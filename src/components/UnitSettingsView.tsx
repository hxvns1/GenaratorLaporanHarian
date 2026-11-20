import React, { useEffect, useRef, useState } from 'react';
import { PenTool, Plus, RotateCcw, Save, Trash2, Upload, X } from 'lucide-react';
import { useFirebase } from '../contexts/FirebaseContext';
import { formatFileSizeKb, formatTimestampShort } from '../lib/dateUtils';
import {
  DOCUMENT_FONT_STACK,
  getCustomFontsStatus,
  removeCustomFontWeight,
  resetAllCustomFonts,
  saveCustomFontFile,
  type CustomFontsStatus,
  type FontWeightSlot,
} from '../lib/fontRegistry';
import { SCHEMA_LIMITS, type UnitSettingsForm } from '../types/report';
import { SignatureModal } from './SignatureModal';

interface UnitSettingsViewProps {
  onNotify: (message: string, variant?: 'success' | 'error') => void;
}

export const UnitSettingsView: React.FC<UnitSettingsViewProps> = ({ onNotify }) => {
  const {
    user,
    unitSettings,
    unitSettingsMeta,
    userProfile,
    saveUnitSettings,
    saveUserProfile,
  } = useFirebase();

  const [unitForm, setUnitForm] = useState<UnitSettingsForm>(unitSettings);
  const [newPreset, setNewPreset] = useState('');
  const [savingUnit, setSavingUnit] = useState(false);

  const [profileName, setProfileName] = useState('');
  const [profileNip, setProfileNip] = useState('');
  const [profileSignature, setProfileSignature] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [sigModalTarget, setSigModalTarget] = useState<'unitHead' | 'myProfile' | null>(null);

  // Custom Tahoma TTF font state (stored locally in IndexedDB)
  const [fontsStatus, setFontsStatus] = useState<CustomFontsStatus>({
    regular: null,
    bold: null,
  });
  const [uploadingFont, setUploadingFont] = useState<FontWeightSlot | null>(null);
  const [fontError, setFontError] = useState<string | null>(null);
  const regularFontInputRef = useRef<HTMLInputElement | null>(null);
  const boldFontInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setUnitForm(unitSettings);
  }, [unitSettings]);

  useEffect(() => {
    setProfileName(userProfile?.defaultReporterName || user?.displayName || '');
    setProfileNip(userProfile?.defaultReporterNip || '');
    setProfileSignature(userProfile?.defaultReporterSignature || '');
  }, [userProfile, user]);

  useEffect(() => {
    void getCustomFontsStatus().then(setFontsStatus);
  }, []);

  const handleUploadFont = async (weight: FontWeightSlot, file: File | null) => {
    if (!file) return;
    setFontError(null);
    setUploadingFont(weight);
    try {
      const meta = await saveCustomFontFile(weight, file);
      setFontsStatus((prev) => ({ ...prev, [weight]: meta }));
      onNotify(
        `Font ${weight === 'regular' ? 'Tahoma Regular' : 'Tahoma Bold'} (${meta.fileName}) berhasil dipasang untuk Pratinjau, Cetak A4, dan PDF.`
      );
    } catch (err) {
      setFontError(err instanceof Error ? err.message : 'Gagal memasang berkas font.');
    } finally {
      setUploadingFont(null);
      if (weight === 'regular' && regularFontInputRef.current) {
        regularFontInputRef.current.value = '';
      }
      if (weight === 'bold' && boldFontInputRef.current) {
        boldFontInputRef.current.value = '';
      }
    }
  };

  const handleRemoveFontWeight = async (weight: FontWeightSlot) => {
    setFontError(null);
    try {
      await removeCustomFontWeight(weight);
      setFontsStatus((prev) => ({ ...prev, [weight]: null }));
      onNotify(
        `Berkas ${weight === 'regular' ? 'Tahoma Regular' : 'Tahoma Bold'} dihapus. Kembali ke font bawaan.`
      );
    } catch {
      setFontError('Gagal menghapus berkas font dari penyimpanan lokal.');
    }
  };

  const handleResetAllFonts = async () => {
    setFontError(null);
    try {
      await resetAllCustomFonts();
      setFontsStatus({ regular: null, bold: null });
      onNotify('Font dokumen dikembalikan ke font vektor mirip Tahoma bawaan.');
    } catch {
      setFontError('Gagal mereset pengaturan font.');
    }
  };

  const handleAddPreset = () => {
    const cleaned = newPreset.trim().slice(0, SCHEMA_LIMITS.placePresetItemMax);
    if (!cleaned) return;
    if (unitForm.placePresets.includes(cleaned)) {
      setNewPreset('');
      return;
    }
    if (unitForm.placePresets.length >= SCHEMA_LIMITS.placePresetsMax) {
      onNotify(`Maksimal ${SCHEMA_LIMITS.placePresetsMax} preset lokasi.`, 'error');
      return;
    }
    setUnitForm((prev) => ({
      ...prev,
      placePresets: [...prev.placePresets, cleaned],
    }));
    setNewPreset('');
  };

  const handleRemovePreset = (preset: string) => {
    setUnitForm((prev) => ({
      ...prev,
      placePresets: prev.placePresets.filter((item) => item !== preset),
    }));
  };

  const handleSaveUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingUnit(true);
    try {
      await saveUnitSettings(unitForm);
      onNotify('Pengaturan bawaan Unit PKP-PK berhasil disinkronkan.');
    } catch {
      onNotify('Gagal menyimpan pengaturan unit.', 'error');
    } finally {
      setSavingUnit(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await saveUserProfile({
        defaultReporterName: profileName,
        defaultReporterNip: profileNip,
        defaultReporterSignature: profileSignature,
      });
      onNotify('Profil petugas pribadi berhasil disimpan.');
    } catch {
      onNotify('Gagal menyimpan profil petugas.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const hasAnyCustomFont = Boolean(fontsStatus.regular || fontsStatus.bold);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Shared Unit Defaults */}
        <form
          onSubmit={(e) => void handleSaveUnit(e)}
          className="lg:col-span-7 bg-white border border-slate-200 rounded-lg divide-y divide-slate-200"
        >
          <div className="px-6 py-4">
            <h2 className="text-base font-bold text-slate-900">
              Pengaturan Bawaan Unit PKP-PK (Bersama)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Nilai ini otomatis mengisi kop dan data Kepala Unit setiap kali petugas membuat
              laporan baru.
              {unitSettingsMeta?.updatedAt
                ? ` Terakhir diperbarui ${formatTimestampShort(unitSettingsMeta.updatedAt)} oleh ${unitSettingsMeta.updatedByName}.`
                : ''}
            </p>
          </div>

          <div className="p-6 space-y-4">
            <div className="text-xs font-semibold text-slate-800">Kop Dokumen Resmi</div>
            <div className="grid grid-cols-1 gap-3">
              <label className="block space-y-1">
                <span className="text-xs text-slate-600">Baris 1 (Judul)</span>
                <input
                  type="text"
                  required
                  maxLength={SCHEMA_LIMITS.headerTitle}
                  value={unitForm.headerTitle}
                  onChange={(e) =>
                    setUnitForm((prev) => ({ ...prev, headerTitle: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-slate-400"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-slate-600">Baris 2 (Unit)</span>
                <input
                  type="text"
                  required
                  maxLength={SCHEMA_LIMITS.headerUnit}
                  value={unitForm.headerUnit}
                  onChange={(e) =>
                    setUnitForm((prev) => ({ ...prev, headerUnit: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-slate-400"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-slate-600">Baris 3 (UPBU / Lokasi)</span>
                <input
                  type="text"
                  required
                  maxLength={SCHEMA_LIMITS.headerLocation}
                  value={unitForm.headerLocation}
                  onChange={(e) =>
                    setUnitForm((prev) => ({ ...prev, headerLocation: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-slate-400"
                />
              </label>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div className="text-xs font-semibold text-slate-800">
              Default Pengetahui (Kepala Unit PKP-PK)
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block space-y-1 sm:col-span-2">
                <span className="text-xs text-slate-600">Jabatan</span>
                <input
                  type="text"
                  required
                  maxLength={SCHEMA_LIMITS.headTitle}
                  value={unitForm.defaultHeadTitle}
                  onChange={(e) =>
                    setUnitForm((prev) => ({ ...prev, defaultHeadTitle: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-slate-400"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs text-slate-600">Nama Lengkap</span>
                <input
                  type="text"
                  required
                  maxLength={SCHEMA_LIMITS.headName}
                  value={unitForm.defaultHeadName}
                  onChange={(e) =>
                    setUnitForm((prev) => ({ ...prev, defaultHeadName: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-slate-400"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs text-slate-600">NIP</span>
                <input
                  type="text"
                  maxLength={SCHEMA_LIMITS.headNip}
                  value={unitForm.defaultHeadNip}
                  onChange={(e) =>
                    setUnitForm((prev) => ({ ...prev, defaultHeadNip: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-200 rounded-md focus:outline-none focus:border-slate-400"
                />
              </label>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              {unitForm.defaultHeadSignature ? (
                <img
                  src={unitForm.defaultHeadSignature}
                  alt="Tanda tangan default Kepala Unit"
                  referrerPolicy="no-referrer"
                  className="h-10 max-w-[120px] object-contain border border-slate-200 rounded px-2 py-0.5 bg-white"
                />
              ) : (
                <span className="text-xs text-slate-400">
                  Belum ada tanda tangan default Kepala Unit
                </span>
              )}
              <button
                type="button"
                onClick={() => setSigModalTarget('unitHead')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
              >
                <PenTool className="w-3.5 h-3.5" />
                Atur Tanda Tangan
              </button>
            </div>
          </div>

          <div className="p-6 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800">
                Pilihan Cepat Lokasi Kegiatan
              </span>
              <span className="text-xs text-slate-400 font-mono tabular-nums">
                {unitForm.placePresets.length}/{SCHEMA_LIMITS.placePresetsMax}
              </span>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                maxLength={SCHEMA_LIMITS.placePresetItemMax}
                value={newPreset}
                onChange={(e) => setNewPreset(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddPreset();
                  }
                }}
                placeholder="Tambah lokasi (misal: Pos Watchroom)"
                className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-slate-400"
              />
              <button
                type="button"
                onClick={handleAddPreset}
                className="inline-flex items-center gap-1 px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah
              </button>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {unitForm.placePresets.map((preset) => (
                <div
                  key={preset}
                  className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded text-slate-700"
                >
                  <span>{preset}</span>
                  <button
                    type="button"
                    onClick={() => handleRemovePreset(preset)}
                    aria-label={`Hapus lokasi ${preset}`}
                    className="p-0.5 text-slate-400 hover:text-red-700 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="px-6 py-4 bg-slate-50/70 flex justify-end">
            <button
              type="submit"
              disabled={savingUnit}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 disabled:opacity-50 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              {savingUnit ? 'Menyimpan...' : 'Simpan Pengaturan Unit'}
            </button>
          </div>
        </form>

        {/* Right Column: Personal Profile + Tahoma PDF Font Panel */}
        <div className="lg:col-span-5 space-y-6">
          {/* Personal Officer Profile (Private PII Isolated) */}
          <form
            onSubmit={(e) => void handleSaveProfile(e)}
            className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-200"
          >
            <div className="px-6 py-4">
              <h2 className="text-base font-bold text-slate-900">Profil Petugas Saya</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Tersimpan privat khusus untuk akun Anda guna mengisi otomatis kolom Yang Membuat
                Laporan.
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div className="text-xs text-slate-500">
                Akun terhubung: <span className="font-medium text-slate-800">{user?.email}</span>
              </div>

              <label className="block space-y-1">
                <span className="text-xs text-slate-600">Nama Resmi pada Laporan</span>
                <input
                  type="text"
                  maxLength={SCHEMA_LIMITS.reporterName}
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="FATRINAH"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-slate-400"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs text-slate-600">NIP Petugas</span>
                <input
                  type="text"
                  maxLength={SCHEMA_LIMITS.reporterNip}
                  value={profileNip}
                  onChange={(e) => setProfileNip(e.target.value)}
                  placeholder="199008202025212032"
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-200 rounded-md focus:outline-none focus:border-slate-400"
                />
              </label>

              <div className="space-y-2 pt-1">
                <span className="block text-xs text-slate-600">Tanda Tangan Pribadi Default</span>
                <div className="flex items-center justify-between gap-3">
                  {profileSignature ? (
                    <img
                      src={profileSignature}
                      alt="Tanda tangan pribadi"
                      referrerPolicy="no-referrer"
                      className="h-10 max-w-[120px] object-contain border border-slate-200 rounded px-2 py-0.5 bg-white"
                    />
                  ) : (
                    <span className="text-xs text-slate-400">Belum diatur</span>
                  )}
                  <button
                    type="button"
                    onClick={() => setSigModalTarget('myProfile')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <PenTool className="w-3.5 h-3.5" />
                    Atur Tanda Tangan
                  </button>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50/70 flex justify-end">
              <button
                type="submit"
                disabled={savingProfile}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                {savingProfile ? 'Menyimpan...' : 'Simpan Profil Saya'}
              </button>
            </div>
          </form>

          {/* Document Output Font Panel (Tahoma & Custom tahoma.ttf) */}
          <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-200">
            <div className="px-6 py-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Font Output Dokumen (Tahoma)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Berlaku untuk Pratinjau A4, Cetak A4, serta Simpan PDF satuan dan gabungan.
                </p>
              </div>
              {hasAnyCustomFont ? (
                <button
                  type="button"
                  onClick={() => void handleResetAllFonts()}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-red-700 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset
                </button>
              ) : null}
            </div>

            <div className="p-6 space-y-4">
              <div className="text-xs text-slate-600 flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-900">Status Aktif:</span>
                <span className={hasAnyCustomFont ? 'text-emerald-700 font-medium' : 'text-slate-700'}>
                  {hasAnyCustomFont
                    ? 'Tahoma Kustom Terpasang (Lokal)'
                    : 'Font Vektor Mirip Tahoma (Bawaan) + Tahoma Sistem'}
                </span>
              </div>

              <input
                ref={regularFontInputRef}
                type="file"
                accept=".ttf,.otf"
                className="hidden"
                onChange={(e) =>
                  void handleUploadFont('regular', e.target.files?.[0] ?? null)
                }
              />
              <input
                ref={boldFontInputRef}
                type="file"
                accept=".ttf,.otf"
                className="hidden"
                onChange={(e) =>
                  void handleUploadFont('bold', e.target.files?.[0] ?? null)
                }
              />

              {/* Regular Slot */}
              <div className="flex items-center justify-between gap-3 py-2 border-t border-slate-100">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-800">
                    Tahoma Regular (tahoma.ttf)
                  </div>
                  <div className="text-xs text-slate-500 font-mono tabular-nums truncate mt-0.5">
                    {fontsStatus.regular
                      ? `${fontsStatus.regular.fileName} · ${formatFileSizeKb(fontsStatus.regular.sizeBytes)}`
                      : 'Menggunakan font vektor bawaan'}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={uploadingFont !== null}
                    onClick={() => regularFontInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md whitespace-nowrap cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {uploadingFont === 'regular'
                      ? 'Memasang...'
                      : fontsStatus.regular
                        ? 'Ganti'
                        : 'Unggah .ttf'}
                  </button>
                  {fontsStatus.regular ? (
                    <button
                      type="button"
                      onClick={() => void handleRemoveFontWeight('regular')}
                      aria-label="Hapus font Tahoma Regular"
                      className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Bold Slot */}
              <div className="flex items-center justify-between gap-3 py-2 border-t border-slate-100">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-800">
                    Tahoma Bold (tahomabd.ttf)
                  </div>
                  <div className="text-xs text-slate-500 font-mono tabular-nums truncate mt-0.5">
                    {fontsStatus.bold
                      ? `${fontsStatus.bold.fileName} · ${formatFileSizeKb(fontsStatus.bold.sizeBytes)}`
                      : 'Menggunakan font vektor bold bawaan'}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={uploadingFont !== null}
                    onClick={() => boldFontInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md whitespace-nowrap cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {uploadingFont === 'bold'
                      ? 'Memasang...'
                      : fontsStatus.bold
                        ? 'Ganti'
                        : 'Unggah .ttf'}
                  </button>
                  {fontsStatus.bold ? (
                    <button
                      type="button"
                      onClick={() => void handleRemoveFontWeight('bold')}
                      aria-label="Hapus font Tahoma Bold"
                      className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  ) : null}
                </div>
              </div>

              {fontError ? (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {fontError}
                </div>
              ) : null}

              {/* Live Typography Preview */}
              <div
                className="bg-slate-50 border border-slate-200 rounded-md p-3.5 space-y-1 text-slate-900"
                style={{ fontFamily: DOCUMENT_FONT_STACK }}
              >
                <div className="text-xs font-bold uppercase tracking-wide">
                  LAPORAN KEGIATAN · UNIT PKP-PK
                </div>
                <div className="text-xs">
                  Selasa 20 Oktober 2026 — Pembersihan fire station · NIP. 199008202025212032
                </div>
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed">
                Opsional: Untuk 100% Microsoft Tahoma asli di berkas Simpan PDF, unggah{' '}
                <span className="font-mono text-slate-700">tahoma.ttf</span> dan{' '}
                <span className="font-mono text-slate-700">tahomabd.ttf</span> dari folder{' '}
                <span className="font-mono text-slate-700">C:\Windows\Fonts</span>. Berkas
                disimpan lokal di peramban ini.
              </p>
            </div>
          </div>
        </div>
      </div>

      <SignatureModal
        isOpen={sigModalTarget !== null}
        title={
          sigModalTarget === 'unitHead'
            ? 'Tanda Tangan Default — Kepala Unit PKP-PK'
            : 'Tanda Tangan Default — Profil Petugas Saya'
        }
        signerName={
          sigModalTarget === 'unitHead' ? unitForm.defaultHeadName : profileName
        }
        currentSignature={
          sigModalTarget === 'unitHead' ? unitForm.defaultHeadSignature : profileSignature
        }
        onSave={(dataUrl) => {
          if (sigModalTarget === 'unitHead') {
            setUnitForm((prev) => ({ ...prev, defaultHeadSignature: dataUrl }));
          } else if (sigModalTarget === 'myProfile') {
            setProfileSignature(dataUrl);
          }
        }}
        onClose={() => setSigModalTarget(null)}
      />
    </div>
  );
};
