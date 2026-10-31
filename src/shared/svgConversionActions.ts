/** SVG UI entry points: scoped targets, explicit conversion choice, and atomic replacement. */
import { Notice } from "obsidian";
import type {
  ExcalidrawImageElement,
  NonDeletedExcalidrawElement,
} from "@zsviczian/excalidraw/types/element/src/types";
import type ExcalidrawPlugin from "src/core/main";
import type ExcalidrawView from "src/view/ExcalidrawView";
import type { ExcalidrawLib } from "src/types/excalidrawLib";
import { getEA } from "src/core";
import { t } from "src/lang/helpers";
import { errorlog } from "src/utils/coreUtils";
import {
  decodeSVGDataURL,
  getSVGImageTransform,
} from "src/utils/svgImageUtils";
import { _measureText } from "src/utils/excalidrawAutomateUtils";
import { svgToExcalidraw } from "./svgToExcalidraw/parser";
import { openSVGFilePicker } from "src/utils/svgFilePicker";
import { MultiOptionConfirmationPrompt } from "./Dialogs/Prompt";

type Diagram = Parameters<
  ExcalidrawLib.ObsidianExcalidrawHostAdapter["prepareMermaidSVGInsert"]
>[1];

function editorView(
  plugin: ExcalidrawPlugin,
  editorId?: string,
): ExcalidrawView | undefined {
  if (!editorId) return;
  return plugin.app.workspace
    .getLeavesOfType("excalidraw")
    .map((l) => l.view as ExcalidrawView)
    .find((v) => v.excalidrawAPI?.id === editorId);
}

function guard(view: ExcalidrawView): () => boolean {
  const api = view.excalidrawAPI,
    file = view.file,
    doc = view.ownerDocument;
  return () =>
    !!api &&
    !!file &&
    view.excalidrawAPI === api &&
    view.file === file &&
    view.ownerDocument === doc &&
    view.isLoaded &&
    !api.isDestroyed &&
    !view.isClosingOrMigrating() &&
    !api.getAppState().viewModeEnabled &&
    view.app.vault.getFileByPath(file.path) === file;
}

/** Never resolve a missing/stale menu editor ID through the active drawing. */
export function openSVGImportForEditor(
  plugin: ExcalidrawPlugin,
  editorId?: string,
): void {
  const view = editorView(plugin, editorId);
  if (!view || !guard(view)()) return;
  const same = guard(view);
  const failed = (error: unknown) => {
    errorlog({ where: "openSVGImportForEditor", error });
    new Notice(t("SVG_IMPORT_ERROR"));
  };
  try {
    openSVGFilePicker(view, async (file) => {
      let ea: ReturnType<typeof getEA> | undefined;
      try {
        if (file.size > 2_000_000) throw Error("SVG input size limit exceeded");
        const source = await file.text();
        if (!same()) return;
        ea = getEA(view);
        if (!ea.importSVG(source) || !ea.getElements().length) return;
        ea.addToGroup(ea.getElements().map((element) => element.id));
        view.setCurrentPositionToCenter();
        await view.addElements({
          newElements: ea.getElements(),
          repositionToCursor: true,
          save: true,
          newElementsOnTop: true,
          shouldRestoreElements: true,
          validateBeforePublish: () => {
            if (!same()) throw Error("SVG import target changed");
          },
        });
      } catch (error: unknown) {
        failed(error);
      } finally {
        ea?.destroy();
      }
    });
  } catch (error: unknown) {
    failed(error);
  }
}

/** Reads generated/shared SVG bytes too; drawing embeds retain their existing edit workflow. */
export function getSVGImageData(
  view: ExcalidrawView,
  image: ExcalidrawImageElement,
): string | null {
  const embedded = view.excalidrawData.getFile(image.fileId);
  if (
    embedded &&
    (embedded.mimeType !== "image/svg+xml" ||
      (embedded.file && view.plugin.isExcalidrawFile(embedded.file)))
  )
    return null;
  const file = view.excalidrawAPI?.getFiles()[image.fileId];
  const dataURL =
    file?.mimeType === "image/svg+xml"
      ? file.dataURL
      : embedded?.getImage(false);
  return /^data:image\/svg\+xml[;,]/i.test(dataURL ?? "") ? dataURL : null;
}

function stageImage(
  view: ExcalidrawView,
  image: ExcalidrawImageElement,
  dataURL: string,
): NonDeletedExcalidrawElement[] | null {
  if (image.crop) {
    new Notice(t("SVG_CONVERSION_CROP"));
    return null;
  }
  const ea = getEA(view);
  try {
    const source = decodeSVGDataURL(dataURL);
    const result = svgToExcalidraw(source, {
      ...getSVGImageTransform(source, image),
      measureText: (text, fontSize, fontFamily, lineHeight) => {
        const { w, h } = _measureText(text, fontSize, fontFamily, lineHeight);
        return { width: w, height: h };
      },
    });
    if (result.hasErrors) {
      new Notice(`${t("SVG_IMPORT_ERROR")}\n${result.errors}`);
      return null;
    }
    if (!result.content.length) return null;
    ea.copyViewElementsToEAforEditing(result.content);
    const elements = ea.getElements();
    ea.addToGroup(elements.map((e) => e.id));
    const cos = Math.cos(image.angle),
      sin = Math.sin(image.angle);
    for (const element of elements) {
      const box = ea.getBoundingBox([element]);
      const cx = box.topX + box.width / 2,
        cy = box.topY + box.height / 2;
      const dx = cx - image.width / 2,
        dy = cy - image.height / 2;
      element.x += image.x + image.width / 2 + cos * dx - sin * dy - cx;
      element.y += image.y + image.height / 2 + sin * dx + cos * dy - cy;
      element.angle = (element.angle + image.angle) as typeof element.angle;
      element.opacity *= image.opacity / 100;
      element.frameId = image.frameId;
      element.groupIds = [...element.groupIds, ...image.groupIds];
      if (image.link) element.link = image.link;
      if (
        [element.x, element.y].some(
          (v) => !Number.isFinite(v) || Math.abs(v) > 1e7,
        )
      )
        throw Error("SVG image geometry limit exceeded");
    }
    if (result.warnings.length) {
      const messages = {
        compositing: "SVG_IMPORT_COMPOSITING",
        stroke: "SVG_IMPORT_STROKE",
        paint: "SVG_IMPORT_PAINT",
        text: "SVG_IMPORT_TEXT",
        unsupported: "SVG_IMPORT_UNSUPPORTED",
        css: "SVG_IMPORT_CSS",
        viewport: "SVG_IMPORT_VIEWPORT",
      } as const;
      new Notice(
        `${t("SVG_IMPORT_WARNING")}\n${result.warnings.map((warning) => t(messages[warning])).join("\n")}`,
        10000,
      );
    }
    return elements.filter(
      (e): e is NonDeletedExcalidrawElement => !e.isDeleted,
    );
  } finally {
    ea.destroy();
  }
}

/** Called only for SVG Mermaid output; generated native diagrams never prompt. */
export async function prepareMermaidSVGInsert(
  plugin: ExcalidrawPlugin,
  editorId: string,
  diagram: Diagram,
): Promise<Diagram | null> {
  const view = editorView(plugin, editorId);
  if (!view) return null;
  const same = guard(view);
  if (!same()) return null;
  try {
    const choice = await new MultiOptionConfirmationPrompt<
      "convert" | "image" | null
    >(
      plugin,
      t("MERMAID_SVG_CONVERSION_PROMPT"),
      new Map<string, "convert" | "image" | null>([
        [t("SVG_CONVERT_ELEMENTS"), "convert"],
        [t("SVG_KEEP_IMAGE"), "image"],
        [t("PROMPT_BUTTON_CANCEL"), null],
      ]),
      t("SVG_KEEP_IMAGE"),
    ).waitForClose;
    if (!same() || choice === null) return null;
    if (choice === "image") return diagram;
    const elements: NonDeletedExcalidrawElement[] = [];
    for (const element of diagram.elements) {
      const file =
        element.type === "image" ? diagram.files?.[element.fileId] : null;
      if (
        element.type !== "image" ||
        !element.customData?.mermaidText ||
        file?.mimeType !== "image/svg+xml"
      ) {
        elements.push(element);
        continue;
      }
      const converted = stageImage(view, element, file.dataURL);
      if (!converted?.length) return null;
      elements.push(...converted);
    }
    const used = new Set<string>(
      elements.filter((e) => e.type === "image").map((e) => e.fileId),
    );
    return same()
      ? {
          elements,
          files: Object.fromEntries(
            Object.entries(diagram.files ?? {}).filter(([id]) => used.has(id)),
          ),
        }
      : null;
  } catch (error: unknown) {
    errorlog({ where: "prepareMermaidSVGInsert", error });
    new Notice(t("SVG_IMPORT_ERROR"));
    return null;
  }
}

/** Replace at the same scene layer in one history step, retaining cached SVG bytes for undo/shared sources. */
export async function convertSVGImage(
  view: ExcalidrawView,
  imageId: string,
): Promise<boolean> {
  const same = guard(view),
    api = view.excalidrawAPI;
  if (!same()) return false;
  const sourceScene = api.getSceneElements();
  const image = sourceScene.find((e) => e.id === imageId);
  if (!image || image.type !== "image" || image.locked) return false;
  const source = getSVGImageData(view, image);
  if (!source) return false;
  const revision = JSON.stringify(
    sourceScene.map((e) => [e.id, e.version, e.versionNonce]),
  );
  const unchanged = () =>
    same() &&
    JSON.stringify(
      api.getSceneElements().map((e) => [e.id, e.version, e.versionNonce]),
    ) === revision;
  try {
    const elements = stageImage(view, image, source);
    if (!elements?.length || !unchanged()) return false;
    const ea = getEA(view);
    try {
      // Include the deleted original and its replacements in one guarded scene publication.
      ea.copyViewElementsToEAforEditing([
        { ...image, isDeleted: true },
        ...elements,
      ]);
      if (
        !(await view.addElements({
          newElements: ea.getElements(),
          save: false,
          insertAtElementId: image.id,
          validateBeforePublish: () => {
            if (!unchanged()) throw Error("SVG conversion target changed");
          },
        }))
      )
        return false;
      if (!same()) return false;
      api.selectElements(elements);
      const saved = await view.saveWithOutcome();
      return (
        saved.acknowledgedRevision !== null &&
        saved.acknowledgedRevision >= saved.requestedRevision
      );
    } finally {
      ea.destroy();
    }
  } catch (error: unknown) {
    errorlog({ where: "convertSVGImage", error });
    new Notice(t("SVG_IMPORT_ERROR"));
    return false;
  }
}
