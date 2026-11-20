import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownUp,
  Copy,
  FileDown,
  FileText,
  Pencil,
  Plus,
  Printer,
  Search,
  Trash2,
  UserPen,
  X,
} from 'lucide-react';
import { useFirebase } from '../contexts/FirebaseContext';
import { BulkReporterModal } from './BulkReporterModal';
import {
  formatMonthYearLabel,
  formatTimestampShort,
  getTodayIso,
} from '../lib/dateUtils';
import {
  sortReportsByActivityDate,
  type BatchDateSortOrder,
} from '../lib/pdfExport';
import type { ActivityReportRecord } from '../types/report';

interface ArchiveViewProps {
  selectedMonth: string;
  onSelectedMonthChange: (month: string) => void;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onCreateNew: () => void;
  onEditReport: (report: ActivityReportRecord) => void;
  onDuplicateReport: (report: ActivityReportRecord) => void;
  onPrintReport: (report: ActivityReportRecord) => void;
  onPrintBatch: (reports: ActivityReportRecord[]) => void;
  onExportPdf: (report: ActivityReportRecord) => Promise<void>;
  onExportBatchPdf: (
    reports: ActivityReportRecord[],
    sortOrder: BatchDateSortOrder
  ) => Promise<void>;
  onNotify: (message: string, variant?: 'success' | 'error') => void;
}

export const ArchiveView: React.FC<ArchiveViewProps> = ({
  selectedMonth,
  onSelectedMonthChange,
  searchTerm,
  onSearchTermChange,
  onCreateNew,
  onEditReport,
  onDuplicateReport,
  onPrintReport,
  onPrintBatch,
  onExportPdf,
  onExportBatchPdf,
  onNotify,
}) => {
  const { reports, reportsLoading, syncStatus, lastSyncedAt, deleteReport } = useFirebase();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [batchSortOrder, setBatchSortOrder] = useState<BatchDateSortOrder>('asc');
  const [exportingBatch, setExportingBatch] = useState(false);
  const [bulkReporterOpen, setBulkReporterOpen] = useState(false);

  const [pendingDelete, setPendingDelete] = useState<ActivityReportRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);

  const selectAllRef = useRef<HTMLInputElement | null>(null);

  const currentYearMonth = getTodayIso().slice(0, 7);

  // Clean up selection if any selected report is deleted in real time
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const existingSet = new Set(reports.map((r) => r.id));
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (existingSet.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [reports]);

  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of reports) {
      if (r.reportDateIso && r.reportDateIso.length >= 7) {
        set.add(r.reportDateIso.slice(0, 7));
      }
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [reports]);

  const thisMonthCount = useMemo(
    () => reports.filter((r) => r.reportDateIso.startsWith(currentYearMonth)).length,
    [reports, currentYearMonth]
  );

  const withDocumentationCount = useMemo(
    () => reports.filter((r) => Boolean(r.documentationImage)).length,
    [reports]
  );

  const filteredReports = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return reports.filter((r) => {
      if (selectedMonth !== 'all' && !r.reportDateIso.startsWith(selectedMonth)) {
        return false;
      }
      if (!q) return true;
      return (
        r.dayDateDisplay.toLowerCase().includes(q) ||
        r.place.toLowerCase().includes(q) ||
        r.activityDescription.toLowerCase().includes(q) ||
        r.reporterName.toLowerCase().includes(q) ||
        r.headName.toLowerCase().includes(q)
      );
    });
  }, [reports, searchTerm, selectedMonth]);

  const selectedSortedReports = useMemo(() => {
    if (selectedIds.size === 0) return [];
    const picked = reports.filter((r) => selectedIds.has(r.id));
    return sortReportsByActivityDate(picked, batchSortOrder);
  }, [reports, selectedIds, batchSortOrder]);

  const selectedDateRangeLabel = useMemo(() => {
    if (selectedSortedReports.length === 0) return '';
    const dates = selectedSortedReports
      .map((r) => r.reportDateIso)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    if (dates.length === 0) return '';
    const first = dates[0];
    const last = dates[dates.length - 1];
    return first === last ? first : `${first} – ${last}`;
  }, [selectedSortedReports]);

  const visibleSelectedCount = useMemo(
    () => filteredReports.filter((r) => selectedIds.has(r.id)).length,
    [filteredReports, selectedIds]
  );

  const allVisibleSelected =
    filteredReports.length > 0 && visibleSelectedCount === filteredReports.length;
  const someVisibleSelected =
    visibleSelectedCount > 0 && visibleSelectedCount < filteredReports.length;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someVisibleSelected;
    }
  }, [someVisibleSelected]);

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const r of filteredReports) {
          next.delete(r.id);
        }
      } else {
        for (const r of filteredReports) {
          next.add(r.id);
        }
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteReport(pendingDelete.id);
      onNotify('Laporan berhasil dihapus dari database.');
      setPendingDelete(null);
    } catch {
      onNotify('Gagal menghapus laporan. Periksa koneksi Anda.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleRowPdf = async (report: ActivityReportRecord) => {
    setExportingId(report.id);
    try {
      await onExportPdf(report);
    } finally {
      setExportingId(null);
    }
  };

  const handleBatchPdf = async () => {
    if (selectedSortedReports.length === 0) return;
    setExportingBatch(true);
    try {
      await onExportBatchPdf(selectedSortedReports, batchSortOrder);
    } finally {
      setExportingBatch(false);
    }
  };

  const handleBatchPrint = () => {
    if (selectedSortedReports.length === 0) return;
    onPrintBatch(selectedSortedReports);
  };

  const syncLabel =
    syncStatus === 'synced'
      ? 'Tersinkron Real-Time'
      : syncStatus === 'syncing'
        ? 'Menyinkronkan...'
        : syncStatus === 'error'
          ? 'Gangguan Koneksi'
          : 'Menghubungkan...';

  const syncColorClass =
    syncStatus === 'synced'
      ? 'text-emerald-700'
      : syncStatus === 'error'
        ? 'text-red-700'
        : 'text-amber-700';

  return (
    <div className="space-y-6">
      {/* Flat Single-Elevation Summary Strip */}
      <div className="bg-white border border-slate-200 rounded-lg grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">Total Arsip Laporan</div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
              {reportsLoading ? '—' : reports.length}
            </span>
            <span className="text-xs text-slate-500">
              {withDocumentationCount} dengan foto kolase
            </span>
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">
            Laporan Bulan {formatMonthYearLabel(currentYearMonth)}
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
              {reportsLoading ? '—' : thisMonthCount}
            </span>
            <span className="text-xs text-slate-500">kegiatan tercatat</span>
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">Status Database Real-Time</div>
          <div className="mt-1.5 flex flex-col gap-0.5">
            <span className={`text-sm font-semibold ${syncColorClass}`}>{syncLabel}</span>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              {lastSyncedAt
                ? `Pembaruan: ${lastSyncedAt.toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}`
                : 'Menunggu sinkronisasi...'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Archive Table Panel */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {/* Search & Filter Toolbar */}
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              placeholder="Cari kegiatan, tempat, atau nama pembuat laporan..."
              className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:border-slate-400 text-slate-900 placeholder:text-slate-400"
            />
            {searchTerm ? (
              <button
                type="button"
                onClick={() => onSearchTermChange('')}
                aria-label="Bersihkan pencarian"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : null}
          </div>

          <div className="flex items-center gap-2.5">
            <select
              value={selectedMonth}
              onChange={(e) => onSelectedMonthChange(e.target.value)}
              aria-label="Filter bulan laporan"
              className="px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-md text-slate-700 focus:outline-none focus:border-slate-400 cursor-pointer"
            >
              <option value="all">Semua Bulan</option>
              {monthOptions.map((ym) => (
                <option key={ym} value={ym}>
                  {formatMonthYearLabel(ym)}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={onCreateNew}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Buat Laporan
            </button>
          </div>
        </div>

        {/* Contextual Batch Merge & Print Action Bar */}
        {selectedSortedReports.length > 0 ? (
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span className="font-semibold text-slate-900 font-mono tabular-nums">
                {selectedSortedReports.length} laporan dipilih
              </span>
              {selectedDateRangeLabel ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    Tgl kegiatan:{' '}
                    <span className="font-mono tabular-nums text-slate-800">
                      {selectedDateRangeLabel}
                    </span>
                  </span>
                </>
              ) : null}
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={clearSelection}
                className="font-medium text-slate-500 hover:text-slate-900 underline underline-offset-2 cursor-pointer"
              >
                Batal Pilih
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div
                className="inline-flex items-center gap-1 p-0.5 bg-white border border-slate-200 rounded-md"
                role="group"
                aria-label="Urutan tanggal kegiatan pada PDF gabungan"
              >
                <span className="inline-flex items-center gap-1 pl-2 pr-1 text-[11px] text-slate-500 whitespace-nowrap">
                  <ArrowDownUp className="w-3 h-3" />
                  Urutan Tgl:
                </span>
                <button
                  type="button"
                  onClick={() => setBatchSortOrder('asc')}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    batchSortOrder === 'asc'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Terlama → Terbaru
                </button>
                <button
                  type="button"
                  onClick={() => setBatchSortOrder('desc')}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    batchSortOrder === 'desc'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Terbaru → Terlama
                </button>
              </div>

              <button
                type="button"
                onClick={() => setBulkReporterOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-800 bg-white border border-slate-200 hover:bg-slate-100 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <UserPen className="w-3.5 h-3.5" />
                Ganti Pembuat Laporan
              </button>

              <button
                type="button"
                onClick={handleBatchPrint}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Cetak A4 Gabungan
              </button>

              <button
                type="button"
                disabled={exportingBatch}
                onClick={() => void handleBatchPdf()}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 disabled:opacity-50 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FileDown className="w-3.5 h-3.5" />
                {exportingBatch
                  ? 'Menggabungkan PDF...'
                  : `Gabung & Simpan PDF (${selectedSortedReports.length})`}
              </button>
            </div>
          </div>
        ) : null}

        {/* Table Content */}
        {reportsLoading ? (
          <div className="divide-y divide-slate-100">
            {[1, 2, 3, 4].map((row) => (
              <div key={row} className="px-5 py-4 flex items-center gap-4 animate-pulse">
                <div className="h-4 w-4 bg-slate-100 rounded" />
                <div className="h-4 w-36 bg-slate-100 rounded" />
                <div className="h-4 w-28 bg-slate-100 rounded" />
                <div className="h-4 flex-1 bg-slate-100 rounded" />
                <div className="h-4 w-24 bg-slate-100 rounded" />
              </div>
            ))}
          </div>
        ) : reports.length === 0 ? (
          <div className="py-16 px-6 text-center space-y-4">
            <div className="w-11 h-11 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
              <FileText className="w-5 h-5" />
            </div>
            <div className="space-y-1 max-w-sm mx-auto">
              <h3 className="text-base font-semibold text-slate-900">
                Belum Ada Laporan Kegiatan
              </h3>
              <p className="text-sm text-slate-500">
                Mulai buat laporan kegiatan pertama Unit PKP-PK. Setiap laporan tersimpan otomatis
                di database real-time dan siap dicetak A4.
              </p>
            </div>
            <button
              type="button"
              onClick={onCreateNew}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-red-700 hover:bg-red-800 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Buat Laporan Pertama
            </button>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="py-14 px-6 text-center space-y-3">
            <p className="text-sm text-slate-600">
              Tidak ada laporan yang cocok dengan filter atau kata kunci pencarian.
            </p>
            <button
              type="button"
              onClick={() => {
                onSearchTermChange('');
                onSelectedMonthChange('all');
              }}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
            >
              Reset Filter
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-3 pl-4 pr-2 w-10">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAllVisible}
                      aria-label="Pilih semua laporan yang tampil"
                      className="w-4 h-4 rounded border-slate-300 text-red-700 focus:ring-red-600 cursor-pointer align-middle"
                    />
                  </th>
                  <th className="py-3 px-4 whitespace-nowrap">Hari / Tanggal</th>
                  <th className="py-3 px-4 whitespace-nowrap">Tempat</th>
                  <th className="py-3 px-4">Uraian Kegiatan</th>
                  <th className="py-3 px-4 whitespace-nowrap">Pembuat Laporan</th>
                  <th className="py-3 px-4 whitespace-nowrap">Kelengkapan</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredReports.map((report) => {
                  const isSelected = selectedIds.has(report.id);
                  return (
                    <tr
                      key={report.id}
                      className={`transition-colors group ${
                        isSelected ? 'bg-red-50/40 hover:bg-red-50/60' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="py-3 pl-4 pr-2 align-top">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectRow(report.id)}
                          aria-label={`Pilih laporan ${report.dayDateDisplay}`}
                          className="w-4 h-4 mt-0.5 rounded border-slate-300 text-red-700 focus:ring-red-600 cursor-pointer"
                        />
                      </td>

                      <td className="py-3 px-4 align-top whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onEditReport(report)}
                          className="text-left font-medium text-slate-900 hover:text-red-700 transition-colors cursor-pointer"
                        >
                          {report.dayDateDisplay}
                        </button>
                        <div className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                          {report.reportDateIso}
                        </div>
                      </td>

                      <td className="py-3 px-4 align-top text-slate-700 whitespace-nowrap">
                        {report.place}
                      </td>

                      <td className="py-3 px-4 align-top max-w-md">
                        <div className="text-slate-800 line-clamp-2 leading-snug">
                          {report.activityDescription}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          Diperbarui {formatTimestampShort(report.updatedAt)} ·{' '}
                          {report.updatedByName}
                        </div>
                      </td>

                      <td className="py-3 px-4 align-top whitespace-nowrap">
                        <div className="font-medium text-slate-900">{report.reporterName}</div>
                        {report.reporterNip ? (
                          <div className="text-xs text-slate-500 font-mono tabular-nums">
                            NIP. {report.reporterNip}
                          </div>
                        ) : null}
                      </td>

                      <td className="py-3 px-4 align-top whitespace-nowrap text-xs text-slate-600">
                        <div>
                          {report.documentationImage ? 'Kolase terlampir' : 'Tanpa kolase'}
                        </div>
                        <div className="text-slate-400 mt-0.5">
                          {[
                            report.reporterSignature ? 'TTD Pembuat' : null,
                            report.headSignature ? 'TTD Kepala' : null,
                          ]
                            .filter(Boolean)
                            .join(' · ') || 'TTD manual'}
                        </div>
                      </td>

                      <td className="py-3 px-4 align-top text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onEditReport(report)}
                            title="Buka & Edit"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-950 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => onPrintReport(report)}
                            title="Cetak A4"
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                            aria-label="Cetak A4"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleRowPdf(report)}
                            disabled={exportingId === report.id}
                            title="Unduh PDF"
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors disabled:opacity-40 cursor-pointer"
                            aria-label="Unduh PDF"
                          >
                            <FileDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDuplicateReport(report)}
                            title="Duplikat ke Laporan Baru"
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                            aria-label="Duplikat laporan"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingDelete(report)}
                            title="Hapus Laporan"
                            className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded transition-colors cursor-pointer"
                            aria-label="Hapus laporan"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* In-App Delete Confirmation Modal */}
      {pendingDelete ? (
        <div
          className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4 no-print"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-lg max-w-md w-full p-6 space-y-4">
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-slate-900">Hapus Laporan Kegiatan?</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Laporan tanggal{' '}
                <span className="font-semibold text-slate-900">
                  {pendingDelete.dayDateDisplay}
                </span>{' '}
                ({pendingDelete.place}) akan dihapus permanen dari database bersama seluruh tim.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setPendingDelete(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void handleConfirmDelete()}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 disabled:opacity-50 rounded-md cursor-pointer"
              >
                {deleting ? 'Menghapus...' : 'Ya, Hapus Permanen'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {/* In-App Bulk Replace Reporter Modal */}
      <BulkReporterModal
        isOpen={bulkReporterOpen}
        selectedReports={selectedSortedReports}
        onClose={() => setBulkReporterOpen(false)}
        onApplied={(updatedCount, reporterName) => {
          onNotify(
            `Pembuat laporan pada ${updatedCount} arsip berhasil diubah menjadi ${reporterName}.`
          );
        }}
      />
    </div>
  );
};
