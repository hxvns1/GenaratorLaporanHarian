import type { Timestamp } from 'firebase/firestore';

export const UNIT_SCOPE = 'pkp-pk-tanjung-api' as const;

export const SCHEMA_LIMITS = {
  headerTitle: 120,
  headerUnit: 120,
  headerLocation: 160,
  dayDateDisplay: 80,
  place: 160,
  activityDescription: 2000,
  documentationImage: 600000,
  reporterName: 120,
  reporterNip: 60,
  reporterSignature: 100000,
  headTitle: 120,
  headName: 120,
  headNip: 60,
  headSignature: 100000,
  displayName: 120,
  email: 254,
  placePresetsMax: 15,
  placePresetItemMax: 80,
} as const;

export const DEFAULT_UNIT_SETTINGS: UnitSettingsForm = {
  unitScope: UNIT_SCOPE,
  headerTitle: 'LAPORAN KEGIATAN',
  headerUnit: 'UNIT PKP-PK',
  headerLocation: 'UPBU KELAS III TANJUNG API',
  defaultHeadTitle: 'KEPALA UNIT PKP-PK',
  defaultHeadName: 'MOH. IQRAM',
  defaultHeadNip: '198302102008011005',
  defaultHeadSignature: '',
  placePresets: [
    'Fire Station',
    'Apron Bandara',
    'Runway & Taxiway',
    'Garasi Kendaraan PKP-PK',
    'Pos Jaga PKP-PK',
    'Area Terminal',
  ],
};

export interface ActivityReportForm {
  headerTitle: string;
  headerUnit: string;
  headerLocation: string;
  reportDateIso: string;
  dayDateDisplay: string;
  place: string;
  activityDescription: string;
  documentationImage: string;
  reporterName: string;
  reporterNip: string;
  reporterSignature: string;
  headTitle: string;
  headName: string;
  headNip: string;
  headSignature: string;
}

export interface ActivityReportRecord extends ActivityReportForm {
  id: string;
  unitScope: typeof UNIT_SCOPE;
  createdByUid: string;
  createdByName: string;
  updatedByUid: string;
  updatedByName: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface UnitSettingsForm {
  unitScope: typeof UNIT_SCOPE;
  headerTitle: string;
  headerUnit: string;
  headerLocation: string;
  defaultHeadTitle: string;
  defaultHeadName: string;
  defaultHeadNip: string;
  defaultHeadSignature: string;
  placePresets: string[];
}

export interface UnitSettingsRecord extends UnitSettingsForm {
  updatedByUid: string;
  updatedByName: string;
  updatedAt: Timestamp | null;
}

export interface UserProfileRecord {
  uid: string;
  displayName: string;
  email: string;
  defaultReporterName: string;
  defaultReporterNip: string;
  defaultReporterSignature: string;
  updatedAt: Timestamp | null;
}

export function sanitizeStr(value: string, maxLen: number): string {
  return value.trim().slice(0, maxLen);
}

export function validateReportForm(form: ActivityReportForm): string[] {
  const errors: string[] = [];
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(form.reportDateIso)) {
    errors.push('Tanggal kegiatan harus valid (YYYY-MM-DD).');
  }
  if (!form.dayDateDisplay.trim()) {
    errors.push('Kolom Hari / Tanggal wajib diisi.');
  }
  if (!form.place.trim()) {
    errors.push('Kolom Tempat wajib diisi.');
  }
  if (!form.activityDescription.trim()) {
    errors.push('Kolom Uraian Kegiatan wajib diisi.');
  }
  if (!form.reporterName.trim()) {
    errors.push('Nama Yang Membuat Laporan wajib diisi.');
  }
  if (!form.headName.trim()) {
    errors.push('Nama Kepala Unit PKP-PK wajib diisi.');
  }
  if (form.documentationImage.length > SCHEMA_LIMITS.documentationImage) {
    errors.push('Ukuran gambar kolase melebihi batas maksimum database.');
  }
  if (form.reporterSignature.length > SCHEMA_LIMITS.reporterSignature) {
    errors.push('Ukuran tanda tangan pembuat laporan terlalu besar.');
  }
  if (form.headSignature.length > SCHEMA_LIMITS.headSignature) {
    errors.push('Ukuran tanda tangan Kepala Unit terlalu besar.');
  }
  return errors;
}
