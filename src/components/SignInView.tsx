import React from 'react';
import { Flame, LogIn } from 'lucide-react';
import { useFirebase } from '../contexts/FirebaseContext';
import { OfficialReportSheet } from './OfficialReportSheet';
import type { ActivityReportForm } from '../types/report';

const PREVIEW_SAMPLE: ActivityReportForm = {
  headerTitle: 'LAPORAN KEGIATAN',
  headerUnit: 'UNIT PKP-PK',
  headerLocation: 'UPBU KELAS III TANJUNG API',
  reportDateIso: '2026-10-20',
  dayDateDisplay: 'Selasa 20 Oktober 2026',
  place: 'Fire Station',
  activityDescription: 'Pembersihan fire station',
  documentationImage: '',
  reporterName: 'FATRINAH',
  reporterNip: '199008202025212032',
  reporterSignature: '',
  headTitle: 'KEPALA UNIT PKP-PK',
  headName: 'MOH. IQRAM',
  headNip: '198302102008011005',
  headSignature: '',
};

export const SignInView: React.FC = () => {
  const { signInWithGoogle, authLoading, authError } = useFirebase();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Clean 3-Zone Top Bar */}
      <header className="bg-white border-b border-slate-200 px-6 lg:px-10 py-4 flex items-center justify-between gap-8">
        <div className="flex items-center gap-2.5 text-slate-900 font-bold tracking-tight whitespace-nowrap shrink-0">
          <span className="w-7 h-7 rounded-md bg-red-700 text-white flex items-center justify-center shrink-0">
            <Flame className="w-4 h-4" />
          </span>
          <span className="text-base">PKP-PK Tanjung Api</span>
        </div>

        <div className="hidden md:flex items-center gap-4 text-xs text-slate-500 whitespace-nowrap">
          <span>UPBU Kelas III Tanjung Api</span>
          <span aria-hidden="true">·</span>
          <span>Sistem Arsip &amp; Pelaporan Kegiatan</span>
        </div>

        <button
          type="button"
          onClick={() => void signInWithGoogle()}
          disabled={authLoading}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 disabled:opacity-60 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <LogIn className="w-3.5 h-3.5" />
          {authLoading ? 'Menghubungkan...' : 'Masuk Petugas'}
        </button>
      </header>

      {/* Main Two-Column Balanced Entry */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 lg:px-10 py-12 lg:py-16 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-6 space-y-7">
          <div className="space-y-3">
            <div className="text-xs font-medium text-slate-500">
              Unit PKP-PK · UPBU Kelas III Tanjung Api
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-950 tracking-tight leading-tight text-balance">
              Laporan Kegiatan Digital dengan Sinkronisasi Real-Time
            </h1>
            <p className="text-base text-slate-600 leading-relaxed max-w-xl">
              Isi formulir laporan kegiatan harian Unit PKP-PK, unggah foto kolase dokumentasi,
              bubuhkan tanda tangan digital, dan cetak langsung sesuai format resmi A4 atau simpan
              sebagai PDF.
            </p>
          </div>

          <div className="space-y-3 pt-1">
            <button
              type="button"
              onClick={() => void signInWithGoogle()}
              disabled={authLoading}
              className="inline-flex items-center justify-center gap-3 px-6 py-3 text-sm font-semibold text-white bg-red-700 hover:bg-red-800 disabled:opacity-60 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              {authLoading ? 'Membuka Login Google...' : 'Masuk dengan Akun Google'}
            </button>

            {authError ? (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3.5 py-2.5 max-w-md">
                {authError}
              </div>
            ) : null}
          </div>

          <div className="pt-6 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm">
            <div className="space-y-1">
              <div className="font-semibold text-slate-900">Sinkronisasi Tim</div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Seluruh petugas melihat dan memperbarui arsip bersama secara instan di database.
              </p>
            </div>
            <div className="space-y-1">
              <div className="font-semibold text-slate-900">Tanda Tangan Digital</div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Gambar langsung di layar atau unggah foto tanda tangan dengan pembersih latar.
              </p>
            </div>
            <div className="space-y-1">
              <div className="font-semibold text-slate-900">Cetak A4 &amp; PDF</div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Tata letak tabel dan kolom dokumentasi presisi mengikuti formulir resmi unit.
              </p>
            </div>
          </div>
        </div>

        {/* Right Preview Frame */}
        <div className="lg:col-span-6">
          <div className="bg-slate-200/70 border border-slate-200 rounded-lg p-5 sm:p-6">
            <div className="flex items-center justify-between text-xs text-slate-600 mb-3">
              <span className="font-medium text-slate-800">Format Dokumen Resmi A4</span>
              <span className="font-mono tabular-nums">210 × 297 mm</span>
            </div>
            <div className="pointer-events-none select-none overflow-hidden rounded border border-slate-200 bg-white">
              <div className="origin-top scale-[0.74] sm:scale-[0.78] -mb-[145px] sm:-mb-[120px]">
                <OfficialReportSheet report={PREVIEW_SAMPLE} />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
