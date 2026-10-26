import type {
  MarkdownImageCustomData,
  MarkdownImageRenderSettings,
} from "src/types/markdownImageTypes";
import type { ImageCrop } from "@zsviczian/excalidraw/types/element/src/types";

type ImageSize = { width: number; height: number };
type ImageBounds = ImageSize & { x: number; y: number };

/**
 * Retains a canvas resize while allowing untouched Markdown images to grow
 * with their content. A missing previous intrinsic size is treated as a
 * legacy image whose existing display bounds must be preserved.
 */
export function getMarkdownImageDisplayGeometry({
  current,
  previousIntrinsic,
  nextIntrinsic,
  previousFlowWidth,
  nextFlowWidth,
}: {
  current: ImageBounds;
  previousIntrinsic?: ImageSize | null;
  nextIntrinsic: ImageSize;
  previousFlowWidth: number;
  nextFlowWidth: number;
}): ImageBounds {
  if (previousFlowWidth !== nextFlowWidth) {
    return { x: current.x, y: current.y, ...nextIntrinsic };
  }
  if (
    !previousIntrinsic ||
    !Number.isFinite(previousIntrinsic.width) ||
    !Number.isFinite(previousIntrinsic.height) ||
    previousIntrinsic.width <= 0 ||
    previousIntrinsic.height <= 0 ||
    Math.abs(current.width - previousIntrinsic.width) > 1 ||
    Math.abs(current.height - previousIntrinsic.height) > 1
  ) {
    return { ...current };
  }
  return { x: current.x, y: current.y, ...nextIntrinsic };
}

/**
 * Remaps a cropped Markdown image to a newly rendered SVG. Explicit editor-width
 * changes retain the relative crop window and use its new intrinsic size.
 * Content-only refreshes retain the pixel viewport and its canvas scale, clamping
 * it when the new SVG is smaller. Margin fractions avoid division by a missing
 * right/bottom margin for edge-aligned or single-axis crops.
 */
export function getMarkdownImageCropGeometry(
  current: ImageBounds & { crop?: ImageCrop | null },
  nextIntrinsic: ImageSize,
  resetDisplayScale = false,
): ImageBounds & { crop: ImageCrop | null } {
  const { x, y, width, height, crop } = current;
  const bounds = { x, y, width, height };
  if (!crop) return { ...bounds, crop: null };
  const valid = Object.values(crop).every(Number.isFinite) &&
    crop.width > 0 && crop.height > 0 && crop.x >= 0 && crop.y >= 0 &&
    crop.x + crop.width <= crop.naturalWidth &&
    crop.y + crop.height <= crop.naturalHeight;
  if (!resetDisplayScale && valid && crop.naturalWidth === nextIntrinsic.width && crop.naturalHeight === nextIntrinsic.height) {
    return { ...bounds, crop: { ...crop } };
  }
  const remapAxis = (offset: number, size: number, natural: number, next: number, display: number) => {
    const previousNatural = Number.isFinite(natural) && natural > 0 ? natural : next;
    const previousSize = Number.isFinite(size) && size > 0 ? Math.min(size, previousNatural) : previousNatural;
    const previousGap = previousNatural - previousSize;
    const previousOffset = Number.isFinite(offset)
      ? Math.max(0, Math.min(offset, previousGap)) : previousGap / 2;
    const nextSize = resetDisplayScale
      ? previousSize / previousNatural * next : Math.min(previousSize, next);
    const nextOffset = resetDisplayScale
      ? previousOffset / previousNatural * next
      : previousGap > 0 ? previousOffset / previousGap * (next - nextSize) : (next - nextSize) / 2;
    const scaledDisplay = display * (nextSize / previousSize);
    return {
      offset: nextOffset,
      size: nextSize,
      display: resetDisplayScale || !Number.isFinite(scaledDisplay) ? nextSize : scaledDisplay,
    };
  };
  const horizontal = remapAxis(crop.x, crop.width, crop.naturalWidth, nextIntrinsic.width, width);
  const vertical = remapAxis(crop.y, crop.height, crop.naturalHeight, nextIntrinsic.height, height);
  return {
    x, y, width: horizontal.display, height: vertical.display,
    crop: horizontal.size === nextIntrinsic.width && vertical.size === nextIntrinsic.height
      ? null : {
        x: horizontal.offset, y: vertical.offset,
        width: horizontal.size, height: vertical.size,
        naturalWidth: nextIntrinsic.width, naturalHeight: nextIntrinsic.height,
      },
  };
}

/** View-local identity of the inputs used to render a Markdown image. */
export type MarkdownImageRenderCacheEntry = {
  markdown: string;
  configuration: string;
};

const normalizeFontColor = (fontColor: string): string =>
  fontColor.trim() === "" ? "black" : fontColor;

/** Resolves a complete render configuration from stored values and defaults. */
export function resolveMarkdownImageRenderSettings(
  defaults: MarkdownImageRenderSettings,
  stored?: MarkdownImageRenderSettings | null,
): MarkdownImageRenderSettings {
  const storedTransclusion = stored?.transclusion;
  const defaultTransclusion = defaults.transclusion;
  return {
    width: stored?.width ?? defaults.width,
    paddingBottom: Math.min(
      100,
      Math.max(0, Math.round(stored?.paddingBottom ?? defaults.paddingBottom)),
    ),
    fontFamily: stored?.fontFamily ?? defaults.fontFamily,
    fontColor: normalizeFontColor(stored?.fontColor ?? defaults.fontColor),
    border: {
      enabled: stored?.border?.enabled ?? defaults.border.enabled,
      color: stored?.border?.color ?? defaults.border.color,
    },
    css: stored?.css ?? defaults.css,
    transclusion: {
      // Existing elements without transclusion settings keep parent inheritance.
      enabled: stored
        ? (storedTransclusion?.enabled ?? false)
        : defaultTransclusion.enabled,
      fontFamily:
        storedTransclusion?.fontFamily ?? defaultTransclusion.fontFamily,
      fontColor: normalizeFontColor(
        storedTransclusion?.fontColor ?? defaultTransclusion.fontColor,
      ),
      border: {
        enabled:
          storedTransclusion?.border?.enabled ??
          defaultTransclusion.border.enabled,
        color:
          storedTransclusion?.border?.color ?? defaultTransclusion.border.color,
      },
      css: storedTransclusion?.css ?? defaultTransclusion.css,
    },
  };
}

/** Captures every persisted or defaulted input that can affect SVG rendering. */
export function createMarkdownImageRenderCacheEntry(
  markdown: string,
  sourceFilePath: string,
  customData: MarkdownImageCustomData,
  render: MarkdownImageRenderSettings,
): MarkdownImageRenderCacheEntry {
  // Canvas geometry is not an SVG render input. Recording the last intrinsic
  // size must not force a second render on the next scene load.
  const renderCustomData = { ...customData };
  delete renderCustomData.renderedSize;
  return {
    markdown,
    configuration: JSON.stringify({
      sourceFilePath,
      customData: renderCustomData,
      render,
    }),
  };
}
