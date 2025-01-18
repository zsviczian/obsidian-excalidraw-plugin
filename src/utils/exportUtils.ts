import { PDFDocument, rgb } from '@cantoo/pdf-lib';
import { getEA } from 'src/core';


export type PDFPageAlignment = "center" | "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right";
export type PDFPageMarginString = "none" | "tiny" | "normal";

interface PDFExportScale {
  fitToPage: boolean;
  zoom?: number;
}

export interface PDFMargin {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface PDFPageProperties {
  dimensions?: {width: number; height: number};
  backgroundColor?: string;
  margin: PDFMargin;
  alignment: PDFPageAlignment;
}

interface PageDimensions {
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
    case "normal": return { left: 20, right: 20, top: 20, bottom: 20 };
    default: return { left: 20, right: 20, top: 20, bottom: 20 };
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
}

function calculateDimensions(
  svgWidth: number,
  svgHeight: number,
  pageDim: PageDimensions,
  margin: PDFPageProperties['margin'],
  scale: PDFExportScale
): SVGDimensions {
  const availableWidth = pageDim.width - (margin?.left || 0) - (margin?.right || 0);
  const availableHeight = pageDim.height - (margin?.top || 0) - (margin?.bottom || 0);

  let finalWidth, finalHeight;
  if (scale.fitToPage) {
    const ratio = Math.min(availableWidth / svgWidth, availableHeight / svgHeight);
    finalWidth = svgWidth * ratio;
    finalHeight = svgHeight * ratio;
  } else {
    finalWidth = svgWidth * (scale.zoom || 1);
    finalHeight = svgHeight * (scale.zoom || 1);
  }

  const x = (margin?.left || 0) + (availableWidth - finalWidth) / 2;
  const y = pageDim.height - (margin?.top || 0) - finalHeight;

  return { width: finalWidth, height: finalHeight, x, y };
}

async function addSVGToPage(
  pdfDoc: PDFDocument,
  svg: SVGSVGElement,
  dimensions: SVGDimensions,
  pageDim: PageDimensions,
  backgroundColor?: string
) {
  const page = pdfDoc.addPage([pageDim.width, pageDim.height]);
    
  if (backgroundColor && backgroundColor !== '#ffffff') {
    const { r, g, b } = hexToRGB(backgroundColor);
    page.drawRectangle({
      x: 0,
      y: 0,
      width: pageDim.width,
      height: pageDim.height,
      color: rgb(r/255, g/255, b/255),
    });
  }

  const svgImage = await pdfDoc.embedSvg(svg.outerHTML);
  
  page.drawSvg(svgImage, {
    x: dimensions.x,
    y: dimensions.y,
    width: dimensions.width,
    height: dimensions.height,
  });

  return page;
}

export async function exportToPDF({
  SVG,
  scale = { fitToPage: true, zoom: 1 },
  pageProps,
}: {
  SVG: SVGSVGElement[];
  scale: PDFExportScale;
  pageProps: PDFPageProperties;
}): Promise<ArrayBuffer> {
  const margin = pageProps.margin;
  const pageDim = pageProps.dimensions;
  
  const pdfDoc = await PDFDocument.create();

  for (const svg of SVG) {
    const svgWidth = parseFloat(svg.getAttribute('width') || '0');
    const svgHeight = parseFloat(svg.getAttribute('height') || '0');
    
    const dimensions = calculateDimensions(svgWidth, svgHeight, pageDim, margin, scale);

    if (!scale.fitToPage && (dimensions.width > pageDim.width || dimensions.height > pageDim.height)) {
      // Split oversized SVG into pages
      const maxWidth = pageDim.width - margin.left - margin.right;
      const maxHeight = pageDim.height - margin.top - margin.bottom;
      const splitSVGs = splitSVGIntoPages(svg, maxWidth, maxHeight);
      
      for (const splitSvg of splitSVGs) {
        const splitDimensions = calculateDimensions(
          parseFloat(splitSvg.getAttribute('width') || '0'),
          parseFloat(splitSvg.getAttribute('height') || '0'),
          pageDim,
          margin,
          { fitToPage: true }
        );
        await addSVGToPage(pdfDoc, splitSvg, splitDimensions, pageDim, pageProps.backgroundColor);
      }
    } else {
      await addSVGToPage(pdfDoc, svg, dimensions, pageDim, pageProps.backgroundColor);
    }
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