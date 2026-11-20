import type { jsPDF } from 'jspdf';

export type FontWeightSlot = 'regular' | 'bold';

export interface StoredFontRecord {
  weight: FontWeightSlot;
  fileName: string;
  sizeBytes: number;
  updatedAt: number;
  buffer: ArrayBuffer;
}

export interface StoredFontMeta {
  fileName: string;
  sizeBytes: number;
  updatedAt: number;
}

export interface CustomFontsStatus {
  regular: StoredFontMeta | null;
  bold: StoredFontMeta | null;
}

const DB_NAME = 'pkppk-document-fonts';
const DB_VERSION = 1;
const STORE_NAME = 'fonts';
const MAX_FONT_BYTES = 15 * 1024 * 1024; // 15 MB safety guard

const BUNDLED_REGULAR_URL = '/fonts/TahomaStyle-Regular.ttf';
const BUNDLED_BOLD_URL = '/fonts/TahomaStyle-Bold.ttf';

export const DOCUMENT_FONT_STACK =
  '"CustomTahoma", Tahoma, "TahomaStyleFallback", Geneva, Verdana, sans-serif';

let bundledRegularBase64Cache: string | null = null;
let bundledBoldBase64Cache: string | null = null;
const activeFontFaces = new Map<FontWeightSlot, FontFace>();

function openFontDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB tidak tersedia di peramban ini.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'weight' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Gagal membuka penyimpanan font lokal.'));
  });
}

async function getStoredFont(weight: FontWeightSlot): Promise<StoredFontRecord | null> {
  try {
    const db = await openFontDb();
    return await new Promise<StoredFontRecord | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(weight);
      req.onsuccess = () => {
        const result = req.result as StoredFontRecord | undefined;
        resolve(result ?? null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function putStoredFont(record: StoredFontRecord): Promise<void> {
  const db = await openFontDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Gagal menyimpan berkas font.'));
  });
}

async function deleteStoredFont(weight: FontWeightSlot): Promise<void> {
  const db = await openFontDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(weight);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Gagal menghapus berkas font.'));
  });
}

function isValidTrueTypeOrOpenType(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 12) return false;
  const view = new DataView(buffer);
  const tag = view.getUint32(0, false);
  // 0x00010000 = TrueType, 0x74727565 = 'true' (Apple TTF), 0x4F54544F = 'OTTO' (OTF)
  return tag === 0x00010000 || tag === 0x74727565 || tag === 0x4f54544f;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function fetchBundledFontBase64(weight: FontWeightSlot): Promise<string> {
  if (weight === 'regular' && bundledRegularBase64Cache) {
    return bundledRegularBase64Cache;
  }
  if (weight === 'bold' && bundledBoldBase64Cache) {
    return bundledBoldBase64Cache;
  }

  const url = weight === 'regular' ? BUNDLED_REGULAR_URL : BUNDLED_BOLD_URL;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Gagal memuat font bawaan (${res.status}).`);
  }
  const buffer = await res.arrayBuffer();
  const base64 = arrayBufferToBase64(buffer);

  if (weight === 'regular') {
    bundledRegularBase64Cache = base64;
  } else {
    bundledBoldBase64Cache = base64;
  }
  return base64;
}

async function applyBrowserFontFace(weight: FontWeightSlot, buffer: ArrayBuffer | null): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document) || typeof FontFace === 'undefined') {
    return;
  }

  const existing = activeFontFaces.get(weight);
  if (existing) {
    document.fonts.delete(existing);
    activeFontFaces.delete(weight);
  }

  if (!buffer) return;

  try {
    const face = new FontFace('CustomTahoma', buffer.slice(0), {
      weight: weight === 'bold' ? '700' : '400',
      style: 'normal',
    });
    const loaded = await face.load();
    document.fonts.add(loaded);
    activeFontFaces.set(weight, loaded);
  } catch (err) {
    console.warn('Gagal mendaftarkan CustomTahoma pada document.fonts:', err);
  }
}

export async function initDocumentFonts(): Promise<CustomFontsStatus> {
  const [regular, bold] = await Promise.all([
    getStoredFont('regular'),
    getStoredFont('bold'),
  ]);

  await Promise.all([
    applyBrowserFontFace('regular', regular?.buffer ?? null),
    applyBrowserFontFace('bold', bold?.buffer ?? null),
  ]);

  return {
    regular: regular
      ? {
          fileName: regular.fileName,
          sizeBytes: regular.sizeBytes,
          updatedAt: regular.updatedAt,
        }
      : null,
    bold: bold
      ? {
          fileName: bold.fileName,
          sizeBytes: bold.sizeBytes,
          updatedAt: bold.updatedAt,
        }
      : null,
  };
}

export async function getCustomFontsStatus(): Promise<CustomFontsStatus> {
  const [regular, bold] = await Promise.all([
    getStoredFont('regular'),
    getStoredFont('bold'),
  ]);

  return {
    regular: regular
      ? {
          fileName: regular.fileName,
          sizeBytes: regular.sizeBytes,
          updatedAt: regular.updatedAt,
        }
      : null,
    bold: bold
      ? {
          fileName: bold.fileName,
          sizeBytes: bold.sizeBytes,
          updatedAt: bold.updatedAt,
        }
      : null,
  };
}

export async function saveCustomFontFile(
  weight: FontWeightSlot,
  file: File
): Promise<StoredFontMeta> {
  const lowerName = file.name.toLowerCase();
  if (!lowerName.endsWith('.ttf') && !lowerName.endsWith('.otf')) {
    throw new Error('Format berkas harus .ttf atau .otf (misalnya tahoma.ttf atau tahomabd.ttf).');
  }
  if (file.size > MAX_FONT_BYTES) {
    throw new Error('Ukuran berkas font terlalu besar (maksimal 15 MB).');
  }

  const buffer = await file.arrayBuffer();
  if (!isValidTrueTypeOrOpenType(buffer)) {
    throw new Error('Berkas bukan font TrueType/OpenType yang valid.');
  }

  const record: StoredFontRecord = {
    weight,
    fileName: file.name,
    sizeBytes: file.size,
    updatedAt: Date.now(),
    buffer,
  };

  await putStoredFont(record);
  await applyBrowserFontFace(weight, buffer);

  return {
    fileName: record.fileName,
    sizeBytes: record.sizeBytes,
    updatedAt: record.updatedAt,
  };
}

export async function removeCustomFontWeight(weight: FontWeightSlot): Promise<void> {
  await deleteStoredFont(weight);
  await applyBrowserFontFace(weight, null);
}

export async function resetAllCustomFonts(): Promise<void> {
  await Promise.all([deleteStoredFont('regular'), deleteStoredFont('bold')]);
  await Promise.all([
    applyBrowserFontFace('regular', null),
    applyBrowserFontFace('bold', null),
  ]);
}

/**
 * Embeds the active Tahoma (user-uploaded tahoma.ttf / tahomabd.ttf if available,
 * otherwise self-hosted Tahoma-style humanist vector TTF) into a jsPDF instance.
 */
export async function registerDocumentFontInPdf(doc: jsPDF): Promise<string> {
  try {
    const [customRegular, customBold] = await Promise.all([
      getStoredFont('regular'),
      getStoredFont('bold'),
    ]);

    const regularBase64 = customRegular
      ? arrayBufferToBase64(customRegular.buffer)
      : await fetchBundledFontBase64('regular');

    const boldBase64 = customBold
      ? arrayBufferToBase64(customBold.buffer)
      : customRegular
        ? regularBase64
        : await fetchBundledFontBase64('bold');

    const familyName = 'DocTahoma';
    doc.addFileToVFS('DocTahoma-Regular.ttf', regularBase64);
    doc.addFont('DocTahoma-Regular.ttf', familyName, 'normal');

    doc.addFileToVFS('DocTahoma-Bold.ttf', boldBase64);
    doc.addFont('DocTahoma-Bold.ttf', familyName, 'bold');

    return familyName;
  } catch (err) {
    console.warn('Gagal menyematkan font TTF ke PDF, menggunakan fallback standar:', err);
    return 'helvetica';
  }
}
