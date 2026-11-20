import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Layers,
  ListFilter,
  Plus,
} from 'lucide-react';
import { useFirebase } from '../contexts/FirebaseContext';
import {
  buildActivityStatRows,
  type ActivityGroupingMode,
} from '../lib/activityStats';
import {
  getTodayIso,
  INDONESIAN_MONTHS,
  INDONESIAN_MONTHS_SHORT,
} from '../lib/dateUtils';
import type { ActivityReportRecord } from '../types/report';

interface StatisticsViewProps {
  onOpenArchiveFiltered: (options: { month: string; search?: string }) => void;
  onCreateNew: () => void;
}

interface MonthlyBucket {
  monthIndex: number; // 0..11
  monthCode: string; // '01'..'12'
  monthKey: string; // YYYY-MM
  monthName: string;
  monthShort: string;
  count: number;
  withPhoto: number;
  withFullSignatures: number;
  topPlace: string;
  topPlaceCount: number;
}

interface BreakdownRow {
  label: string;
  sublabel?: string;
  count: number;
  sharePercent: number;
}

function getNiceChartMax(maxValue: number): number {
  if (maxValue <= 4) return 4;
  if (maxValue <= 8) return 8;
  if (maxValue <= 12) return 12;
  if (maxValue <= 20) return 20;
  const step = Math.ceil(maxValue / 4 / 5) * 5;
  return step * 4;
}

export const StatisticsView: React.FC<StatisticsViewProps> = ({
  onOpenArchiveFiltered,
  onCreateNew,
}) => {
  const { reports, reportsLoading } = useFirebase();
  const currentYear = getTodayIso().slice(0, 4);

  const availableYears = useMemo(() => {
    const yearSet = new Set<string>();
    for (const r of reports) {
      if (r.reportDateIso && /^[0-9]{4}-/.test(r.reportDateIso)) {
        yearSet.add(r.reportDateIso.slice(0, 4));
      }
    }
    if (yearSet.size === 0) {
      yearSet.add(currentYear);
    }
    return Array.from(yearSet).sort((a, b) => b.localeCompare(a));
  }, [reports, currentYear]);

  const [selectedYear, setSelectedYear] = useState<string>(() => availableYears[0] || currentYear);
  const [selectedPeriodMonth, setSelectedPeriodMonth] = useState<string>('all'); // 'all' | '01'..'12'
  const [activityMode, setActivityMode] = useState<ActivityGroupingMode>('auto');
  const [expandedActivityKey, setExpandedActivityKey] = useState<string | null>(null);
  const [showAllActivityBars, setShowAllActivityBars] = useState(false);
  const [onlyActiveMonths, setOnlyActiveMonths] = useState(false);
  const [hoveredMonthIdx, setHoveredMonthIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0] || currentYear);
      setSelectedPeriodMonth('all');
    }
  }, [availableYears, selectedYear, currentYear]);

  // Reset expanded accordion when switching period or grouping mode
  useEffect(() => {
    setExpandedActivityKey(null);
    setShowAllActivityBars(false);
  }, [selectedYear, selectedPeriodMonth, activityMode]);

  const yearReports = useMemo<ActivityReportRecord[]>(
    () => reports.filter((r) => r.reportDateIso.startsWith(`${selectedYear}-`)),
    [reports, selectedYear]
  );

  const monthlyBuckets = useMemo<MonthlyBucket[]>(() => {
    const buckets: MonthlyBucket[] = INDONESIAN_MONTHS.map((name, idx) => {
      const mm = String(idx + 1).padStart(2, '0');
      return {
        monthIndex: idx,
        monthCode: mm,
        monthKey: `${selectedYear}-${mm}`,
        monthName: name,
        monthShort: INDONESIAN_MONTHS_SHORT[idx],
        count: 0,
        withPhoto: 0,
        withFullSignatures: 0,
        topPlace: '—',
        topPlaceCount: 0,
      };
    });

    const placeCounters: Array<Map<string, number>> = Array.from(
      { length: 12 },
      () => new Map<string, number>()
    );

    for (const r of yearReports) {
      const monthNum = Number(r.reportDateIso.slice(5, 7));
      if (Number.isNaN(monthNum) || monthNum < 1 || monthNum > 12) continue;
      const idx = monthNum - 1;
      const bucket = buckets[idx];
      bucket.count += 1;
      if (r.documentationImage) bucket.withPhoto += 1;
      if (r.reporterSignature && r.headSignature) bucket.withFullSignatures += 1;

      const placeClean = r.place.trim() || 'Tanpa Lokasi';
      placeCounters[idx].set(placeClean, (placeCounters[idx].get(placeClean) ?? 0) + 1);
    }

    for (let i = 0; i < 12; i += 1) {
      let bestPlace = '—';
      let bestCount = 0;
      for (const [place, cnt] of placeCounters[i].entries()) {
        if (cnt > bestCount) {
          bestCount = cnt;
          bestPlace = place;
        }
      }
      buckets[i].topPlace = bestPlace;
      buckets[i].topPlaceCount = bestCount;
    }

    return buckets;
  }, [yearReports, selectedYear]);

  const isMonthlyMode = selectedPeriodMonth !== 'all';
  const selectedMonthIdx = isMonthlyMode ? Number(selectedPeriodMonth) - 1 : -1;
  const activeMonthKey = isMonthlyMode ? `${selectedYear}-${selectedPeriodMonth}` : 'all';

  const periodLabel = useMemo(() => {
    if (!isMonthlyMode || selectedMonthIdx < 0 || selectedMonthIdx > 11) {
      return `Tahun ${selectedYear}`;
    }
    return `${INDONESIAN_MONTHS[selectedMonthIdx]} ${selectedYear}`;
  }, [isMonthlyMode, selectedMonthIdx, selectedYear]);

  const periodReports = useMemo<ActivityReportRecord[]>(() => {
    if (!isMonthlyMode) return yearReports;
    return yearReports.filter((r) => r.reportDateIso.startsWith(`${selectedYear}-${selectedPeriodMonth}`));
  }, [yearReports, isMonthlyMode, selectedYear, selectedPeriodMonth]);

  const activityRows = useMemo(
    () => buildActivityStatRows(periodReports, activityMode),
    [periodReports, activityMode]
  );

  const periodSummary = useMemo(() => {
    const total = periodReports.length;
    const yearTotal = yearReports.length;
    const shareOfYear = yearTotal > 0 ? Math.round((total / yearTotal) * 100) : 0;
    const topActivity = activityRows[0] ?? null;

    const totalWithPhoto = periodReports.filter((r) => Boolean(r.documentationImage)).length;
    const totalFullSig = periodReports.filter(
      (r) => Boolean(r.reporterSignature) && Boolean(r.headSignature)
    ).length;
    const photoPercent = total > 0 ? Math.round((totalWithPhoto / total) * 100) : 0;
    const sigPercent = total > 0 ? Math.round((totalFullSig / total) * 100) : 0;

    return {
      total,
      yearTotal,
      shareOfYear,
      distinctActivities: activityRows.length,
      topActivity,
      totalWithPhoto,
      totalFullSig,
      photoPercent,
      sigPercent,
    };
  }, [periodReports, yearReports, activityRows]);

  const yearlyTotals = useMemo(() => {
    const totalYear = yearReports.length;
    const activeMonths = monthlyBuckets.filter((b) => b.count > 0).length;
    let peakBucket: MonthlyBucket | null = null;
    for (const b of monthlyBuckets) {
      if (b.count > 0 && (!peakBucket || b.count > peakBucket.count)) {
        peakBucket = b;
      }
    }
    const totalWithPhoto = yearReports.filter((r) => Boolean(r.documentationImage)).length;
    const totalFullSig = yearReports.filter(
      (r) => Boolean(r.reporterSignature) && Boolean(r.headSignature)
    ).length;
    const photoPercent = totalYear > 0 ? Math.round((totalWithPhoto / totalYear) * 100) : 0;
    const sigPercent = totalYear > 0 ? Math.round((totalFullSig / totalYear) * 100) : 0;
    return {
      totalYear,
      activeMonths,
      peakBucket,
      totalWithPhoto,
      totalFullSig,
      photoPercent,
      sigPercent,
    };
  }, [yearReports, monthlyBuckets]);

  const placeBreakdown = useMemo<BreakdownRow[]>(() => {
    const total = periodReports.length;
    if (total === 0) return [];
    const counts = new Map<string, number>();
    for (const r of periodReports) {
      const key = r.place.trim() || 'Tanpa Lokasi';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([label, count]) => ({
        label,
        count,
        sharePercent: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [periodReports]);

  const reporterBreakdown = useMemo<BreakdownRow[]>(() => {
    const total = periodReports.length;
    if (total === 0) return [];
    const counts = new Map<string, { name: string; nip: string; count: number }>();
    for (const r of periodReports) {
      const name = r.reporterName.trim() || 'Tanpa Nama';
      const nip = r.reporterNip.trim();
      const key = `${name.toLowerCase()}__${nip}`;
      const existing = counts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(key, { name, nip, count: 1 });
      }
    }
    return Array.from(counts.values())
      .map((item) => ({
        label: item.name,
        sublabel: item.nip ? `NIP. ${item.nip}` : undefined,
        count: item.count,
        sharePercent: Math.round((item.count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [periodReports]);

  const maxMonthlyCount = useMemo(
    () => monthlyBuckets.reduce((max, b) => Math.max(max, b.count), 0),
    [monthlyBuckets]
  );
  const chartMax = getNiceChartMax(maxMonthlyCount);
  const yTicks = [chartMax, (chartMax * 3) / 4, chartMax / 2, chartMax / 4, 0];

  const maxActivityCount = activityRows[0]?.count ?? 0;
  const visibleActivityBars = showAllActivityBars ? activityRows : activityRows.slice(0, 8);

  const currentYearIdx = availableYears.indexOf(selectedYear);
  const canGoPrevYear = currentYearIdx >= 0 && currentYearIdx < availableYears.length - 1;
  const canGoNextYear = currentYearIdx > 0;

  const displayedTableBuckets = onlyActiveMonths
    ? monthlyBuckets.filter((b) => b.count > 0)
    : monthlyBuckets;

  const hoveredBucket = hoveredMonthIdx !== null ? monthlyBuckets[hoveredMonthIdx] : null;

  const handleSelectYear = (nextYear: string) => {
    setSelectedYear(nextYear);
    setSelectedPeriodMonth('all');
  };

  const handleStepMonth = (delta: -1 | 1) => {
    if (!isMonthlyMode) return;
    const nextIdx = selectedMonthIdx + delta;
    if (nextIdx < 0 || nextIdx > 11) return;
    setSelectedPeriodMonth(String(nextIdx + 1).padStart(2, '0'));
  };

  const handleSelectMonthFromChart = (monthCode: string) => {
    setSelectedPeriodMonth((prev) => (prev === monthCode ? 'all' : monthCode));
  };

  if (reportsLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-lg grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-5 space-y-2.5">
              <div className="h-3 w-28 bg-slate-100 rounded" />
              <div className="h-7 w-20 bg-slate-100 rounded" />
              <div className="h-3 w-36 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-6 h-72 animate-pulse">
          <div className="h-4 w-56 bg-slate-100 rounded mb-6" />
          <div className="h-44 w-full bg-slate-100 rounded" />
        </div>
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg py-16 px-6 text-center space-y-4">
        <div className="w-11 h-11 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
          <BarChart3 className="w-5 h-5" />
        </div>
        <div className="space-y-1 max-w-md mx-auto">
          <h2 className="text-base font-semibold text-slate-900">
            Belum Ada Data Statistik Kegiatan
          </h2>
          <p className="text-sm text-slate-500">
            Statistik per kegiatan, tren bulanan, rekap lokasi, dan daftar pembuat laporan akan
            dihitung otomatis setelah laporan kegiatan pertama tersimpan.
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
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header + Year & Month Period Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">
            Statistik Per Kegiatan &amp; Bulanan
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Menampilkan statistik{' '}
            <span className="font-semibold text-slate-700">{periodLabel}</span> berdasarkan
            tanggal kegiatan pada formulir laporan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Year Stepper */}
          <div className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-md p-1">
            <button
              type="button"
              disabled={!canGoPrevYear}
              onClick={() => {
                if (canGoPrevYear) handleSelectYear(availableYears[currentYearIdx + 1]);
              }}
              aria-label="Tahun sebelumnya"
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed rounded transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <select
              value={selectedYear}
              onChange={(e) => handleSelectYear(e.target.value)}
              aria-label="Pilih tahun statistik"
              className="px-2 py-1 text-xs font-semibold font-mono tabular-nums text-slate-900 bg-transparent focus:outline-none cursor-pointer"
            >
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  Tahun {yr}
                </option>
              ))}
            </select>

            <button
              type="button"
              disabled={!canGoNextYear}
              onClick={() => {
                if (canGoNextYear) handleSelectYear(availableYears[currentYearIdx - 1]);
              }}
              aria-label="Tahun berikutnya"
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed rounded transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Month Period Filter */}
          <div className="inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-md px-2.5 py-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <select
              value={selectedPeriodMonth}
              onChange={(e) => setSelectedPeriodMonth(e.target.value)}
              aria-label="Pilih periode bulan statistik"
              className="text-xs font-semibold text-slate-900 bg-transparent focus:outline-none cursor-pointer pr-1"
            >
              <option value="all">
                Semua Bulan ({yearlyTotals.totalYear} kegiatan)
              </option>
              {monthlyBuckets.map((b) => (
                <option key={b.monthCode} value={b.monthCode}>
                  {b.monthName} {selectedYear} ({b.count})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Contextual Active Month Bar (when viewing a specific month) */}
      {isMonthlyMode ? (
        <div className="bg-slate-900 text-white rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold">Mode Per Bulan:</span>
            <span className="font-bold text-white">{periodLabel}</span>
            <span className="text-slate-400" aria-hidden="true">
              ·
            </span>
            <span className="font-mono tabular-nums text-slate-200">
              {periodSummary.total} kegiatan ({periodSummary.shareOfYear}% dari {selectedYear})
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              disabled={selectedMonthIdx <= 0}
              onClick={() => handleStepMonth(-1)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Bulan Lalu
            </button>
            <button
              type="button"
              disabled={selectedMonthIdx >= 11}
              onClick={() => handleStepMonth(1)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Bulan Berikut
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setSelectedPeriodMonth('all')}
              className="px-2.5 py-1.5 text-xs font-medium text-slate-200 border border-slate-700 hover:bg-slate-800 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Lihat 1 Tahun
            </button>
            {periodSummary.total > 0 ? (
              <button
                type="button"
                onClick={() => onOpenArchiveFiltered({ month: activeMonthKey, search: '' })}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Buka Arsip Bulan Ini
                <ArrowRight className="w-3 h-3" />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Flat Single-Elevation 4-KPI Summary Strip (Dynamic for Year or Selected Month) */}
      <div className="bg-white border border-slate-200 rounded-lg grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">
            Total Kegiatan ({periodLabel})
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
              {periodSummary.total}
            </span>
            <span className="text-xs text-slate-500">laporan</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-mono tabular-nums">
            {isMonthlyMode
              ? `${periodSummary.shareOfYear}% dari ${periodSummary.yearTotal} kegiatan tahun ${selectedYear}`
              : `${reports.length} total arsip seluruh tahun`}
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">
            {activityMode === 'auto' ? 'Kategori Kegiatan Aktif' : 'Variasi Uraian Kegiatan'}
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
              {periodSummary.distinctActivities}
            </span>
            <span className="text-xs text-slate-500">
              {activityMode === 'auto' ? 'kelompok' : 'uraian'}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {activityMode === 'auto'
              ? 'Dikelompokkan otomatis dari uraian'
              : 'Berdasarkan teks uraian persis'}
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">Kegiatan Paling Sering</div>
          <div className="mt-1.5">
            <span
              className="block text-sm font-bold text-slate-900 truncate"
              title={periodSummary.topActivity?.label || '—'}
            >
              {periodSummary.topActivity ? periodSummary.topActivity.label : '—'}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1.5 font-mono tabular-nums">
            {periodSummary.topActivity
              ? `${periodSummary.topActivity.count} kali (${periodSummary.topActivity.sharePercent}% dari periode)`
              : 'Belum ada kegiatan pada periode ini'}
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">Kelengkapan Foto Kolase</div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold font-mono tabular-nums ${
                periodSummary.photoPercent === 100 && periodSummary.total > 0
                  ? 'text-emerald-700'
                  : periodSummary.photoPercent >= 70
                    ? 'text-slate-900'
                    : 'text-amber-700'
              }`}
            >
              {periodSummary.photoPercent}%
            </span>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              ({periodSummary.totalWithPhoto}/{periodSummary.total})
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-mono tabular-nums">
            TTD lengkap: {periodSummary.totalFullSig}/{periodSummary.total} (
            {periodSummary.sigPercent}%)
          </div>
        </div>
      </div>

      {/* PRIMARY SECTION: Per-Activity Statistics (Horizontal Bar Chart + Expandable Table) */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Statistik Per Kegiatan — {periodLabel}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Frekuensi pelaksanaan setiap kegiatan yang diolah otomatis dari kolom Uraian Kegiatan.
            </p>
          </div>

          {/* Grouping Mode Switcher */}
          <div
            className="inline-flex items-center gap-1 p-0.5 bg-slate-100 rounded-md self-start sm:self-auto"
            role="group"
            aria-label="Mode pengelompokan kegiatan"
          >
            <button
              type="button"
              onClick={() => setActivityMode('auto')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activityMode === 'auto'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Kelompok Otomatis
            </button>
            <button
              type="button"
              onClick={() => setActivityMode('exact')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activityMode === 'exact'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" />
              Rinci per Uraian
            </button>
          </div>
        </div>

        {activityRows.length === 0 ? (
          <div className="py-12 px-6 text-center space-y-3">
            <p className="text-sm text-slate-600">
              Belum ada laporan kegiatan tercatat pada{' '}
              <span className="font-semibold text-slate-900">{periodLabel}</span>.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {isMonthlyMode ? (
                <button
                  type="button"
                  onClick={() => setSelectedPeriodMonth('all')}
                  className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md cursor-pointer"
                >
                  Kembali ke Tahun {selectedYear}
                </button>
              ) : null}
              <button
                type="button"
                onClick={onCreateNew}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 rounded-md cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Buat Laporan Baru
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Horizontal Bar Chart Visual */}
            <div className="p-5 sm:p-6 border-b border-slate-200 space-y-3.5">
              <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                <span>
                  Perbandingan frekuensi kegiatan ({activityRows.length}{' '}
                  {activityMode === 'auto' ? 'kategori' : 'uraian'})
                </span>
                <span className="hidden sm:inline">
                  Klik batang untuk melihat daftar laporan pada tabel di bawah
                </span>
              </div>

              <div className="space-y-3">
                {visibleActivityBars.map((row, idx) => {
                  const widthPct =
                    maxActivityCount > 0 ? Math.max(4, (row.count / maxActivityCount) * 100) : 0;
                  const isTop = idx === 0;
                  const isExpanded = expandedActivityKey === row.key;

                  return (
                    <button
                      key={`bar-${row.key}`}
                      type="button"
                      onClick={() =>
                        setExpandedActivityKey((prev) => (prev === row.key ? null : row.key))
                      }
                      className={`w-full text-left group rounded-md px-2 py-1.5 -mx-2 transition-colors cursor-pointer ${
                        isExpanded ? 'bg-slate-50' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-3 text-xs mb-1.5">
                        <span className="font-medium text-slate-900 truncate group-hover:text-red-700 transition-colors">
                          {row.label}
                        </span>
                        <span className="font-mono tabular-nums text-slate-600 shrink-0">
                          <strong className={isTop ? 'text-red-700' : 'text-slate-900'}>
                            {row.count}
                          </strong>{' '}
                          <span className="text-slate-400">({row.sharePercent}%)</span>
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-100 rounded-xs overflow-hidden">
                        <div
                          style={{ width: `${widthPct}%` }}
                          className={`h-full transition-all duration-200 ${
                            isTop
                              ? 'bg-red-700 group-hover:bg-red-800'
                              : 'bg-slate-900 group-hover:bg-slate-700'
                          }`}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>

              {activityRows.length > 8 ? (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAllActivityBars((prev) => !prev)}
                    className="text-xs font-medium text-slate-600 hover:text-slate-900 underline underline-offset-2 cursor-pointer"
                  >
                    {showAllActivityBars
                      ? 'Ringkas grafik (tampilkan 8 teratas)'
                      : `Tampilkan semua ${activityRows.length} kegiatan pada grafik`}
                  </button>
                </div>
              ) : null}
            </div>

            {/* Detailed Per-Activity Table with Inline Expandable Report List */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-5">
                      {activityMode === 'auto' ? 'Kelompok Kegiatan' : 'Uraian Kegiatan'}
                    </th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Jumlah</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Porsi</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Foto Kolase</th>
                    <th className="py-3 px-4 whitespace-nowrap">Lokasi Utama</th>
                    <th className="py-3 px-4 whitespace-nowrap">Terakhir</th>
                    <th className="py-3 px-5 text-right whitespace-nowrap">Rincian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {activityRows.map((row) => {
                    const isExpanded = expandedActivityKey === row.key;
                    const photoPct =
                      row.count > 0 ? Math.round((row.withPhoto / row.count) * 100) : 0;

                    return (
                      <React.Fragment key={row.key}>
                        <tr
                          className={`transition-colors ${
                            isExpanded ? 'bg-slate-50/90' : 'hover:bg-slate-50/70'
                          }`}
                        >
                          <td className="py-3 px-5 align-top max-w-md">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedActivityKey((prev) =>
                                  prev === row.key ? null : row.key
                                )
                              }
                              className="text-left group flex items-start gap-2 cursor-pointer"
                            >
                              <span className="mt-0.5 text-slate-400 group-hover:text-slate-700 shrink-0">
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </span>
                              <div className="min-w-0">
                                <div className="font-semibold text-slate-900 group-hover:text-red-700 transition-colors leading-snug">
                                  {row.label}
                                </div>
                                {activityMode === 'auto' && row.sampleDescriptions.length > 0 ? (
                                  <div className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                                    Contoh: {row.sampleDescriptions[0]}
                                  </div>
                                ) : null}
                              </div>
                            </button>
                          </td>

                          <td className="py-3 px-4 align-top text-right font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                            {row.count}
                          </td>

                          <td className="py-3 px-4 align-top text-right font-mono tabular-nums text-xs text-slate-600 whitespace-nowrap">
                            {row.sharePercent}%
                          </td>

                          <td className="py-3 px-4 align-top text-right font-mono tabular-nums text-xs whitespace-nowrap">
                            <span
                              className={
                                photoPct === 100
                                  ? 'text-emerald-700 font-medium'
                                  : 'text-slate-600'
                              }
                            >
                              {row.withPhoto}/{row.count}
                            </span>
                          </td>

                          <td className="py-3 px-4 align-top text-xs text-slate-600 whitespace-nowrap">
                            {row.topPlace}
                          </td>

                          <td className="py-3 px-4 align-top font-mono tabular-nums text-xs text-slate-500 whitespace-nowrap">
                            {row.latestDateIso || '—'}
                          </td>

                          <td className="py-3 px-5 align-top text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedActivityKey((prev) =>
                                    prev === row.key ? null : row.key
                                  )
                                }
                                className="text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                              >
                                {isExpanded ? 'Tutup' : 'Daftar'}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  onOpenArchiveFiltered({
                                    month: activeMonthKey,
                                    search: row.searchQuery,
                                  })
                                }
                                className="inline-flex items-center gap-1 text-xs font-medium text-red-700 hover:text-red-800 hover:underline cursor-pointer"
                              >
                                Arsip
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expanded Inline Matched Reports */}
                        {isExpanded ? (
                          <tr className="bg-slate-50/70">
                            <td colSpan={7} className="px-5 py-3 border-t border-slate-100">
                              <div className="pl-6 space-y-2">
                                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                  Daftar Laporan dalam Kelompok Ini ({row.reports.length})
                                </div>
                                <div className="divide-y divide-slate-200/70 border border-slate-200 rounded-md bg-white overflow-hidden">
                                  {row.reports.map((rep) => (
                                    <div
                                      key={rep.id}
                                      className="px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                                    >
                                      <div className="min-w-0 space-y-0.5">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="font-mono tabular-nums font-semibold text-slate-900">
                                            {rep.reportDateIso}
                                          </span>
                                          <span className="text-slate-300" aria-hidden="true">
                                            ·
                                          </span>
                                          <span className="text-slate-700 font-medium">
                                            {rep.place}
                                          </span>
                                          <span className="text-slate-300" aria-hidden="true">
                                            ·
                                          </span>
                                          <span className="text-slate-500">{rep.reporterName}</span>
                                        </div>
                                        <div className="text-slate-700 leading-snug">
                                          {rep.activityDescription}
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onOpenArchiveFiltered({
                                            month: rep.reportDateIso.slice(0, 7),
                                            search: rep.activityDescription
                                              .replace(/\s+/g, ' ')
                                              .trim()
                                              .slice(0, 36),
                                          })
                                        }
                                        className="inline-flex items-center gap-1 text-xs font-medium text-red-700 hover:underline whitespace-nowrap shrink-0 cursor-pointer self-start sm:self-center"
                                      >
                                        Buka di Arsip
                                        <ArrowRight className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* 12-Month Interactive Trend Chart (Click Bar to Switch Monthly Statistics) */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Tren Kegiatan Bulanan ({selectedYear})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Klik batang bulan mana saja untuk memfokuskan statistik ke bulan tersebut. Klik ulang
              untuk kembali ke tampilan 1 tahun penuh.
            </p>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-slate-500 shrink-0">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-red-700 inline-block" />
              {isMonthlyMode ? 'Bulan dipilih' : 'Bulan puncak'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-slate-900 inline-block" />
              Bulan aktif
            </span>
          </div>
        </div>

        <div className="relative pt-5">
          <div className="flex items-stretch gap-3">
            {/* Y-Axis Labels */}
            <div className="w-7 h-48 flex flex-col justify-between text-right text-[11px] font-mono tabular-nums text-slate-400 select-none shrink-0">
              {yTicks.map((tick, i) => (
                <span
                  key={i}
                  className="leading-none -translate-y-1/2 first:translate-y-0 last:translate-y-0"
                >
                  {Number.isInteger(tick) ? tick : tick.toFixed(1)}
                </span>
              ))}
            </div>

            {/* Plot Area + X-Axis */}
            <div className="flex-1 min-w-0">
              <div className="relative h-48">
                <div
                  className="absolute inset-0 flex flex-col justify-between pointer-events-none"
                  aria-hidden="true"
                >
                  {yTicks.map((_, idx) => (
                    <div
                      key={idx}
                      className={`w-full border-t ${
                        idx === yTicks.length - 1
                          ? 'border-slate-300'
                          : 'border-dashed border-slate-100'
                      }`}
                    />
                  ))}
                </div>

                <div className="relative z-10 grid grid-cols-12 gap-1.5 sm:gap-2.5 h-full items-end">
                  {monthlyBuckets.map((bucket) => {
                    const heightPercent =
                      bucket.count > 0 ? Math.max(4, (bucket.count / chartMax) * 100) : 0;
                    const isSelectedBar = selectedPeriodMonth === bucket.monthCode;
                    const isPeak =
                      !isMonthlyMode &&
                      yearlyTotals.peakBucket !== null &&
                      bucket.count === yearlyTotals.peakBucket.count &&
                      bucket.count > 0;
                    const isHovered = hoveredMonthIdx === bucket.monthIndex;

                    const barColorClass =
                      bucket.count === 0
                        ? isSelectedBar
                          ? 'bg-red-700'
                          : 'bg-slate-200'
                        : isSelectedBar || isPeak
                          ? isHovered
                            ? 'bg-red-800'
                            : 'bg-red-700'
                          : isMonthlyMode
                            ? isHovered
                              ? 'bg-slate-700'
                              : 'bg-slate-400'
                            : isHovered
                              ? 'bg-slate-700'
                              : 'bg-slate-900';

                    return (
                      <button
                        key={bucket.monthKey}
                        type="button"
                        onMouseEnter={() => setHoveredMonthIdx(bucket.monthIndex)}
                        onMouseLeave={() => setHoveredMonthIdx(null)}
                        onFocus={() => setHoveredMonthIdx(bucket.monthIndex)}
                        onBlur={() => setHoveredMonthIdx(null)}
                        onClick={() => handleSelectMonthFromChart(bucket.monthCode)}
                        title={
                          isSelectedBar
                            ? `${bucket.monthName} ${selectedYear} (sedang dipilih) — klik untuk kembali ke 1 tahun`
                            : `${bucket.monthName} ${selectedYear}: ${bucket.count} kegiatan — klik untuk lihat statistik bulan ini`
                        }
                        className="group h-full flex flex-col justify-end items-center focus:outline-none cursor-pointer"
                      >
                        <div
                          style={{
                            height: bucket.count > 0 ? `${heightPercent}%` : '3px',
                          }}
                          className={`relative w-full max-w-[36px] rounded-t-xs transition-all duration-150 ${barColorClass}`}
                        >
                          <span
                            className={`absolute -top-5 left-1/2 -translate-x-1/2 text-[11px] font-mono tabular-nums whitespace-nowrap transition-colors ${
                              isSelectedBar || isPeak
                                ? 'font-bold text-red-700'
                                : bucket.count === 0
                                  ? 'text-slate-300'
                                  : isHovered
                                    ? 'font-bold text-slate-950'
                                    : 'font-semibold text-slate-700'
                            }`}
                          >
                            {bucket.count}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-12 gap-1.5 sm:gap-2.5 mt-2">
                {monthlyBuckets.map((bucket) => {
                  const isSelectedBar = selectedPeriodMonth === bucket.monthCode;
                  const isHovered = hoveredMonthIdx === bucket.monthIndex;
                  return (
                    <button
                      key={`x-${bucket.monthKey}`}
                      type="button"
                      onClick={() => handleSelectMonthFromChart(bucket.monthCode)}
                      className={`text-center text-[11px] py-0.5 rounded transition-colors cursor-pointer ${
                        isSelectedBar
                          ? 'bg-red-700 text-white font-semibold'
                          : isHovered
                            ? 'text-red-700 font-semibold'
                            : bucket.count > 0
                              ? 'text-slate-700 font-medium'
                              : 'text-slate-400'
                      }`}
                    >
                      {bucket.monthShort}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 min-h-[28px]">
            {hoveredBucket ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-semibold text-slate-900">
                  {hoveredBucket.monthName} {selectedYear}
                </span>
                <span className="font-mono tabular-nums text-slate-700">
                  {hoveredBucket.count} kegiatan
                </span>
                <span className="font-mono tabular-nums">
                  Foto kolase: {hoveredBucket.withPhoto}/{hoveredBucket.count}
                </span>
                {hoveredBucket.count > 0 ? (
                  <span>Lokasi terbanyak: {hoveredBucket.topPlace}</span>
                ) : null}
              </div>
            ) : (
              <span>
                Klik salah satu bulan pada grafik untuk langsung menyaring seluruh statistik ke
                bulan tersebut.
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Side-by-Side Breakdowns (Dynamically reflect Year or Selected Month) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="text-sm font-bold text-slate-900">
              Distribusi Lokasi Kegiatan — {periodLabel}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Urutan lokasi berdasarkan frekuensi pelaksanaan kegiatan pada periode terpilih.
            </p>
          </div>

          {placeBreakdown.length === 0 ? (
            <div className="p-6 text-xs text-slate-500 text-center">
              Belum ada data lokasi untuk {periodLabel}.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {placeBreakdown.map((row) => (
                <div key={row.label} className="px-5 py-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-medium text-slate-900 truncate">{row.label}</span>
                    <span className="font-mono tabular-nums text-slate-700 shrink-0">
                      <strong className="text-slate-900">{row.count}</strong>{' '}
                      <span className="text-slate-400">({row.sharePercent}%)</span>
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-xs overflow-hidden">
                    <div style={{ width: `${row.sharePercent}%` }} className="h-full bg-slate-800" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="text-sm font-bold text-slate-900">
              Rekap Pembuat Laporan — {periodLabel}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Jumlah laporan per petugas pembuat laporan pada periode terpilih.
            </p>
          </div>

          {reporterBreakdown.length === 0 ? (
            <div className="p-6 text-xs text-slate-500 text-center">
              Belum ada data pembuat laporan untuk {periodLabel}.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {reporterBreakdown.map((row) => (
                <div
                  key={`${row.label}-${row.sublabel ?? ''}`}
                  className="px-5 py-3 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-900 truncate">{row.label}</div>
                    {row.sublabel ? (
                      <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5">
                        {row.sublabel}
                      </div>
                    ) : null}
                  </div>
                  <div className="text-right font-mono tabular-nums text-xs shrink-0">
                    <span className="font-semibold text-slate-900">{row.count}</span>{' '}
                    <span className="text-slate-400">({row.sharePercent}%)</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* High-Density Monthly Recap Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Tabel Rekap Bulanan ({selectedYear})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pilih bulan untuk melihat statistik per kegiatan bulan tersebut atau langsung buka
              arsipnya.
            </p>
          </div>

          <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none whitespace-nowrap">
            <input
              type="checkbox"
              checked={onlyActiveMonths}
              onChange={(e) => setOnlyActiveMonths(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-slate-300 text-red-700 focus:ring-red-600"
            />
            <span>Hanya bulan yang ada kegiatan</span>
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <th className="py-3 px-5 whitespace-nowrap">Bulan</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Jumlah Kegiatan</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Foto Kolase</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">TTD Lengkap</th>
                <th className="py-3 px-4 whitespace-nowrap">Lokasi Terbanyak</th>
                <th className="py-3 px-5 text-right whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {displayedTableBuckets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 px-5 text-center text-xs text-slate-500">
                    Tidak ada kegiatan tercatat pada tahun {selectedYear}.
                  </td>
                </tr>
              ) : (
                displayedTableBuckets.map((bucket) => {
                  const isSelectedRow = selectedPeriodMonth === bucket.monthCode;
                  const photoPct =
                    bucket.count > 0 ? Math.round((bucket.withPhoto / bucket.count) * 100) : 0;
                  const barPct =
                    maxMonthlyCount > 0 ? Math.round((bucket.count / maxMonthlyCount) * 100) : 0;

                  return (
                    <tr
                      key={bucket.monthKey}
                      className={`transition-colors ${
                        isSelectedRow
                          ? 'bg-red-50/50 hover:bg-red-50/70'
                          : bucket.count > 0
                            ? 'hover:bg-slate-50/80'
                            : 'text-slate-400'
                      }`}
                    >
                      <td className="py-2.5 px-5 whitespace-nowrap">
                        <span
                          className={`font-medium ${
                            isSelectedRow
                              ? 'text-red-800 font-semibold'
                              : bucket.count > 0
                                ? 'text-slate-900'
                                : 'text-slate-400'
                          }`}
                        >
                          {bucket.monthName}
                        </span>
                        <span className="ml-2 text-[11px] font-mono tabular-nums text-slate-400">
                          {bucket.monthKey}
                        </span>
                      </td>

                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-2.5">
                          <div className="hidden sm:block w-16 h-1.5 bg-slate-100 rounded-xs overflow-hidden">
                            <div
                              style={{ width: `${barPct}%` }}
                              className={`h-full ${
                                isSelectedRow || yearlyTotals.peakBucket?.monthKey === bucket.monthKey
                                  ? 'bg-red-700'
                                  : 'bg-slate-800'
                              }`}
                            />
                          </div>
                          <span
                            className={`font-mono tabular-nums font-semibold ${
                              bucket.count > 0 ? 'text-slate-900' : 'text-slate-400'
                            }`}
                          >
                            {bucket.count}
                          </span>
                        </div>
                      </td>

                      <td className="py-2.5 px-4 text-right whitespace-nowrap font-mono tabular-nums text-xs">
                        {bucket.count > 0 ? (
                          <span
                            className={
                              photoPct === 100 ? 'text-emerald-700 font-medium' : 'text-slate-700'
                            }
                          >
                            {bucket.withPhoto}/{bucket.count} ({photoPct}%)
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      <td className="py-2.5 px-4 text-right whitespace-nowrap font-mono tabular-nums text-xs">
                        {bucket.count > 0 ? (
                          <span className="text-slate-700">
                            {bucket.withFullSignatures}/{bucket.count}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      <td className="py-2.5 px-4 whitespace-nowrap text-xs text-slate-600">
                        {bucket.count > 0 ? (
                          <span>
                            {bucket.topPlace}{' '}
                            <span className="font-mono tabular-nums text-slate-400">
                              ({bucket.topPlaceCount})
                            </span>
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      <td className="py-2.5 px-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPeriodMonth(isSelectedRow ? 'all' : bucket.monthCode);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className={`text-xs font-medium cursor-pointer ${
                              isSelectedRow
                                ? 'text-slate-700 underline underline-offset-2'
                                : 'text-slate-600 hover:text-slate-950'
                            }`}
                          >
                            {isSelectedRow ? 'Sedang Dilihat' : 'Lihat Statistik'}
                          </button>
                          {bucket.count > 0 ? (
                            <button
                              type="button"
                              onClick={() =>
                                onOpenArchiveFiltered({ month: bucket.monthKey, search: '' })
                              }
                              className="inline-flex items-center gap-1 text-xs font-medium text-red-700 hover:text-red-800 hover:underline cursor-pointer"
                            >
                              Arsip
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 border-t border-slate-200 text-xs font-bold text-slate-900">
                <td className="py-3 px-5 whitespace-nowrap">Total Tahun {selectedYear}</td>
                <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                  {yearlyTotals.totalYear}
                </td>
                <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                  {yearlyTotals.totalWithPhoto}/{yearlyTotals.totalYear} ({yearlyTotals.photoPercent}
                  %)
                </td>
                <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                  {yearlyTotals.totalFullSig}/{yearlyTotals.totalYear} ({yearlyTotals.sigPercent}%)
                </td>
                <td className="py-3 px-4 whitespace-nowrap font-normal text-slate-500">
                  {yearlyTotals.activeMonths} bln aktif
                </td>
                <td className="py-3 px-5 text-right whitespace-nowrap font-normal text-slate-500">
                  {isMonthlyMode ? (
                    <button
                      type="button"
                      onClick={() => setSelectedPeriodMonth('all')}
                      className="text-xs font-medium text-red-700 hover:underline cursor-pointer"
                    >
                      Reset ke 1 Tahun
                    </button>
                  ) : (
                    '1 Tahun Penuh'
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
