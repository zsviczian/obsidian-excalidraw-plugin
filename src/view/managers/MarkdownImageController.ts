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

type MarkdownImageDeletionDecision = "keep" | "delete";

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
  containsReservedMarkdownImageMarker: typeof import("../../shared/MarkdownImage").containsReservedMarkdownImageMarker;
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
  private conversionInProgress = false;

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
          !this.view.excalidrawData.markdownImages.has(element.fileId)
        ) {
          continue;
        }

        const decision = await this.getDeletionDecision();
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

  private async getDeletionDecision(): Promise<MarkdownImageDeletionDecision | null> {
    const preference =
      this.view.plugin.settings.markdownImageDeletionPreference;
    if (preference === "keep" || preference === "delete") {
      return preference;
    }

    const prompt = new this.dependencies.MultiOptionConfirmationPrompt<
      MarkdownImageDeletionDecision | null
    >(
      this.view.plugin,
      t("MARKDOWN_IMAGE_DELETE_TEXT_PROMPT"),
      new Map([
        [t("MARKDOWN_IMAGE_KEEP_TEXT"), "keep"],
        [t("MARKDOWN_IMAGE_DELETE_TEXT"), "delete"],
      ]),
      t("MARKDOWN_IMAGE_KEEP_TEXT"),
      {
        name: t("MARKDOWN_IMAGE_REMEMBER_DELETE_CHOICE"),
        description: t("MARKDOWN_IMAGE_REMEMBER_DELETE_CHOICE_DESC"),
      },
    );
    const decision = await prompt.waitForClose;
    if (decision && prompt.toggleValue) {
      this.view.plugin.settings.markdownImageDeletionPreference = decision;
      try {
        await this.view.plugin.saveSettings();
      } catch (error: unknown) {
        this.dependencies.errorlog({
          where: "MarkdownImageController.getDeletionDecision.saveSettings",
          error,
        });
      }
    }
    return decision;
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

  private getUniqueLocalSectionRange(
    data: string,
    localSection: string,
  ): { start: number; end: number } | null {
    const sectionHeadings =
      this.dependencies.getLevelOneMarkdownHeadings(localSection);
    const firstContentIndex = localSection.search(/\S/);
    if (sectionHeadings.length === 0) {
      const exactCandidates = [localSection, localSection.trim()].filter(
        (candidate, index, candidates) =>
          candidate.length > 0 && candidates.indexOf(candidate) === index,
      );
      for (const candidate of exactCandidates) {
        const start = data.indexOf(candidate);
        if (start !== -1 && start === data.lastIndexOf(candidate)) {
          return { start, end: start + candidate.length };
        }
      }
      return null;
    }
    if (
      sectionHeadings.length !== 1 ||
      sectionHeadings[0].index !== firstContentIndex
    ) {
      return null;
    }
    const title = cleanSectionHeading(
      sectionHeadings[0].title,
    ).toLocaleLowerCase();
    const documentHeadings =
      this.dependencies.getLevelOneMarkdownHeadings(data);
    const matches = documentHeadings
      .map((heading, index) => ({ heading, index }))
      .filter(
        ({ heading }) =>
          cleanSectionHeading(heading.title).toLocaleLowerCase() === title,
      );
    if (matches.length !== 1) {
      return null;
    }
    const match = matches[0];
    let end = documentHeadings[match.index + 1]?.index ?? data.length;
    const beforeNextHeading = data.slice(match.heading.index, end);
    const commentBoundary = /(?:^|\r?\n)(%%[ \t]*)(?:\r?\n[ \t]*)*$/.exec(
      beforeNextHeading,
    );
    if (commentBoundary) {
      end =
        match.heading.index +
        commentBoundary.index +
        commentBoundary[0].indexOf(commentBoundary[1]);
    }
    return {
      start: match.heading.index,
      end,
    };
  }

  private removeLocalSection(
    data: string,
    localSection: string,
  ): string | null {
    const range = this.getUniqueLocalSectionRange(data, localSection);
    return range
      ? `${data.slice(0, range.start)}${data.slice(range.end)}`
      : null;
  }

  private isManagedSectionTitle(title: string): boolean {
    const normalizedTitle = cleanSectionHeading(title).toLocaleLowerCase();
    return MD_EX_SECTIONS.some(
      (heading) =>
        cleanSectionHeading(heading).toLocaleLowerCase() === normalizedTitle,
    );
  }

  private isUnsafeLocalSection(localSection: string): boolean {
    if (this.dependencies.containsReservedMarkdownImageMarker(localSection)) {
      return true;
    }
    const sectionHeadings =
      this.dependencies.getLevelOneMarkdownHeadings(localSection);
    const firstContentIndex = localSection.search(/\S/);
    return (
      sectionHeadings.length > 1 ||
      (sectionHeadings.length === 1 &&
        (sectionHeadings[0].index !== firstContentIndex ||
          this.isManagedSectionTitle(sectionHeadings[0].title)))
    );
  }

  private persistedLocalSectionMatches(
    data: string,
    localSection: string,
  ): boolean {
    const normalizedData = data.replace(/\r\n/g, "\n");
    const normalizedSection = localSection.replace(/\r\n/g, "\n").trim();
    if (!normalizedSection) {
      return false;
    }
    const range = this.getUniqueLocalSectionRange(
      normalizedData,
      normalizedSection,
    );
    if (!range) {
      return false;
    }
    const persistedSection = normalizedData
      .slice(range.start, range.end)
      .trim();
    return (
      persistedSection === normalizedSection ||
      (persistedSection.startsWith(normalizedSection) &&
        /^[\s#]*$/.test(persistedSection.slice(normalizedSection.length)))
    );
  }

  private waitForViewFileModification(timeoutMs: number): Promise<void> {
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) {
          return;
        }
        settled = true;
        this.view.ownerWindow.clearTimeout(timeout);
        this.view.app.vault.offref(eventRef);
        resolve();
      };
      const eventRef = this.view.app.vault.on("modify", (file) => {
        if (file === this.view.file) {
          finish();
        }
      });
      const timeout = this.view.ownerWindow.setTimeout(finish, timeoutMs);
    });
  }

  private async runConversion(operation: () => Promise<void>): Promise<void> {
    if (this.conversionInProgress) {
      return;
    }
    this.conversionInProgress = true;
    try {
      await operation();
    } finally {
      this.conversionInProgress = false;
    }
  }

  /** Converts a Markdown embeddable without changing its scene identity. */
  public async convertEmbeddableToMarkdownImage(
    elementId: string,
  ): Promise<void> {
    await this.runConversion(() =>
      this.performEmbeddableToMarkdownImage(elementId),
    );
  }

  private async performEmbeddableToMarkdownImage(
    elementId: string,
  ): Promise<void> {
    const element = this.view
      .getViewElements()
      .find(
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

    let dataWithoutLocalSection: string | null = null;
    if (source.source === "local") {
      const node = this.view.getEmbeddableLeafElementById(element.id)?.node;
      const child = node?.child;
      if (!node || !child || child.file !== this.view.file) {
        new Notice(t("MARKDOWN_IMAGE_CONVERSION_ERROR"));
        return;
      }
      const localSection = `${child.heading ?? ""}${child.text ?? ""}`;
      if (!localSection.trim()) {
        new Notice(t("MARKDOWN_IMAGE_CONVERSION_ERROR"));
        return;
      }
      if (this.isUnsafeLocalSection(localSection)) {
        new Notice(t("ERROR_TRY_AGAIN"));
        return;
      }
      try {
        let persistedData = await this.view.app.vault.read(this.view.file);
        const shouldWaitForModification =
          node.isEditing &&
          !this.persistedLocalSectionMatches(persistedData, localSection);
        const modificationPromise = shouldWaitForModification
          ? this.waitForViewFileModification(2500)
          : null;
        this.view.canvasNodeFactory.stopEditing(node, element.id);
        this.view.updateScene({ appState: { activeEmbeddable: null } });
        if (shouldWaitForModification) {
          await modificationPromise;
          persistedData = await this.view.app.vault.read(this.view.file);
        }
        if (!this.persistedLocalSectionMatches(persistedData, localSection)) {
          new Notice(t("ERROR_TRY_AGAIN"));
          return;
        }
        this.view.data = persistedData;
      } catch (error: unknown) {
        this.dependencies.errorlog({
          where:
            "MarkdownImageController.performEmbeddableToMarkdownImage.flushChild",
          error,
        });
        new Notice(t("ERROR_TRY_AGAIN"));
        return;
      }
      const updatedData = this.removeLocalSection(this.view.data, localSection);
      if (updatedData === null) {
        new Notice(t("ERROR_TRY_AGAIN"));
        return;
      }
      dataWithoutLocalSection = updatedData;
      source.markdown = localSection.trim();
    }

    const converted =
      await this.dependencies.convertEmbeddableElementToMarkdownImage(
        this.view,
        element,
        source,
      );
    if (!converted) {
      new Notice(t("MARKDOWN_IMAGE_CONVERSION_ERROR"));
      return;
    }
    if (dataWithoutLocalSection !== null) {
      this.view.data = dataWithoutLocalSection;
      await this.view.forceSave(true);
    }
  }

  /** Converts a Markdown image to an external or back-of-note embeddable. */
  public async convertMarkdownImageToEmbeddable(
    elementId: string,
  ): Promise<void> {
    await this.runConversion(() =>
      this.performMarkdownImageToEmbeddable(elementId),
    );
  }

  private async performMarkdownImageToEmbeddable(
    elementId: string,
  ): Promise<void> {
    const element = this.view
      .getViewElements()
      .find(
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
        !this.isManagedSectionTitle(candidateTitle);
      if (!valid) {
        new Notice(t("MARKDOWN_IMAGE_H1_WARNING"), 10000);
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
        this.isManagedSectionTitle(title) ||
        sections.some(
          (heading) =>
            heading.toLocaleLowerCase() === title.toLocaleLowerCase(),
        )
      ) {
        new Notice(t("INVALID_SECTION_NAME"));
        return;
      }
      sectionMarkdown = `# ${title}\n\n${source.markdown.trim()}`.trim();
    }

    const remainingLocalImageIds = new Set([
      ...parsedMarkdownImages.keys(),
      ...this.view.excalidrawData.markdownImages.keys(),
    ]);
    remainingLocalImageIds.delete(element.fileId);
    sectionMarkdown = sectionMarkdown
      .replace(/(?:\r?\n[ \t]*#[ \t]*)+(?:\r?\n[ \t]*)*$/, "")
      .trimEnd();
    if (remainingLocalImageIds.size === 0) {
      sectionMarkdown += "\n\n#";
    }

    const previousData = this.view.data;
    this.view.data = this.dependencies.unwrapMarkdownImageBlock(
      this.view.data,
      element.fileId,
      "",
    );
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
