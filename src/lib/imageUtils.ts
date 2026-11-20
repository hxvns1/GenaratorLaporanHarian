import { SCHEMA_LIMITS } from '../types/report';

export interface ProcessedImageResult {
  dataUrl: string;
  originalBytes: number;
  compressedBytes: number;
  width: number;
  height: number;
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca berkas gambar.'));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Format gambar tidak didukung oleh peramban.'));
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Compresses a single ready-made documentation collage photo so it prints crisply on A4
 * while staying comfortably under the Firestore 600KB field limit (1MB document cap).
 */
export async function compressCollageImage(file: File): Promise<ProcessedImageResult> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Silakan pilih berkas gambar (JPG, PNG, atau WebP).');
  }

  const img = await loadImageFromFile(file);
  const maxTargetChars = Math.min(540000, SCHEMA_LIMITS.documentationImage - 20000);

  let maxDim = 1500;
  let quality = 0.84;
  let bestDataUrl = '';
  let finalWidth = img.naturalWidth;
  let finalHeight = img.naturalHeight;

  for (let attempt = 0; attempt < 8; attempt++) {
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Kanvas kompresi tidak tersedia.');

    // Fill white background in case PNG has transparency
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);

    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    bestDataUrl = dataUrl;
    finalWidth = width;
    finalHeight = height;

    if (dataUrl.length <= maxTargetChars) {
      break;
    }

    if (quality > 0.6) {
      quality = Number((quality - 0.08).toFixed(2));
    } else {
      maxDim = Math.round(maxDim * 0.8);
      quality = 0.72;
    }
  }

  if (bestDataUrl.length > SCHEMA_LIMITS.documentationImage) {
    throw new Error('Gambar kolase terlalu besar untuk disimpan. Coba gunakan resolusi lebih rendah.');
  }

  return {
    dataUrl: bestDataUrl,
    originalBytes: file.size,
    compressedBytes: Math.round((bestDataUrl.length * 3) / 4),
    width: finalWidth,
    height: finalHeight,
  };
}

/**
 * Processes an uploaded signature image (PNG/JPG), optionally removing white/near-white
 * paper background into alpha transparency so it overlays neatly above the printed name.
 */
export async function processSignatureUpload(
  file: File,
  removeWhiteBg: boolean
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Silakan pilih berkas gambar tanda tangan (PNG atau JPG).');
  }

  const img = await loadImageFromFile(file);
  const maxWidth = 480;
  const maxHeight = 200;
  const scale = Math.min(1, maxWidth / img.naturalWidth, maxHeight / img.naturalHeight);
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Kanvas tanda tangan tidak tersedia.');

  ctx.clearRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);

  if (removeWhiteBg) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a === 0) continue;

      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      if (luminance > 218) {
        data[i + 3] = 0;
      } else if (luminance > 180) {
        // Soft anti-aliased edge transition
        const factor = (218 - luminance) / (218 - 180);
        data[i + 3] = Math.round(a * factor);
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }

  let dataUrl = canvas.toDataURL('image/png');
  if (dataUrl.length > SCHEMA_LIMITS.reporterSignature) {
    // Fallback downscale if PNG is complex
    const smaller = document.createElement('canvas');
    smaller.width = Math.round(width * 0.65);
    smaller.height = Math.round(height * 0.65);
    const sCtx = smaller.getContext('2d');
    if (sCtx) {
      sCtx.drawImage(canvas, 0, 0, smaller.width, smaller.height);
      dataUrl = smaller.toDataURL('image/png');
    }
  }

  if (dataUrl.length > SCHEMA_LIMITS.reporterSignature) {
    throw new Error('Gambar tanda tangan melebihi batas ukuran. Gunakan gambar yang lebih sederhana.');
  }

  return dataUrl;
}
