import type { ExcalidrawElement, NonDeleted } from "@zsviczian/excalidraw/types/element/src/types";
import { exportToBlob } from "src/constants/constants";
import { blobToDataURL } from "src/utils/coreUtils";
import { createExportAreaAnchor, getElementsInArea } from "src/utils/excalidrawElementUtils";
import { resolveThumbnailFrame } from "src/utils/frameMetadata";
import { getFrameBasedOnFrameNameOrId } from "src/utils/excalidrawViewUtils";
import { admitDrawingPreview, MAX_THUMBNAIL_ELEMENTS } from "./visualResourceModel";

const THUMBNAIL_SIDE = 256;

/** Render saved geometry at thumbnail size without loading nested drawings or original assets. */
export async function rasterizeDrawingResource(elements: ExcalidrawElement[], frameId: string | undefined,
  thumbnail: unknown, dark: boolean): Promise<string | null> {
  const frame = frameId ? getFrameBasedOnFrameNameOrId(frameId, elements) : resolveThumbnailFrame(elements, thumbnail);
  if (frameId && !frame) return null;
  const content = frame ? [...getElementsInArea(elements, frame).filter(element => element.id !== frame.id), createExportAreaAnchor(frame)] : elements;
  if (!content.length || content.length > MAX_THUMBNAIL_ELEMENTS) return null;
  const geometry = content.map((element): NonDeleted<ExcalidrawElement> =>
    element.type === "image" || element.type === "embeddable" || element.type === "iframe"
      ? { ...element, isDeleted: false, type: "rectangle", fillStyle: "solid", strokeColor: "#868e96", backgroundColor: "#868e9633", roughness: 0 }
      : { ...element, isDeleted: false });
  if (!admitDrawingPreview(geometry)) return null;
  const blob = await exportToBlob({
    elements: geometry,
    files: {},
    appState: { exportBackground: false, exportWithDarkMode: dark },
    mimeType: "image/png",
    exportPadding: 4,
    getDimensions: (width, height) => {
      if (![width, height].every(value => Number.isFinite(value) && value > 0)) throw Error("Invalid thumbnail dimensions");
      const scale = Math.min(1, THUMBNAIL_SIDE / Math.max(width, height));
      return { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)), scale };
    },
  });
  return blobToDataURL(blob);
}
