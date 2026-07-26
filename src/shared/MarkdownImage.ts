import type { Mutable } from "@zsviczian/excalidraw/types/common/src/utility-types";
import type {
  ExcalidrawImageElement,
  FileId,
} from "@zsviczian/excalidraw/types/element/src/types";
import type ExcalidrawPlugin from "src/core/main";
import { getEA } from "src/core";
import type ExcalidrawView from "src/view/ExcalidrawView";
import { fileid } from "src/constants/constants";
import {
  EmbeddedFilesLoader,
  type EmbeddedFile,
} from "src/shared/EmbeddedFileLoader";
import { getTransclusion } from "src/shared/ExcalidrawData";
import {
  addAppendUpdateCustomData,
} from "src/utils/elementCustomDataUtils";
import {
  MARKDOWN_IMAGE_CUSTOM_DATA_KEY,
  MARKDOWN_IMAGE_SCHEMA_VERSION,
  type MarkdownImageCustomData,
  type MarkdownImageRenderSettings,
} from "src/types/markdownImageTypes";

export type MarkdownImageSourceData = {
  markdown: string;
  source: "local" | "external";
  embeddedFile?: EmbeddedFile;
};

/** Returns whether a fragment would collide with its storage delimiter. */
export function containsReservedMarkdownImageMarker(
  fileId: FileId,
  markdown: string,
): boolean {
  const open = `<!-- excalidraw-markdown-image:${fileId} -->`;
  const close = `<!-- /excalidraw-markdown-image:${fileId} -->`;
  return markdown
    .split(/\r?\n/)
    .some((line) => line === open || line === close);
}

/** Reads the feature metadata from an image element without modifying it. */
export function getMarkdownImageCustomData(
  element: ExcalidrawImageElement,
): MarkdownImageCustomData | undefined {
  const value: unknown = element.customData?.[MARKDOWN_IMAGE_CUSTOM_DATA_KEY];
  return value && typeof value === "object"
    ? (value as MarkdownImageCustomData)
    : undefined;
}

/** Resolves the element appearance, then the configured defaults. */
export function getMarkdownImageRenderSettings(
  plugin: ExcalidrawPlugin,
  element?: ExcalidrawImageElement,
): MarkdownImageRenderSettings {
  const stored = element ? getMarkdownImageCustomData(element)?.render : null;
  const fallback = plugin.settings.markdownImageSettings.defaults;
  return {
    width: stored?.width ?? fallback.width,
    fontFamily: stored?.fontFamily ?? fallback.fontFamily,
    fontColor: stored?.fontColor ?? fallback.fontColor,
    border: {
      enabled: stored?.border?.enabled ?? fallback.border.enabled,
      color: stored?.border?.color ?? fallback.border.color,
    },
    css: stored?.css ?? fallback.css,
    theme: stored?.theme ?? fallback.theme,
  };
}

/** Writes Markdown-image metadata through the repository custom-data helper. */
export function setMarkdownImageCustomData(
  element: Mutable<ExcalidrawImageElement>,
  source: "local" | "external",
  render: MarkdownImageRenderSettings,
): void {
  const previous = getMarkdownImageCustomData(element);
  const value: MarkdownImageCustomData = {
    schemaVersion: MARKDOWN_IMAGE_SCHEMA_VERSION,
    version: (previous?.version ?? 0) + 1,
    source,
    render: {
      ...render,
      border: { ...render.border },
    },
  };
  addAppendUpdateCustomData(element, {
    [MARKDOWN_IMAGE_CUSTOM_DATA_KEY]: value,
  });
}

/** Resolves the current local fragment or external Markdown transclusion. */
export async function getMarkdownImageSource(
  view: ExcalidrawView,
  element: ExcalidrawImageElement,
): Promise<MarkdownImageSourceData | null> {
  const preferredSource = getMarkdownImageCustomData(element)?.source;
  const local =
    preferredSource === "external"
      ? undefined
      : view.excalidrawData.getMarkdownImage(element.fileId);
  if (local !== undefined) {
    return { markdown: local.markdown, source: "local" };
  }
  const embeddedFile = view.excalidrawData.getFile(element.fileId);
  if (
    !embeddedFile?.file ||
    embeddedFile.file.extension.toLowerCase() !== "md" ||
    view.plugin.isExcalidrawFile(embeddedFile.file)
  ) {
    return null;
  }
  const transclusion = await getTransclusion(
    embeddedFile.linkParts,
    view.app,
    embeddedFile.file,
  );
  return {
    markdown: (transclusion.leadingHashes ?? "") + transclusion.contents,
    source: "external",
    embeddedFile,
  };
}

/** Returns whether an image can be edited through the Markdown-image panel. */
export function isMarkdownImageElement(
  view: ExcalidrawView,
  element: ExcalidrawImageElement,
): boolean {
  const embeddedFile = view.excalidrawData.getFile(element.fileId);
  return Boolean(
    getMarkdownImageCustomData(element) ||
      view.excalidrawData.hasMarkdownImage(element.fileId) ||
      (embeddedFile?.file?.extension.toLowerCase() === "md" &&
        !view.plugin.isExcalidrawFile(embeddedFile.file)),
  );
}

async function renderMarkdown(
  view: ExcalidrawView,
  markdown: string,
  render: MarkdownImageRenderSettings,
  sourceFile = view.file,
) {
  const isDark =
    render.theme === "dark" ||
    (render.theme === "canvas" &&
      view.excalidrawAPI?.getAppState().theme === "dark");
  const loader = new EmbeddedFilesLoader(view.plugin, isDark);
  return loader.renderMarkdownToSVG(sourceFile, markdown, render);
}

/** Inserts a new local editable Markdown image without adding wrapper content. */
export async function insertMarkdownImage(
  view: ExcalidrawView,
  markdown: string = "",
): Promise<string | null> {
  if (!view.excalidrawAPI || !view.file) {
    return null;
  }
  const render = getMarkdownImageRenderSettings(view.plugin);
  const rendered = await renderMarkdown(view, markdown, render);
  if (!rendered.dataURL || rendered.size.height <= 0) {
    return null;
  }
  const ea = getEA(view);
  const fileId = fileid() as FileId;
  const id = await ea.addImage(
    view.currentPosition.x,
    view.currentPosition.y,
    rendered.dataURL,
    false,
    false,
  );
  if (!id) {
    ea.destroy();
    return null;
  }
  const element = ea.getElement(id) as Mutable<ExcalidrawImageElement>;
  const generatedFileId = element.fileId;
  const image = ea.imagesDict[generatedFileId];
  delete ea.imagesDict[generatedFileId];
  element.fileId = fileId;
  element.width = render.width;
  element.height = rendered.size.height;
  element.crop = null;
  setMarkdownImageCustomData(element, "local", render);
  ea.imagesDict[fileId] = {
    ...image,
    id: fileId,
    dataURL: rendered.dataURL,
    mimeType: "image/svg+xml",
    size: rendered.size,
    hasSVGwithBitmap: rendered.hasSVGwithBitmap,
  };
  view.excalidrawData.setMarkdownImage(fileId, { markdown });
  await ea.addElementsToView(false, false, true);
  ea.destroy();
  view.setDirty();
  const inserted = view
    .getViewElements()
    .find((candidate) => candidate.id === id);
  if (inserted) {
    view.excalidrawAPI.selectElements([inserted]);
  }
  return id;
}

/** Renders and applies current source and appearance settings to an image. */
export async function updateMarkdownImage(
  view: ExcalidrawView,
  element: ExcalidrawImageElement,
  markdown: string,
  render: MarkdownImageRenderSettings,
  source: "local" | "external",
): Promise<boolean> {
  if (containsReservedMarkdownImageMarker(element.fileId, markdown)) {
    return false;
  }
  view.setMarkdownImageEditorIsEditing();
  const sourceFile =
    source === "external"
      ? (view.excalidrawData.getFile(element.fileId)?.file ?? view.file)
      : view.file;
  const rendered = await renderMarkdown(view, markdown, render, sourceFile);
  if (!rendered.dataURL || rendered.size.height <= 0) {
    return false;
  }
  const ea = getEA(view);
  ea.copyViewElementsToEAforEditing([element]);
  const editable = ea.getElement(element.id) as Mutable<ExcalidrawImageElement>;
  editable.width = render.width;
  editable.height = rendered.size.height;
  editable.crop = null;
  setMarkdownImageCustomData(editable, source, render);
  ea.imagesDict[element.fileId] = {
    id: element.fileId,
    dataURL: rendered.dataURL,
    mimeType: "image/svg+xml",
    created: Date.now(),
    size: rendered.size,
    hasSVGwithBitmap: rendered.hasSVGwithBitmap,
  };
  if (source === "local") {
    view.excalidrawData.setMarkdownImage(element.fileId, { markdown });
  }
  await ea.addElementsToView(false, false);
  ea.destroy();
  view.setDirty();
  return true;
}
