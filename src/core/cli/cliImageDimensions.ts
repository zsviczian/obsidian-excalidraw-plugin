/** Bounded raster-header inspection before a CLI thumbnail can invoke a decoder. */
import { CLIError } from "./cliProtocol";

/**
 * Accept only formats whose encoded dimensions can be established cheaply.
 * Read at most 256 KiB of encoded headers; SVG/animated/unknown input must use
 * original or placeholder instead. Decoded dimensions are checked again later.
 */
export function thumbnailDimensions(url: string): { width: number; height: number } {
  const comma = url.indexOf(",");
  if (comma < 0 || !url.slice(0, comma).endsWith(";base64")) throw new CLIError("ASSETS_UNAVAILABLE", "Cannot preflight thumbnail dimensions; choose original or placeholder.");
  let header: string;
  try { header = atob(url.slice(comma + 1, comma + 1 + 349524)); }
  catch { throw new CLIError("ASSETS_UNAVAILABLE", "Invalid thumbnail source encoding."); }
  const bytes = Uint8Array.from(header, char => char.charCodeAt(0));
  return rasterDimensions(bytes);
}

/** Inspect raw PNG/JPEG/WebP headers without asking the browser to decode pixels. */
export function rasterDimensions(bytes: Uint8Array): { width: number; height: number } {
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const header = String.fromCharCode(...bytes.subarray(0, 16));
  let width = 0, height = 0;
  if (header.startsWith("\x89PNG\r\n\x1a\n") && bytes.length >= 24 && header.slice(12, 16) === "IHDR") {
    width = data.getUint32(16); height = data.getUint32(20);
  } else if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 4 <= bytes.length) {
      if (bytes[offset++] !== 0xff) break;
      while (bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 0x01 || marker >= 0xd0 && marker <= 0xd7) continue;
      if (offset + 2 > bytes.length) break;
      const size = data.getUint16(offset);
      if (size < 2 || offset + size > bytes.length) break;
      if ([0xc0, 0xc1, 0xc2].includes(marker) && size >= 8) {
        height = data.getUint16(offset + 3); width = data.getUint16(offset + 5); break;
      }
      offset += size;
    }
  } else if (header.startsWith("RIFF") && header.slice(8, 12) === "WEBP" && bytes.length >= 30) {
    const kind = header.slice(12, 16);
    if (kind === "VP8X" && !(bytes[20] & 2)) {
      width = 1 + bytes[24] + bytes[25] * 256 + bytes[26] * 65536;
      height = 1 + bytes[27] + bytes[28] * 256 + bytes[29] * 65536;
    } else if (kind === "VP8 " && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
      width = data.getUint16(26, true) & 0x3fff; height = data.getUint16(28, true) & 0x3fff;
    } else if (kind === "VP8L" && bytes[20] === 0x2f) {
      const packed = data.getUint32(21, true);
      width = 1 + (packed & 0x3fff); height = 1 + ((packed >>> 14) & 0x3fff);
    }
  }
  if (!width || !height || width * height > 16_000_000) throw new CLIError("ASSETS_UNAVAILABLE", "Thumbnail dimensions are unknown or exceed 16 million pixels; choose original or placeholder.");
  return { width, height };
}
