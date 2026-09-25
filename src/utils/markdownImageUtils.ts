import type {
  MarkdownImageCustomData,
  MarkdownImageRenderSettings,
} from "src/types/markdownImageTypes";

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
  preserveBounds = false,
}: {
  current: ImageBounds;
  previousIntrinsic?: ImageSize | null;
  nextIntrinsic: ImageSize;
  previousFlowWidth: number;
  nextFlowWidth: number;
  preserveBounds?: boolean;
}): ImageBounds {
  if (preserveBounds) {
    return { ...current };
  }
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
