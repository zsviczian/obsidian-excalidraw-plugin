import { Notice } from "obsidian";
import type {
  ExcalidrawElement,
  ExcalidrawEmbeddableElement,
  ExcalidrawImageElement,
} from "@zsviczian/excalidraw/types/element/src/types";

import { MD_EX_SECTIONS } from "../../constants/constants";
import { t } from "../../lang/helpers";
import { cleanSectionHeading } from "../../utils/pathUtils";
import type ExcalidrawView from "../ExcalidrawView";

/** Runtime dependencies supplied by the composition root to avoid adding a
 * circular import: each originates from a module already on the plugin's
 * existing `ExcalidrawData`/`MarkdownImage`/`Prompt` import cycle. */
export interface MarkdownImageControllerDependencies {
  isMarkdownImageElement: typeof import("../../shared/MarkdownImage").isMarkdownImageElement;
  getMarkdownImageCustomData: typeof import("../../shared/MarkdownImage").getMarkdownImageCustomData;
  getEmbeddableMarkdownImageSource: typeof import("../../shared/MarkdownImage").getEmbeddableMarkdownImageSource;
  convertEmbeddableElementToMarkdownImage: typeof import("../../shared/MarkdownImage").convertEmbeddableElementToMarkdownImage;
  getMarkdownImageSource: typeof import("../../shared/MarkdownImage").getMarkdownImageSource;
  convertMarkdownImageElementToEmbeddable: typeof import("../../shared/MarkdownImage").convertMarkdownImageElementToEmbeddable;
  getLevelOneMarkdownHeadings: typeof import("../../shared/MarkdownImage").getLevelOneMarkdownHeadings;
  openMarkdownImageEditorSidepanel: typeof import("../sidepanel/MarkdownImageEditor").openMarkdownImageEditor;
  parseMarkdownImages: typeof import("../../shared/ExcalidrawData").parseMarkdownImages;
  unwrapMarkdownImageBlock: typeof import("../../shared/ExcalidrawData").unwrapMarkdownImageBlock;
  MultiOptionConfirmationPrompt: typeof import("../../shared/Dialogs/Prompt").MultiOptionConfirmationPrompt;
  GenericInputPrompt: typeof import("../../shared/Dialogs/Prompt").GenericInputPrompt;
  insertBackOfTheNoteContent: typeof import("../../utils/excalidrawViewUtils").insertBackOfTheNoteContent;
  errorlog: typeof import("../../utils/utils").errorlog;
}

/**
 * Owns the Markdown-image deletion queue and the edit/convert workflows
 * (RefactorPlan.md Phase 6, "MarkdownImageController").
 *
 * `queueMarkdownImageDeletion()` is called by `ExcalidrawView.onExcalidrawIncrement()`
 * whenever a locally-sourced Markdown-image element is deleted from the scene, and
 * `markdownImageDeletionPrompt` is awaited directly by `ExcalidrawView.save()` so a
 * save never races an in-flight keep/delete confirmation. Both fields stay `public`
 * on this controller rather than behind a narrower accessor, matching how
 * `packages`/`plugin`/`excalidrawAPI` are public on `ExcalidrawView` for the same
 * cross-module-read reason.
 *
 * Author: zsviczian (extraction); original implementation predates this move.
 */
export class MarkdownImageController {
  public markdownImageDeletionQueue: Array<{
    element: ExcalidrawImageElement;
    filePath: string;
  }> = [];
  public pendingMarkdownImageDeletionIds = new Set<ExcalidrawElement["id"]>();
  public markdownImageDeletionPrompt: Promise<void> | null = null;

  public constructor(
    private readonly view: ExcalidrawView,
    private readonly dependencies: MarkdownImageControllerDependencies,
  ) {}

  /** Queues a locally-sourced Markdown-image element for a keep/delete prompt. */
  public queueMarkdownImageDeletion(element: ExcalidrawImageElement): void {
    if (!this.view.file || this.pendingMarkdownImageDeletionIds.has(element.id)) {
      return;
    }
    this.pendingMarkdownImageDeletionIds.add(element.id);
    this.markdownImageDeletionQueue.push({
      element,
      filePath: this.view.file.path,
    });
    if (this.markdownImageDeletionPrompt !== null) {
      return;
    }
    const processing = this.processMarkdownImageDeletionQueue();
    this.markdownImageDeletionPrompt = processing;
    void processing.finally(() => {
      if (this.markdownImageDeletionPrompt === processing) {
        this.markdownImageDeletionPrompt = null;
      }
    });
  }

  private async processMarkdownImageDeletionQueue(): Promise<void> {
    while (this.markdownImageDeletionQueue.length > 0) {
      const item = this.markdownImageDeletionQueue.shift();
      if (!item) {
        continue;
      }
      const { element, filePath } = item;
      try {
        const viewElements = this.view.getViewElements();
        if (
          !this.view.file ||
          this.view.file.path !== filePath ||
          viewElements.some((candidate) => candidate.id === element.id) ||
          viewElements.some(
            (candidate) =>
              candidate.id !== element.id &&
              candidate.type === "image" &&
              candidate.fileId === element.fileId &&
              this.dependencies.getMarkdownImageCustomData(candidate)
                ?.source === "local",
          ) ||
          !this.view.excalidrawData.hasMarkdownImage(element.fileId)
        ) {
          continue;
        }

        const prompt = new this.dependencies.MultiOptionConfirmationPrompt<
          "keep" | "delete" | null
        >(
          this.view.plugin,
          t("MARKDOWN_IMAGE_DELETE_TEXT_PROMPT"),
          new Map([
            [t("MARKDOWN_IMAGE_KEEP_TEXT"), "keep"],
            [t("MARKDOWN_IMAGE_DELETE_TEXT"), "delete"],
          ]),
          t("MARKDOWN_IMAGE_KEEP_TEXT"),
        );
        const decision = await prompt.waitForClose;
        if (
          !this.view.file ||
          this.view.file.path !== filePath ||
          this.view
            .getViewElements()
            .some((candidate) => candidate.id === element.id)
        ) {
          continue;
        }
        if (decision !== "delete") {
          const markdown = this.view.excalidrawData.getMarkdownImage(
            element.fileId,
          )?.markdown;
          this.view.data = this.dependencies.unwrapMarkdownImageBlock(
            this.view.data,
            element.fileId,
            markdown,
          );
        }
        this.view.excalidrawData.deleteMarkdownImage(element.fileId);
        this.view.setDirty();
      } catch (error: unknown) {
        this.dependencies.errorlog({
          where: "MarkdownImageController.processMarkdownImageDeletionQueue",
          error,
        });
      } finally {
        this.pendingMarkdownImageDeletionIds.delete(element.id);
      }
    }
  }

  public async openMarkdownImageEditor(elementId?: string): Promise<void> {
    const selected = elementId
      ? this.view.getViewElements().find((element) => element.id === elementId)
      : undefined;
    const image = selected?.type === "image" ? selected : undefined;
    if (image && !this.dependencies.isMarkdownImageElement(this.view, image)) {
      new Notice(t("MARKDOWN_IMAGE_SELECT_ERROR"));
      return;
    }
    await this.dependencies.openMarkdownImageEditorSidepanel(this.view, image);
  }

  /** Converts a Markdown embeddable without changing its scene identity. */
  public async convertEmbeddableToMarkdownImage(
    elementId: string,
  ): Promise<void> {
    const element = this.view.getViewElements().find(
      (candidate): candidate is ExcalidrawEmbeddableElement =>
        candidate.id === elementId && candidate.type === "embeddable",
    );
    if (!element) {
      return;
    }
    const source = await this.dependencies.getEmbeddableMarkdownImageSource(
      this.view,
      element,
    );
    if (!source) {
      new Notice(t("MARKDOWN_IMAGE_CONVERSION_ERROR"));
      return;
    }

    let localSection = "";
    if (source.source === "local") {
      const child = this.view.getEmbeddableLeafElementById(element.id)?.node
        ?.child;
      if (!child || child.file !== this.view.file) {
        new Notice(t("MARKDOWN_IMAGE_CONVERSION_ERROR"));
        return;
      }
      if (child.lastSavedData !== this.view.data) {
        await this.view.forceSave(true);
        if (child.lastSavedData !== this.view.data) {
          new Notice(t("ERROR_TRY_AGAIN"));
          return;
        }
      }
      localSection = `${child.heading ?? ""}${child.text ?? ""}`;
      if (!localSection.trim()) {
        new Notice(t("MARKDOWN_IMAGE_CONVERSION_ERROR"));
        return;
      }
      source.markdown = localSection.trim();
    }

    if (
      !(await this.dependencies.convertEmbeddableElementToMarkdownImage(
        this.view,
        element,
        source,
      ))
    ) {
      new Notice(t("MARKDOWN_IMAGE_CONVERSION_ERROR"));
      return;
    }
    if (source.source === "local") {
      this.view.data = this.view.data.replace(localSection, "");
      await this.view.forceSave(true);
    }
  }

  /** Converts a Markdown image to an external or back-of-note embeddable. */
  public async convertMarkdownImageToEmbeddable(
    elementId: string,
  ): Promise<void> {
    const element = this.view.getViewElements().find(
      (candidate): candidate is ExcalidrawImageElement =>
        candidate.id === elementId && candidate.type === "image",
    );
    if (
      !element ||
      !this.dependencies.isMarkdownImageElement(this.view, element)
    ) {
      return;
    }
    const source = await this.dependencies.getMarkdownImageSource(
      this.view,
      element,
    );
    if (!source) {
      new Notice(t("MARKDOWN_IMAGE_CONVERSION_ERROR"));
      return;
    }

    if (source.source === "external" && source.embeddedFile) {
      const link = `[[${source.embeddedFile.linkParts.original}]]`;
      if (
        await this.dependencies.convertMarkdownImageElementToEmbeddable(
          this.view,
          element,
          link,
        )
      ) {
        this.view.excalidrawData.deleteFile(element.fileId);
      }
      return;
    }

    const parsedMarkdownImages = this.dependencies.parseMarkdownImages(
      this.view.data,
    );
    const headings = this.dependencies.getLevelOneMarkdownHeadings(
      source.markdown,
    );
    let title: string;
    let sectionMarkdown: string;
    if (headings.length > 0) {
      const firstContentIndex = source.markdown.search(/\S/);
      const candidateTitle = cleanSectionHeading(headings[0].title);
      const documentHeadingCount = this.dependencies
        .getLevelOneMarkdownHeadings(this.view.data)
        .filter(
          (heading) =>
            cleanSectionHeading(heading.title).toLocaleLowerCase() ===
            candidateTitle.toLocaleLowerCase(),
        ).length;
      const storedHeadingCount = this.dependencies
        .getLevelOneMarkdownHeadings(
          parsedMarkdownImages.get(element.fileId)?.markdown ?? "",
        )
        .filter(
          (heading) =>
            cleanSectionHeading(heading.title).toLocaleLowerCase() ===
            candidateTitle.toLocaleLowerCase(),
        ).length;
      const valid =
        headings.length === 1 &&
        headings[0].index === firstContentIndex &&
        documentHeadingCount - storedHeadingCount === 0 &&
        candidateTitle.length > 0 &&
        !MD_EX_SECTIONS.some(
          (heading) =>
            cleanSectionHeading(heading).toLocaleLowerCase() ===
            candidateTitle.toLocaleLowerCase(),
        );
      if (!valid) {
        new Notice(t("MARKDOWN_IMAGE_H1_WARNING"), 10000);
        return;
      }
      const proceed = await new this.dependencies.MultiOptionConfirmationPrompt(
        this.view.plugin,
        t("MARKDOWN_IMAGE_H1_WARNING"),
      ).waitForClose;
      if (!proceed) {
        return;
      }
      title = candidateTitle;
      sectionMarkdown = source.markdown.trim();
    } else {
      title = (
        await this.dependencies.GenericInputPrompt.Prompt(
          this.view,
          this.view.plugin,
          this.view.app,
          t("MARKDOWN_IMAGE_SECTION_NAME"),
          t("MARKDOWN_IMAGE_SECTION_NAME_PLACEHOLDER"),
          "",
        )
      )?.trim();
      const sections = await this.view.getBackOfTheNoteSections();
      if (
        !title ||
        MD_EX_SECTIONS.some(
          (heading) =>
            cleanSectionHeading(heading).toLocaleLowerCase() ===
            title.toLocaleLowerCase(),
        ) ||
        sections.some(
          (heading) => heading.toLocaleLowerCase() === title.toLocaleLowerCase(),
        )
      ) {
        new Notice(t("INVALID_SECTION_NAME"));
        return;
      }
      sectionMarkdown = `# ${title}\n\n${source.markdown.trim()}`.trim();
    }

    const localIds = parsedMarkdownImages.size
      ? [...parsedMarkdownImages.keys()]
      : [...this.view.excalidrawData.markdownImages.keys()];
    const localIndex = localIds.indexOf(element.fileId);
    if (localIndex !== -1 && localIndex < localIds.length - 1) {
      sectionMarkdown += "\n\n# \n\n";
    }

    const previousData = this.view.data;
    this.dependencies.insertBackOfTheNoteContent(this.view, sectionMarkdown);
    this.view.excalidrawData.deleteMarkdownImage(element.fileId);
    const link = `[[${this.view.file.path}#${title}]]`;
    if (
      !(await this.dependencies.convertMarkdownImageElementToEmbeddable(
        this.view,
        element,
        link,
      ))
    ) {
      this.view.data = previousData;
      this.view.excalidrawData.setMarkdownImage(element.fileId, {
        markdown: source.markdown,
      });
      new Notice(t("MARKDOWN_IMAGE_CONVERSION_ERROR"));
      return;
    }
    await this.view.forceSave(true);
  }
}
