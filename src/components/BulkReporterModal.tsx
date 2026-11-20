import React, { useEffect, useMemo, useState } from 'react';
import { PenTool, Trash2, UserCheck, UserPen, X } from 'lucide-react';
import { useFirebase } from '../contexts/FirebaseContext';
import { SCHEMA_LIMITS, type ActivityReportRecord } from '../types/report';
import { SignatureModal } from './SignatureModal';

type SignatureMode = 'keep' | 'replace' | 'clear';

interface BulkReporterModalProps {
  isOpen: boolean;
  selectedReports: ActivityReportRecord[];
  onClose: () => void;
  onApplied: (updatedCount: number, reporterName: string) => void;
}

export const BulkReporterModal: React.FC<BulkReporterModalProps> = ({
  isOpen,
  selectedReports,
  onClose,
  onApplied,
}) => {
  const { user, userProfile, bulkUpdateReporter } = useFirebase();

  const [reporterName, setReporterName] = useState('');
  const [reporterNip, setReporterNip] = useState('');
  const [signatureMode, setSignatureMode] = useState<SignatureMode>('keep');
  const [newSignature, setNewSignature] = useState('');
  const [sigModalOpen, setSigModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    // Prefill from first selected report if all share one reporter, otherwise from profile
    const uniqueNames = new Set(selectedReports.map((r) => r.reporterName.trim()).filter(Boolean));
    if (uniqueNames.size === 1 && selectedReports.length > 0) {
      setReporterName(selectedReports[0].reporterName);
      setReporterNip(selectedReports[0].reporterNip);
    } else {
      setReporterName(userProfile?.defaultReporterName || '');
      setReporterNip(userProfile?.defaultReporterNip || '');
    }
    setSignatureMode('keep');
    setNewSignature(userProfile?.defaultReporterSignature || '');
    setErrorMessage(null);
    setSaving(false);
  }, [isOpen, selectedReports, userProfile]);

  const currentReporterSummary = useMemo(() => {
    const names = Array.from(
      new Set(selectedReports.map((r) => r.reporterName.trim()).filter(Boolean))
    );
    if (names.length === 0) return 'Belum diisi';
    if (names.length <= 2) return names.join(', ');
    return `${names.slice(0, 2).join(', ')} (+${names.length - 2} lainnya)`;
  }, [selectedReports]);

  const dateRangeLabel = useMemo(() => {
    const dates = selectedReports
      .map((r) => r.reportDateIso)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    if (dates.length === 0) return '';
    return dates[0] === dates[dates.length - 1]
      ? dates[0]
      : `${dates[0]} – ${dates[dates.length - 1]}`;
  }, [selectedReports]);

  if (!isOpen) return null;

  const hasSavedProfile = Boolean(
    userProfile?.defaultReporterName ||
      userProfile?.defaultReporterNip ||
      userProfile?.defaultReporterSignature ||
      user?.displayName
  );

  const handleFillFromProfile = () => {
    setReporterName(userProfile?.defaultReporterName || user?.displayName || '');
    setReporterNip(userProfile?.defaultReporterNip || '');
    if (userProfile?.defaultReporterSignature) {
      setNewSignature(userProfile.defaultReporterSignature);
      setSignatureMode('replace');
    }
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedName = reporterName.trim();
    if (!trimmedName) {
      setErrorMessage('Nama pembuat laporan wajib diisi.');
      return;
    }

    if (signatureMode === 'replace' && !newSignature) {
      setErrorMessage(
        'Anda memilih ganti tanda tangan baru. Silakan gambar atau unggah tanda tangan terlebih dahulu.'
      );
      return;
    }

    setSaving(true);
    try {
      const ids = selectedReports.map((r) => r.id);
      const updatedCount = await bulkUpdateReporter(ids, {
        reporterName: trimmedName,
        reporterNip: reporterNip.trim(),
        signatureMode,
        reporterSignature: signatureMode === 'replace' ? newSignature : undefined,
      });
      onApplied(updatedCount, trimmedName);
      onClose();
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Gagal memperbarui data pembuat laporan. Periksa koneksi Anda.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-slate-950/50 flex items-center justify-center p-4 no-print"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-reporter-title"
      >
        <div className="bg-white border border-slate-200 rounded-lg max-w-xl w-full overflow-hidden">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-200">
            <div className="flex items-start gap-3 min-w-0">
              <span className="w-8 h-8 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                <UserPen className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <h3 id="bulk-reporter-title" className="text-base font-bold text-slate-900">
                  Ganti Pembuat Laporan Massal
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Berlaku untuk{' '}
                  <span className="font-mono tabular-nums font-semibold text-slate-800">
                    {selectedReports.length}
                  </span>{' '}
                  arsip terpilih
                  {dateRangeLabel ? (
                    <>
                      {' '}
                      · Tgl{' '}
                      <span className="font-mono tabular-nums text-slate-700">
                        {dateRangeLabel}
                      </span>
                    </>
                  ) : null}
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Tutup modal ganti pembuat laporan"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={(e) => void handleSubmit(e)}>
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Current Reporter Context + Quick Fill */}
              <div className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="text-xs text-slate-600 min-w-0">
                  <span className="text-slate-500">Pembuat saat ini: </span>
                  <span className="font-medium text-slate-900">{currentReporterSummary}</span>
                </div>
                {hasSavedProfile ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleFillFromProfile}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-800 bg-white border border-slate-200 hover:bg-slate-100 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-red-700" />
                    Isi dari Profil Saya
                  </button>
                ) : null}
              </div>

              {/* Name & NIP Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label
                    htmlFor="bulk-reporter-name"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Nama Pembuat Laporan Baru <span className="text-red-700">*</span>
                  </label>
                  <input
                    id="bulk-reporter-name"
                    type="text"
                    required
                    maxLength={SCHEMA_LIMITS.reporterName}
                    value={reporterName}
                    onChange={(e) => {
                      setReporterName(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="Contoh: BUDI SANTOSO"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:border-slate-400"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="bulk-reporter-nip"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    NIP Pembuat Laporan Baru{' '}
                    <span className="text-slate-400 font-normal">(opsional, kosongkan bila non-ASN)</span>
                  </label>
                  <input
                    id="bulk-reporter-nip"
                    type="text"
                    maxLength={SCHEMA_LIMITS.reporterNip}
                    value={reporterNip}
                    onChange={(e) => setReporterNip(e.target.value)}
                    placeholder="Contoh: 199204152019021004"
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:border-slate-400"
                  />
                </div>
              </div>

              {/* Signature Handling Options */}
              <div className="space-y-2.5">
                <div className="text-xs font-semibold text-slate-700">
                  Pengaturan Tanda Tangan Pembuat Laporan
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      setSignatureMode('keep');
                      setErrorMessage(null);
                    }}
                    className={`px-3 py-2.5 text-left rounded-md border transition-colors cursor-pointer ${
                      signatureMode === 'keep'
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs font-semibold">Pertahankan Lama</div>
                    <div
                      className={`text-[11px] mt-0.5 leading-snug ${
                        signatureMode === 'keep' ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      TTD tiap arsip tidak diubah
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      setSignatureMode('replace');
                      setErrorMessage(null);
                    }}
                    className={`px-3 py-2.5 text-left rounded-md border transition-colors cursor-pointer ${
                      signatureMode === 'replace'
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs font-semibold">Ganti TTD Baru</div>
                    <div
                      className={`text-[11px] mt-0.5 leading-snug ${
                        signatureMode === 'replace' ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      Terapkan 1 TTD ke semua
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      setSignatureMode('clear');
                      setErrorMessage(null);
                    }}
                    className={`px-3 py-2.5 text-left rounded-md border transition-colors cursor-pointer ${
                      signatureMode === 'clear'
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs font-semibold">Kosongkan TTD</div>
                    <div
                      className={`text-[11px] mt-0.5 leading-snug ${
                        signatureMode === 'clear' ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      Hapus TTD untuk TTD basah
                    </div>
                  </button>
                </div>

                {/* New Signature Preview & Picker */}
                {signatureMode === 'replace' ? (
                  <div className="border border-slate-200 rounded-md p-4 bg-slate-50/70 space-y-3">
                    {newSignature ? (
                      <div className="bg-white border border-slate-200 rounded-md p-3 flex flex-col items-center">
                        <img
                          src={newSignature}
                          alt="Pratinjau tanda tangan baru"
                          referrerPolicy="no-referrer"
                          className="max-h-20 object-contain"
                        />
                        <div className="w-40 border-b border-slate-900 mt-1.5" />
                        <div className="text-[11px] font-bold uppercase text-slate-800 mt-1">
                          {reporterName.trim() || 'NAMA PEMBUAT LAPORAN'}
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 text-center py-3 bg-white border border-dashed border-slate-300 rounded-md">
                        Belum ada gambar tanda tangan baru dipilih.
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => setSigModalOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-800 bg-white border border-slate-200 hover:bg-slate-100 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <PenTool className="w-3.5 h-3.5" />
                        {newSignature ? 'Ubah / Gambar Ulang TTD' : 'Gambar atau Unggah TTD'}
                      </button>

                      {newSignature ? (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => setNewSignature('')}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Hapus Pilihan
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>

              {errorMessage ? (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3.5 py-2.5">
                  {errorMessage}
                </div>
              ) : null}

              <p className="text-xs text-slate-500 leading-relaxed">
                Perubahan ini akan disimpan permanen ke database bersama seluruh tim dan langsung
                memperbarui tampilan arsip, pratinjau A4, maupun berkas PDF gabungan.
              </p>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2.5 px-6 py-4 bg-slate-50 border-t border-slate-200">
              <button
                type="button"
                disabled={saving}
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={saving || selectedReports.length === 0}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 disabled:opacity-50 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {saving
                  ? `Menyimpan ke ${selectedReports.length} Laporan...`
                  : `Simpan ke ${selectedReports.length} Laporan`}
              </button>
            </div>
          </form>
        </div>
      </div>

      <SignatureModal
        isOpen={sigModalOpen}
        title="Tanda Tangan Pembuat Laporan (Massal)"
        signerName={reporterName.trim() || 'Pembuat Laporan'}
        currentSignature={newSignature}
        defaultSavedSignature={userProfile?.defaultReporterSignature || undefined}
        onSave={(dataUrl) => {
          setNewSignature(dataUrl);
          if (!dataUrl) {
            setSignatureMode('clear');
          } else {
            setSignatureMode('replace');
          }
          setErrorMessage(null);
        }}
        onClose={() => setSigModalOpen(false)}
      />
    </>
  );
};
