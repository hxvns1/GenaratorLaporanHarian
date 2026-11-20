import React, { useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Eye,
  FileDown,
  FileEdit,
  ImagePlus,
  PenTool,
  Printer,
  Save,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { useFirebase } from '../contexts/FirebaseContext';
import { formatFileSizeKb, formatIndonesianDayDate } from '../lib/dateUtils';
import { compressCollageImage } from '../lib/imageUtils';
import {
  SCHEMA_LIMITS,
  validateReportForm,
  type ActivityReportForm,
} from '../types/report';
import { OfficialReportSheet } from './OfficialReportSheet';
import { SignatureModal } from './SignatureModal';

interface ReportEditorViewProps {
  editingId: string | null;
  form: ActivityReportForm;
  hasUnsavedChanges: boolean;
  onChangeForm: (updater: (prev: ActivityReportForm) => ActivityReportForm) => void;
  onSave: () => Promise<void>;
  onPrint: () => void;
  onExportPdf: () => Promise<void>;
  onBackToArchive: () => void;
}

export const ReportEditorView: React.FC<ReportEditorViewProps> = ({
  editingId,
  form,
  hasUnsavedChanges,
  onChangeForm,
  onSave,
  onPrint,
  onExportPdf,
  onBackToArchive,
}) => {
  const { unitSettings, userProfile } = useFirebase();
  const [mobileTab, setMobileTab] = useState<'form' | 'preview'>('form');
  const [showHeaderEdit, setShowHeaderEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Collage upload state
  const [compressing, setCompressing] = useState(false);
  const [compressionInfo, setCompressionInfo] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const collageInputRef = useRef<HTMLInputElement | null>(null);

  // Signature modal state
  const [sigTarget, setSigTarget] = useState<'reporter' | 'head' | null>(null);

  const handleDateChange = (iso: string) => {
    const formatted = formatIndonesianDayDate(iso);
    onChangeForm((prev) => ({
      ...prev,
      reportDateIso: iso,
      dayDateDisplay: formatted,
    }));
  };

  const handleCollageFile = async (file: File | null) => {
    if (!file) return;
    setUploadError(null);
    setCompressing(true);
    try {
      const result = await compressCollageImage(file);
      onChangeForm((prev) => ({
        ...prev,
        documentationImage: result.dataUrl,
      }));
      setCompressionInfo(
        `${result.width}×${result.height}px · ${formatFileSizeKb(result.originalBytes)} → ${formatFileSizeKb(result.compressedBytes)}`
      );
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Gagal memproses gambar kolase.');
    } finally {
      setCompressing(false);
      if (collageInputRef.current) {
        collageInputRef.current.value = '';
      }
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0] ?? null;
    void handleCollageFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validateReportForm(form);
    setValidationErrors(errs);
    if (errs.length > 0) return;

    setSaving(true);
    try {
      await onSave();
    } finally {
      setSaving(false);
    }
  };

  const handlePdfClick = async () => {
    setExportingPdf(true);
    try {
      await onExportPdf();
    } finally {
      setExportingPdf(false);
    }
  };

  const applyMyProfileDefaults = () => {
    if (!userProfile) return;
    onChangeForm((prev) => ({
      ...prev,
      reporterName: userProfile.defaultReporterName || prev.reporterName,
      reporterNip: userProfile.defaultReporterNip || prev.reporterNip,
      reporterSignature: userProfile.defaultReporterSignature || prev.reporterSignature,
    }));
  };

  return (
    <div className="space-y-4">
      {/* Mobile / Tablet View Switcher */}
      <div className="flex xl:hidden items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-md">
          <button
            type="button"
            onClick={() => setMobileTab('form')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
              mobileTab === 'form'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileEdit className="w-3.5 h-3.5" />
            Isi Formulir
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('preview')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
              mobileTab === 'preview'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            Pratinjau A4
          </button>
        </div>

        <button
          type="button"
          onClick={onBackToArchive}
          className="text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
        >
          Kembali ke Arsip
        </button>
      </div>

      {/* Main Split Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(440px,46%)_1fr] gap-6 items-start">
        {/* LEFT PANEL: Structured Report Form */}
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className={`bg-white border border-slate-200 rounded-lg divide-y divide-slate-200 ${
            mobileTab === 'preview' ? 'hidden xl:block' : 'block'
          }`}
        >
          {/* Form Header */}
          <div className="px-6 py-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {editingId ? 'Edit Laporan Kegiatan' : 'Buat Laporan Kegiatan Baru'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {hasUnsavedChanges
                  ? 'Ada perubahan yang belum disimpan ke database'
                  : editingId
                    ? 'Tersinkron dengan database real-time'
                    : 'Lengkapi kolom di bawah sesuai formulir resmi'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowHeaderEdit((v) => !v)}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Kop Laporan
              {showHeaderEdit ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {/* Optional Collapsible Kop Header Settings */}
          {showHeaderEdit ? (
            <div className="px-6 py-4 bg-slate-50/70 space-y-3">
              <div className="text-xs font-semibold text-slate-700">
                Kop Dokumen (3 Baris Tengah)
              </div>
              <div className="grid grid-cols-1 gap-2.5">
                <input
                  type="text"
                  maxLength={SCHEMA_LIMITS.headerTitle}
                  value={form.headerTitle}
                  onChange={(e) =>
                    onChangeForm((prev) => ({ ...prev, headerTitle: e.target.value }))
                  }
                  placeholder="LAPORAN KEGIATAN"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:border-slate-400"
                />
                <input
                  type="text"
                  maxLength={SCHEMA_LIMITS.headerUnit}
                  value={form.headerUnit}
                  onChange={(e) =>
                    onChangeForm((prev) => ({ ...prev, headerUnit: e.target.value }))
                  }
                  placeholder="UNIT PKP-PK"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:border-slate-400"
                />
                <input
                  type="text"
                  maxLength={SCHEMA_LIMITS.headerLocation}
                  value={form.headerLocation}
                  onChange={(e) =>
                    onChangeForm((prev) => ({ ...prev, headerLocation: e.target.value }))
                  }
                  placeholder="UPBU KELAS III TANJUNG API"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:border-slate-400"
                />
              </div>
            </div>
          ) : null}

          {/* Section 1: Informasi Kegiatan */}
          <div className="p-6 space-y-4">
            <div className="text-xs font-semibold text-slate-800">01. Informasi Kegiatan</div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-slate-700">Pilih Tanggal</span>
                <input
                  type="date"
                  required
                  value={form.reportDateIso}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-md focus:outline-none focus:border-slate-400"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-slate-700">
                  Hari / Tanggal (Tercetak)
                </span>
                <input
                  type="text"
                  required
                  maxLength={SCHEMA_LIMITS.dayDateDisplay}
                  value={form.dayDateDisplay}
                  onChange={(e) =>
                    onChangeForm((prev) => ({ ...prev, dayDateDisplay: e.target.value }))
                  }
                  placeholder="Selasa 20 Oktober 2026"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:border-slate-400"
                />
              </label>
            </div>

            <div className="space-y-2">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-slate-700">Tempat</span>
                <input
                  type="text"
                  required
                  maxLength={SCHEMA_LIMITS.place}
                  value={form.place}
                  onChange={(e) => onChangeForm((prev) => ({ ...prev, place: e.target.value }))}
                  placeholder="Fire Station"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:border-slate-400"
                />
              </label>

              {unitSettings.placePresets.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  {unitSettings.placePresets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => onChangeForm((prev) => ({ ...prev, place: preset }))}
                      className={`px-2.5 py-1 text-xs rounded border transition-colors whitespace-nowrap cursor-pointer ${
                        form.place === preset
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-700">Uraian Kegiatan</span>
              <textarea
                required
                rows={3}
                maxLength={SCHEMA_LIMITS.activityDescription}
                value={form.activityDescription}
                onChange={(e) =>
                  onChangeForm((prev) => ({ ...prev, activityDescription: e.target.value }))
                }
                placeholder="Pembersihan fire station"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:border-slate-400 resize-y"
              />
            </label>
          </div>

          {/* Section 2: Dokumentasi (1 Gambar Kolase) */}
          <div className="p-6 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-slate-800">
                02. Dokumentasi (1 Gambar Kolase)
              </div>
              {form.documentationImage ? (
                <span className="text-xs text-slate-500 font-mono tabular-nums">
                  {compressionInfo ||
                    formatFileSizeKb(Math.round((form.documentationImage.length * 3) / 4))}
                </span>
              ) : null}
            </div>

            <input
              ref={collageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void handleCollageFile(e.target.files?.[0] ?? null)}
            />

            {form.documentationImage ? (
              <div className="space-y-3">
                <div className="border border-slate-200 rounded-md bg-slate-50 p-3 flex items-center justify-center">
                  <img
                    src={form.documentationImage}
                    alt="Pratinjau kolase dokumentasi"
                    referrerPolicy="no-referrer"
                    className="max-h-56 w-auto object-contain rounded-xs"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={compressing}
                    onClick={() => collageInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md cursor-pointer"
                  >
                    <ImagePlus className="w-3.5 h-3.5" />
                    {compressing ? 'Mengompresi...' : 'Ganti Gambar Kolase'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onChangeForm((prev) => ({ ...prev, documentationImage: '' }));
                      setCompressionInfo(null);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 rounded-md cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Hapus Gambar
                  </button>
                </div>
              </div>
            ) : (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => collageInputRef.current?.click()}
                className={`border border-dashed rounded-md p-6 text-center transition-colors cursor-pointer ${
                  isDragging
                    ? 'border-red-600 bg-red-50/40'
                    : 'border-slate-300 bg-slate-50/60 hover:bg-slate-50 hover:border-slate-400'
                }`}
              >
                <ImagePlus className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                <div className="text-sm font-medium text-slate-800">
                  {compressing
                    ? 'Mengoptimalkan ukuran gambar untuk cetak & database...'
                    : 'Klik atau seret 1 gambar kolase dokumentasi ke sini'}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  JPG, PNG, atau WebP · Kompresi otomatis agar tajam di A4 &amp; sinkron cepat
                </div>
              </div>
            )}

            {uploadError ? (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {uploadError}
              </div>
            ) : null}
          </div>

          {/* Section 3: Penandatangan */}
          <div className="p-6 space-y-5">
            <div className="text-xs font-semibold text-slate-800">03. Penandatangan Laporan</div>

            {/* Yang Membuat Laporan */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-600">Yang Membuat Laporan</span>
                {userProfile?.defaultReporterName ? (
                  <button
                    type="button"
                    onClick={applyMyProfileDefaults}
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-red-700 cursor-pointer"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    Isi dari Profil Saya
                  </button>
                ) : null}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs text-slate-600">Nama Lengkap</span>
                  <input
                    type="text"
                    required
                    maxLength={SCHEMA_LIMITS.reporterName}
                    value={form.reporterName}
                    onChange={(e) =>
                      onChangeForm((prev) => ({ ...prev, reporterName: e.target.value }))
                    }
                    placeholder="FATRINAH"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:border-slate-400"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs text-slate-600">NIP</span>
                  <input
                    type="text"
                    maxLength={SCHEMA_LIMITS.reporterNip}
                    value={form.reporterNip}
                    onChange={(e) =>
                      onChangeForm((prev) => ({ ...prev, reporterNip: e.target.value }))
                    }
                    placeholder="199008202025212032"
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-md focus:outline-none focus:border-slate-400"
                  />
                </label>
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-3 min-w-0">
                  {form.reporterSignature ? (
                    <img
                      src={form.reporterSignature}
                      alt="Tanda tangan pembuat laporan"
                      referrerPolicy="no-referrer"
                      className="h-9 max-w-[110px] object-contain border border-slate-200 rounded px-1.5 py-0.5 bg-white"
                    />
                  ) : (
                    <span className="text-xs text-slate-400">Belum ada tanda tangan digital</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSigTarget('reporter')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <PenTool className="w-3.5 h-3.5" />
                  {form.reporterSignature ? 'Ubah Tanda Tangan' : 'Bubuhkan Tanda Tangan'}
                </button>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-3">
              <span className="block text-xs font-medium text-slate-600">
                Mengetahui (Kepala Unit)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs text-slate-600">Jabatan</span>
                  <input
                    type="text"
                    required
                    maxLength={SCHEMA_LIMITS.headTitle}
                    value={form.headTitle}
                    onChange={(e) =>
                      onChangeForm((prev) => ({ ...prev, headTitle: e.target.value }))
                    }
                    placeholder="KEPALA UNIT PKP-PK"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:border-slate-400"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs text-slate-600">Nama Lengkap</span>
                  <input
                    type="text"
                    required
                    maxLength={SCHEMA_LIMITS.headName}
                    value={form.headName}
                    onChange={(e) =>
                      onChangeForm((prev) => ({ ...prev, headName: e.target.value }))
                    }
                    placeholder="MOH. IQRAM"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:border-slate-400"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs text-slate-600">NIP</span>
                  <input
                    type="text"
                    maxLength={SCHEMA_LIMITS.headNip}
                    value={form.headNip}
                    onChange={(e) =>
                      onChangeForm((prev) => ({ ...prev, headNip: e.target.value }))
                    }
                    placeholder="198302102008011005"
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-md focus:outline-none focus:border-slate-400"
                  />
                </label>
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-3 min-w-0">
                  {form.headSignature ? (
                    <img
                      src={form.headSignature}
                      alt="Tanda tangan Kepala Unit"
                      referrerPolicy="no-referrer"
                      className="h-9 max-w-[110px] object-contain border border-slate-200 rounded px-1.5 py-0.5 bg-white"
                    />
                  ) : (
                    <span className="text-xs text-slate-400">Belum ada tanda tangan digital</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSigTarget('head')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <PenTool className="w-3.5 h-3.5" />
                  {form.headSignature ? 'Ubah Tanda Tangan' : 'Bubuhkan Tanda Tangan'}
                </button>
              </div>
            </div>
          </div>

          {/* Validation Errors + Save Bar */}
          <div className="p-6 bg-slate-50/70 space-y-4">
            {validationErrors.length > 0 ? (
              <div className="bg-red-50 border border-red-200 rounded-md p-3 space-y-1 text-xs text-red-700">
                {validationErrors.map((err) => (
                  <div key={err}>• {err}</div>
                ))}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={onBackToArchive}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
              >
                Kembali ke Arsip
              </button>

              <button
                type="submit"
                disabled={saving || compressing}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 disabled:opacity-50 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                {saving
                  ? 'Menyimpan...'
                  : editingId
                    ? 'Simpan Perubahan'
                    : 'Simpan ke Database'}
              </button>
            </div>
          </div>
        </form>

        {/* RIGHT PANEL: Live A4 Document Preview */}
        <div
          className={`space-y-3 xl:sticky xl:top-6 ${
            mobileTab === 'form' ? 'hidden xl:block' : 'block'
          }`}
        >
          <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
            <div className="text-xs text-slate-600 flex items-center gap-2">
              <span className="font-semibold text-slate-900">Pratinjau Dokumen A4</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">210 × 297 mm</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onPrint}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Cetak A4
              </button>
              <button
                type="button"
                disabled={exportingPdf}
                onClick={() => void handlePdfClick()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FileDown className="w-3.5 h-3.5" />
                {exportingPdf ? 'Membuat PDF...' : 'Simpan PDF'}
              </button>
            </div>
          </div>

          <div className="bg-slate-200/70 border border-slate-200 rounded-lg p-4 sm:p-6 overflow-x-auto">
            <OfficialReportSheet report={form} />
          </div>
        </div>
      </div>

      {/* Signature Modal */}
      <SignatureModal
        isOpen={sigTarget !== null}
        title={
          sigTarget === 'reporter'
            ? 'Tanda Tangan — Yang Membuat Laporan'
            : 'Tanda Tangan — Kepala Unit PKP-PK'
        }
        signerName={sigTarget === 'reporter' ? form.reporterName : form.headName}
        currentSignature={
          sigTarget === 'reporter' ? form.reporterSignature : form.headSignature
        }
        defaultSavedSignature={
          sigTarget === 'reporter'
            ? userProfile?.defaultReporterSignature
            : unitSettings.defaultHeadSignature
        }
        onSave={(dataUrl) => {
          if (sigTarget === 'reporter') {
            onChangeForm((prev) => ({ ...prev, reporterSignature: dataUrl }));
          } else if (sigTarget === 'head') {
            onChangeForm((prev) => ({ ...prev, headSignature: dataUrl }));
          }
        }}
        onClose={() => setSigTarget(null)}
      />
    </div>
  );
};
