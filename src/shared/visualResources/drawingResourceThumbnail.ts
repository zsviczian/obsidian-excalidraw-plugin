import type { ExcalidrawElement, FileId, NonDeleted } from "@zsviczian/excalidraw/types/element/src/types";
import type { BinaryFiles, DataURL } from "@zsviczian/excalidraw/types/excalidraw/types";
import type { App, TFile } from "obsidian";
import { exportToBlob } from "src/constants/constants";
import { EMBEDDED_VAULT_FILE_REG, RE_EXCALIDRAWDATA_NOSECTION_OK } from "src/shared/excalidrawMarkdownParsing";
import { getElementsInArea } from "src/utils/excalidrawElementUtils";
import { resolveThumbnailFrame } from "src/utils/frameMetadata";
import { getFrameBasedOnFrameNameOrId } from "src/utils/excalidrawViewUtils";
import { getLinkParts } from "src/utils/linkUtils";
import { inspectRasterDimensions } from "src/utils/rasterImageDimensions";
import type { readDrawingPreviewScene } from "src/utils/drawingPreviewScene";
import { admitDrawingPreview } from "./visualResourceModel";

const THUMBNAIL_SIDE = 256;
const MAX_ASSET_COUNT = 16;
const MAX_ASSET_BYTES = 4 * 1024 * 1024;
const MAX_TOTAL_ASSET_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_ASSET_PIXELS = 40_000_000;
const RASTER_TYPES = new Map([["png", "image/png"], ["jpeg", "image/jpeg"], ["jpg", "image/jpeg"], ["webp", "image/webp"]]);

type PreviewScene = Awaited<ReturnType<typeof readDrawingPreviewScene>>;
type ReducedImage = { width: number; height: number; originalWidth: number; originalHeight: number; url: DataURL };

async function reduceRaster(blob: Blob, expected: { width: number; height: number }, owner: Document, active: () => boolean): Promise<ReducedImage | null> {
  const fragment = owner.defaultView.createFragment();
  const image = fragment.createEl("img");
  const urls = owner.defaultView.URL;
  const url = urls.createObjectURL(blob);
  const canvas = fragment.createEl("canvas");
  try {
    image.src = url;
    await image.decode();
    if (!active()) return null;
    const { naturalWidth: originalWidth, naturalHeight: originalHeight } = image;
    if (!(originalWidth === expected.width && originalHeight === expected.height ||
          originalWidth === expected.height && originalHeight === expected.width)) return null;
    const scale = Math.min(1, THUMBNAIL_SIDE / Math.max(originalWidth, originalHeight));
    const width = canvas.width = Math.max(1, Math.round(originalWidth * scale));
    const height = canvas.height = Math.max(1, Math.round(originalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(image, 0, 0, width, height);
    return { url: canvas.toDataURL("image/png") as DataURL, width, height, originalWidth, originalHeight };
  } finally {
    canvas.width = 0;
    image.removeAttribute("src");
    urls.revokeObjectURL(url);
  }
}

/** Reduce direct vault images sequentially before the scene renderer sees them. */
async function loadVisibleImages(app: App, drawing: TFile, source: string, elements: readonly ExcalidrawElement[], active: () => boolean) {
  const ids = new Set(elements.flatMap(element => element.type === "image" && element.fileId ? [element.fileId] : []));
  const reduced = new Map<FileId, ReducedImage>();
  if (!ids.size) return reduced;
  const owner = app.workspace.containerEl.ownerDocument;
  const data = source.slice(Math.max(0, source.search(RE_EXCALIDRAWDATA_NOSECTION_OK)));
  const section = /^(?:## Embedded Files|# Embedded files)\n([\s\S]*?)(?=^#{1,2} |(?![\s\S]))/m.exec(data)?.[1];
  if (!section) return reduced;
  let bytesLeft = MAX_TOTAL_ASSET_BYTES, pixelsLeft = MAX_TOTAL_ASSET_PIXELS, attempted = 0;
  for (const [, rawId, link] of section.matchAll(EMBEDDED_VAULT_FILE_REG)) {
    const id = rawId as FileId;
    if (!ids.delete(id)) continue;
    if (!active() || attempted >= MAX_ASSET_COUNT) break;
    const asset = app.metadataCache.getFirstLinkpathDest(getLinkParts(link).path, drawing.path);
    const type = asset && RASTER_TYPES.get(asset.extension.toLowerCase());
    const size = asset?.stat.size;
    if (!type || size > Math.min(MAX_ASSET_BYTES, bytesLeft)) continue;
    attempted++;
    bytesLeft -= size;
    try {
      const bytes = await app.vault.readBinary(asset);
      if (bytes.byteLength > size || !active()) continue;
      const dims = inspectRasterDimensions(new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 262_144)));
      if (!dims || dims.width * dims.height > pixelsLeft) continue;
      pixelsLeft -= dims.width * dims.height;
      const image = await reduceRaster(new Blob([bytes], { type }), dims, owner, active);
      if (image) reduced.set(id, image);
    } catch {
      // A missing or corrupt image can still be represented by its bounds.
    }
  }
  return reduced;
}

/** Render from saved scene data using a small output canvas and only in-area image renditions. */
export async function rasterizeDrawingResource(app: App, drawing: TFile, scene: PreviewScene, frameId: string | undefined,
  thumbnail: unknown, dark: boolean, active: () => boolean): Promise<Blob | null> {
  const { elements, source } = scene;
  const frame = frameId ? getFrameBasedOnFrameNameOrId(frameId, elements) : resolveThumbnailFrame(elements, thumbnail);
  if (frameId && !frame) return null;
  const content = frame ? getElementsInArea(elements, frame, { includeBoundElements: true }).filter(element => element.id !== frame.id) : elements;
  if (!content.length || !admitDrawingPreview(content)) return null;
  const images = await loadVisibleImages(app, drawing, source, content, active);
  if (!active()) return null;
  const files: BinaryFiles = {};
  const geometry = content.map((element): NonDeleted<ExcalidrawElement> => {
    if (element.type === "image" && element.fileId) {
      const id = element.fileId;
      const image = images.get(id);
      if (image) {
        files[id] = { id, mimeType: "image/png", dataURL: image.url, created: drawing.stat.mtime };
        const scaleX = image.width / image.originalWidth, scaleY = image.height / image.originalHeight;
        const crop = element.crop;
        return { ...element, status: "saved", isDeleted: false, crop: crop ? {
          x: crop.x * scaleX, y: crop.y * scaleY, width: crop.width * scaleX, height: crop.height * scaleY,
          naturalWidth: image.width, naturalHeight: image.height,
        } : null };
      }
    }
    if (element.type === "image" || element.type === "embeddable" || element.type === "iframe")
      return { ...element, isDeleted: false, type: "rectangle", fillStyle: "solid", strokeColor: "#868e96", backgroundColor: "#868e9633", roughness: 0 };
    return { ...element, isDeleted: false };
  });
  return exportToBlob({
    elements: geometry,
    files,
    exportingFrame: frame ? { ...frame, isDeleted: false } : undefined,
    appState: { exportBackground: false, exportWithDarkMode: dark },
    mimeType: "image/png",
    exportPadding: 4,
    getDimensions: (width, height) => {
      if (![width, height].every(value => Number.isFinite(value) && value > 0)) throw Error("Invalid thumbnail dimensions");
      const scale = Math.min(1, THUMBNAIL_SIDE / Math.max(width, height));
      return { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)), scale };
    },
  });
}
