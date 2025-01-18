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
  scale: PDFExportScale
): {x: number, y: number} {
  const availableWidth = pageWidth - margin.left - margin.right;
  const availableHeight = pageHeight - margin.top - margin.bottom;

  console.log(JSON.stringify({
    message: 'PDF Position Debug',
    input: {
      svgWidth,
      svgHeight,
      pageWidth,
      pageHeight,
      margin,
      alignment,
      scale
    },
    calculated: {
      availableWidth,
      availableHeight
    }
  }));

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

  console.log(JSON.stringify({
    message: 'PDF Position Intermediate',
    x,
    y,
    alignment,
    availableHeight,
    marginTop: margin.top,
    marginBottom: margin.bottom,
    svgHeight,
    pageHeight
  }));

  console.log(JSON.stringify({
    message: 'PDF Position Result',
    x,
    y,
    finalPosition: {
      bottom: y,
      top: y + svgHeight,
      left: x,
      right: x + svgWidth
    }
  }));

  return {x, y};
}

function calculateDimensions(
  svgWidth: number,
  svgHeight: number,
  pageDim: PageDimensions,
  margin: PDFPageProperties['margin'],
  scale: PDFExportScale,
  alignment: PDFPageAlignment
): SVGDimensions[] {
  const availableWidth = pageDim.width - margin.left - margin.right;
  const availableHeight = pageDim.height - margin.top - margin.bottom;

  let finalWidth: number;
  let finalHeight: number;

  if (scale.fitToPage) {
    const ratio = Math.min(availableWidth / svgWidth, availableHeight / svgHeight);
    finalWidth = svgWidth * ratio;
    finalHeight = svgHeight * ratio;
    
    const position = calculatePosition(
      finalWidth, 
      finalHeight, 
      pageDim.width, 
      pageDim.height, 
      margin,
      alignment,
      scale
    );

    return [{
      width: finalWidth,
      height: finalHeight,
      x: position.x,
      y: position.y
    }];
  } else {
    // Scale mode - may need multiple pages
    finalWidth = svgWidth * (scale.zoom || 1);
    finalHeight = svgHeight * (scale.zoom || 1);

    if (finalWidth <= availableWidth && finalHeight <= availableHeight) {
      // Content fits on one page
      const position = calculatePosition(
        finalWidth, 
        finalHeight, 
        pageDim.width, 
        pageDim.height, 
        margin,
        alignment,
        scale
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
      const cols = Math.ceil(finalWidth / availableWidth);
      const rows = Math.ceil(finalHeight / availableHeight);

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const tileWidth = Math.min(availableWidth, finalWidth - col * availableWidth);
          const tileHeight = Math.min(availableHeight, finalHeight - row * availableHeight);
          
          // Calculate y coordinate following the same logic as single-page rendering
          // We start from the bottom margin and work our way up
          //const y = margin.bottom + row * availableHeight;
          
          dimensions.push({
            width: tileWidth,
            height: tileHeight,
            x: margin.left,
            y: margin.top,
            sourceX: col * availableWidth / (scale.zoom || 1),
            sourceY: row * availableHeight / (scale.zoom || 1),
            sourceWidth: tileWidth / (scale.zoom || 1),
            sourceHeight: tileHeight / (scale.zoom || 1)
          });
        }
      }
      return dimensions;
    }
  }
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

  // Clone and modify SVG for tiling if needed
  let svgToEmbed = svg;
  if (dimensions.sourceX !== undefined) {
    svgToEmbed = svg.cloneNode(true) as SVGSVGElement;
    const viewBox = `${dimensions.sourceX} ${dimensions.sourceY} ${dimensions.sourceWidth} ${dimensions.sourceHeight}`;
    svgToEmbed.setAttribute('viewBox', viewBox);
    svgToEmbed.setAttribute('width', String(dimensions.sourceWidth));
    svgToEmbed.setAttribute('height', String(dimensions.sourceHeight));
  }

  const svgImage = await pdfDoc.embedSvg(svgToEmbed.outerHTML);
  
  console.log(JSON.stringify({message: "addSVGToPage", dimensions, html: svgToEmbed.outerHTML}));

  // Adjust y-coordinate to account for PDF coordinate system
  const adjustedY = pageDim.height - dimensions.y;

  page.drawSvg(svgImage, {
    x: dimensions.x,
    y: adjustedY,
    width: dimensions.width,
    height: dimensions.height,
  });

  console.log(JSON.stringify({
    message: 'PDF Draw SVG',
    x: dimensions.x,
    y: adjustedY,
    width: dimensions.width,
    height: dimensions.height
  }));

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
  const pdfDoc = await PDFDocument.create();

  for (const svg of SVG) {
    const svgWidth = parseFloat(svg.getAttribute('width') || '0');
    const svgHeight = parseFloat(svg.getAttribute('height') || '0');
    
    const dimensions = calculateDimensions(
      svgWidth, 
      svgHeight, 
      pageProps.dimensions, 
      pageProps.margin, 
      scale,
      pageProps.alignment
    );

    for (const dim of dimensions) {
      await addSVGToPage(pdfDoc, svg, dim, pageProps.dimensions, pageProps.backgroundColor);
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