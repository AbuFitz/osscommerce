/** Phone photos carry location and device data (EXIF GPS is common, and many sole traders photograph at home). Everything that comes in through
 *  the phone link is checked by content, not by file name or declared type, and stripped of metadata before it is stored. */
export type ImageType = 'jpeg' | 'png' | 'webp';
export function sniff(b: Uint8Array): ImageType | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'png';
  if (b.length > 12 && String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP') return 'webp';
  return null;
}
export const mime = (t: ImageType) => `image/${t}`;

function stripJpeg(b: Uint8Array): Uint8Array {
  const out: number[] = [0xff, 0xd8]; let i = 2;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) throw new Error('Corrupt JPEG');
    const m = b[i + 1];
    if (m === 0xda) { for (let j = i; j < b.length; j++) out.push(b[j]); return Uint8Array.from(out); }      // start of scan: the rest is image data
    if (m === 0xd9) { out.push(0xff, 0xd9); return Uint8Array.from(out); }
    const len = (b[i + 2] << 8) | b[i + 3]; if (len < 2 || i + 2 + len > b.length) throw new Error('Corrupt JPEG');
    const drop = m === 0xe1 || m === 0xed || m === 0xfe || (m >= 0xe2 && m <= 0xef && m !== 0xee);          // Exif/XMP, Photoshop IRB, comments, other APPn (keep APP0 JFIF and APP14 Adobe colour)
    if (!drop) for (let j = i; j < i + 2 + len; j++) out.push(b[j]);
    i += 2 + len;
  }
  throw new Error('Corrupt JPEG');
}
const DROP_PNG = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME']);
function stripPng(b: Uint8Array): Uint8Array {
  const out: number[] = Array.from(b.slice(0, 8)); let i = 8;
  while (i + 12 <= b.length) {
    const len = ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0; const type = String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7]);
    if (i + 12 + len > b.length) throw new Error('Corrupt PNG');
    if (!DROP_PNG.has(type)) for (let j = i; j < i + 12 + len; j++) out.push(b[j]);
    i += 12 + len; if (type === 'IEND') break;
  }
  return Uint8Array.from(out);
}
function stripWebp(b: Uint8Array): Uint8Array {
  const out: number[] = Array.from(b.slice(0, 12)); let i = 12;
  while (i + 8 <= b.length) {
    const type = String.fromCharCode(...b.slice(i, i + 4)); const len = b[i + 4] | (b[i + 5] << 8) | (b[i + 6] << 16) | (b[i + 7] << 24); const padded = len + (len & 1);
    if (len < 0 || i + 8 + padded > b.length + 1) throw new Error('Corrupt WebP');
    if (type !== 'EXIF' && type !== 'XMP ') { const chunk = Array.from(b.slice(i, i + 8 + padded)); if (type === 'VP8X') chunk[8] &= ~(0x08 | 0x04); out.push(...chunk); }   // clear the Exif and XMP flags
    i += 8 + padded;
  }
  const size = out.length - 8; out[4] = size & 255; out[5] = (size >> 8) & 255; out[6] = (size >> 16) & 255; out[7] = (size >> 24) & 255;
  return Uint8Array.from(out);
}
export function stripMetadata(b: Uint8Array, t: ImageType): Uint8Array { return t === 'jpeg' ? stripJpeg(b) : t === 'png' ? stripPng(b) : stripWebp(b); }
