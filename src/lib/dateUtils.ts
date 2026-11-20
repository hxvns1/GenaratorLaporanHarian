import type { Timestamp } from 'firebase/firestore';

const INDONESIAN_DAYS = [
  'Minggu',
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
] as const;

export const INDONESIAN_MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
] as const;

export const INDONESIAN_MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
] as const;

export function getTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatIndonesianDayDate(isoDate: string): string {
  const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(isoDate);
  if (!match) return isoDate;
  const year = Number(match[1]);
  const monthIdx = Number(match[2]) - 1;
  const day = Number(match[3]);
  const dt = new Date(year, monthIdx, day);
  if (Number.isNaN(dt.getTime())) return isoDate;

  const dayName = INDONESIAN_DAYS[dt.getDay()];
  const monthName = INDONESIAN_MONTHS[dt.getMonth()];
  return `${dayName} ${day} ${monthName} ${year}`;
}

export function formatMonthYearLabel(ym: string): string {
  const match = /^([0-9]{4})-([0-9]{2})$/.exec(ym);
  if (!match) return ym;
  const year = match[1];
  const monthIdx = Number(match[2]) - 1;
  const monthName = INDONESIAN_MONTHS[monthIdx] ?? match[2];
  return `${monthName} ${year}`;
}

export function formatTimestampShort(ts: Timestamp | null): string {
  if (!ts) return 'Baru saja';
  try {
    const dt = ts.toDate();
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(dt);
  } catch {
    return 'Baru saja';
  }
}

export function formatFileSizeKb(bytesOrChars: number): string {
  const kb = Math.max(1, Math.round(bytesOrChars / 1024));
  return `${kb} KB`;
}
