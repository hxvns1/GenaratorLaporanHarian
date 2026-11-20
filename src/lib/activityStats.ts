import type { ActivityReportRecord } from '../types/report';

export type ActivityGroupingMode = 'auto' | 'exact';

export interface ActivityStatRow {
  key: string;
  label: string;
  count: number;
  sharePercent: number;
  withPhoto: number;
  withFullSignatures: number;
  latestDateIso: string;
  topPlace: string;
  sampleDescriptions: string[];
  searchQuery: string;
  reports: ActivityReportRecord[];
}

interface ActivityCategoryRule {
  label: string;
  keywords: string[];
}

// Ordered by operational specificity for Unit PKP-PK (ARFF) aviation fire & rescue workflows
const PKP_PK_CATEGORY_RULES: ActivityCategoryRule[] = [
  {
    label: 'Standby & Pengamanan Penerbangan',
    keywords: [
      'standby',
      'stand by',
      'take off',
      'takeoff',
      'landing',
      'pesawat',
      'penerbangan',
      'pengamanan',
      'siaga',
      'movement',
      'refueling',
      'avtur',
      'pengisian bahan bakar',
      'darurat',
      'emergency',
      'insiden',
      'kebakaran',
      'pemadaman',
      'evakuasi',
    ],
  },
  {
    label: 'Latihan & Kesiapsiagaan (Drill)',
    keywords: [
      'latihan',
      'drill',
      'simulasi',
      'respon time',
      'response time',
      'penyemprotan',
      'penggelaran selang',
      'gelar selang',
      'olahraga',
      'fisik',
      'samapta',
      'pelatihan',
      'bimtek',
      'diklat',
      'uji coba',
    ],
  },
  {
    label: 'Pengecekan & Perawatan Kendaraan',
    keywords: [
      'kendaraan',
      'foam tender',
      'riv',
      'rapid intervention',
      'mobil',
      'armada',
      'pemanasan',
      'mesin',
      'pompa',
      'tangki',
      'foam',
      'busa',
      'oli',
      'aki',
      'ban',
      'servis',
      'service',
      'perbaikan',
      'maintenance',
      'uji fungsi',
      'running test',
      'pump',
    ],
  },
  {
    label: 'Pengecekan Peralatan & APAR',
    keywords: [
      'apar',
      'peralatan',
      'alat',
      'selang',
      'nozzle',
      'ba set',
      'scba',
      'breathing',
      'hydrant',
      'hidran',
      'apd',
      'baju tahan panas',
      'helm',
      'ht',
      'radio',
      'komunikasi',
      'genset',
      'perlengkapan',
      'inventaris',
    ],
  },
  {
    label: 'Patroli & Inspeksi Sisi Udara',
    keywords: [
      'patroli',
      'inspeksi',
      'runway',
      'taxiway',
      'apron',
      'fod',
      'sisi udara',
      'airside',
      'perimeter',
      'pagar',
      'pengawasan',
      'monitoring',
      'cek area',
    ],
  },
  {
    label: 'Apel & Serah Terima Jaga',
    keywords: [
      'apel',
      'serah terima',
      'pergantian shift',
      'shift',
      'dinas jaga',
      'regu jaga',
      'briefing',
      'piket',
      'absensi',
    ],
  },
  {
    label: 'Kebersihan & Perawatan Fasilitas',
    keywords: [
      'kurve',
      'korve',
      'kebersihan',
      'pembersihan',
      'membersihkan',
      'bersih',
      'mencuci',
      'cuci',
      'garasi',
      'pos jaga',
      'fire station',
      'ruangan',
      'halaman',
      'rumput',
      'taman',
      'fasilitas',
    ],
  },
  {
    label: 'Rapat, Administrasi & Koordinasi',
    keywords: [
      'rapat',
      'koordinasi',
      'evaluasi',
      'administrasi',
      'laporan',
      'pendataan',
      'sosialisasi',
      'pembinaan',
      'kunjungan',
      'tamu',
      'audit',
      'verifikasi',
      'dokumen',
      'logbook',
    ],
  },
];

export function classifyActivityDescription(description: string): string {
  const normalized = description.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!normalized) return 'Kegiatan Operasional Lainnya';

  for (const rule of PKP_PK_CATEGORY_RULES) {
    for (const kw of rule.keywords) {
      if (normalized.includes(kw)) {
        return rule.label;
      }
    }
  }

  return 'Kegiatan Operasional Lainnya';
}

export function normalizeExactActivityLabel(description: string): {
  key: string;
  label: string;
} {
  const singleLine = description
    .replace(/\r?\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.;,]+$/g, '')
    .trim();

  if (!singleLine) {
    return { key: '__empty__', label: 'Tanpa Uraian Kegiatan' };
  }

  const label = singleLine.length > 96 ? `${singleLine.slice(0, 93).trim()}...` : singleLine;
  return {
    key: singleLine.toLowerCase(),
    label,
  };
}

export function buildActivityStatRows(
  reports: ActivityReportRecord[],
  mode: ActivityGroupingMode
): ActivityStatRow[] {
  const total = reports.length;
  if (total === 0) return [];

  const buckets = new Map<
    string,
    {
      key: string;
      label: string;
      reports: ActivityReportRecord[];
      withPhoto: number;
      withFullSignatures: number;
      latestDateIso: string;
      placeCounts: Map<string, number>;
      sampleDescriptions: string[];
      searchQuery: string;
    }
  >();

  for (const report of reports) {
    let key: string;
    let label: string;
    let searchQuery = '';

    if (mode === 'auto') {
      label = classifyActivityDescription(report.activityDescription);
      key = label;
    } else {
      const exact = normalizeExactActivityLabel(report.activityDescription);
      key = exact.key;
      label = exact.label;
      searchQuery = report.activityDescription
        .replace(/\r?\n+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 48);
    }

    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        key,
        label,
        reports: [],
        withPhoto: 0,
        withFullSignatures: 0,
        latestDateIso: '',
        placeCounts: new Map<string, number>(),
        sampleDescriptions: [],
        searchQuery,
      };
      buckets.set(key, bucket);
    }

    bucket.reports.push(report);
    if (report.documentationImage) bucket.withPhoto += 1;
    if (report.reporterSignature && report.headSignature) bucket.withFullSignatures += 1;
    if (report.reportDateIso > bucket.latestDateIso) {
      bucket.latestDateIso = report.reportDateIso;
    }

    const placeClean = report.place.trim() || 'Tanpa Lokasi';
    bucket.placeCounts.set(placeClean, (bucket.placeCounts.get(placeClean) ?? 0) + 1);

    const descShort = report.activityDescription.replace(/\s+/g, ' ').trim();
    if (
      descShort &&
      bucket.sampleDescriptions.length < 2 &&
      !bucket.sampleDescriptions.some((s) => s.toLowerCase() === descShort.toLowerCase())
    ) {
      bucket.sampleDescriptions.push(descShort);
    }
  }

  const rows: ActivityStatRow[] = [];
  for (const b of buckets.values()) {
    let topPlace = '—';
    let topPlaceCount = 0;
    for (const [place, cnt] of b.placeCounts.entries()) {
      if (cnt > topPlaceCount) {
        topPlaceCount = cnt;
        topPlace = place;
      }
    }

    // Sort matching reports newest activity date first
    const sortedReports = [...b.reports].sort((a, bRep) =>
      bRep.reportDateIso.localeCompare(a.reportDateIso)
    );

    rows.push({
      key: b.key,
      label: b.label,
      count: b.reports.length,
      sharePercent: Math.round((b.reports.length / total) * 100),
      withPhoto: b.withPhoto,
      withFullSignatures: b.withFullSignatures,
      latestDateIso: b.latestDateIso,
      topPlace,
      sampleDescriptions: b.sampleDescriptions,
      searchQuery: b.searchQuery,
      reports: sortedReports,
    });
  }

  return rows.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
