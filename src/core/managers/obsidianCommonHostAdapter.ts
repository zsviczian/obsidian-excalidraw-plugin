import type ExcalidrawPlugin from "src/core/main";
import { ExcalidrawLib } from "../../types/excalidrawLib";

const DEFAULT_AREA_LIMIT = 16_777_216;
const DEFAULT_WIDTH_HEIGHT_LIMIT = 32_767;

/**
 * Creates the narrow, window-runtime host adapter consumed by the Excalidraw
 * fork's common and element packages.
 *
 * @remarks
 * Capability methods read current plugin state rather than capturing settings
 * values. The package manager owns both this adapter and its disposer, so the
 * adapter cannot outlive the corresponding evaluated Excalidraw runtime.
 */
export const createObsidianCommonHostAdapter = (
  plugin: ExcalidrawPlugin,
  protocolVersion: typeof ExcalidrawLib.OBSIDIAN_COMMON_HOST_PROTOCOL_VERSION,
): ExcalidrawLib.ObsidianCommonHostAdapter => ({
  protocolVersion,
  getDeviceInfo: () => plugin.getObsidianDevice(),
  getDesktopUIMode: () => plugin.getPreferredUIMode(),
  getPreferredUIMode: (formFactor) => {
    if (formFactor === "phone") {
      return plugin.settings.phoneUIMode;
    }

    if (formFactor === "tablet") {
      return plugin.settings.tabletUIMode;
    }

    return plugin.settings.desktopUIMode;
  },
  getCanvasLimits: () => ({
    areaLimit: plugin.excalidrawConfig?.areaLimit ?? DEFAULT_AREA_LIMIT,
    widthHeightLimit:
      plugin.excalidrawConfig?.widthHeightLimit ?? DEFAULT_WIDTH_HEIGHT_LIMIT,
  }),
  getHighlightColor: (sceneBackgroundColor, opacity) =>
    plugin.getHighlightColor(sceneBackgroundColor, opacity),
});
