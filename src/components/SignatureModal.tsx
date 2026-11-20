import React, { useEffect, useRef, useState } from 'react';
import { Eraser, PenTool, Trash2, Upload, X } from 'lucide-react';
import { processSignatureUpload } from '../lib/imageUtils';

interface SignatureModalProps {
  isOpen: boolean;
  title: string;
  signerName: string;
  currentSignature: string;
  defaultSavedSignature?: string;
  onSave: (dataUrl: string) => void;
  onClose: () => void;
}

export const SignatureModal: React.FC<SignatureModalProps> = ({
  isOpen,
  title,
  signerName,
  currentSignature,
  defaultSavedSignature,
  onSave,
  onClose,
}) => {
  const [mode, setMode] = useState<'draw' | 'upload'>('draw');
  const [inkColor, setInkColor] = useState<'#111827' | '#1e3a8a'>('#111827');
  const [hasStroke, setHasStroke] = useState(false);
  const [uploadedPreview, setUploadedPreview] = useState<string>('');
  const [removeWhiteBg, setRemoveWhiteBg] = useState(true);
  const [lastUploadedFile, setLastUploadedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [processingUpload, setProcessingUpload] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setMode('draw');
    setHasStroke(false);
    setUploadedPreview(currentSignature || '');
    setLastUploadedFile(null);
    setUploadError(null);
  }, [isOpen, currentSignature]);

  useEffect(() => {
    if (!isOpen || mode !== 'draw') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = 520;
    const height = 200;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
    setHasStroke(false);
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 520,
      y: ((e.clientY - rect.top) / rect.height) * 200,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = getCanvasPoint(e);
    isDrawingRef.current = true;
    lastPointRef.current = pt;

    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.fillStyle = inkColor;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 1.4, 0, Math.PI * 2);
      ctx.fill();
      setHasStroke(true);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !lastPointRef.current) return;
    const pt = getCanvasPoint(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.strokeStyle = inkColor;
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
      ctx.lineTo(pt.x, pt.y);
      ctx.stroke();
      setHasStroke(true);
    }
    lastPointRef.current = pt;
  };

  const handlePointerUp = () => {
    isDrawingRef.current = false;
    lastPointRef.current = null;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasStroke(false);
  };

  const handleFileChange = async (file: File | null, stripBg: boolean) => {
    if (!file) return;
    setUploadError(null);
    setProcessingUpload(true);
    setLastUploadedFile(file);
    try {
      const processed = await processSignatureUpload(file, stripBg);
      setUploadedPreview(processed);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Gagal memproses gambar tanda tangan.');
    } finally {
      setProcessingUpload(false);
    }
  };

  const handleToggleRemoveBg = async (checked: boolean) => {
    setRemoveWhiteBg(checked);
    if (lastUploadedFile) {
      await handleFileChange(lastUploadedFile, checked);
    }
  };

  const handleConfirmSave = () => {
    if (mode === 'draw') {
      const canvas = canvasRef.current;
      if (!canvas || !hasStroke) return;
      // Export crisp 460x176 transparent PNG
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = 460;
      exportCanvas.height = 176;
      const eCtx = exportCanvas.getContext('2d');
      if (eCtx) {
        eCtx.drawImage(canvas, 0, 0, exportCanvas.width, exportCanvas.height);
        onSave(exportCanvas.toDataURL('image/png'));
      }
      onClose();
    } else {
      if (!uploadedPreview) return;
      onSave(uploadedPreview);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4 no-print"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sig-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-lg max-w-xl w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h3 id="sig-modal-title" className="text-base font-bold text-slate-900">
              {title}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Penandatangan: {signerName || 'Belum diisi'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Tutup dialog tanda tangan"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="px-6 pt-4">
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-md">
            <button
              type="button"
              onClick={() => setMode('draw')}
              className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mode === 'draw'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PenTool className="w-3.5 h-3.5" />
              Gambar di Layar
            </button>
            <button
              type="button"
              onClick={() => setMode('upload')}
              className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mode === 'upload'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              Unggah Gambar PNG/JPG
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {mode === 'draw' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Goreskan tanda tangan di area kanvas di bawah ini</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setInkColor('#111827')}
                    className={`px-2 py-1 rounded border text-xs cursor-pointer ${
                      inkColor === '#111827'
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Tinta Hitam
                  </button>
                  <button
                    type="button"
                    onClick={() => setInkColor('#1e3a8a')}
                    className={`px-2 py-1 rounded border text-xs cursor-pointer ${
                      inkColor === '#1e3a8a'
                        ? 'border-blue-900 bg-blue-900 text-white'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Tinta Biru
                  </button>
                  <button
                    type="button"
                    onClick={clearCanvas}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 cursor-pointer"
                  >
                    <Eraser className="w-3.5 h-3.5" />
                    Bersihkan
                  </button>
                </div>
              </div>

              <div className="relative border border-slate-300 rounded-md bg-white overflow-hidden touch-none">
                <canvas
                  ref={canvasRef}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerUp}
                  className="w-full h-[200px] block cursor-crosshair"
                />
                <div className="pointer-events-none absolute inset-x-10 bottom-6 border-b border-dashed border-slate-200" />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  void handleFileChange(file, removeWhiteBg);
                }}
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border border-dashed border-slate-300 hover:border-slate-400 bg-slate-50/70 hover:bg-slate-50 rounded-md p-6 text-center transition-colors cursor-pointer"
              >
                <Upload className="w-6 h-6 text-slate-500 mx-auto mb-2" />
                <div className="text-sm font-medium text-slate-800">
                  {processingUpload ? 'Memproses gambar tanda tangan...' : 'Pilih berkas gambar tanda tangan'}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Mendukung PNG transparan atau foto tanda tangan di kertas putih (JPG/WebP)
                </div>
              </button>

              <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={removeWhiteBg}
                  onChange={(e) => void handleToggleRemoveBg(e.target.checked)}
                  className="rounded border-slate-300 text-red-700 focus:ring-red-600"
                />
                <span>Hilangkan latar kertas putih otomatis agar transparan saat dicetak</span>
              </label>

              {uploadError ? (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {uploadError}
                </div>
              ) : null}

              {uploadedPreview ? (
                <div className="border border-slate-200 rounded-md p-4 bg-white flex flex-col items-center">
                  <img
                    src={uploadedPreview}
                    alt="Pratinjau tanda tangan"
                    referrerPolicy="no-referrer"
                    className="max-h-24 object-contain"
                  />
                  <div className="w-44 border-b border-slate-900 mt-2" />
                  <div className="text-[11px] font-bold uppercase text-slate-800 mt-1">
                    {signerName || 'NAMA PENANDATANGAN'}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {defaultSavedSignature ? (
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
              <span className="text-slate-500">Tersedia tanda tangan bawaan tersimpan.</span>
              <button
                type="button"
                onClick={() => {
                  onSave(defaultSavedSignature);
                  onClose();
                }}
                className="font-medium text-red-700 hover:text-red-800 hover:underline cursor-pointer"
              >
                Gunakan Tanda Tangan Default
              </button>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 bg-slate-50 border-t border-slate-200">
          {currentSignature ? (
            <button
              type="button"
              onClick={() => {
                onSave('');
                onClose();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Kosongkan (TTD Basah)
            </button>
          ) : (
            <span className="text-xs text-slate-500">Bisa dikosongkan untuk tanda tangan manual</span>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={mode === 'draw' ? !hasStroke : !uploadedPreview}
              onClick={handleConfirmSave}
              className="px-4 py-2 text-xs font-medium text-white bg-red-700 hover:bg-red-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Terapkan Tanda Tangan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
