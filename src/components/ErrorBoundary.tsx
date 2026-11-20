import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
  isQuotaError: boolean;
  isPermissionError: boolean;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
      isQuotaError: false,
      isPermissionError: false,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let rawMessage = error.message || 'Terjadi kesalahan tidak terduga.';
    try {
      const parsed = JSON.parse(rawMessage) as { error?: string; operationType?: string; path?: string };
      if (parsed && parsed.error) {
        rawMessage = `${parsed.error}${parsed.path ? ` (${parsed.operationType} ${parsed.path})` : ''}`;
      }
    } catch {
      // Plain error string
    }

    const lower = rawMessage.toLowerCase();
    return {
      hasError: true,
      errorMessage: rawMessage,
      isQuotaError: lower.includes('quota exceeded'),
      isPermissionError: lower.includes('permission') || lower.includes('insufficient'),
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Application ErrorBoundary caught:', error, info);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white border border-slate-200 rounded-lg p-8 space-y-5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-md bg-red-50 text-red-700 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg font-bold text-slate-900">
                {this.state.isQuotaError
                  ? 'Kuota Harian Database Tercapai'
                  : this.state.isPermissionError
                    ? 'Akses Database Ditolak'
                    : 'Terjadi Gangguan Aplikasi'}
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                {this.state.isQuotaError
                  ? 'Batas penggunaan harian gratis Firestore telah tercapai dan akan direset keesokan harinya.'
                  : this.state.isPermissionError
                    ? 'Akun Anda tidak memiliki izin yang diperlukan atau sesi autentikasi perlu dimuat ulang.'
                    : 'Aplikasi mengalami kendala saat menyinkronkan data dengan database.'}
              </p>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-xs font-mono text-slate-700 break-words">
            {this.state.errorMessage}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                this.setState({
                  hasError: false,
                  errorMessage: '',
                  isQuotaError: false,
                  isPermissionError: false,
                });
                window.location.reload();
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Muat Ulang Aplikasi
            </button>
          </div>
        </div>
      </div>
    );
  }
}
