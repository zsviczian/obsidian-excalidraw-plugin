import { Notice } from "obsidian";
import {
  DEVICE,
  EXCALIDRAW_PLUGIN,
} from "src/constants/constants";
import { t } from "src/lang/helpers";
import { download } from "./fileUtils";
import { svgToBase64 } from "./utils";
import {
  PageDimensions,
  PageOrientation,
  PageSize,
  PDFExportScale,
  PDFMargin,
  PDFPageAlignment,
  PDFPageMarginString,
  PDFPageProperties,
  STANDARD_PAGE_SIZES,
} from "src/types/exportUtilTypes";
import { setStyle } from "./styleUtils";

const DPI = 96;

//margins are in pixels
export function getMarginValue(margin: PDFPageMarginString): PDFMargin {
  switch (margin) {
    case "none":
      return { left: 0, right: 0, top: 0, bottom: 0 };
    case "tiny":
      return { left: 10, right: 10, top: 10, bottom: 10 };
    case "normal":
      return { left: 60, right: 60, top: 60, bottom: 60 };
    default:
      return { left: 60, right: 60, top: 60, bottom: 60 };
  }
}

export function getPageDimensions(
  pageSize: PageSize,
  orientation: PageOrientation,
  dims?: { width: number; height: number },
): PageDimensions {
  let dimensions: { width: number; height: number };
  dimensions = STANDARD_PAGE_SIZES[pageSize];

  if (dims && dimensions.width === 0 && dimensions.height === 0) {
    dimensions = { width: dims.width, height: dims.height };
  }

  return orientation === "portrait" ||
    pageSize === "MATCH IMAGE" ||
    pageSize === "HD Screen"
    ? { width: dimensions.width, height: dimensions.height }
    : { width: dimensions.height, height: dimensions.width };
}

function getPageSizePixels(
  pageSize: PageSize | PageDimensions,
  landscape = false,
): PageDimensions {
  if (typeof pageSize === "object") {
    return pageSize;
  }

  const pageDimensions = STANDARD_PAGE_SIZES[pageSize];
  if (!pageDimensions) {
    throw new Error(`Unsupported page size: ${pageSize}`);
  }

  return landscape
    ? { width: pageDimensions.height, height: pageDimensions.width }
    : { width: pageDimensions.width, height: pageDimensions.height };
}

async function getSavePath(defaultPath: string): Promise<string | undefined> {
  const result = await window.electron.remote.dialog.showSaveDialog({
    defaultPath,
    filters: [
      { name: "PDF Files", extensions: ["pdf"] },
      { name: "All Files", extensions: ["*"] },
    ],
    properties: ["showOverwriteConfirmation"],
  });
  return result.filePath;
}

async function printPdf(
  elementToPrint: HTMLElement,
  pdfPath: string,
  bgColor: string,
  pageSize: PageSize | PageDimensions,
  isLandscape: boolean,
  margins: { top: number; left: number; right: number; bottom: number },
  shouldOpen: boolean = true,
  extraCss: string = "",
  pageRanges?: string | { from: number; to: number }[],
): Promise<void> {
  const pdf = await EXCALIDRAW_PLUGIN.extrasGateway.getExportToPDF();
  if (!pdf) {
    return;
  }
  await pdf.exportToPDF(
    elementToPrint,
    pdfPath,
    bgColor,
    pageSize,
    isLandscape,
    margins,
    shouldOpen,
    extraCss,
    pageRanges,
  );
}

function calculateDimensions(
  svg: SVGSVGElement,
  svgWidth: number,
  svgHeight: number,
  pageDim: PageDimensions,
  margin: PDFMargin,
  scale: PDFExportScale,
  alignment: PDFPageAlignment,
): {
  tiles: {
    viewBox: string;
    width: number;
    height: number;
    x: number;
    y: number;
  }[];
  pages: number;
} {
  const viewBox = svg.getAttribute("viewBox")?.split(" ").map(Number) || [
    0,
    0,
    svgWidth,
    svgHeight,
  ];
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
      const pages =
        Math.ceil(scaledWidth / availableWidth) *
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
      alignment,
    );

    return {
      tiles: [
        {
          viewBox: `${viewBoxX} ${viewBoxY} ${svgWidth} ${svgHeight}`,
          width: finalWidth,
          height: finalHeight,
          x: position.x,
          y: position.y,
        },
      ],
      pages: 1,
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
      bottom: 0,
    },
    alignment,
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
      const intersectRight = Math.min(
        tileGlobalX + availableWidth,
        globalPosition.x + finalWidth,
      );
      const intersectBottom = Math.min(
        tileGlobalY + availableHeight,
        globalPosition.y + finalHeight,
      );

      // Calculate actual tile dimensions
      const scaledTileWidth = Math.max(0, intersectRight - intersectX);
      const scaledTileHeight = Math.max(0, intersectBottom - intersectY);

      if (scaledTileWidth <= 0 || scaledTileHeight <= 0) {
        continue;
      }

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
      } else if (
        alignment === "center" ||
        alignment === "top-center" ||
        alignment === "bottom-center"
      ) {
        if (col === 0) {
          x = margin.left + (availableWidth - scaledTileWidth);
        } else {
          x = margin.left;
        }
      } else if (alignment.endsWith("right")) {
        x = pageDim.width - margin.right - scaledTileWidth;
      } else {
        x = margin.left;
      }

      // Handle vertical positioning
      const heightRatio = scaledTileHeight / availableHeight;
      if (heightRatio >= 0.99 && heightRatio <= 1.01) {
        y = margin.top;
      } else if (
        alignment === "center" ||
        alignment === "center-left" ||
        alignment === "center-right"
      ) {
        if (row === 0) {
          y = margin.top + (availableHeight - scaledTileHeight);
        } else {
          y = margin.top;
        }
      } else if (alignment.startsWith("bottom")) {
        y = pageDim.height - margin.bottom - scaledTileHeight;
      } else {
        y = margin.top;
      }

      tiles.push({
        viewBox: `${tileX + viewBoxX} ${tileY + viewBoxY} ${tileWidth} ${tileHeight}`,
        width: scaledTileWidth,
        height: scaledTileHeight,
        x,
        y,
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
): { x: number; y: number } {
  const availableWidth = pageWidth - margin.left - margin.right;
  const availableHeight = pageHeight - margin.top - margin.bottom;

  let x = margin.left;
  let y = margin.top;

  // Handle horizontal alignment
  if (
    alignment === "center" ||
    alignment === "top-center" ||
    alignment === "bottom-center"
  ) {
    x = margin.left + (availableWidth - svgWidth) / 2;
  } else if (alignment.endsWith("right")) {
    x = margin.left + availableWidth - svgWidth;
  }

  // Handle vertical alignment
  if (
    alignment === "center" ||
    alignment === "center-left" ||
    alignment === "center-right"
  ) {
    y = margin.top + (availableHeight - svgHeight) / 2;
  } else if (alignment.startsWith("bottom")) {
    y = margin.top + availableHeight - svgHeight;
  }

  return { x, y };
}

export async function exportToPDF({
  SVG,
  scale = { fitToPage: 1, zoom: 1 },
  pageProps,
  filename,
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
  if (!savePath) {
    return;
  }

  // Decide if we should run multiple print jobs based on requested dimensions
  const dims = pageProps?.dimensions;
  const useMultiJob =
    !dims ||
    typeof dims.width !== "number" ||
    typeof dims.height !== "number" ||
    dims.width <= 0 ||
    dims.height <= 0;

  // Single fixed-size job (existing behavior)
  if (!useMultiJob) {
    const allPagesDiv = createDiv();
    setStyle(allPagesDiv, {
      width: "100%",
      height: "fit-content",
    });

    for (const svg of SVG) {
      const svgWidth = parseFloat(svg.getAttribute("width") || "0");
      const svgHeight = parseFloat(svg.getAttribute("height") || "0");

      const pageDimForSvg: PageDimensions = pageProps.dimensions; // fixed size
      const { tiles } = calculateDimensions(
        svg,
        svgWidth,
        svgHeight,
        pageDimForSvg,
        pageProps.margin,
        scale,
        pageProps.alignment,
      );

      const { width: pageWidth, height: pageHeight } = getPageSizePixels(
        pageDimForSvg,
        false,
      );

      for (const tile of tiles) {
        const pageDiv = createDiv();
        pageDiv.addClass("print-page");

        setStyle(pageDiv, {
          width: `${pageWidth}px`,
          height: `${pageHeight}px`,
          display: "flex",
          justifyContent: "start",
          alignItems: "left",
          left: `${pageProps.margin.left}px`,
          top: `${pageProps.margin.top}px`,
          position: "relative",
          //padding: `${pageProps.margin.top}px ${pageProps.margin.right}px ${pageProps.margin.bottom}px ${pageProps.margin.left}px`,
        });

        const clonedSVG = svg.cloneNode(true) as SVGSVGElement;
        clonedSVG.setAttribute("viewBox", tile.viewBox);
        setStyle(clonedSVG, {
          width: `${tile.width}px`,
          height: `${tile.height}px`,
          position: "absolute",
          left: `${tile.x - pageProps.margin.left}px`,
          top: `${tile.y - pageProps.margin.top}px`,
        });

        pageDiv.appendChild(clonedSVG);
        allPagesDiv.appendChild(pageDiv);
      }
    }

    new Notice(t("EXPORTDIALOG_PDF_PROGRESS_NOTICE"));
    try {
      await printPdf(
        allPagesDiv,
        savePath,
        pageProps.backgroundColor || "#ffffff",
        pageProps.dimensions,
        false,
        { top: 0, right: 0, bottom: 0, left: 0 },
        true,
      );
    } catch (error) {
      console.error("Failed to export to PDF: ", error);
      new Notice(t("EXPORTDIALOG_PDF_PROGRESS_ERROR"));
    }
    new Notice(t("EXPORTDIALOG_PDF_PROGRESS_DONE"));
    return;
  }

  // Mixed-size single job using CSS @page rules
  new Notice(t("EXPORTDIALOG_PDF_PROGRESS_NOTICE"));
  try {
    const allPagesDiv = createDiv();
    setStyle(allPagesDiv, {
      width: "100%",
      height: "fit-content",
    });

    // Collect unique page sizes -> named @page rules
    const pageRuleNames = new Map<
      string,
      { name: string; w: number; h: number }
    >();
    const makeKey = (w: number, h: number) => `${w.toFixed(2)}x${h.toFixed(2)}`;
    const toIn = (px: number) => px / DPI;
    const toCssName = (key: string) => `p_${key.replace(/[^\w-]/g, "_")}`;

    for (const svg of SVG) {
      const svgWidth = parseFloat(svg.getAttribute("width") || "0");
      const svgHeight = parseFloat(svg.getAttribute("height") || "0");

      const pageDimForSvg: PageDimensions = {
        width: svgWidth,
        height: svgHeight,
      };

      const key = makeKey(pageDimForSvg.width, pageDimForSvg.height);
      if (!pageRuleNames.has(key)) {
        pageRuleNames.set(key, {
          name: toCssName(key),
          w: pageDimForSvg.width,
          h: pageDimForSvg.height,
        });
      }

      const { tiles } = calculateDimensions(
        svg,
        svgWidth,
        svgHeight,
        pageDimForSvg,
        pageProps.margin,
        scale,
        pageProps.alignment,
      );

      const { width: pageWidth, height: pageHeight } = getPageSizePixels(
        pageDimForSvg,
        false,
      );
      const pageClass = pageRuleNames.get(key).name;

      for (const tile of tiles) {
        const pageDiv = createDiv();
        pageDiv.addClass("print-page");
        // bind to @page rule via page: <name>
        pageDiv.addClass(pageClass);

        setStyle(pageDiv, {
          page: pageClass,
          width: `${pageWidth}px`,
          height: `${pageHeight}px`,
          display: "flex",
          justifyContent: "start",
          alignItems: "left",
          left: `${pageProps.margin.left}px`,
          top: `${pageProps.margin.top}px`,
          position: "relative",
        });

        const clonedSVG = svg.cloneNode(true) as SVGSVGElement;
        clonedSVG.setAttribute("viewBox", tile.viewBox);
        setStyle(clonedSVG, {
          width: `${tile.width}px`,
          height: `${tile.height}px`,
          position: "absolute",
          left: `${tile.x - pageProps.margin.left}px`,
          top: `${tile.y - pageProps.margin.top}px`,
        });

        pageDiv.appendChild(clonedSVG);
        allPagesDiv.appendChild(pageDiv);
      }
    }

    // Build @page CSS with named sizes
    let extraCss = "";
    for (const { name, w, h } of pageRuleNames.values()) {
      extraCss += `
        @page ${name} {
          size: ${toIn(w)}in ${toIn(h)}in;
          margin: 0;
        }
        .print-page.${name} { page: ${name}; }
      `;
    }

    // Determine a base numeric page size large enough for all pages
    let baseW = 0;
    let baseH = 0;
    for (const { w, h } of pageRuleNames.values()) {
      baseW = Math.max(baseW, w);
      baseH = Math.max(baseH, h);
    }
    const basePageSize = { width: baseW || 800, height: baseH || 600 };

    // Ensure we have a class for the base size
    const baseKey = makeKey(basePageSize.width, basePageSize.height);
    if (!pageRuleNames.has(baseKey)) {
      pageRuleNames.set(baseKey, {
        name: toCssName(baseKey),
        w: basePageSize.width,
        h: basePageSize.height,
      });
      extraCss += `
        @page ${pageRuleNames.get(baseKey).name} {
          size: ${toIn(basePageSize.width)}in ${toIn(basePageSize.height)}in;
          margin: 0;
        }
        .print-page.${pageRuleNames.get(baseKey).name} { page: ${pageRuleNames.get(baseKey).name}; }
      `;
    }
    const baseClass = pageRuleNames.get(baseKey).name;

    // Insert a dummy first page to prime Chromium with the largest page box
    const dummy = createDiv();
    dummy.addClass("print-page");
    dummy.addClass("dummy-first");
    dummy.addClass(baseClass);
    allPagesDiv.prepend(dummy);

    // Kick a single print job, excluding the first (dummy) page
    await printPdf(
      allPagesDiv,
      savePath,
      pageProps.backgroundColor || "#ffffff",
      basePageSize,
      false,
      { top: 0, right: 0, bottom: 0, left: 0 },
      true,
      extraCss,
      "2-", // EXCLUDE PAGE 1, included to prime the Chromium page box
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

export async function exportPNGToClipboard(png: Blob) {
  await navigator.clipboard.write([
    new window.ClipboardItem({
      "image/png": png,
    }),
  ]);
}

export function exportPNG(png: Blob, filename: string) {
  const reader = new FileReader();
  reader.readAsDataURL(png);
  reader.onloadend = () => {
    const base64data = reader.result;
    download(null, base64data, `${filename}.png`);
  };
}

export function exportSVG(svg: SVGSVGElement, filename: string) {
  download(null, svgToBase64(svg.outerHTML), `${filename}.svg`);
}
