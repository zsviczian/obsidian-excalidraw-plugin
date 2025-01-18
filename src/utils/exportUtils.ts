import { PDFDocument, rgb } from '@cantoo/pdf-lib';
import { getEA } from 'src/core';


export type PDFPageAlignment = "center" | "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right";
export type PDFPageMarginString = "none" | "tiny" | "normal";

export interface PDFExportScale {
  fitToPage: boolean;
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

  svgToEmbed = await preprocessSVGForPDFLib(svgToEmbed);
  const svgImage = await pdfDoc.embedSvg(svgToEmbed.outerHTML);
  
  // Adjust y-coordinate to account for PDF coordinate system
  const adjustedY = pageDim.height - dimensions.y;

  page.drawSvg(svgImage, {
    x: dimensions.x,
    y: adjustedY,
    width: dimensions.width,
    height: dimensions.height,
  });

  return page;
}

async function convertImageToDataURL(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

async function preprocessSVGForPDFLib(svg: SVGSVGElement): Promise<SVGSVGElement> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  
  // Convert all images to PNG format
  const images = clone.querySelectorAll('image');
  await Promise.all(Array.from(images).map(async (img) => {
    const href = img.getAttribute('href') || img.getAttribute('xlink:href');
    if (href && href.startsWith('data:image/')) {
      try {
        const pngDataUrl = await convertImageToDataURL(href);
        img.setAttribute('href', pngDataUrl);
        if (img.hasAttribute('xlink:href')) {
          img.setAttribute('xlink:href', pngDataUrl);
        }
      } catch (error) {
        console.error('Failed to convert image:', error);
      }
    }
  }));

  // Convert symbols with images
  const symbols = clone.querySelectorAll('symbol');
  for (const symbol of Array.from(symbols)) {
    const image = symbol.querySelector('image');
    if (image) {
      const uses = clone.querySelectorAll(`use[href="#${symbol.id}"]`);
      for (const use of Array.from(uses)) {
        const newImage = image.cloneNode(true) as SVGImageElement;
        newImage.setAttribute('width', use.getAttribute('width') || '100%');
        newImage.setAttribute('height', use.getAttribute('height') || '100%');
        newImage.setAttribute('x', use.getAttribute('x') || '0');
        newImage.setAttribute('y', use.getAttribute('y') || '0');
        use.parentNode.replaceChild(newImage, use);
      }
    }
  }

  // Remove defs and symbols
  const defs = clone.querySelector('defs');
  if (defs) defs.remove();

  return clone;
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

export async function exportSVGToClipboard(svg: SVGSVGElement) {
  try {
    const svgString = svg.outerHTML;
    await navigator.clipboard.writeText(svgString);
  } catch (error) {
    console.error("Failed to copy SVG to clipboard: ", error);
  }
}