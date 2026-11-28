import type { ExcalidrawElement, FileId, NonDeleted } from "@zsviczian/excalidraw/types/element/src/types";
import type { BinaryFiles, DataURL } from "@zsviczian/excalidraw/types/excalidraw/types";
import type { TFile } from "obsidian";
import { exportToBlob } from "src/constants/constants";
import type ExcalidrawPlugin from "src/core/main";
import { EMBEDDED_VAULT_FILE_REG, RE_EXCALIDRAWDATA_NOSECTION_OK } from "src/shared/excalidrawMarkdownParsing";
import { blobToDataURL } from "src/utils/coreUtils";
import { readDrawingPreviewScene } from "src/utils/drawingPreviewScene";
import { getEmbeddedFilenameParts } from "src/utils/embeddedFilenameParts";
import { getElementsInArea } from "src/utils/excalidrawElementUtils";
import { getFrameBasedOnFrameNameOrId } from "src/utils/excalidrawViewUtils";
import { FRAME_THUMBNAIL_PROPERTY, resolveThumbnailFrame } from "src/utils/frameMetadata";
import { getLinkParts } from "src/utils/linkUtils";
import { inspectRasterDimensions } from "src/utils/rasterImageDimensions";
import { admitDrawingPreview, DRAWING_PREVIEW_SCENE_LENGTH, DRAWING_PREVIEW_SOURCE_BYTES, drawingPreviewGeometryBudget } from "./visualResourceModel";

const THUMBNAIL_SIDE = 256;
const MAX_ASSET_COUNT = 16;
const MAX_ASSET_BYTES = 4 * 1024 * 1024;
const MAX_TOTAL_ASSET_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_ASSET_PIXELS = 40_000_000;
const MAX_NESTED_DRAWING_DEPTH = 2;
const RASTER_TYPES = new Map([["png", "image/png"], ["jpeg", "image/jpeg"], ["jpg", "image/jpeg"], ["webp", "image/webp"]]);

type PreviewScene = Awaited<ReturnType<typeof readDrawingPreviewScene>>;
type PreviewDimensions = { width: number; height: number; originalWidth: number; originalHeight: number };
type ReducedImage = PreviewDimensions & { url: DataURL; drawing?: true };
type PNGThumbnail = { png: Blob; dimensions: PreviewDimensions };
type RenderContext = {
  plugin: ExcalidrawPlugin;
  dark: boolean;
  active: () => boolean;
  ancestors: Set<TFile>;
  geometry: ReturnType<typeof drawingPreviewGeometryBudget>;
  assetsLeft: number;
  bytesLeft: number;
  pixelsLeft: number;
  sceneLengthLeft: number;
};

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

async function reduceDrawing(context: RenderContext, file: TFile, reference: string): Promise<ReducedImage | null> {
  if (context.ancestors.has(file) || context.ancestors.size > MAX_NESTED_DRAWING_DEPTH ||
      file.stat.size > DRAWING_PREVIEW_SOURCE_BYTES || context.sceneLengthLeft <= 0) return null;
  const parts = getEmbeddedFilenameParts(reference);
  const frameId = parts.hasFrameref || parts.hasClippedFrameref ? parts.blockref ?? parts.sectionref : undefined;
  if (!frameId && (parts.hasSectionref || parts.hasBlockref && parts.blockref !== "as-image")) return null;
  const app = context.plugin.app;
  const scene = await readDrawingPreviewScene(app.vault, file, context.sceneLengthLeft);
  if (!context.active()) return null;
  context.sceneLengthLeft -= scene.length;
  const thumbnail: unknown = app.metadataCache.getFileCache(file)?.frontmatter?.[FRAME_THUMBNAIL_PROPERTY];
  context.ancestors.add(file);
  try {
    const image = await renderDrawingThumbnail(context, file, scene, frameId, thumbnail);
    if (!image || !context.active()) return null;
    return { ...image.dimensions, url: await blobToDataURL(image.png), drawing: true };
  } finally { context.ancestors.delete(file); }
}

/** Reduce visible linked images and drawings under one shared work budget. */
async function loadVisibleImages(context: RenderContext, drawing: TFile, source: string, elements: readonly ExcalidrawElement[]) {
  const ids = new Set(elements.flatMap(element => element.type === "image" && element.fileId ? [element.fileId] : []));
  const reduced = new Map<FileId, ReducedImage>();
  if (!ids.size) return reduced;
  const { app } = context.plugin;
  const owner = app.workspace.containerEl.ownerDocument;
  const data = source.slice(Math.max(0, source.search(RE_EXCALIDRAWDATA_NOSECTION_OK)));
  const section = /^(?:## Embedded Files|# Embedded files)\n([\s\S]*?)(?=^#{1,2} |(?![\s\S]))/m.exec(data)?.[1];
  if (!section) return reduced;
  for (const [, rawId, link] of section.matchAll(EMBEDDED_VAULT_FILE_REG)) {
    const id = rawId as FileId;
    if (!ids.delete(id)) continue;
    if (!context.active() || context.assetsLeft <= 0) break;
    const asset = app.metadataCache.getFirstLinkpathDest(getLinkParts(link).path, drawing.path);
    if (!asset) continue;
    const type = RASTER_TYPES.get(asset.extension.toLowerCase());
    const nestedDrawing = context.plugin.isExcalidrawFile(asset);
    const size = asset.stat.size;
    if ((!type && !nestedDrawing) || size > Math.min(MAX_ASSET_BYTES, context.bytesLeft)) continue;
    context.assetsLeft--;
    context.bytesLeft -= size;
    try {
      if (nestedDrawing) {
        const image = await reduceDrawing(context, asset, link);
        if (image) reduced.set(id, image);
        continue;
      }
      const bytes = await app.vault.readBinary(asset);
      if (bytes.byteLength > size || !context.active()) continue;
      const dims = inspectRasterDimensions(new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 262_144)));
      if (!dims || dims.width * dims.height > context.pixelsLeft) continue;
      context.pixelsLeft -= dims.width * dims.height;
      const image = await reduceRaster(new Blob([bytes], { type }), dims, owner, context.active);
      if (image) reduced.set(id, image);
    } catch {
      // A missing or corrupt image can still be represented by its bounds.
    }
  }
  return reduced;
}

async function renderDrawingThumbnail(context: RenderContext, drawing: TFile, scene: PreviewScene,
  frameId: string | undefined, thumbnail: unknown): Promise<PNGThumbnail | null> {
  const { elements, source } = scene;
  const frame = frameId ? getFrameBasedOnFrameNameOrId(frameId, elements) : resolveThumbnailFrame(elements, thumbnail);
  if (frameId && !frame) return null;
  const content = frame ? getElementsInArea(elements, frame, { includeBoundElements: true }).filter(element => element.id !== frame.id) : elements;
  if (!content.length || !admitDrawingPreview(content, context.geometry)) return null;
  const images = await loadVisibleImages(context, drawing, source, content);
  if (!context.active()) return null;
  const files: BinaryFiles = {};
  const geometry = content.map((element): NonDeleted<ExcalidrawElement> => {
    if (element.type === "image" && element.fileId) {
      const id = element.fileId;
      const image = images.get(id);
      if (image) {
        files[id] = { id, mimeType: "image/png", dataURL: image.url, created: drawing.stat.mtime };
        const scaleX = image.width / image.originalWidth, scaleY = image.height / image.originalHeight;
        const crop = element.crop;
        return { ...element, status: "saved", isDeleted: false,
          customData: image.drawing ? { ...element.customData, invertBitmapInDarkmode: false } : element.customData,
          crop: crop ? {
          x: crop.x * scaleX, y: crop.y * scaleY, width: crop.width * scaleX, height: crop.height * scaleY,
          naturalWidth: image.width, naturalHeight: image.height,
        } : null };
      }
    }
    if (element.type === "image" || element.type === "embeddable" || element.type === "iframe")
      return { ...element, isDeleted: false, type: "rectangle", fillStyle: "solid", strokeColor: "#868e96", backgroundColor: "#868e9633", roughness: 0 };
    return { ...element, isDeleted: false };
  });
  let dimensions: PreviewDimensions = null;
  const png = await exportToBlob({
    elements: geometry,
    files,
    exportingFrame: frame ? { ...frame, isDeleted: false } : undefined,
    appState: { exportBackground: false, exportWithDarkMode: context.dark },
    mimeType: "image/png",
    exportPadding: 4,
    getDimensions: (width, height) => {
      if (![width, height].every(value => Number.isFinite(value) && value > 0)) throw Error("Invalid thumbnail dimensions");
      const scale = Math.min(1, THUMBNAIL_SIDE / Math.max(width, height));
      dimensions = { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)),
        originalWidth: width, originalHeight: height };
      return { width: dimensions.width, height: dimensions.height, scale };
    },
  });
  return dimensions ? { png, dimensions } : null;
}

/** Render one drawing or named frame into a PNG using only bounded in-area dependencies. */
export async function rasterizeDrawingResource(plugin: ExcalidrawPlugin, drawing: TFile, scene: PreviewScene, frameId: string | undefined,
  thumbnail: unknown, dark: boolean, active: () => boolean): Promise<Blob | null> {
  const context: RenderContext = { plugin, dark, active, ancestors: new Set([drawing]), geometry: drawingPreviewGeometryBudget(),
    assetsLeft: MAX_ASSET_COUNT, bytesLeft: MAX_TOTAL_ASSET_BYTES, pixelsLeft: MAX_TOTAL_ASSET_PIXELS,
    sceneLengthLeft: DRAWING_PREVIEW_SCENE_LENGTH - scene.length };
  return (await renderDrawingThumbnail(context, drawing, scene, frameId, thumbnail))?.png ?? null;
}
