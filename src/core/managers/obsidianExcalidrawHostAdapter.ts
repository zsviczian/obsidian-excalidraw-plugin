import type ExcalidrawPlugin from "src/core/main";
import { ExcalidrawLib } from "../../types/excalidrawLib";

/**
 * Creates the plugin-wide settings adapter consumed by the evaluated
 * Excalidraw package runtime.
 *
 * @remarks
 * Every method reads current settings so changes are not captured in a stale
 * snapshot. This boundary deliberately excludes plugin services and active-view
 * state; those require separate lifecycle contracts.
 */
export const createObsidianExcalidrawHostAdapter = (
  plugin: ExcalidrawPlugin,
  protocolVersion: typeof ExcalidrawLib.OBSIDIAN_EXCALIDRAW_HOST_PROTOCOL_VERSION,
): ExcalidrawLib.ObsidianExcalidrawHostAdapter => ({
  protocolVersion,
  isDoubleTapEraserEnabled: () => plugin.settings.penModeDoubleTapEraser,
  isRightClickPanEnabled: () => plugin.settings.panWithRightMouseButton,
  getZoomToFitMaxLevel: () => plugin.settings.zoomToFitMaxLevel,
  isPenModeCrosshairVisible: () => plugin.settings.penModeCrosshairVisible,
  isSingleFingerPanningEnabled: () =>
    plugin.settings.penModeSingleFingerPanning,
  isDoubleClickTextEditingDisabled: () =>
    plugin.settings.disableDoubleClickTextEditing,
  getZoomStep: () => plugin.settings.zoomStep,
  getZoomMin: () => plugin.settings.zoomMin,
  getZoomMax: () => plugin.settings.zoomMax,
  isContextMenuDisabled: () => plugin.settings.disableContextMenu,
  shouldSyncElementLinkWithText: () => plugin.settings.syncElementLinkWithText,
});
