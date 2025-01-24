import { Notice } from 'obsidian';
import { DEVICE } from 'src/constants/constants';
import { t } from 'src/lang/helpers';

const DPI = 96;

export type PDFPageAlignment = 
  | "center" 
  | "top-left" 
  | "top-center" 
  | "top-right" 
  | "bottom-left" 
  | "bottom-center" 
  | "bottom-right"
  | "center-left"
  | "center-right";
export type PDFPageMarginString = "none" | "tiny" | "normal";

export interface PDFExportScale {
  fitToPage: number; // 0 means use zoom, >1 means fit to that many pages exactly
  zoom?: number;
}

export interface PDFMargin {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface PDFPageProperties {
  dimensions?: {width: number; height: number};
  backgroundColor?: string;
  margin: PDFMargin;
  alignment: PDFPageAlignment;
}

export interface PageDimensions {
  width: number;
  height: number;
}

export type PageOrientation = "portrait" | "landscape";

// All dimensions in pixels (pt)
export const STANDARD_PAGE_SIZES = {
  A0: { width: 3179.52, height: 4494.96 }, // 33.11 × 46.81 inches
  A1: { width: 2245.76, height: 3179.52 }, // 23.39 × 33.11 inches
  A2: { width: 1587.76, height: 2245.76 }, // 16.54 × 23.39 inches
  A3: { width: 1122.56, height: 1587.76 }, // 11.69 × 16.54 inches
  A4: { width: 794.56, height: 1122.56 },  // 8.27 × 11.69 inches
  A5: { width: 559.37, height: 794.56 },   // 5.83 × 8.27 inches
  A6: { width: 397.28, height: 559.37 },   // 4.13 × 5.83 inches
  Legal: { width: 816, height: 1344 },     // 8.5 × 14 inches
  Letter: { width: 816, height: 1056 },    // 8.5 × 11 inches
  Tabloid: { width: 1056, height: 1632 },  // 11 × 17 inches
  Ledger: { width: 1632, height: 1056 }    // 17 × 11 inches
} as const;

export type PageSize = keyof typeof STANDARD_PAGE_SIZES;

//margins are in pixels
export function getMarginValue(margin:PDFPageMarginString): PDFMargin {
  switch(margin) {
    case "none": return { left: 0, right: 0, top: 0, bottom: 0 };
    case "tiny": return { left: 10, right: 10, top: 10, bottom: 10 };
    case "normal": return { left: 60, right: 60, top: 60, bottom: 60 };
    default: return { left: 60, right: 60, top: 60, bottom: 60 };
  }
}

export function getPageDimensions(pageSize: PageSize, orientation: PageOrientation): PageDimensions {
  const dimensions = STANDARD_PAGE_SIZES[pageSize];
  return orientation === "portrait" 
    ? { width: dimensions.width, height: dimensions.height }
    : { width: dimensions.height, height: dimensions.width };
}

// Electron IPC interfaces
interface PrintToPDFOptions {
  includeName: boolean;
  pageSize: string | { width: number; height: number };
  landscape: boolean;
  margins: { top: number; left: number; right: number; bottom: number };
  scaleFactor: number;
  scale: number;
  open: boolean;
  filepath: string;
}

interface SaveDialogOptions {
  defaultPath: string;
  filters: { name: string; extensions: string[] }[];
  properties: string[];
}

interface SaveDialogReturnValue {
  canceled: boolean;
  filePath?: string;
}

interface ElectronAPI {
  ipcRenderer: {
    send(channel: string, ...args: any[]): void;
    once(channel: string, func: (...args: any[]) => void): void;
  };
  remote: {
    dialog: {
      showSaveDialog(options: SaveDialogOptions): Promise<SaveDialogReturnValue>;
    };
  };
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}

function getPageSizePixels(pageSize: PageSize | PageDimensions, landscape = false): PageDimensions {
  if (typeof pageSize === "object") return pageSize;
  
  const pageDimensions = STANDARD_PAGE_SIZES[pageSize];
  if (!pageDimensions) {
    throw new Error(`Unsupported page size: ${pageSize}`);
  }

  return landscape 
    ? { width: pageDimensions.height, height: pageDimensions.width }
    : { width: pageDimensions.width, height: pageDimensions.height };
}

function getPageSize(pageSize: PageSize | PageDimensions): string | { width: number; height: number } {
  if (typeof pageSize === "string") return pageSize;

  if (!pageSize || typeof pageSize !== "object" || 
      typeof pageSize.width !== "number" || typeof pageSize.height !== "number") {
    throw new Error("Invalid page dimensions");
  }

  return {
    width: (pageSize.width / DPI),
    height: (pageSize.height / DPI)
  };
}

async function getSavePath(defaultPath: string): Promise<string | undefined> {
  const result = await window.electron.remote.dialog.showSaveDialog({
    defaultPath,
    filters: [
      { name: "PDF Files", extensions: ["pdf"] },
      { name: "All Files", extensions: ["*"] }
    ],
    properties: ["showOverwriteConfirmation"]
  });
  return result.filePath;
}

async function printPdf(
  elementToPrint: HTMLElement,
  pdfPath: string,
  bgColor: string,
  pageSize: PageSize | PageDimensions,
  isLandscape: boolean,
  margins: { top: number; left: number; right: number; bottom: number }
): Promise<void> {
  const styleTag = document.createElement('style');
  styleTag.textContent = `
    @media print {
      .print {
        background-color: ${bgColor} !important;
        display: flex !important;
        justify-content: center !important;
        align-items: center !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        flex-direction: column !important;
        page-break-before: always;
        margin: 0px !important;
        padding: 0px !important;
      }
    }
  `;
  document.head.appendChild(styleTag);

  const printDiv = document.body.createDiv('print');
  printDiv.style.top = "0";
  printDiv.style.left = "0";
  printDiv.style.display = "flex";
  printDiv.appendChild(elementToPrint);

  const options: PrintToPDFOptions = {
    includeName: false,
    pageSize: getPageSize(pageSize),
    landscape: isLandscape,
    margins,
    scaleFactor: 100,
    scale: 1,
    open: true,
    filepath: pdfPath,
  };

  try {
    await new Promise<void>((resolve) => {
      window.electron.ipcRenderer.once('print-to-pdf', resolve);
      window.electron.ipcRenderer.send('print-to-pdf', options);
    });
  } finally {
    printDiv.remove();
    styleTag.remove();
  }
}

function calculateDimensions(
  svg: SVGSVGElement,
  svgWidth: number,
  svgHeight: number,
  pageDim: PageDimensions,
  margin: PDFMargin,
  scale: PDFExportScale,
  alignment: PDFPageAlignment
): {
  tiles: {
    viewBox: string,
    width: number,
    height: number,
    x: number,
    y: number
  }[],
  pages: number
} {
  const viewBox = svg.getAttribute('viewBox')?.split(' ').map(Number) || [0, 0, svgWidth, svgHeight];
  const [viewBoxX, viewBoxY] = viewBox;

  const availableWidth = pageDim.width - margin.left - margin.right;
  const availableHeight = pageDim.height - margin.top - margin.bottom;

  // If fitToPage is specified, find optimal zoom using binary search
  if (scale.fitToPage > 0) {
    let low = 0;
    let high = 100;
    let bestZoom = 1;
    const tolerance = 0.000001;

    while (high - low > tolerance) {
      const mid = (low + high) / 2;
      const scaledWidth = svgWidth * mid;
      const scaledHeight = svgHeight * mid;
      const pages = Math.ceil(scaledWidth / availableWidth) * 
                   Math.ceil(scaledHeight / availableHeight);

      if (pages > scale.fitToPage) {
        high = mid;
      } else {
        bestZoom = mid;
        low = mid;
      }
    }
    scale.zoom = Math.round(bestZoom * 0.99999 * 1000000) / 1000000;
  }

  const finalWidth = svgWidth * (scale.zoom || 1);
  const finalHeight = svgHeight * (scale.zoom || 1);

  if (finalWidth <= availableWidth && finalHeight <= availableHeight) {
    // Content fits on one page
    const position = calculatePosition(
      finalWidth,
      finalHeight,
      pageDim.width,
      pageDim.height,
      margin,
      alignment
    );

    return {
      tiles: [{
        viewBox: `${viewBoxX} ${viewBoxY} ${svgWidth} ${svgHeight}`,
        width: finalWidth,
        height: finalHeight,
        x: position.x,
        y: position.y
      }],
      pages: 1
    };
  }

  // Content needs to be tiled
  const cols = Math.ceil(finalWidth / availableWidth);
  const rows = Math.ceil(finalHeight / availableHeight);

  // Calculate total available space considering all margins
  const totalAvailableWidth = cols * availableWidth;
  const totalAvailableHeight = rows * availableHeight;

  // Calculate global position in the total available space
  const globalPosition = calculatePosition(
    finalWidth,
    finalHeight,
    totalAvailableWidth,
    totalAvailableHeight,
    {
      left: 0,
      right: 0,
      top: 0,
      bottom: 0
    },
    alignment
  );

  const tiles = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // Calculate where this tile intersects with the image in global space
      const tileGlobalX = col * availableWidth;
      const tileGlobalY = row * availableHeight;
      
      // Calculate the intersection of the tile with the image
      const intersectX = Math.max(tileGlobalX, globalPosition.x);
      const intersectY = Math.max(tileGlobalY, globalPosition.y);
      const intersectRight = Math.min(tileGlobalX + availableWidth, globalPosition.x + finalWidth);
      const intersectBottom = Math.min(tileGlobalY + availableHeight, globalPosition.y + finalHeight);

      // Calculate actual tile dimensions
      const scaledTileWidth = Math.max(0, intersectRight - intersectX);
      const scaledTileHeight = Math.max(0, intersectBottom - intersectY);

      if (scaledTileWidth <= 0 || scaledTileHeight <= 0) continue;

      // Calculate viewBox coordinates
      const tileX = (intersectX - globalPosition.x) / (scale.zoom || 1);
      const tileY = (intersectY - globalPosition.y) / (scale.zoom || 1);
      const tileWidth = scaledTileWidth / (scale.zoom || 1);
      const tileHeight = scaledTileHeight / (scale.zoom || 1);

      let x = margin.left;
      let y = margin.top;

      // Handle horizontal positioning
      const widthRatio = scaledTileWidth / availableWidth;
      if (widthRatio >= 0.99 && widthRatio <= 1.01) {
        x = margin.left;
      } else {
        if (alignment === "center" || alignment === "top-center" || alignment === "bottom-center") {
          if(col === 0) {
            x = margin.left + (availableWidth - scaledTileWidth);
          } else {
            x = margin.left;
          }
        } else if (alignment.endsWith('right')) {
          x = pageDim.width - margin.right - scaledTileWidth;
        } else {
          x = margin.left;
        }
      }

      // Handle vertical positioning
      const heightRatio = scaledTileHeight / availableHeight;
      if (heightRatio >= 0.99 && heightRatio <= 1.01) {
        y = margin.top;
      } else {
        if (alignment === "center" || alignment === "center-left" || alignment === "center-right") {
          if(row === 0) {
            y = margin.top + (availableHeight - scaledTileHeight);
          } else {
            y = margin.top;
          }
        } else if (alignment.startsWith('bottom')) {
          y = pageDim.height - margin.bottom - scaledTileHeight;
        } else {
          y = margin.top;
        }
      }

      tiles.push({
        viewBox: `${tileX + viewBoxX} ${tileY + viewBoxY} ${tileWidth} ${tileHeight}`,
        width: scaledTileWidth,
        height: scaledTileHeight,
        x: x,
        y: y
      });
    }
  }

  return { tiles, pages: tiles.length };
}

function calculatePosition(
  svgWidth: number, 
  svgHeight: number,
  pageWidth: number,
  pageHeight: number,
  margin: PDFMargin,
  alignment: PDFPageAlignment,
): {x: number, y: number} {
  const availableWidth = pageWidth - margin.left - margin.right;
  const availableHeight = pageHeight - margin.top - margin.bottom;

  let x = margin.left;
  let y = margin.top;

  // Handle horizontal alignment
  if (alignment === "center" || alignment === "top-center" || alignment === "bottom-center") {
    x = margin.left + (availableWidth - svgWidth) / 2;
  } else if (alignment.endsWith('right')) {
    x = margin.left + availableWidth - svgWidth;
  }

  // Handle vertical alignment
  if (alignment === "center" || alignment === "center-left" || alignment === "center-right") {
    y = margin.top + (availableHeight - svgHeight) / 2;
  } else if (alignment.startsWith('bottom')) {
    y = margin.top + availableHeight - svgHeight;
  }

  return {x, y};
}

export async function exportToPDF({
  SVG,
  scale = { fitToPage: 1, zoom: 1 },
  pageProps,
  filename
}: {
  SVG: SVGSVGElement[];
  scale: PDFExportScale;
  pageProps: PDFPageProperties;
  filename: string;
}): Promise<void> {
  if (!DEVICE.isDesktop) {
    new Notice(t("PDF_EXPORT_DESKTOP_ONLY"));
    return;
  }

  const savePath = await getSavePath(filename);
  if (!savePath) return;

  const {width, height} = getPageSizePixels(pageProps.dimensions, false);
  const allPagesDiv = createDiv();
  allPagesDiv.style.width = "100%";
  allPagesDiv.style.height = "fit-content";

  let j = 0;
  for (const svg of SVG) {
    const svgWidth = parseFloat(svg.getAttribute('width') || '0');
    const svgHeight = parseFloat(svg.getAttribute('height') || '0');
    
    const {tiles} = calculateDimensions(
      svg,
      svgWidth,
      svgHeight,
      pageProps.dimensions,
      pageProps.margin,
      scale,
      pageProps.alignment
    );

    let i = 0;
    for (const tile of tiles) {
      const pageDiv = createDiv();
      pageDiv.style.width = `${width}px`;
      pageDiv.style.height = `${height}px`;
      pageDiv.style.display = "flex";
      pageDiv.style.justifyContent = "start";
      pageDiv.style.alignItems = "left";
      pageDiv.style.padding = `${pageProps.margin.top}px ${pageProps.margin.right}px ${pageProps.margin.bottom}px ${pageProps.margin.left}px`;

      const clonedSVG = svg.cloneNode(true) as SVGSVGElement;
      clonedSVG.setAttribute('viewBox', tile.viewBox);
      clonedSVG.style.width = `${tile.width}px`;
      clonedSVG.style.height = `${tile.height}px`;
      clonedSVG.style.position = 'absolute';
      clonedSVG.style.left = `${tile.x}px`;
      clonedSVG.style.top = `${tile.y + (i+j)*height}px`;

      pageDiv.appendChild(clonedSVG);
      allPagesDiv.appendChild(pageDiv);
      i++;
    }
    j++;
  }

  new Notice(t("EXPORTDIALOG_PDF_PROGRESS_NOTICE"));
  try {
    await printPdf(
      allPagesDiv,
      savePath,
      pageProps.backgroundColor || "#ffffff",
      pageProps.dimensions,
      false,
      { top: 0, right: 0, bottom: 0, left: 0 }
    );
  } catch (error) {
    console.error("Failed to export to PDF: ", error);
    new Notice(t("EXPORTDIALOG_PDF_PROGRESS_ERROR"));
  }
  new Notice(t("EXPORTDIALOG_PDF_PROGRESS_DONE"));
}

export async function exportSVGToClipboard(svg: SVGSVGElement) {
  try {
    const svgString = svg.outerHTML;
    await navigator.clipboard.writeText(svgString);
  } catch (error) {
    console.error("Failed to copy SVG to clipboard: ", error);
  }
}