/** Measure frame-label export geometry through the installed renderer, without original images. */
import type { ExcalidrawElement } from "@zsviczian/excalidraw/types/element/src/types";
import type { AppState } from "@zsviczian/excalidraw/types/excalidraw/types";
import { getSVG } from "src/utils/utils";
import { createExportAreaAnchor } from "src/utils/excalidrawElementUtils";
import { CLIError } from "./cliProtocol";
import { parseImagePolicy, prepareImagePreview } from "./cliImages";

/**
 * Frames add renderer-owned title text above their geometric bounds. Probe with
 * tiny placeholders and an invisible in-bounds linked rectangle; the rectangle's
 * SVG translation exposes the actual origin without duplicating renderer font
 * constants or rewriting SVG markup. The entire probe is discarded afterward.
 */
export async function frameExportGeometry(elements: ExcalidrawElement[], appState: Partial<AppState>, padding: number,
  bounds: readonly number[]): Promise<{ x: number; y: number; width: number; height: number }> {
  const converted = await prepareImagePreview(elements, {}, parseImagePolicy({ default: "placeholder" }), new Map());
  const anchor = createExportAreaAnchor({ x: bounds[0], y: bounds[1], width: Math.min(0.1, bounds[2] - bounds[0]), height: Math.min(0.1, bounds[3] - bounds[1]) });
  const link = `#excalidraw-cli-origin-${anchor.id}`;
  const svg = await getSVG({ elements: [...converted.elements, { ...anchor, link }], files: converted.files, appState: { ...appState, exportEmbedScene: false } },
    { withBackground: true, withTheme: true, isMask: false }, padding, null);
  const group = svg?.querySelector<SVGGElement>(`a[href="${link}"] > g`);
  const matrix = group?.transform.baseVal.getItem(0)?.matrix;
  const width = Number(svg?.getAttribute("width")), height = Number(svg?.getAttribute("height"));
  if (!matrix || !Number.isFinite(width) || !Number.isFinite(height)) throw new CLIError("EXPORT_FAILED", "Renderer export geometry is unavailable.");
  return { x: anchor.x - matrix.e, y: anchor.y - matrix.f, width, height };
}
