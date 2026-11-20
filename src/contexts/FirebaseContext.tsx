import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  DEFAULT_UNIT_SETTINGS,
  SCHEMA_LIMITS,
  UNIT_SCOPE,
  sanitizeStr,
  type ActivityReportForm,
  type ActivityReportRecord,
  type UnitSettingsForm,
  type UnitSettingsRecord,
  type UserProfileRecord,
} from '../types/report';

export interface BulkReporterUpdatePayload {
  reporterName: string;
  reporterNip: string;
  signatureMode: 'keep' | 'replace' | 'clear';
  reporterSignature?: string;
}

interface FirebaseContextValue {
  user: User | null;
  authReady: boolean;
  authLoading: boolean;
  authError: string | null;
  reports: ActivityReportRecord[];
  reportsLoading: boolean;
  syncStatus: 'connecting' | 'synced' | 'syncing' | 'error';
  lastSyncedAt: Date | null;
  unitSettings: UnitSettingsForm;
  unitSettingsMeta: Pick<UnitSettingsRecord, 'updatedByName' | 'updatedAt'> | null;
  userProfile: UserProfileRecord | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  createReport: (form: ActivityReportForm) => Promise<string>;
  updateReport: (reportId: string, form: ActivityReportForm) => Promise<void>;
  bulkUpdateReporter: (
    reportIds: string[],
    payload: BulkReporterUpdatePayload
  ) => Promise<number>;
  deleteReport: (reportId: string) => Promise<void>;
  saveUnitSettings: (settings: UnitSettingsForm) => Promise<void>;
  saveUserProfile: (profile: {
    defaultReporterName: string;
    defaultReporterNip: string;
    defaultReporterSignature: string;
  }) => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

function generateSafeReportId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `rep-${ts}-${rand}`;
}

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [reports, setReports] = useState<ActivityReportRecord[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<'connecting' | 'synced' | 'syncing' | 'error'>(
    'connecting'
  );
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const [unitSettings, setUnitSettings] = useState<UnitSettingsForm>(DEFAULT_UNIT_SETTINGS);
  const [unitSettingsMeta, setUnitSettingsMeta] = useState<Pick<
    UnitSettingsRecord,
    'updatedByName' | 'updatedAt'
  > | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfileRecord | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (!nextUser) {
        setReports([]);
        setReportsLoading(false);
        setUserProfile(null);
        setSyncStatus('connecting');
      }
    });
    return () => unsubscribe();
  }, []);

  // Real-time Firestore listeners — only attached when auth is ready and user is authenticated
  useEffect(() => {
    if (!authReady || !user) return;

    setReportsLoading(true);
    setSyncStatus('connecting');

    // 1. Shared Reports real-time listener (single equality where avoids composite index requirement)
    const reportsPath = 'reports';
    const reportsQuery = query(
      collection(db, reportsPath),
      where('unitScope', '==', UNIT_SCOPE)
    );

    const unsubReports = onSnapshot(
      reportsQuery,
      (snapshot) => {
        const items: ActivityReportRecord[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            unitScope: UNIT_SCOPE,
            headerTitle: String(data.headerTitle ?? DEFAULT_UNIT_SETTINGS.headerTitle),
            headerUnit: String(data.headerUnit ?? DEFAULT_UNIT_SETTINGS.headerUnit),
            headerLocation: String(data.headerLocation ?? DEFAULT_UNIT_SETTINGS.headerLocation),
            reportDateIso: String(data.reportDateIso ?? ''),
            dayDateDisplay: String(data.dayDateDisplay ?? ''),
            place: String(data.place ?? ''),
            activityDescription: String(data.activityDescription ?? ''),
            documentationImage: String(data.documentationImage ?? ''),
            reporterName: String(data.reporterName ?? ''),
            reporterNip: String(data.reporterNip ?? ''),
            reporterSignature: String(data.reporterSignature ?? ''),
            headTitle: String(data.headTitle ?? DEFAULT_UNIT_SETTINGS.defaultHeadTitle),
            headName: String(data.headName ?? ''),
            headNip: String(data.headNip ?? ''),
            headSignature: String(data.headSignature ?? ''),
            createdByUid: String(data.createdByUid ?? ''),
            createdByName: String(data.createdByName ?? ''),
            updatedByUid: String(data.updatedByUid ?? ''),
            updatedByName: String(data.updatedByName ?? ''),
            createdAt: data.createdAt ?? null,
            updatedAt: data.updatedAt ?? null,
          };
        });

        // Client-side sort: newest reportDateIso first, then updatedAt desc
        items.sort((a, b) => {
          const dateDiff = b.reportDateIso.localeCompare(a.reportDateIso);
          if (dateDiff !== 0) return dateDiff;
          const aTime = a.updatedAt?.toMillis?.() ?? 0;
          const bTime = b.updatedAt?.toMillis?.() ?? 0;
          return bTime - aTime;
        });

        setReports(items);
        setReportsLoading(false);
        setSyncStatus('synced');
        setLastSyncedAt(new Date());
      },
      (error) => {
        setSyncStatus('error');
        setReportsLoading(false);
        handleFirestoreError(error, OperationType.LIST, reportsPath);
      }
    );

    // 2. Shared Unit Settings real-time listener
    const settingsPath = `unitSettings/${UNIT_SCOPE}`;
    const unsubSettings = onSnapshot(
      doc(db, 'unitSettings', UNIT_SCOPE),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const presets = Array.isArray(data.placePresets)
            ? data.placePresets.filter((item): item is string => typeof item === 'string')
            : DEFAULT_UNIT_SETTINGS.placePresets;

          setUnitSettings({
            unitScope: UNIT_SCOPE,
            headerTitle: String(data.headerTitle ?? DEFAULT_UNIT_SETTINGS.headerTitle),
            headerUnit: String(data.headerUnit ?? DEFAULT_UNIT_SETTINGS.headerUnit),
            headerLocation: String(data.headerLocation ?? DEFAULT_UNIT_SETTINGS.headerLocation),
            defaultHeadTitle: String(data.defaultHeadTitle ?? DEFAULT_UNIT_SETTINGS.defaultHeadTitle),
            defaultHeadName: String(data.defaultHeadName ?? DEFAULT_UNIT_SETTINGS.defaultHeadName),
            defaultHeadNip: String(data.defaultHeadNip ?? DEFAULT_UNIT_SETTINGS.defaultHeadNip),
            defaultHeadSignature: String(data.defaultHeadSignature ?? ''),
            placePresets: presets.length > 0 ? presets : DEFAULT_UNIT_SETTINGS.placePresets,
          });
          setUnitSettingsMeta({
            updatedByName: String(data.updatedByName ?? ''),
            updatedAt: data.updatedAt ?? null,
          });
        } else {
          setUnitSettings(DEFAULT_UNIT_SETTINGS);
          setUnitSettingsMeta(null);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, settingsPath);
      }
    );

    // 3. Private Officer Profile listener (strictly isolated to owner UID)
    const userPath = `users/${user.uid}`;
    const unsubUser = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setUserProfile({
            uid: String(data.uid ?? user.uid),
            displayName: String(data.displayName ?? user.displayName ?? 'Petugas PKP-PK'),
            email: String(data.email ?? user.email ?? ''),
            defaultReporterName: String(data.defaultReporterName ?? ''),
            defaultReporterNip: String(data.defaultReporterNip ?? ''),
            defaultReporterSignature: String(data.defaultReporterSignature ?? ''),
            updatedAt: data.updatedAt ?? null,
          });
        } else {
          setUserProfile(null);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, userPath);
      }
    );

    return () => {
      unsubReports();
      unsubSettings();
      unsubUser();
    };
  }, [authReady, user]);

  const signInWithGoogle = useCallback(async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Gagal masuk dengan Google.';
      if (!msg.includes('popup-closed-by-user')) {
        setAuthError(msg);
      }
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
  }, []);

  const createReport = useCallback(
    async (form: ActivityReportForm): Promise<string> => {
      if (!user) throw new Error('Anda harus masuk terlebih dahulu.');
      setSyncStatus('syncing');
      const reportId = generateSafeReportId();
      const docPath = `reports/${reportId}`;
      const actorName = sanitizeStr(
        user.displayName || user.email?.split('@')[0] || 'Petugas PKP-PK',
        SCHEMA_LIMITS.displayName
      );

      const payload = {
        unitScope: UNIT_SCOPE,
        headerTitle: sanitizeStr(
          form.headerTitle || DEFAULT_UNIT_SETTINGS.headerTitle,
          SCHEMA_LIMITS.headerTitle
        ),
        headerUnit: sanitizeStr(
          form.headerUnit || DEFAULT_UNIT_SETTINGS.headerUnit,
          SCHEMA_LIMITS.headerUnit
        ),
        headerLocation: sanitizeStr(
          form.headerLocation || DEFAULT_UNIT_SETTINGS.headerLocation,
          SCHEMA_LIMITS.headerLocation
        ),
        reportDateIso: form.reportDateIso,
        dayDateDisplay: sanitizeStr(form.dayDateDisplay, SCHEMA_LIMITS.dayDateDisplay),
        place: sanitizeStr(form.place, SCHEMA_LIMITS.place),
        activityDescription: sanitizeStr(
          form.activityDescription,
          SCHEMA_LIMITS.activityDescription
        ),
        documentationImage: form.documentationImage.slice(0, SCHEMA_LIMITS.documentationImage),
        reporterName: sanitizeStr(form.reporterName, SCHEMA_LIMITS.reporterName),
        reporterNip: sanitizeStr(form.reporterNip, SCHEMA_LIMITS.reporterNip),
        reporterSignature: form.reporterSignature.slice(0, SCHEMA_LIMITS.reporterSignature),
        headTitle: sanitizeStr(
          form.headTitle || DEFAULT_UNIT_SETTINGS.defaultHeadTitle,
          SCHEMA_LIMITS.headTitle
        ),
        headName: sanitizeStr(form.headName, SCHEMA_LIMITS.headName),
        headNip: sanitizeStr(form.headNip, SCHEMA_LIMITS.headNip),
        headSignature: form.headSignature.slice(0, SCHEMA_LIMITS.headSignature),
        createdByUid: user.uid,
        createdByName: actorName,
        updatedByUid: user.uid,
        updatedByName: actorName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      try {
        await setDoc(doc(db, 'reports', reportId), payload);
        setSyncStatus('synced');
        setLastSyncedAt(new Date());
        return reportId;
      } catch (error) {
        setSyncStatus('error');
        handleFirestoreError(error, OperationType.CREATE, docPath);
      }
    },
    [user]
  );

  const updateReport = useCallback(
    async (reportId: string, form: ActivityReportForm): Promise<void> => {
      if (!user) throw new Error('Anda harus masuk terlebih dahulu.');
      setSyncStatus('syncing');
      const docPath = `reports/${reportId}`;
      const actorName = sanitizeStr(
        user.displayName || user.email?.split('@')[0] || 'Petugas PKP-PK',
        SCHEMA_LIMITS.displayName
      );

      const payload = {
        headerTitle: sanitizeStr(
          form.headerTitle || DEFAULT_UNIT_SETTINGS.headerTitle,
          SCHEMA_LIMITS.headerTitle
        ),
        headerUnit: sanitizeStr(
          form.headerUnit || DEFAULT_UNIT_SETTINGS.headerUnit,
          SCHEMA_LIMITS.headerUnit
        ),
        headerLocation: sanitizeStr(
          form.headerLocation || DEFAULT_UNIT_SETTINGS.headerLocation,
          SCHEMA_LIMITS.headerLocation
        ),
        reportDateIso: form.reportDateIso,
        dayDateDisplay: sanitizeStr(form.dayDateDisplay, SCHEMA_LIMITS.dayDateDisplay),
        place: sanitizeStr(form.place, SCHEMA_LIMITS.place),
        activityDescription: sanitizeStr(
          form.activityDescription,
          SCHEMA_LIMITS.activityDescription
        ),
        documentationImage: form.documentationImage.slice(0, SCHEMA_LIMITS.documentationImage),
        reporterName: sanitizeStr(form.reporterName, SCHEMA_LIMITS.reporterName),
        reporterNip: sanitizeStr(form.reporterNip, SCHEMA_LIMITS.reporterNip),
        reporterSignature: form.reporterSignature.slice(0, SCHEMA_LIMITS.reporterSignature),
        headTitle: sanitizeStr(
          form.headTitle || DEFAULT_UNIT_SETTINGS.defaultHeadTitle,
          SCHEMA_LIMITS.headTitle
        ),
        headName: sanitizeStr(form.headName, SCHEMA_LIMITS.headName),
        headNip: sanitizeStr(form.headNip, SCHEMA_LIMITS.headNip),
        headSignature: form.headSignature.slice(0, SCHEMA_LIMITS.headSignature),
        updatedByUid: user.uid,
        updatedByName: actorName,
        updatedAt: serverTimestamp(),
      };

      try {
        await updateDoc(doc(db, 'reports', reportId), payload);
        setSyncStatus('synced');
        setLastSyncedAt(new Date());
      } catch (error) {
        setSyncStatus('error');
        handleFirestoreError(error, OperationType.UPDATE, docPath);
      }
    },
    [user]
  );

  const bulkUpdateReporter = useCallback(
    async (
      reportIds: string[],
      input: BulkReporterUpdatePayload
    ): Promise<number> => {
      if (!user) throw new Error('Anda harus masuk terlebih dahulu.');

      const uniqueIds = Array.from(new Set(reportIds.filter((id) => id.trim().length > 0)));
      if (uniqueIds.length === 0) return 0;

      const cleanedName = sanitizeStr(input.reporterName, SCHEMA_LIMITS.reporterName);
      if (!cleanedName) {
        throw new Error('Nama pembuat laporan wajib diisi.');
      }
      const cleanedNip = sanitizeStr(input.reporterNip, SCHEMA_LIMITS.reporterNip);

      if (input.signatureMode === 'replace') {
        const sigLen = (input.reporterSignature ?? '').length;
        if (sigLen === 0) {
          throw new Error('Pilih atau gambar tanda tangan baru terlebih dahulu.');
        }
        if (sigLen > SCHEMA_LIMITS.reporterSignature) {
          throw new Error('Ukuran gambar tanda tangan melebihi batas maksimum database.');
        }
      }

      const actorName = sanitizeStr(
        user.displayName || user.email?.split('@')[0] || 'Petugas PKP-PK',
        SCHEMA_LIMITS.displayName
      );

      // Strictly matches Action 2 whitelisted keys in firestore.rules
      const updateFields: Record<string, unknown> = {
        reporterName: cleanedName,
        reporterNip: cleanedNip,
        updatedByUid: user.uid,
        updatedByName: actorName,
        updatedAt: serverTimestamp(),
      };

      if (input.signatureMode === 'replace') {
        updateFields.reporterSignature = (input.reporterSignature ?? '').slice(
          0,
          SCHEMA_LIMITS.reporterSignature
        );
      } else if (input.signatureMode === 'clear') {
        updateFields.reporterSignature = '';
      }

      setSyncStatus('syncing');
      const BATCH_LIMIT = 450;

      try {
        for (let i = 0; i < uniqueIds.length; i += BATCH_LIMIT) {
          const chunk = uniqueIds.slice(i, i + BATCH_LIMIT);
          const batch = writeBatch(db);
          for (const reportId of chunk) {
            batch.update(doc(db, 'reports', reportId), updateFields);
          }
          await batch.commit();
        }
        setSyncStatus('synced');
        setLastSyncedAt(new Date());
        return uniqueIds.length;
      } catch (error) {
        setSyncStatus('error');
        handleFirestoreError(error, OperationType.UPDATE, 'reports');
      }
    },
    [user]
  );

  const deleteReport = useCallback(
    async (reportId: string): Promise<void> => {
      if (!user) throw new Error('Anda harus masuk terlebih dahulu.');
      const docPath = `reports/${reportId}`;
      try {
        await deleteDoc(doc(db, 'reports', reportId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, docPath);
      }
    },
    [user]
  );

  const saveUnitSettings = useCallback(
    async (settings: UnitSettingsForm): Promise<void> => {
      if (!user) throw new Error('Anda harus masuk terlebih dahulu.');
      const docPath = `unitSettings/${UNIT_SCOPE}`;
      const actorName = sanitizeStr(
        user.displayName || user.email?.split('@')[0] || 'Petugas PKP-PK',
        SCHEMA_LIMITS.displayName
      );

      const cleanedPresets = settings.placePresets
        .map((p) => sanitizeStr(p, SCHEMA_LIMITS.placePresetItemMax))
        .filter((p) => p.length > 0)
        .slice(0, SCHEMA_LIMITS.placePresetsMax);

      const payload = {
        unitScope: UNIT_SCOPE,
        headerTitle: sanitizeStr(
          settings.headerTitle || DEFAULT_UNIT_SETTINGS.headerTitle,
          SCHEMA_LIMITS.headerTitle
        ),
        headerUnit: sanitizeStr(
          settings.headerUnit || DEFAULT_UNIT_SETTINGS.headerUnit,
          SCHEMA_LIMITS.headerUnit
        ),
        headerLocation: sanitizeStr(
          settings.headerLocation || DEFAULT_UNIT_SETTINGS.headerLocation,
          SCHEMA_LIMITS.headerLocation
        ),
        defaultHeadTitle: sanitizeStr(
          settings.defaultHeadTitle || DEFAULT_UNIT_SETTINGS.defaultHeadTitle,
          SCHEMA_LIMITS.headTitle
        ),
        defaultHeadName: sanitizeStr(
          settings.defaultHeadName || DEFAULT_UNIT_SETTINGS.defaultHeadName,
          SCHEMA_LIMITS.headName
        ),
        defaultHeadNip: sanitizeStr(settings.defaultHeadNip, SCHEMA_LIMITS.headNip),
        defaultHeadSignature: settings.defaultHeadSignature.slice(0, SCHEMA_LIMITS.headSignature),
        placePresets: cleanedPresets,
        updatedByUid: user.uid,
        updatedByName: actorName,
        updatedAt: serverTimestamp(),
      };

      try {
        await setDoc(doc(db, 'unitSettings', UNIT_SCOPE), payload);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, docPath);
      }
    },
    [user]
  );

  const saveUserProfile = useCallback(
    async (profile: {
      defaultReporterName: string;
      defaultReporterNip: string;
      defaultReporterSignature: string;
    }): Promise<void> => {
      if (!user) throw new Error('Anda harus masuk terlebih dahulu.');
      const docPath = `users/${user.uid}`;
      const displayName = sanitizeStr(
        user.displayName || user.email?.split('@')[0] || 'Petugas PKP-PK',
        SCHEMA_LIMITS.displayName
      );
      const email = sanitizeStr(user.email || '', SCHEMA_LIMITS.email);

      const payload = {
        uid: user.uid,
        displayName,
        email,
        defaultReporterName: sanitizeStr(profile.defaultReporterName, SCHEMA_LIMITS.reporterName),
        defaultReporterNip: sanitizeStr(profile.defaultReporterNip, SCHEMA_LIMITS.reporterNip),
        defaultReporterSignature: profile.defaultReporterSignature.slice(
          0,
          SCHEMA_LIMITS.reporterSignature
        ),
        updatedAt: serverTimestamp(),
      };

      try {
        await setDoc(doc(db, 'users', user.uid), payload);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, docPath);
      }
    },
    [user]
  );

  const value = useMemo<FirebaseContextValue>(
    () => ({
      user,
      authReady,
      authLoading,
      authError,
      reports,
      reportsLoading,
      syncStatus,
      lastSyncedAt,
      unitSettings,
      unitSettingsMeta,
      userProfile,
      signInWithGoogle,
      signOut,
      createReport,
      updateReport,
      bulkUpdateReporter,
      deleteReport,
      saveUnitSettings,
      saveUserProfile,
    }),
    [
      user,
      authReady,
      authLoading,
      authError,
      reports,
      reportsLoading,
      syncStatus,
      lastSyncedAt,
      unitSettings,
      unitSettingsMeta,
      userProfile,
      signInWithGoogle,
      signOut,
      createReport,
      updateReport,
      bulkUpdateReporter,
      deleteReport,
      saveUnitSettings,
      saveUserProfile,
    ]
  );

  return <FirebaseContext.Provider value={value}>{children}</FirebaseContext.Provider>;
}

export function useFirebase(): FirebaseContextValue {
  const ctx = useContext(FirebaseContext);
  if (!ctx) throw new Error('useFirebase harus digunakan di dalam FirebaseProvider.');
  return ctx;
}
