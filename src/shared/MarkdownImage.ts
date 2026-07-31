import type { Mutable } from "@zsviczian/excalidraw/types/common/src/utility-types";
import type {
  ExcalidrawElement,
  ExcalidrawEmbeddableElement,
  ExcalidrawImageElement,
  FileId,
} from "@zsviczian/excalidraw/types/element/src/types";
import type ExcalidrawPlugin from "src/core/main";
import { getEA } from "src/core";
import type ExcalidrawView from "src/view/ExcalidrawView";
import { fileid, MD_EX_SECTIONS } from "src/constants/constants";
import {
  EmbeddedFile,
  EmbeddedFilesLoader,
} from "src/shared/EmbeddedFileLoader";
import { getTransclusion, REGEX_LINK } from "src/shared/ExcalidrawData";
import {
  addAppendUpdateCustomData,
} from "src/utils/elementCustomDataUtils";
import {
  MARKDOWN_IMAGE_CUSTOM_DATA_KEY,
  MARKDOWN_IMAGE_SCHEMA_VERSION,
  type MarkdownImageCustomData,
  type MarkdownImageRenderSettings,
  type MarkdownImageSource,
} from "src/types/markdownImageTypes";
import { resolveMarkdownImageRenderSettings } from "src/utils/markdownImageUtils";
import { cleanSectionHeading } from "src/utils/pathUtils";
import { errorlog } from "src/utils/coreUtils";

export type MarkdownImageSourceData = {
  markdown: string;
  source: MarkdownImageSource;
  embeddedFile?: EmbeddedFile;
};

type ConvertibleElement = Mutable<ExcalidrawElement> & {
  type: "image" | "embeddable";
  fileId?: FileId | null;
  status?: "pending" | "saved" | "error";
  scale: [number, number];
  crop?: ExcalidrawImageElement["crop"];
};

const commitElements = async (
  ea: ReturnType<typeof getEA>,
  newElementsOnTop = false,
): Promise<boolean> => {
  try {
    return await ea.addElementsToView(false, false, newElementsOnTop);
  } catch (error: unknown) {
    errorlog({ where: "MarkdownImage.commitElements", error });
    return false;
  } finally {
    ea.destroy();
  }
};

/** Returns whether a fragment would collide with its storage delimiter. */
export function containsReservedMarkdownImageMarker(
  markdown: string,
): boolean {
  return markdown
    .split(/\r?\n/)
    .some((line) =>
      /^<!-- \/?excalidraw-markdown-image:[\w-]+ -->$/.test(line),
    );
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
  return resolveMarkdownImageRenderSettings(fallback, stored);
}

/** Writes Markdown-image metadata through the repository custom-data helper. */
export function setMarkdownImageCustomData(
  element: Mutable<ExcalidrawImageElement>,
  source: MarkdownImageSource,
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
      transclusion: {
        ...render.transclusion,
        border: { ...render.transclusion.border },
      },
    },
  };
  addAppendUpdateCustomData(element, {
    [MARKDOWN_IMAGE_CUSTOM_DATA_KEY]: value,
    ...(typeof element.customData?.doNotInvertSVGInDarkMode !== "boolean"
      ? { doNotInvertSVGInDarkMode: false }
      : {}),
  });
}

/** Resolves the current local fragment or external Markdown transclusion. */
export async function getMarkdownImageSource(
  view: ExcalidrawView,
  element: ExcalidrawImageElement,
): Promise<MarkdownImageSourceData | null> {
  const customData = getMarkdownImageCustomData(element);
  const preferredSource = customData?.source;
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
    (view.plugin.isExcalidrawFile(embeddedFile.file) && !customData)
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
  const loader = new EmbeddedFilesLoader(view.plugin, false);
  return loader.renderMarkdownToSVG(sourceFile, markdown, render);
}

const setRenderedMarkdownImageFile = (
  ea: ReturnType<typeof getEA>,
  fileId: FileId,
  rendered: Awaited<ReturnType<typeof renderMarkdown>>,
): void => {
  ea.imagesDict[fileId] = {
    id: fileId,
    dataURL: rendered.dataURL,
    mimeType: "image/svg+xml",
    created: Date.now(),
    size: rendered.size,
    hasSVGwithBitmap: rendered.hasSVGwithBitmap,
  };
};

const getEmbeddableLinkTarget = (link: string): string | null => {
  const result = REGEX_LINK.getRes(link).next();
  if (result.value) {
    return REGEX_LINK.getLink(result);
  }
  const normalized = link.replace(/^!?\[\[/, "").replace(/]]$/, "").trim();
  return normalized || null;
};

/** Resolves a Markdown embeddable into a local or external image source. */
export async function getEmbeddableMarkdownImageSource(
  view: ExcalidrawView,
  element: ExcalidrawEmbeddableElement,
): Promise<MarkdownImageSourceData | null> {
  const target = getEmbeddableLinkTarget(element.link);
  if (!target) {
    return null;
  }
  const embeddedFile = new EmbeddedFile(view.plugin, view.file.path, target);
  if (!embeddedFile.file || embeddedFile.file.extension.toLowerCase() !== "md") {
    return null;
  }
  const isLocal = embeddedFile.file.path === view.file.path;
  const isManagedSection = MD_EX_SECTIONS.some(
    (heading) =>
      cleanSectionHeading(heading).toLocaleLowerCase() ===
      embeddedFile.linkParts.ref?.toLocaleLowerCase(),
  );
  if (
    (isLocal &&
      (!embeddedFile.linkParts.ref ||
        embeddedFile.linkParts.isBlockRef ||
        isManagedSection))
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
    source: isLocal ? "local" : "external",
    ...(isLocal ? {} : { embeddedFile }),
  };
}

/** Retypes a Markdown embeddable as a full-height Markdown image. */
export async function convertEmbeddableElementToMarkdownImage(
  view: ExcalidrawView,
  element: ExcalidrawEmbeddableElement,
  sourceData: MarkdownImageSourceData,
): Promise<boolean> {
  const render = getMarkdownImageRenderSettings(view.plugin);
  render.width = Math.max(50, Math.round(element.width));
  const rendered = await renderMarkdown(
    view,
    sourceData.markdown,
    render,
    sourceData.embeddedFile?.file ?? view.file,
  );
  if (!rendered.dataURL || rendered.size.height <= 0) {
    return false;
  }

  const fileId = fileid() as FileId;
  const ea = getEA(view);
  ea.copyViewElementsToEAforEditing([element]);
  const editable = ea.getElement(element.id) as unknown as ConvertibleElement;
  editable.type = "image";
  editable.fileId = fileId;
  editable.status = "saved";
  editable.scale = [1, 1];
  editable.crop = null;
  editable.width = render.width;
  editable.height = rendered.size.height;
  editable.link = null;
  addAppendUpdateCustomData(editable, { mdProps: undefined });
  setMarkdownImageCustomData(
    editable as unknown as Mutable<ExcalidrawImageElement>,
    sourceData.source,
    render,
  );
  setRenderedMarkdownImageFile(ea, fileId, rendered);
  if (sourceData.source === "local") {
    view.excalidrawData.setMarkdownImage(fileId, {
      markdown: sourceData.markdown,
    });
  } else if (sourceData.embeddedFile) {
    view.excalidrawData.setFile(fileId, sourceData.embeddedFile);
  }
  let committed = false;
  try {
    committed = await commitElements(ea);
  } finally {
    if (!committed) {
      view.excalidrawData.deleteMarkdownImage(fileId, true);
      view.excalidrawData.deleteFile(fileId);
    }
  }
  if (!committed) {
    return false;
  }
  view.excalidrawData.elementLinks.delete(element.id);
  view.updateScene({ appState: { activeEmbeddable: null } });
  const converted = view.getViewElements().find((item) => item.id === element.id);
  if (converted) {
    view.excalidrawAPI.selectElements([converted]);
  }
  view.setDirty();
  return true;
}

/** Retypes a Markdown image as an embeddable while preserving scene identity. */
export async function convertMarkdownImageElementToEmbeddable(
  view: ExcalidrawView,
  element: ExcalidrawImageElement,
  link: string,
): Promise<boolean> {
  const ea = getEA(view);
  ea.copyViewElementsToEAforEditing([element]);
  const editable = ea.getElement(element.id) as unknown as ConvertibleElement;
  editable.type = "embeddable";
  editable.link = link;
  editable.scale = [1, 1];
  delete editable.fileId;
  delete editable.status;
  delete editable.crop;
  addAppendUpdateCustomData(editable, {
    [MARKDOWN_IMAGE_CUSTOM_DATA_KEY]: undefined,
    mdProps: view.plugin.settings.embeddableMarkdownDefaults,
  });
  if (!(await commitElements(ea))) {
    return false;
  }
  view.excalidrawData.elementLinks.set(element.id, link);
  const converted = view.getViewElements().find((item) => item.id === element.id);
  if (converted) {
    view.excalidrawAPI.selectElements([converted]);
  }
  view.setDirty();
  return true;
}

/** Finds level-one ATX and Setext headings outside fenced code blocks. */
export function getLevelOneMarkdownHeadings(
  markdown: string,
): Array<{ title: string; index: number }> {
  const headings: Array<{ title: string; index: number }> = [];
  const linePattern = /.*(?:\n|$)/g;
  let fence: string | null = null;
  let previousContentLine: { text: string; index: number } | null = null;
  let match: RegExpExecArray | null;
  while ((match = linePattern.exec(markdown)) !== null && match[0]) {
    const line = match[0].replace(/\r?\n$/, "");
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) {
      if (!fence) {
        fence = fenceMatch[1][0];
      } else if (fence === fenceMatch[1][0]) {
        fence = null;
      }
      previousContentLine = null;
      continue;
    }
    if (!fence) {
      const heading = line.match(
        /^#(?!#)[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/,
      );
      if (heading) {
        headings.push({ title: heading[1].trim(), index: match.index });
        previousContentLine = null;
        continue;
      }
      if (/^[ \t]{0,3}=+[ \t]*$/.test(line) && previousContentLine) {
        headings.push({
          title: previousContentLine.text.trim(),
          index: previousContentLine.index,
        });
        previousContentLine = null;
        continue;
      }
      previousContentLine = line.trim()
        ? { text: line, index: match.index }
        : null;
    }
  }
  return headings;
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
  let committed = false;
  try {
    committed = await commitElements(ea, true);
  } finally {
    if (!committed) {
      view.excalidrawData.deleteMarkdownImage(fileId, true);
    }
  }
  if (!committed) {
    return null;
  }
  view.setDirty();
  const inserted = view
    .getViewElements()
    .find((candidate) => candidate.id === id);
  if (inserted) {
    view.excalidrawAPI.selectElements([inserted]);
  }
  return id;
}

/** Duplicates a local Markdown image with independent element and file IDs. */
export async function duplicateLocalMarkdownImageElement(
  view: ExcalidrawView,
  element: ExcalidrawImageElement,
): Promise<string | null> {
  const source = await getMarkdownImageSource(view, element);
  if (!source || source.source !== "local") {
    return null;
  }
  const render = getMarkdownImageRenderSettings(view.plugin, element);
  const rendered = await renderMarkdown(view, source.markdown, render);
  if (!rendered.dataURL || rendered.size.height <= 0) {
    return null;
  }

  const ea = getEA(view);
  const duplicate = ea.cloneElements([element])[0] as
    | Mutable<ExcalidrawImageElement>
    | undefined;
  if (!duplicate) {
    ea.destroy();
    return null;
  }
  const fileId = fileid() as FileId;
  duplicate.fileId = fileId;
  duplicate.x = element.x + element.width + 20;
  duplicate.y = element.y;
  duplicate.width = render.width;
  duplicate.height = rendered.size.height;
  duplicate.crop = null;
  duplicate.index = null;
  duplicate.version = 1;
  duplicate.versionNonce = Math.floor(Math.random() * 1000000000);
  duplicate.updated = Date.now();
  duplicate.groupIds = [];
  duplicate.boundElements = null;
  setMarkdownImageCustomData(duplicate, "local", render);
  ea.elementsDict[duplicate.id] = duplicate;
  setRenderedMarkdownImageFile(ea, fileId, rendered);
  view.excalidrawData.setMarkdownImage(fileId, {
    markdown: source.markdown,
  });

  let committed = false;
  try {
    committed = await commitElements(ea, true);
  } finally {
    if (!committed) {
      view.excalidrawData.deleteMarkdownImage(fileId, true);
    }
  }
  if (!committed) {
    return null;
  }
  view.setDirty();
  const inserted = view
    .getViewElements()
    .find((candidate) => candidate.id === duplicate.id);
  if (inserted) {
    view.excalidrawAPI.selectElements([inserted]);
  }
  return duplicate.id;
}

/** Renders and applies current source and appearance settings to an image. */
export async function updateMarkdownImage(
  view: ExcalidrawView,
  element: ExcalidrawImageElement,
  markdown: string,
  render: MarkdownImageRenderSettings,
  source: MarkdownImageSource,
): Promise<boolean> {
  if (containsReservedMarkdownImageMarker(markdown)) {
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
  setRenderedMarkdownImageFile(ea, element.fileId, rendered);
  if (source === "local") {
    view.excalidrawData.setMarkdownImage(element.fileId, { markdown });
  }
  if (!(await commitElements(ea))) {
    return false;
  }
  view.setDirty();
  return true;
}
