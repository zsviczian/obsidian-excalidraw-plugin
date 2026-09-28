import { deflate } from "pako";

/**
 * Minimal PDF 1.4 writer for documents made of full-page raster images.
 *
 * Deliberately tiny: the plugin already sits near the Community Plugin
 * bundle-size ceiling, so pulling in a general purpose PDF library for
 * "one image per page" is not worth ~600 KB. Only what the mobile PDF export
 * needs is implemented: N pages, each showing one 8-bit RGB image scaled to
 * the page box, Flate-compressed with PNG "Up" row prediction.
 */

export interface RGBImagePage {
  /** page size in PDF points (1/72 in) */
  widthPt: number;
  heightPt: number;
  /** image size in pixels */
  pixelWidth: number;
  pixelHeight: number;
  /** tightly packed RGB bytes, row-major, 3 bytes per pixel */
  rgb: Uint8Array;
}

const encoder = new TextEncoder();

function ascii(text: string): Uint8Array {
  return encoder.encode(text);
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/** Converts canvas RGBA pixels to RGB, dropping alpha. */
export function rgbaToRGB(rgba: Uint8ClampedArray | Uint8Array): Uint8Array {
  const pixels = rgba.byteLength / 4;
  const rgb = new Uint8Array(pixels * 3);
  for (let i = 0, j = 0; i < pixels; i++, j += 3) {
    const k = i * 4;
    rgb[j] = rgba[k];
    rgb[j + 1] = rgba[k + 1];
    rgb[j + 2] = rgba[k + 2];
  }
  return rgb;
}

/**
 * Applies the PNG "Up" filter (type 2) to every row and Flate-compresses the
 * result. Line art compresses far better with row prediction than raw.
 */
function encodeImageStream(
  rgb: Uint8Array,
  pixelWidth: number,
  pixelHeight: number,
): Uint8Array {
  const rowBytes = pixelWidth * 3;
  const filtered = new Uint8Array((rowBytes + 1) * pixelHeight);
  for (let row = 0; row < pixelHeight; row++) {
    const src = row * rowBytes;
    const dst = row * (rowBytes + 1);
    filtered[dst] = 2; // "Up"
    if (row === 0) {
      filtered.set(rgb.subarray(0, rowBytes), dst + 1);
      continue;
    }
    const prev = src - rowBytes;
    for (let i = 0; i < rowBytes; i++) {
      filtered[dst + 1 + i] = (rgb[src + i] - rgb[prev + i]) & 0xff;
    }
  }
  return deflate(filtered);
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(4);
}

class PDFObjectWriter {
  private chunks: Uint8Array[] = [];
  private offsets: number[] = [];
  private length = 0;

  constructor() {
    this.push(ascii("%PDF-1.4\n"));
    // Binary comment so transports treat the file as binary.
    this.push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
  }

  private push(bytes: Uint8Array) {
    this.chunks.push(bytes);
    this.length += bytes.byteLength;
  }

  /** Reserves the next object number without writing it yet. */
  reserve(): number {
    this.offsets.push(-1);
    return this.offsets.length;
  }

  write(objectNumber: number, dictionary: string, stream?: Uint8Array) {
    this.offsets[objectNumber - 1] = this.length;
    this.push(ascii(`${objectNumber} 0 obj\n`));
    if (stream) {
      this.push(
        ascii(`<< ${dictionary} /Length ${stream.byteLength} >>\nstream\n`),
      );
      this.push(stream);
      this.push(ascii("\nendstream\n"));
    } else {
      this.push(ascii(`${dictionary}\n`));
    }
    this.push(ascii("endobj\n"));
  }

  finish(rootObject: number, infoObject?: number): Uint8Array {
    const xrefOffset = this.length;
    const count = this.offsets.length + 1;
    let xref = `xref\n0 ${count}\n0000000000 65535 f \n`;
    for (const offset of this.offsets) {
      xref += `${offset.toString().padStart(10, "0")} 00000 n \n`;
    }
    const info = infoObject ? ` /Info ${infoObject} 0 R` : "";
    xref += `trailer\n<< /Size ${count} /Root ${rootObject} 0 R${info} >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
    this.push(ascii(xref));
    return concat(this.chunks);
  }
}

/**
 * Builds a PDF where each entry of `pages` is one page fully covered by its
 * image. Pages may have different sizes.
 */
export function buildImagePDF(
  pages: RGBImagePage[],
  producer = "Obsidian Excalidraw Plugin",
): Uint8Array {
  const writer = new PDFObjectWriter();
  const catalog = writer.reserve();
  const pagesRoot = writer.reserve();
  const info = writer.reserve();
  const pageObjects: number[] = [];

  for (const page of pages) {
    const image = writer.reserve();
    const content = writer.reserve();
    const pageObject = writer.reserve();
    pageObjects.push(pageObject);

    writer.write(
      image,
      `/Type /XObject /Subtype /Image /Width ${page.pixelWidth} /Height ${page.pixelHeight} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode ` +
        `/DecodeParms << /Predictor 15 /Colors 3 /BitsPerComponent 8 /Columns ${page.pixelWidth} >>`,
      encodeImageStream(page.rgb, page.pixelWidth, page.pixelHeight),
    );

    const w = formatNumber(page.widthPt);
    const h = formatNumber(page.heightPt);
    writer.write(content, "", ascii(`q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`));
    writer.write(
      pageObject,
      `<< /Type /Page /Parent ${pagesRoot} 0 R /MediaBox [0 0 ${w} ${h}] ` +
        `/Resources << /XObject << /Im0 ${image} 0 R >> >> /Contents ${content} 0 R >>`,
    );
  }

  writer.write(
    pagesRoot,
    `<< /Type /Pages /Kids [${pageObjects.map((n) => `${n} 0 R`).join(" ")}] /Count ${pageObjects.length} >>`,
  );
  writer.write(catalog, `<< /Type /Catalog /Pages ${pagesRoot} 0 R >>`);
  writer.write(
    info,
    `<< /Producer (${producer.replace(/[\\()]/g, "\\$&")}) >>`,
  );
  return writer.finish(catalog, info);
}
