/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  FileDown,
  FilePlus2,
  Flame,
  FolderOpen,
  LogOut,
  Menu,
  Printer,
  Settings,
  X,
} from 'lucide-react';
import { ArchiveView } from './components/ArchiveView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OfficialReportSheet } from './components/OfficialReportSheet';
import { ReportEditorView } from './components/ReportEditorView';
import { SignInView } from './components/SignInView';
import { StatisticsView } from './components/StatisticsView';
import { UnitSettingsView } from './components/UnitSettingsView';
import { FirebaseProvider, useFirebase } from './contexts/FirebaseContext';
import { formatIndonesianDayDate, getTodayIso } from './lib/dateUtils';
import { initDocumentFonts } from './lib/fontRegistry';
import {
  exportReportsBatchToPdf,
  exportReportToPdf,
  type BatchDateSortOrder,
} from './lib/pdfExport';
import type { ActivityReportForm, ActivityReportRecord } from './types/report';

type ActiveView = 'archive' | 'statistics' | 'editor' | 'settings';

interface ToastState {
  message: string;
  variant: 'success' | 'error';
}

function buildFreshReportForm(
  unitSettings: ReturnType<typeof useFirebase>['unitSettings'],
  userProfile: ReturnType<typeof useFirebase>['userProfile'],
  fallbackDisplayName: string
): ActivityReportForm {
  const todayIso = getTodayIso();
  return {
    headerTitle: unitSettings.headerTitle,
    headerUnit: unitSettings.headerUnit,
    headerLocation: unitSettings.headerLocation,
    reportDateIso: todayIso,
    dayDateDisplay: formatIndonesianDayDate(todayIso),
    place: unitSettings.placePresets[0] || 'Fire Station',
    activityDescription: '',
    documentationImage: '',
    reporterName: userProfile?.defaultReporterName || fallbackDisplayName || '',
    reporterNip: userProfile?.defaultReporterNip || '',
    reporterSignature: userProfile?.defaultReporterSignature || '',
    headTitle: unitSettings.defaultHeadTitle,
    headName: unitSettings.defaultHeadName,
    headNip: unitSettings.defaultHeadNip,
    headSignature: unitSettings.defaultHeadSignature,
  };
}

function WorkspaceShell() {
  const {
    user,
    authReady,
    unitSettings,
    userProfile,
    signOut,
    createReport,
    updateReport,
  } = useFirebase();

  const [activeView, setActiveView] = useState<ActiveView>('archive');
  const [archiveMonthFilter, setArchiveMonthFilter] = useState<string>('all');
  const [archiveSearchTerm, setArchiveSearchTerm] = useState<string>('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorForm, setEditorForm] = useState<ActivityReportForm>(() =>
    buildFreshReportForm(unitSettings, userProfile, user?.displayName || '')
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [printReports, setPrintReports] = useState<ActivityReportForm[]>([]);
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((message: string, variant: 'success' | 'error' = 'success') => {
    setToast({ message, variant });
  }, []);

  useEffect(() => {
    void initDocumentFonts();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const handleOpenArchiveFiltered = useCallback(
    (options: { month: string; search?: string }) => {
      setArchiveMonthFilter(options.month || 'all');
      setArchiveSearchTerm(options.search ?? '');
      setActiveView('archive');
      setSidebarOpen(false);
    },
    []
  );

  const handleOpenNewReport = useCallback(() => {
    const fresh = buildFreshReportForm(
      unitSettings,
      userProfile,
      user?.displayName || ''
    );
    setEditingId(null);
    setEditorForm(fresh);
    setHasUnsavedChanges(false);
    setActiveView('editor');
    setSidebarOpen(false);
  }, [unitSettings, userProfile, user]);

  const handleEditReport = useCallback((report: ActivityReportRecord) => {
    setEditingId(report.id);
    setEditorForm({
      headerTitle: report.headerTitle,
      headerUnit: report.headerUnit,
      headerLocation: report.headerLocation,
      reportDateIso: report.reportDateIso,
      dayDateDisplay: report.dayDateDisplay,
      place: report.place,
      activityDescription: report.activityDescription,
      documentationImage: report.documentationImage,
      reporterName: report.reporterName,
      reporterNip: report.reporterNip,
      reporterSignature: report.reporterSignature,
      headTitle: report.headTitle,
      headName: report.headName,
      headNip: report.headNip,
      headSignature: report.headSignature,
    });
    setHasUnsavedChanges(false);
    setActiveView('editor');
    setSidebarOpen(false);
  }, []);

  const handleDuplicateReport = useCallback(
    (report: ActivityReportRecord) => {
      const todayIso = getTodayIso();
      setEditingId(null);
      setEditorForm({
        headerTitle: report.headerTitle,
        headerUnit: report.headerUnit,
        headerLocation: report.headerLocation,
        reportDateIso: todayIso,
        dayDateDisplay: formatIndonesianDayDate(todayIso),
        place: report.place,
        activityDescription: report.activityDescription,
        documentationImage: '',
        reporterName: report.reporterName,
        reporterNip: report.reporterNip,
        reporterSignature: report.reporterSignature,
        headTitle: report.headTitle,
        headName: report.headName,
        headNip: report.headNip,
        headSignature: report.headSignature,
      });
      setHasUnsavedChanges(true);
      setActiveView('editor');
      showToast('Isian laporan diduplikasi. Unggah dokumentasi baru lalu simpan.');
    },
    [showToast]
  );

  const handleSaveReport = useCallback(async () => {
    try {
      if (editingId) {
        await updateReport(editingId, editorForm);
        setHasUnsavedChanges(false);
        showToast('Perubahan laporan berhasil disinkronkan ke database.');
      } else {
        const newId = await createReport(editorForm);
        setEditingId(newId);
        setHasUnsavedChanges(false);
        showToast('Laporan baru berhasil disimpan dan disinkronkan.');
      }
    } catch {
      showToast('Gagal menyimpan laporan ke database.', 'error');
    }
  }, [editingId, editorForm, updateReport, createReport, showToast]);

  const triggerPrint = useCallback((target: ActivityReportForm) => {
    setPrintReports([target]);
    window.setTimeout(() => {
      window.print();
    }, 120);
  }, []);

  const triggerPrintBatch = useCallback((targets: ActivityReportRecord[]) => {
    if (targets.length === 0) return;
    setPrintReports(targets);
    window.setTimeout(() => {
      window.print();
    }, 180);
  }, []);

  const triggerExportPdf = useCallback(
    async (target: ActivityReportForm) => {
      try {
        await exportReportToPdf(target);
        showToast('Berkas PDF A4 berhasil diunduh.');
      } catch {
        showToast('Gagal mengekspor PDF. Coba gunakan tombol Cetak A4.', 'error');
      }
    },
    [showToast]
  );

  const triggerExportBatchPdf = useCallback(
    async (targets: ActivityReportRecord[], sortOrder: BatchDateSortOrder) => {
      if (targets.length === 0) return;
      try {
        await exportReportsBatchToPdf(targets, sortOrder);
        showToast(`${targets.length} laporan berhasil digabung ke 1 berkas PDF A4.`);
      } catch {
        showToast('Gagal menggabungkan PDF. Coba gunakan Cetak A4 Gabungan.', 'error');
      }
    },
    [showToast]
  );

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-sm text-slate-500">Memuat sesi Unit PKP-PK...</div>
      </div>
    );
  }

  if (!user) {
    return <SignInView />;
  }

  const breadcrumbSection =
    activeView === 'archive'
      ? 'Arsip Laporan'
      : activeView === 'statistics'
        ? 'Statistik Kegiatan'
        : activeView === 'settings'
          ? 'Pengaturan Unit'
          : editingId
            ? `Edit Laporan / ${editorForm.dayDateDisplay || 'Tanpa Tanggal'}`
            : 'Buat Laporan Baru';

  return (
    <>
      <div className="min-h-screen bg-slate-50 flex no-print">
        {/* Mobile Sidebar Backdrop */}
        {sidebarOpen ? (
          <div
            className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}

        {/* Left Workspace Sidebar (260px desktop) */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-[260px] bg-slate-950 text-slate-200 flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {/* Brand Header */}
          <div className="h-16 px-5 border-b border-slate-800/80 flex items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={() => {
                setActiveView('archive');
                setSidebarOpen(false);
              }}
              className="flex items-center gap-2.5 text-left text-white font-bold tracking-tight whitespace-nowrap cursor-pointer"
            >
              <span className="w-7 h-7 rounded-md bg-red-700 text-white flex items-center justify-center shrink-0">
                <Flame className="w-4 h-4" />
              </span>
              <span className="text-sm">PKP-PK Tanjung Api</span>
            </button>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded cursor-pointer"
              aria-label="Tutup menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 p-3 space-y-1">
            <button
              type="button"
              onClick={() => {
                setActiveView('archive');
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeView === 'archive'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-300 hover:bg-slate-900 hover:text-white'
              }`}
            >
              <FolderOpen className="w-4 h-4 shrink-0" />
              Arsip Laporan
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveView('statistics');
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeView === 'statistics'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-300 hover:bg-slate-900 hover:text-white'
              }`}
            >
              <BarChart3 className="w-4 h-4 shrink-0" />
              Statistik Kegiatan
            </button>

            <button
              type="button"
              onClick={handleOpenNewReport}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeView === 'editor' && !editingId
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-300 hover:bg-slate-900 hover:text-white'
              }`}
            >
              <FilePlus2 className="w-4 h-4 shrink-0" />
              Buat Laporan Baru
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveView('settings');
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeView === 'settings'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-300 hover:bg-slate-900 hover:text-white'
              }`}
            >
              <Settings className="w-4 h-4 shrink-0" />
              Pengaturan Unit
            </button>
          </nav>

          {/* Officer Profile Footer */}
          <div className="p-4 border-t border-slate-800/80 space-y-3">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-white truncate">
                {userProfile?.defaultReporterName || user.displayName || 'Petugas PKP-PK'}
              </div>
              <div className="text-[11px] text-slate-400 truncate mt-0.5">{user.email}</div>
            </div>

            <button
              type="button"
              onClick={() => void signOut()}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-md transition-colors whitespace-nowrap cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Keluar Akun
            </button>
          </div>
        </aside>

        {/* Main Content Viewport */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Top Bar Contract (1 row, contextual breadcrumb left + max 2 primary actions right) */}
          <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-md hover:bg-slate-100 cursor-pointer"
                aria-label="Buka menu navigasi"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2 text-sm min-w-0">
                <span className="text-slate-500 whitespace-nowrap hidden sm:inline">
                  Unit PKP-PK
                </span>
                <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
                  /
                </span>
                <span className="font-semibold text-slate-900 truncate">{breadcrumbSection}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {activeView === 'editor' ? (
                <>
                  <button
                    type="button"
                    onClick={() => triggerPrint(editorForm)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Cetak A4</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void triggerExportPdf(editorForm)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    Simpan PDF
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleOpenNewReport}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <FilePlus2 className="w-3.5 h-3.5" />
                  Buat Laporan Baru
                </button>
              )}
            </div>
          </header>

          {/* Active Page View */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
            {activeView === 'archive' ? (
              <ArchiveView
                selectedMonth={archiveMonthFilter}
                onSelectedMonthChange={setArchiveMonthFilter}
                searchTerm={archiveSearchTerm}
                onSearchTermChange={setArchiveSearchTerm}
                onCreateNew={handleOpenNewReport}
                onEditReport={handleEditReport}
                onDuplicateReport={handleDuplicateReport}
                onPrintReport={triggerPrint}
                onPrintBatch={triggerPrintBatch}
                onExportPdf={triggerExportPdf}
                onExportBatchPdf={triggerExportBatchPdf}
                onNotify={showToast}
              />
            ) : activeView === 'statistics' ? (
              <StatisticsView
                onOpenArchiveFiltered={handleOpenArchiveFiltered}
                onCreateNew={handleOpenNewReport}
              />
            ) : activeView === 'editor' ? (
              <ReportEditorView
                editingId={editingId}
                form={editorForm}
                hasUnsavedChanges={hasUnsavedChanges}
                onChangeForm={(updater) => {
                  setEditorForm(updater);
                  setHasUnsavedChanges(true);
                }}
                onSave={handleSaveReport}
                onPrint={() => triggerPrint(editorForm)}
                onExportPdf={() => triggerExportPdf(editorForm)}
                onBackToArchive={() => setActiveView('archive')}
              />
            ) : (
              <UnitSettingsView onNotify={showToast} />
            )}
          </main>
        </div>

        {/* Toast Feedback */}
        {toast ? (
          <div className="fixed bottom-5 right-5 z-50 no-print">
            <div
              className={`flex items-center gap-2.5 px-4 py-3 rounded-md border text-xs font-medium shadow-md ${
                toast.variant === 'error'
                  ? 'bg-red-700 text-white border-red-800'
                  : 'bg-slate-900 text-white border-slate-800'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{toast.message}</span>
            </div>
          </div>
        ) : null}
      </div>

      {/* Dedicated Crisp A4 Print Surface (Supports Single & Merged Multi-Page Batch Print) */}
      <div className="hidden print:block">
        {(printReports.length > 0 ? printReports : [editorForm]).map((reportItem, idx) => (
          <div key={`print-sheet-${idx}`} className="print-page-break">
            <OfficialReportSheet report={reportItem} isPrintTarget />
          </div>
        ))}
      </div>
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <FirebaseProvider>
        <WorkspaceShell />
      </FirebaseProvider>
    </ErrorBoundary>
  );
}
