import { jsPDF } from 'jspdf';
import type { ActivityReportForm, ActivityReportRecord } from '../types/report';
import { registerDocumentFontInPdf } from './fontRegistry';

export type BatchDateSortOrder = 'asc' | 'desc';

function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('Gagal memuat gambar untuk PDF.'));
    img.src = dataUrl;
  });
}

function detectImageFormat(dataUrl: string): 'PNG' | 'JPEG' {
  if (dataUrl.startsWith('data:image/png')) return 'PNG';
  return 'JPEG';
}

/**
 * Sorts reports strictly by the activity date selected in the form (reportDateIso: YYYY-MM-DD),
 * never by export date. Ties on the same date break stably by createdAt then id.
 */
export function sortReportsByActivityDate(
  reports: ActivityReportRecord[],
  sortOrder: BatchDateSortOrder = 'asc'
): ActivityReportRecord[] {
  const dir = sortOrder === 'asc' ? 1 : -1;
  return [...reports].sort((a, b) => {
    const dateCmp = (a.reportDateIso || '').localeCompare(b.reportDateIso || '');
    if (dateCmp !== 0) return dateCmp * dir;
    const aTime = a.createdAt?.toMillis?.() ?? 0;
    const bTime = b.createdAt?.toMillis?.() ?? 0;
    if (aTime !== bTime) return (aTime - bTime) * dir;
    return a.id.localeCompare(b.id) * dir;
  });
}

async function renderReportPage(
  doc: jsPDF,
  report: ActivityReportForm,
  fontFamily: string
): Promise<void> {
  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 18;
  const marginTop = 16;
  const tableWidth = pageWidth - marginX * 2; // 174mm
  const labelColWidth = 42;
  const valueColWidth = tableWidth - labelColWidth; // 132mm

  doc.setDrawColor(20, 20, 20);
  doc.setLineWidth(0.32);
  doc.setTextColor(20, 20, 20);

  let y = marginTop;

  // Row 1: Header block (3 centered bold lines)
  const headerHeight = 24;
  doc.rect(marginX, y, tableWidth, headerHeight);
  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(10.5);
  doc.text((report.headerTitle || 'LAPORAN KEGIATAN').toUpperCase(), pageWidth / 2, y + 6.5, {
    align: 'center',
  });
  doc.text((report.headerUnit || 'UNIT PKP-PK').toUpperCase(), pageWidth / 2, y + 13, {
    align: 'center',
  });
  doc.text(
    (report.headerLocation || 'UPBU KELAS III TANJUNG API').toUpperCase(),
    pageWidth / 2,
    y + 19.5,
    { align: 'center' }
  );
  y += headerHeight;

  // Helper for standard 2-column text rows
  const drawTextRow = (label: string, value: string, minHeight: number) => {
    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(10);
    const wrappedLines = doc.splitTextToSize(value || '-', valueColWidth - 6) as string[];
    const lineHeight = 5.2;
    const rowHeight = Math.max(minHeight, wrappedLines.length * lineHeight + 5);

    doc.rect(marginX, y, labelColWidth, rowHeight);
    doc.rect(marginX + labelColWidth, y, valueColWidth, rowHeight);

    doc.text(label, marginX + 2.5, y + 6.5);
    doc.text(wrappedLines, marginX + labelColWidth + 2.5, y + 6.5);

    y += rowHeight;
  };

  drawTextRow('Hari / Tanggal', report.dayDateDisplay, 11);
  drawTextRow('Tempat', report.place, 11);
  drawTextRow('Uraian Kegiatan', report.activityDescription, 11);

  // Row 5: Dokumentasi cell (fills generously above signature area)
  const signatureBlockHeight = 58;
  const bottomMargin = 16;
  const docRowHeight = Math.max(118, pageHeight - bottomMargin - signatureBlockHeight - y);

  doc.rect(marginX, y, labelColWidth, docRowHeight);
  doc.rect(marginX + labelColWidth, y, valueColWidth, docRowHeight);

  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(10);
  doc.text('Dokumentasi', marginX + 2.5, y + 6.5);

  if (report.documentationImage) {
    try {
      const dims = await getImageDimensions(report.documentationImage);
      const pad = 5;
      const availW = valueColWidth - pad * 2;
      const availH = docRowHeight - pad * 2;
      const ratio = Math.min(availW / dims.width, availH / dims.height);
      const drawW = dims.width * ratio;
      const drawH = dims.height * ratio;
      const drawX = marginX + labelColWidth + (valueColWidth - drawW) / 2;
      const drawY = y + (docRowHeight - drawH) / 2;
      doc.addImage(
        report.documentationImage,
        detectImageFormat(report.documentationImage),
        drawX,
        drawY,
        drawW,
        drawH,
        undefined,
        'FAST'
      );
    } catch {
      doc.setFontSize(9.5);
      doc.setTextColor(120, 120, 120);
      doc.text(
        'Dokumentasi gagal dimuat',
        marginX + labelColWidth + valueColWidth / 2,
        y + docRowHeight / 2,
        {
          align: 'center',
        }
      );
      doc.setTextColor(20, 20, 20);
    }
  }

  y += docRowHeight + 14;

  // Signature Footer Block (Left: Yang Membuat Laporan, Right: Mengetahui, KEPALA UNIT PKP-PK)
  const leftSigX = marginX + 4;
  const rightSigX = marginX + tableWidth - 66;

  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(10);
  doc.text('Yang Membuat Laporan', leftSigX, y + 4.5);

  doc.text('Mengetahui,', rightSigX, y);
  doc.text((report.headTitle || 'KEPALA UNIT PKP-PK').toUpperCase(), rightSigX, y + 5);

  const sigBoxY = y + 7.5;
  const sigBoxW = 46;
  const sigBoxH = 20;

  if (report.reporterSignature) {
    try {
      const dims = await getImageDimensions(report.reporterSignature);
      const ratio = Math.min(sigBoxW / dims.width, sigBoxH / dims.height);
      const drawW = dims.width * ratio;
      const drawH = dims.height * ratio;
      doc.addImage(
        report.reporterSignature,
        detectImageFormat(report.reporterSignature),
        leftSigX,
        sigBoxY + (sigBoxH - drawH) / 2,
        drawW,
        drawH
      );
    } catch {
      // Ignore invalid signature image gracefully
    }
  }

  if (report.headSignature) {
    try {
      const dims = await getImageDimensions(report.headSignature);
      const ratio = Math.min(sigBoxW / dims.width, sigBoxH / dims.height);
      const drawW = dims.width * ratio;
      const drawH = dims.height * ratio;
      doc.addImage(
        report.headSignature,
        detectImageFormat(report.headSignature),
        rightSigX,
        sigBoxY + (sigBoxH - drawH) / 2,
        drawW,
        drawH
      );
    } catch {
      // Ignore invalid signature image gracefully
    }
  }

  const nameY = sigBoxY + sigBoxH + 4;

  // Reporter Name (Bold + Underlined) & NIP
  const repName = (report.reporterName || '').toUpperCase();
  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(9.5);
  doc.text(repName, leftSigX, nameY);
  const repNameW = doc.getTextWidth(repName);
  if (repNameW > 0) {
    doc.setLineWidth(0.3);
    doc.line(leftSigX, nameY + 0.8, leftSigX + repNameW, nameY + 0.8);
  }
  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(9);
  if (report.reporterNip.trim()) {
    doc.text(`NIP. ${report.reporterNip.trim()}`, leftSigX, nameY + 4.8);
  }

  // Head Name (Bold + Underlined) & NIP
  const headName = (report.headName || '').toUpperCase();
  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(9.5);
  doc.text(headName, rightSigX, nameY);
  const headNameW = doc.getTextWidth(headName);
  if (headNameW > 0) {
    doc.setLineWidth(0.3);
    doc.line(rightSigX, nameY + 0.8, rightSigX + headNameW, nameY + 0.8);
  }
  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(9);
  if (report.headNip.trim()) {
    doc.text(`NIP. ${report.headNip.trim()}`, rightSigX, nameY + 4.8);
  }
}

/**
 * Generates an exact A4 portrait PDF reproducing the official
 * LAPORAN KEGIATAN UNIT PKP-PK UPBU KELAS III TANJUNG API layout.
 */
export async function exportReportToPdf(report: ActivityReportForm): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const fontFamily = await registerDocumentFontInPdf(doc);
  await renderReportPage(doc, report, fontFamily);

  const safeDate = report.reportDateIso || 'laporan';
  doc.save(`Laporan_Kegiatan_PKP-PK_${safeDate}.pdf`);
}

/**
 * Merges multiple selected activity reports into a single A4 portrait PDF,
 * strictly ordered by form activity date (reportDateIso), 1 report per A4 page.
 */
export async function exportReportsBatchToPdf(
  reports: ActivityReportRecord[],
  sortOrder: BatchDateSortOrder = 'asc'
): Promise<void> {
  if (reports.length === 0) return;

  const sorted = sortReportsByActivityDate(reports, sortOrder);
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const fontFamily = await registerDocumentFontInPdf(doc);

  for (let i = 0; i < sorted.length; i++) {
    if (i > 0) {
      doc.addPage('a4', 'portrait');
    }
    await renderReportPage(doc, sorted[i], fontFamily);
  }

  const dates = sorted
    .map((r) => r.reportDateIso)
    .filter((d): d is string => Boolean(d))
    .sort((a, b) => a.localeCompare(b));

  const firstDate = dates[0] || 'awal';
  const lastDate = dates[dates.length - 1] || firstDate;
  const filename =
    firstDate === lastDate
      ? `Laporan_Kegiatan_PKP-PK_${firstDate}_(${sorted.length}_laporan).pdf`
      : `Laporan_Kegiatan_PKP-PK_${firstDate}_sd_${lastDate}.pdf`;

  doc.save(filename);
}
