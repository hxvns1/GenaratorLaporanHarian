import React from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { DOCUMENT_FONT_STACK } from '../lib/fontRegistry';
import type { ActivityReportForm } from '../types/report';

interface OfficialReportSheetProps {
  report: ActivityReportForm;
  isPrintTarget?: boolean;
}

/**
 * Exact A4 portrait layout reproducing the official
 * LAPORAN KEGIATAN UNIT PKP-PK UPBU KELAS III TANJUNG API form.
 */
export const OfficialReportSheet: React.FC<OfficialReportSheetProps> = ({
  report,
  isPrintTarget = false,
}) => {
  return (
    <div
      className={`bg-white text-slate-950 ${
        isPrintTarget
          ? 'print-only-sheet w-full'
          : 'w-full max-w-[794px] mx-auto border border-slate-200 shadow-sm aspect-[210/297] p-[7.5%] flex flex-col justify-between'
      }`}
      style={{
        fontFamily: DOCUMENT_FONT_STACK,
        color: '#111111',
      }}
    >
      {/* Main Bordered Official Table */}
      <table className="w-full border-collapse border border-slate-900 text-[13px] leading-snug">
        <tbody>
          {/* Row 1: 3-line Centered Official Header */}
          <tr>
            <td
              colSpan={2}
              className="border border-slate-900 py-3 px-4 text-center font-bold uppercase tracking-wide leading-[1.65]"
            >
              <div>{report.headerTitle || 'LAPORAN KEGIATAN'}</div>
              <div>{report.headerUnit || 'UNIT PKP-PK'}</div>
              <div>{report.headerLocation || 'UPBU KELAS III TANJUNG API'}</div>
            </td>
          </tr>

          {/* Row 2: Hari / Tanggal */}
          <tr>
            <td className="border border-slate-900 py-2.5 px-2.5 w-[25%] align-top">
              Hari / Tanggal
            </td>
            <td className="border border-slate-900 py-2.5 px-2.5 w-[75%] align-top">
              {report.dayDateDisplay || '\u00A0'}
            </td>
          </tr>

          {/* Row 3: Tempat */}
          <tr>
            <td className="border border-slate-900 py-2.5 px-2.5 align-top">Tempat</td>
            <td className="border border-slate-900 py-2.5 px-2.5 align-top">
              {report.place || '\u00A0'}
            </td>
          </tr>

          {/* Row 4: Uraian Kegiatan */}
          <tr>
            <td className="border border-slate-900 py-2.5 px-2.5 align-top">
              Uraian Kegiatan
            </td>
            <td className="border border-slate-900 py-2.5 px-2.5 align-top whitespace-pre-wrap">
              {report.activityDescription || '\u00A0'}
            </td>
          </tr>

          {/* Row 5: Dokumentasi */}
          <tr>
            <td className="border border-slate-900 py-2.5 px-2.5 align-top">
              Dokumentasi
            </td>
            <td
              className={`border border-slate-900 p-3 align-middle ${
                isPrintTarget ? 'h-[132mm]' : 'h-[360px] sm:h-[420px]'
              }`}
            >
              {report.documentationImage ? (
                <div className="w-full h-full flex items-center justify-center">
                  <img
                    src={report.documentationImage}
                    alt="Dokumentasi Kegiatan Unit PKP-PK"
                    referrerPolicy="no-referrer"
                    className={`max-w-full object-contain ${
                      isPrintTarget ? 'max-h-[124mm]' : 'max-h-[340px] sm:max-h-[395px]'
                    }`}
                  />
                </div>
              ) : (
                <div className="no-print w-full h-full border border-dashed border-slate-300 rounded flex flex-col items-center justify-center text-slate-400 gap-2 p-6 text-center">
                  <ImageIcon className="w-7 h-7 stroke-[1.5]" />
                  <span className="text-xs">
                    Belum ada foto kolase dokumentasi yang diunggah
                  </span>
                </div>
              )}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Official Dual Signature Block */}
      <div
        className={`grid grid-cols-2 gap-8 text-[13px] leading-snug ${
          isPrintTarget ? 'mt-12 px-2' : 'mt-10 px-2'
        }`}
      >
        {/* Left: Yang Membuat Laporan */}
        <div className="flex flex-col justify-between">
          <div className="min-h-[36px] flex items-end">
            <span>Yang Membuat Laporan</span>
          </div>

          <div className="h-[72px] my-1.5 flex items-center justify-start">
            {report.reporterSignature ? (
              <img
                src={report.reporterSignature}
                alt={`Tanda tangan ${report.reporterName}`}
                referrerPolicy="no-referrer"
                className="max-h-[68px] max-w-[180px] object-contain"
              />
            ) : null}
          </div>

          <div>
            <div className="font-bold uppercase underline underline-offset-2 decoration-slate-900">
              {report.reporterName || 'NAMA PETUGAS'}
            </div>
            {report.reporterNip.trim() ? (
              <div className="text-[12px] mt-0.5 tabular-nums">
                NIP. {report.reporterNip.trim()}
              </div>
            ) : (
              <div className="text-[12px] mt-0.5 text-slate-400 no-print">NIP. -</div>
            )}
          </div>
        </div>

        {/* Right: Mengetahui, KEPALA UNIT PKP-PK */}
        <div className="flex flex-col justify-between pl-6 sm:pl-12">
          <div className="min-h-[36px]">
            <div>Mengetahui,</div>
            <div className="uppercase">{report.headTitle || 'KEPALA UNIT PKP-PK'}</div>
          </div>

          <div className="h-[72px] my-1.5 flex items-center justify-start">
            {report.headSignature ? (
              <img
                src={report.headSignature}
                alt={`Tanda tangan ${report.headName}`}
                referrerPolicy="no-referrer"
                className="max-h-[68px] max-w-[180px] object-contain"
              />
            ) : null}
          </div>

          <div>
            <div className="font-bold uppercase underline underline-offset-2 decoration-slate-900">
              {report.headName || 'NAMA KEPALA UNIT'}
            </div>
            {report.headNip.trim() ? (
              <div className="text-[12px] mt-0.5 tabular-nums">
                NIP. {report.headNip.trim()}
              </div>
            ) : (
              <div className="text-[12px] mt-0.5 text-slate-400 no-print">NIP. -</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
