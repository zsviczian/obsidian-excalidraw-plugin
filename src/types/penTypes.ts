import type {
  ObsidianExtendedFillStyle,
  ObsidianPenOptions,
  ObsidianPenStrokeOptions,
  ObsidianPenStyle,
  ObsidianPenType,
} from "@zsviczian/excalidraw/types/excalidraw/obsidianTypes";

/**
 * Local names for the custom-pen types, aliased to the canonical
 * definitions owned by the Excalidraw fork
 * (packages/excalidraw/obsidianTypes.ts, referenced by
 * `AppState.customPens`/`currentStrokeOptions`). The fork cannot depend on
 * this plugin, so the shapes live there and are aliased here rather than
 * duplicated -- edit the fork's `Obsidian*` types, not these.
 */
export type StrokeOptions = ObsidianPenStrokeOptions;
export type PenOptions = ObsidianPenOptions;
export type ExtendedFillStyle = ObsidianExtendedFillStyle;
export type PenType = ObsidianPenType;
export type PenStyle = ObsidianPenStyle;
