import { Notice, TFile } from "obsidian";
import { EXCALIDRAW_PLUGIN } from "src/constants/constants";
import { t } from "src/lang/helpers";
import { svgToBase64 } from "./embeddedAssetUtils";
import { createOrOverwriteFile, getNewUniqueFilepath } from "./fileUtils";
import { buildImagePDF, RGBImagePage, rgbaToRGB } from "./pdfWriter";

/**
 * Browser-only PDF export used where Electron's print-to-PDF is unavailable
 * (Obsidian Mobile / iPadOS / Android) or when the Excalidraw Extras PDF
 * component is not active on desktop.
 *
 * Each page is rasterized from its SVG through a canvas and written as a
 * full-page image with the tiny in-repo PDF writer. The resulting PDF is saved
 * into the vault next to the drawing (there is no OS save dialog on mobile)
 * and opened.
 */

/** One physical output page: the SVG tile that lands on it and its placement. */
export interface RasterPrintPage {
  svg: SVGSVGElement;
  /** viewBox of the tile to render on this page */
  viewBox: string;
  /** page size in CSS px (96 DPI) */
  pageWidth: number;
  pageHeight: number;
  /** placement of the tile on the page, in CSS px */
  x: number;
  y: number;
  width: number;
  height: number;
}

const CSS_DPI = 96;
const PDF_POINTS_PER_INCH = 72;
const PX_TO_PT = PDF_POINTS_PER_INCH / CSS_DPI;
/** Preferred raster density; 3× CSS px ≈ 288 DPI on a 96 DPI page. */
const PREFERRED_RASTER_SCALE = 3;
/** Conservative WebKit canvas area ceiling (4096 × 4096). */
const MAX_CANVAS_AREA = 16_777_216;

function pickRasterScale(pageWidth: number, pageHeight: number): number {
  const area = Math.max(1, pageWidth * pageHeight);
  const maxScale = Math.sqrt(MAX_CANVAS_AREA / area);
  return Math.max(1, Math.min(PREFERRED_RASTER_SCALE, maxScale));
}

async function loadSVGAsImage(
  svg: SVGSVGElement,
  viewBox: string,
  width: number,
  height: number,
): Promise<HTMLImageElement> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("viewBox", viewBox);
  clone.setAttribute("width", `${width}`);
  clone.setAttribute("height", `${height}`);
  clone.removeAttribute("style");
  const image = createFragment().createEl("img");
  image.src = svgToBase64(clone.outerHTML);
  await image.decode();
  return image;
}

async function rasterizePage(
  page: RasterPrintPage,
  backgroundColor: string,
): Promise<RGBImagePage> {
  const scale = pickRasterScale(page.pageWidth, page.pageHeight);
  const canvas = createFragment().createEl("canvas");
  canvas.width = Math.max(1, Math.round(page.pageWidth * scale));
  canvas.height = Math.max(1, Math.round(page.pageHeight * scale));
  try {
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Could not create a 2D canvas for PDF export.");
    }
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    const image = await loadSVGAsImage(
      page.svg,
      page.viewBox,
      page.width,
      page.height,
    );
    ctx.drawImage(
      image,
      page.x * scale,
      page.y * scale,
      page.width * scale,
      page.height * scale,
    );
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return {
      widthPt: page.pageWidth * PX_TO_PT,
      heightPt: page.pageHeight * PX_TO_PT,
      pixelWidth: canvas.width,
      pixelHeight: canvas.height,
      rgb: rgbaToRGB(data),
    };
  } finally {
    // Release GPU/bitmap memory promptly; matters on iPadOS with many pages.
    canvas.width = 0;
    canvas.height = 0;
  }
}

function resolveTargetFolder(): string {
  const plugin = EXCALIDRAW_PLUGIN;
  const activeFile =
    plugin?.activeExcalidrawView?.file ?? plugin?.app.workspace.getActiveFile();
  return activeFile?.parent?.path ?? "";
}

/**
 * Renders the given pages to a raster PDF and saves it into the vault.
 *
 * @returns the created vault file, or null when nothing was written.
 */
export async function exportPagesToRasterPDF({
  pages,
  backgroundColor,
  filename,
  openAfterExport = true,
}: {
  pages: RasterPrintPage[];
  backgroundColor: string;
  filename: string;
  openAfterExport?: boolean;
}): Promise<TFile | null> {
  if (pages.length === 0) {
    return null;
  }
  const plugin = EXCALIDRAW_PLUGIN;
  if (!plugin) {
    return null;
  }

  // Rasterize sequentially so only one page bitmap is alive at a time.
  const imagePages: RGBImagePage[] = [];
  for (const page of pages) {
    imagePages.push(await rasterizePage(page, backgroundColor));
  }
  const bytes = buildImagePDF(imagePages);
  const safeName = filename.toLowerCase().endsWith(".pdf")
    ? filename
    : `${filename}.pdf`;
  const path = getNewUniqueFilepath(
    plugin.app.vault,
    safeName,
    resolveTargetFolder(),
  );
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const file = await createOrOverwriteFile(plugin.app, path, buffer);
  new Notice(t("PDF_EXPORT_SAVED_TO_VAULT").replace("{PATH}", file.path));

  if (openAfterExport) {
    await plugin.app.workspace.getLeaf("tab").openFile(file);
  }
  return file;
}
