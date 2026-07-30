import type { MarkdownImageRenderSettings } from "src/types/markdownImageTypes";

/** Resolves a complete render configuration from stored values and defaults. */
export function resolveMarkdownImageRenderSettings(
  defaults: MarkdownImageRenderSettings,
  stored?: MarkdownImageRenderSettings | null,
): MarkdownImageRenderSettings {
  const storedTransclusion = stored?.transclusion;
  const defaultTransclusion = defaults.transclusion;
  return {
    width: stored?.width ?? defaults.width,
    fontFamily: stored?.fontFamily ?? defaults.fontFamily,
    fontColor: stored?.fontColor ?? defaults.fontColor,
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
      fontColor: storedTransclusion?.fontColor ?? defaultTransclusion.fontColor,
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
