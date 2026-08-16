import type ExcalidrawPlugin from "src/core/main";
import { ExcalidrawLib } from "../../types/excalidrawLib";

/**
 * Creates the plugin-wide capability adapter consumed by the evaluated
 * Excalidraw package runtime.
 *
 * @remarks
 * Settings methods read current values rather than capturing a stale snapshot.
 * The adapter exposes only semantic operations and never the plugin instance,
 * settings object, or active-view state.
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
  loadFontFromFile: (filename) => plugin.loadFontFromFile(filename),
  getMermaid: () => plugin.getMermaid(),
  runAction: (action) => plugin.runAction(action),
  getLabel: (key) =>
    plugin.getLabel(key as Parameters<ExcalidrawPlugin["getLabel"]>[0]),
  attachInlineLinkSuggester: (
    inputEl,
    widthWrapper,
    container,
    suppressPlaceholder,
  ) =>
    plugin.attachInlineLinkSuggester(
      inputEl,
      widthWrapper,
      container ?? undefined,
      suppressPlaceholder,
    ),
});
