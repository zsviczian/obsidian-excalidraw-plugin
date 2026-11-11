import type { ExportSceneConfig } from "@zsviczian/excalidraw/types/excalidraw/scene/export";
import type { AppState } from "@zsviczian/excalidraw/types/excalidraw/types";
import type { ExportSettings } from "src/types/exportUtilTypes";

/** A larger export viewport adds outer space while the original frame remains the clip. */
export function getThumbnailPaddingConfig(settings: ExportSettings, state: Partial<AppState>, padding: number, scale = 1): ExportSceneConfig {
  const frame = settings.exportingFrame;
  return {
    exportingFrame: frame, padding: 0, scale, fit: "none", origin: "canvas",
    x: frame.x - padding, y: frame.y - padding,
    width: frame.width + 2 * padding, height: frame.height + 2 * padding,
    theme: settings.withTheme && state.theme === "dark" ? "dark" : "light",
    canvasBackgroundColor: settings.withBackground ? state.viewBackgroundColor ?? "#ffffff" : false,
  };
}
