import { Notice } from 'obsidian';
import { getEA } from 'src/core';
import { t } from 'src/lang/helpers';

// Define proper types for PDFLib
type PDFLibType = typeof import('@cantoo/pdf-lib');
let pdfLibPromise: Promise<PDFLibType> | null = null;

async function getPDFLib(): Promise<PDFLibType> {
  if (!pdfLibPromise) {
    pdfLibPromise = import('@cantoo/pdf-lib');
  }
  return pdfLibPromise;
}

const PDF_DPI = 72;

export type PDFPageAlignment = "center" | "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right";
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
  exportDPI: number;
}

export interface PageDimensions {
  width: number;
  height: number;
}

export type PageOrientation = "portrait" | "landscape";

// All dimensions in points (pt)
export const STANDARD_PAGE_SIZES = {
  "A0": { width: 2383.94, height: 3370.39 },
  "A1": { width: 1683.78, height: 2383.94 },
  "A2": { width: 1190.55, height: 1683.78 },
  "A3": { width: 841.89, height: 1190.55 },
  "A4": { width: 595.28, height: 841.89 },
  "A5": { width: 419.53, height: 595.28 },
  "Letter": { width: 612, height: 792 },
  "Legal": { width: 612, height: 1008 },
  "Tabloid": { width: 792, height: 1224 },
} as const;

export type PageSize = keyof typeof STANDARD_PAGE_SIZES;

export function getMarginValue(margin:PDFPageMarginString): PDFMargin {
  switch(margin) {
    case "none": return { left: 0, right: 0, top: 0, bottom: 0 };
    case "tiny": return { left: 5, right: 5, top: 5, bottom: 5 };
    case "normal": return { left: 25, right: 25, top: 25, bottom: 25 };
    default: return { left: 25, right: 25, top: 25, bottom: 25 };
  }
}

export function getPageDimensions(pageSize: PageSize, orientation: PageOrientation): PageDimensions {
  const dimensions = STANDARD_PAGE_SIZES[pageSize];
  return orientation === "portrait" 
    ? { width: dimensions.width, height: dimensions.height }
    : { width: dimensions.height, height: dimensions.width };
}

interface SVGDimensions {
  width: number;
  height: number;
  x: number;
  y: number;
  sourceX?: number;
  sourceY?: number;
  sourceWidth?: number;
  sourceHeight?: number;
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
  let y = margin.bottom;

  // Handle horizontal alignment
  if (alignment.includes('center')) {
    x = margin.left + (availableWidth - svgWidth) / 2;
  } else if (alignment.includes('right')) {
    x = margin.left + availableWidth - svgWidth;
  }

  // Handle vertical alignment
  if (alignment.startsWith('center')) {
    y = margin.bottom + (availableHeight - svgHeight) / 2;
  } else if (alignment.startsWith('top')) {
    y = margin.bottom;
  } else if (alignment.startsWith('bottom')) {
    y = pageHeight - margin.top - svgHeight;
  }

  return {x, y};
}

function getNumberOfPages(
  width: number,
  height: number,
  availableWidth: number,
  availableHeight: number
): number {
  const cols = Math.ceil(width / availableWidth);
  const rows = Math.ceil(height / availableHeight);
  return cols * rows;
}

function calculateDimensions(
  svgWidth: number,
  svgHeight: number,
  pageDim: PageDimensions,
  margin: PDFPageProperties['margin'],
  scale: PDFExportScale,
  alignment: PDFPageAlignment,
  exportDPI: number,
): SVGDimensions[] {
  const svg_to_pdf_scale = PDF_DPI / exportDPI;
  const pdfWidth = svgWidth * svg_to_pdf_scale;
  const pdfHeight = svgHeight * svg_to_pdf_scale;
  const availableWidth = pageDim.width - margin.left - margin.right;
  const availableHeight = pageDim.height - margin.top - margin.bottom;

  // If fitToPage is specified, find optimal zoom using binary search
  if (scale.fitToPage > 0) {
    let low = 0;
    let high = 100; // Start with a reasonable upper bound
    let bestZoom = 1;
    const tolerance = 0.000001;

    while (high - low > tolerance) {
      const mid = (low + high) / 2;
      const scaledWidth = pdfWidth * mid;
      const scaledHeight = pdfHeight * mid;
      const pages = getNumberOfPages(scaledWidth, scaledHeight, availableWidth, availableHeight);

      if (pages > scale.fitToPage) {
        high = mid;
      } else {
        bestZoom = mid;
        low = mid;
      }
    }

    // Apply a small reduction to prevent floating-point issues
    scale.zoom = Math.round(bestZoom * 0.99999 * 1000000) / 1000000;
  }

  // Now handle as regular scale mode
  const finalWidth = Math.round(pdfWidth * (scale.zoom || 1) * 1000) / 1000;
  const finalHeight = Math.round(pdfHeight * (scale.zoom || 1) * 1000) / 1000;

  // Round the available dimensions as well for consistent comparison
  const roundedAvailableWidth = Math.round(availableWidth * 1000) / 1000;
  const roundedAvailableHeight = Math.round(availableHeight * 1000) / 1000;

  if (finalWidth <= roundedAvailableWidth && finalHeight <= roundedAvailableHeight) {
    // Content fits on one page
    const position = calculatePosition(
      finalWidth, 
      finalHeight, 
      pageDim.width, 
      pageDim.height, 
      margin,
      alignment,
    );
    
    return [{
      width: finalWidth,
      height: finalHeight,
      x: position.x,
      y: position.y
    }];
  } else {
    // Content needs to be tiled across multiple pages
    const dimensions: SVGDimensions[] = [];
    // Calculate exact number of needed columns and rows
    const cols = Math.ceil(finalWidth / roundedAvailableWidth);
    const rows = Math.ceil(finalHeight / roundedAvailableHeight);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        // Calculate remaining width and height for this tile
        const remainingWidth = finalWidth - col * roundedAvailableWidth;
        const remainingHeight = finalHeight - row * roundedAvailableHeight;
        
        // Only create tile if there's actual content to show
        if (remainingWidth > 0 && remainingHeight > 0) {
          const tileWidth = Math.min(roundedAvailableWidth, remainingWidth);
          const tileHeight = Math.min(roundedAvailableHeight, remainingHeight);
          
          dimensions.push({
            width: tileWidth,
            height: tileHeight,
            x: margin.left,
            y: margin.top,
            sourceX: (col * roundedAvailableWidth) / ((scale.zoom || 1) * svg_to_pdf_scale),
            sourceY: (row * roundedAvailableHeight) / ((scale.zoom || 1) * svg_to_pdf_scale),
            sourceWidth: tileWidth / ((scale.zoom || 1) * svg_to_pdf_scale),
            sourceHeight: tileHeight / ((scale.zoom || 1) * svg_to_pdf_scale)
          });
        }
      }
    }
    return dimensions;
  }
}

async function addSVGToPage(
  pdfDoc: Awaited<ReturnType<typeof import('@cantoo/pdf-lib').PDFDocument.create>>,
  svg: SVGSVGElement,
  dimensions: SVGDimensions,
  pageDim: PageDimensions,
  pageProps: PDFPageProperties
) {
  const { rgb } = await getPDFLib();
  const page = pdfDoc.addPage([pageDim.width, pageDim.height]);
    
  if (pageProps.backgroundColor && pageProps.backgroundColor !== '#ffffff') {
    const { r, g, b } = hexToRGB(pageProps.backgroundColor);
    page.drawRectangle({
      x: 0,
      y: 0,
      width: pageDim.width,
      height: pageDim.height,
      color: rgb(r/255, g/255, b/255),
    });
  }

  // Render SVG to canvas with specified DPI
  const canvas = await renderSVGToCanvas(svg, dimensions, pageProps.exportDPI);
  
  // Convert canvas to PNG
  const pngData = canvas.toDataURL('image/png');
  
  // Embed the PNG in the PDF
  const image = await pdfDoc.embedPng(pngData);
  
  // Adjust y-coordinate to account for PDF coordinate system
  const adjustedY = pageDim.height - dimensions.y - dimensions.height;

  // Draw the image
  page.drawImage(image, {
    x: dimensions.x,
    y: adjustedY,
    width: dimensions.width,
    height: dimensions.height,
  });

  return page;
}

async function renderSVGToCanvas(
  svg: SVGSVGElement,
  dimensions: SVGDimensions,
  exportDPI: number = 300,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  const scale = exportDPI / PDF_DPI;
  
  canvas.width = dimensions.width * scale;
  canvas.height = dimensions.height * scale;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas context');

  let svgToRender = svg;
  if (dimensions.sourceX !== undefined) {
    svgToRender = svg.cloneNode(true) as SVGSVGElement;
    const viewBox = `${dimensions.sourceX} ${dimensions.sourceY} ${dimensions.sourceWidth} ${dimensions.sourceHeight}`;
    svgToRender.setAttribute('viewBox', viewBox);
    svgToRender.setAttribute('width', String(dimensions.sourceWidth));
    svgToRender.setAttribute('height', String(dimensions.sourceHeight));
  }

  const svgBlob = new Blob([svgToRender.outerHTML], { type: 'image/svg+xml;charset=utf-8' });
  const blobUrl = URL.createObjectURL(svgBlob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(blobUrl);
      resolve(canvas);
    };
    img.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      reject(new Error('Failed to load SVG'));
    };
    img.src = blobUrl;
  });
}

export async function exportToPDF({
  SVG,
  scale = { fitToPage: 1, zoom: 1 },
  pageProps,
}: {
  SVG: SVGSVGElement[];
  scale: PDFExportScale;
  pageProps: PDFPageProperties;
}): Promise<ArrayBuffer> {
  const { PDFDocument } = await getPDFLib();
  const pdfDoc = await PDFDocument.create();

  const msg = t('EXPORTDIALOG_PDF_PROGRESS_NOTICE');
  const imgmsg = t('EXPORTDIALOG_PDF_PROGRESS_IMAGE');

  let notice = new Notice(msg, 0);
  //@ts-ignore
  let noticeContainerEl = notice.containerEl ?? notice.noticeEl;

  let j=1;
  for (const svg of SVG) {
    const svgWidth = parseFloat(svg.getAttribute('width') || '0');
    const svgHeight = parseFloat(svg.getAttribute('height') || '0');
    
    const dimensions = calculateDimensions(
      svgWidth, 
      svgHeight, 
      pageProps.dimensions, 
      pageProps.margin, 
      scale,
      pageProps.alignment,
      pageProps.exportDPI
    );

    let i=1;
    for (const dim of dimensions) {    
      if(noticeContainerEl.parentElement) {
        notice.setMessage(`${msg} ${i++}/${dimensions.length}${SVG.length>1?` ${imgmsg} ${j}`:""}`);
      } else {
        notice = new Notice(`${msg} ${i++}/${dimensions.length}${SVG.length>1?` ${imgmsg} ${j}`:""}`, 0);
        //@ts-ignore
        noticeContainerEl = notice.containerEl ?? notice.noticeEl;
      }
      await addSVGToPage(pdfDoc, svg, dim, pageProps.dimensions, pageProps);
    }
    j++;
  }

  //@ts-ignore
  if(noticeContainerEl.parentElement) {
    notice.setMessage(t('EXPORTDIALOG_PDF_PROGRESS_DONE'));
    setTimeout(() => notice.hide(), 4000);
  } else {
    new Notice(t('EXPORTDIALOG_PDF_PROGRESS_DONE'));
  }
  return pdfDoc.save();
}

function hexToRGB(hex: string): { r: number; g: number; b: number } {
  const ea = getEA();
  const color = ea.getCM(hex);
  if (color) {
    return { r: color.red, g: color.green, b: color.blue };
  }
    return {r: 255, g: 255, b: 255};
}

// Helper function to split SVG into pages if needed
function splitSVGIntoPages(
  svg: SVGSVGElement,
  maxWidth: number,
  maxHeight: number
): SVGSVGElement[] {
  const width = parseFloat(svg.getAttribute('width') || '0');
  const height = parseFloat(svg.getAttribute('height') || '0');
  
  if (width <= maxWidth && height <= maxHeight) {
    return [svg];
  }

  const pages: SVGSVGElement[] = [];
  const cols = Math.ceil(width / maxWidth);
  const rows = Math.ceil(height / maxHeight);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const viewBox = `${col * maxWidth} ${row * maxHeight} ${maxWidth} ${maxHeight}`;
      const clonedSvg = svg.cloneNode(true) as SVGSVGElement;
      clonedSvg.setAttribute('viewBox', viewBox);
      clonedSvg.setAttribute('width', String(maxWidth));
      clonedSvg.setAttribute('height', String(maxHeight));
      pages.push(clonedSvg);
    }
  }

  return pages;
}

export async function exportSVGToClipboard(svg: SVGSVGElement) {
  try {
    const svgString = svg.outerHTML;
    await navigator.clipboard.writeText(svgString);
  } catch (error) {
    console.error("Failed to copy SVG to clipboard: ", error);
  }
}