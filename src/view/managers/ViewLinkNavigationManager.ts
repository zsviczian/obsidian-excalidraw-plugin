import { Notice } from "obsidian";
import {
  ElementsMap,
  ExcalidrawElement,
  ExcalidrawImageElement,
  ExcalidrawTextElement,
} from "@zsviczian/excalidraw/types/element/src/types";
import {
  CaptureUpdateAction,
  getContainerElement,
} from "../../constants/constants";
import { t } from "../../lang/helpers";
import { TextMode } from "../../shared/TextMode";
import type {
  SelectedElementWithLink,
  SelectedImage,
} from "../../types/excalidrawViewTypes";
import type { ModifierKeys } from "../../utils/modifierkeyHelper";
import { getMermaidText, shouldRenderMermaid } from "../../utils/mermaidUtils";
import type ExcalidrawView from "../ExcalidrawView";

/** Runtime dependencies and private view operations needed by link navigation. */
export interface ViewLinkNavigationDependencies {
  REGEX_LINK: typeof import("../../shared/ExcalidrawData").REGEX_LINK;
  REG_LINKINDEX_HYPERLINK: typeof import("../../shared/ExcalidrawData").REG_LINKINDEX_HYPERLINK;
  NewFileActions: typeof import("../../shared/Dialogs/Prompt").NewFileActions;
  linkPrompt: typeof import("../../shared/Dialogs/Prompt").linkPrompt;
  getMarkdownImageSource: typeof import("../../shared/MarkdownImage").getMarkdownImageSource;
  isMarkdownImageElement: typeof import("../../shared/MarkdownImage").isMarkdownImageElement;
  splitFolderAndFilename: typeof import("../../utils/fileUtils").splitFolderAndFilename;
  getTextElementAtPointer: typeof import("../../utils/getElementAtPointer").getTextElementAtPointer;
  anyModifierKeysPressed: typeof import("../../utils/modifierkeyHelper").anyModifierKeysPressed;
  emulateKeysForLinkClick: typeof import("../../utils/modifierkeyHelper").emulateKeysForLinkClick;
  linkClickModifierType: typeof import("../../utils/modifierkeyHelper").linkClickModifierType;
  getLeaf: typeof import("../../utils/obsidianUtils").getLeaf;
  openLeaf: typeof import("../../utils/obsidianUtils").openLeaf;
  getExcalidrawFileForwardLinks: typeof import("../../utils/excalidrawViewUtils").getExcalidrawFileForwardLinks;
  openExternalLink: typeof import("../../utils/excalidrawViewUtils").openExternalLink;
  parseObsidianLink: typeof import("../../utils/excalidrawViewUtils").parseObsidianLink;
  arrayToMap: typeof import("../../utils/utils").arrayToMap;
  errorlog: typeof import("../../utils/utils").errorlog;
  getContainerElementForText: (
    element: ExcalidrawTextElement,
  ) => ExcalidrawElement | null;
  getSelectedTextElement: () => SelectedElementWithLink;
  getSelectedImageElement: () => SelectedImage;
  getSelectedElementWithLink: () => SelectedElementWithLink;
  forceSaveIfRequired: () => Promise<boolean>;
}

/**
 * Resolves element links and coordinates navigation for one Excalidraw view.
 *
 * The owning view retains compatibility delegates for scripts, commands, UI
 * components, and Excalidraw callbacks. The concrete view is referenced only
 * as a TypeScript type because established link helpers require that surface;
 * this module does not create a runtime import cycle.
 */
export class ViewLinkNavigationManager {
  public constructor(
    private readonly view: ExcalidrawView,
    private readonly dependencies: ViewLinkNavigationDependencies,
  ) {}

  /** Hides the Excalidraw link tooltip in the view's owning document. */
  public removeLinkTooltip(): void {
    const tooltip = this.view.ownerDocument.body.querySelector(
      "body>div.excalidraw-tooltip,div.excalidraw-tooltip--visible",
    );
    if (tooltip) {
      tooltip.classList.remove("excalidraw-tooltip--visible");
    }
  }

  /**
   * Invokes the public link-click hook and reports whether default navigation
   * should stop.
   */
  public handleLinkHookCall(
    element: ExcalidrawElement,
    link: string,
    event: MouseEvent | null,
  ): boolean {
    if (this.view.getHookServer().onLinkClickHook) {
      try {
        if (
          !this.view.getHookServer().onLinkClickHook(
            element,
            link,
            event,
            this.view,
            this.view.getHookServer(),
          )
        ) {
          return true;
        }
      } catch (e: unknown) {
        this.dependencies.errorlog({
          where: "ExcalidrawView.onLinkOpen",
          fn: "getHookServer().onLinkClickHook",
          error: e,
        });
      }
    }
    return false;
  }

  /** Resolves the effective link and source element for a view selection. */
  public getLinkTextForElement(
    selectedText: SelectedElementWithLink,
    selectedElementWithLink?: SelectedElementWithLink,
    allowLinearElementClick: boolean = false,
  ): {
    linkText: string;
    selectedElement: ExcalidrawElement;
    isLinearElement: boolean;
  } {
    if (selectedText?.id || selectedElementWithLink?.id) {
      let selectedTextElement: ExcalidrawTextElement = selectedText.id
        ? (this.view.excalidrawAPI
            .getSceneElements()
            .find(
              (el: ExcalidrawElement) => el.id === selectedText.id,
            ) as ExcalidrawTextElement)
        : null;

      let selectedElement = selectedElementWithLink.id
        ? (this.view.excalidrawAPI
            .getSceneElements()
            .find(
              (el: ExcalidrawElement) => el.id === selectedElementWithLink.id,
            ) as ExcalidrawElement)
        : null;

      // If the user clicked the label of an arrow, Excalidraw returns the
      // container as selected. Treat the label as text so its link navigates.
      if (!selectedTextElement && selectedElement?.type === "text") {
        const container = getContainerElement(
          selectedElement,
          this.dependencies.arrayToMap(
            this.view.excalidrawAPI.getSceneElements(),
          ) as ElementsMap,
        );
        if (container?.type === "arrow") {
          const x = this.dependencies.getTextElementAtPointer(
            this.view.currentPosition,
            this.view,
          );
          if (x?.id === selectedElement.id) {
            selectedTextElement = selectedElement;
            selectedElement = null;
          }
        }
      }

      // CTRL click on a linear element with a link navigates instead of opening
      // the linear element editor.
      if (
        !allowLinearElementClick &&
        ["arrow", "line"].includes(selectedElement?.type)
      ) {
        return {
          linkText: selectedElement.link,
          selectedElement,
          isLinearElement: true,
        };
      }

      if (!selectedTextElement && selectedElement?.type === "text") {
        if (!allowLinearElementClick) {
          const container = getContainerElement(
            selectedElement,
            this.dependencies.arrayToMap(
              this.view.excalidrawAPI.getSceneElements(),
            ) as ElementsMap,
          );
          if (container?.type !== "arrow") {
            selectedTextElement = selectedElement;
            selectedElement = null;
          } else {
            const x = this.view.processLinkText(
              selectedElement.rawText,
              selectedElement,
              container,
              false,
            );
            return {
              linkText: x.linkText,
              selectedElement: container,
              isLinearElement: true,
            };
          }
        } else {
          selectedTextElement = selectedElement;
          selectedElement = null;
        }
      }

      const linkCandidates: string[] = [];
      const addCandidate = (value?: string | null) => {
        if (value && value.trim().length > 0) {
          linkCandidates.push(value);
        }
      };

      if (selectedTextElement) {
        const textBody =
          this.view.textMode === TextMode.parsed
            ? this.view.excalidrawData.getRawText(selectedTextElement.id)
            : (selectedTextElement.rawText ??
              selectedTextElement.text ??
              selectedText.text);
        addCandidate(textBody);
        addCandidate(selectedTextElement.link);

        if (!selectedElement && selectedTextElement.containerId) {
          const container =
            this.dependencies.getContainerElementForText(selectedTextElement);
          addCandidate(container?.link);
        }
      } else {
        const rawTextCandidate = selectedText?.id
          ? this.view.textMode === TextMode.parsed
            ? this.view.excalidrawData.getRawText(selectedText.id)
            : selectedText.text
          : selectedText?.text;
        addCandidate(rawTextCandidate);
      }

      addCandidate(selectedElement?.link ?? selectedElementWithLink?.text);

      const linkText = Array.from(new Set(linkCandidates)).join(" ");

      return {
        linkText: linkText || null,
        selectedElement: selectedElement ?? selectedTextElement,
        isLinearElement: false,
      };
    }
    return { linkText: null, selectedElement: null, isLinearElement: false };
  }

  /** Resolves raw element text to the link used by the navigation flow. */
  public processLinkText(
    linkText: string,
    selectedTextElement: ExcalidrawTextElement,
    selectedElement: ExcalidrawElement,
    shouldOpenLink: boolean = true,
  ): { linkText: string | null; selectedElement: ExcalidrawElement | null } {
    if (!linkText) {
      return { linkText: null, selectedElement: null };
    }

    if (linkText.startsWith("#")) {
      return {
        linkText,
        selectedElement: selectedTextElement ?? selectedElement,
      };
    }

    const maybeObsidianLink = this.dependencies.parseObsidianLink(
      linkText,
      this.view.app,
      shouldOpenLink,
    );
    if (typeof maybeObsidianLink === "string") {
      linkText = maybeObsidianLink;
    }

    const partsArray = this.dependencies.REGEX_LINK.getResList(linkText);
    if (!linkText || partsArray.length === 0) {
      // The container link takes precedence over the text link.
      if (selectedTextElement?.containerId) {
        const container =
          this.dependencies.getContainerElementForText(selectedTextElement);
        if (container) {
          linkText = container.link;

          if (linkText?.startsWith("#")) {
            return {
              linkText,
              selectedElement: selectedTextElement ?? selectedElement,
            };
          }

          const maybeObsidianLink = this.dependencies.parseObsidianLink(
            linkText,
            this.view.app,
            shouldOpenLink,
          );
          if (typeof maybeObsidianLink === "string") {
            linkText = maybeObsidianLink;
          }
        }
      }
      if (!linkText || partsArray.length === 0) {
        linkText = selectedTextElement?.link;
      }
    }
    return {
      linkText,
      selectedElement: selectedTextElement ?? selectedElement,
    };
  }

  /** Resolves the clicked element and performs the configured link action. */
  public async linkClick(
    ev: MouseEvent | null,
    selectedText: SelectedElementWithLink,
    selectedImage: SelectedImage,
    selectedElementWithLink: SelectedElementWithLink,
    keys?: ModifierKeys,
    allowLinearElementClick: boolean = false,
  ): Promise<void> {
    if (!selectedText) {
      selectedText = { id: null, text: null };
    }
    if (!selectedImage) {
      selectedImage = { id: null, fileId: null };
    }
    if (!selectedElementWithLink) {
      selectedElementWithLink = { id: null, text: null };
    }
    if (!ev && !keys) {
      keys = this.dependencies.emulateKeysForLinkClick("new-tab");
    }
    if (ev && !keys) {
      keys = {
        shiftKey: ev.shiftKey,
        ctrlKey: ev.ctrlKey,
        metaKey: ev.metaKey,
        altKey: ev.altKey,
      };
    }

    const linkClickType = this.dependencies.linkClickModifierType(keys);

    let file = null;
    let subpath: string = null;
    let { linkText, selectedElement, isLinearElement } =
      this.getLinkTextForElement(
        selectedText,
        selectedElementWithLink,
        allowLinearElementClick,
      );

    if (selectedElement) {
      if (!allowLinearElementClick && linkText && isLinearElement) {
        if (this.view.semaphores.warnAboutLinearElementLinkClick) {
          new Notice(t("LINEAR_ELEMENT_LINK_CLICK_ERROR"), 20000);
          this.view.semaphores.warnAboutLinearElementLinkClick = false;
        }
        return;
      }
      if (!linkText) {
        return;
      }
      linkText = linkText.replaceAll("\n", "");

      if (this.dependencies.openExternalLink(linkText, this.view.app)) {
        return;
      }

      const maybeObsidianLink = this.dependencies.parseObsidianLink(
        linkText,
        this.view.app,
      );
      if (typeof maybeObsidianLink === "boolean" && maybeObsidianLink) {
        return;
      }
      if (typeof maybeObsidianLink === "string") {
        linkText = maybeObsidianLink;
      }

      const result = await this.dependencies.linkPrompt(
        linkText,
        this.view.app,
        this.view,
      );
      if (!result) {
        return;
      }
      [file, linkText, subpath] = result;

      if (this.view.handleLinkHookCall(selectedElement, linkText, ev)) {
        return;
      }
    }
    if (selectedImage?.id) {
      const imageElement = this.view
        .getScene()
        .elements.find(
          (el: ExcalidrawElement) => el.id === selectedImage.id,
        ) as ExcalidrawImageElement;
      if (
        linkClickType === "md-properties" &&
        this.view.excalidrawData.hasFile(selectedImage.fileId)
      ) {
        this.view.updateScene({ appState: { contextMenu: null } });
        void this.view.openEmbeddedLinkEditor(selectedImage.id);
        return;
      }
      const markdownImageSource = this.dependencies.isMarkdownImageElement(
        this.view,
        imageElement,
      )
        ? await this.dependencies.getMarkdownImageSource(this.view, imageElement)
        : null;
      if (markdownImageSource) {
        const externalSourceLink =
          markdownImageSource.source === "external" &&
          markdownImageSource.embeddedFile
            ? markdownImageSource.embeddedFile.linkParts.original
            : null;
        const result = await this.dependencies.linkPrompt(
          `${externalSourceLink ? `[[${externalSourceLink}]] ` : ""}${markdownImageSource.markdown}`,
          this.view.app,
          this.view,
        );
        if (!result) {
          return;
        }
        [file, linkText, subpath] = result;
        if (
          markdownImageSource.source === "external" &&
          markdownImageSource.embeddedFile?.file &&
          linkText
        ) {
          file =
            linkText === markdownImageSource.embeddedFile.linkParts.path
              ? markdownImageSource.embeddedFile.file
              : this.view.app.metadataCache.getFirstLinkpathDest(
                  linkText,
                  markdownImageSource.embeddedFile.file.path,
                );
        }
      }
      if (
        !markdownImageSource &&
        this.view.excalidrawData.hasEquation(selectedImage.fileId)
      ) {
        this.view.updateScene({ appState: { contextMenu: null } });
        void this.view.openLaTeXEditor(selectedImage.id);
        return;
      }
      if (
        !markdownImageSource &&
        (this.view.excalidrawData.hasMermaid(selectedImage.fileId) ||
          getMermaidText(imageElement))
      ) {
        if (shouldRenderMermaid) {
          const api = this.view.excalidrawAPI;
          api.updateScene({
            appState: { openDialog: { name: "ttd", tab: "mermaid" } },
            captureUpdate: CaptureUpdateAction.NEVER,
          });
        }
        return;
      }

      if (!markdownImageSource) {
        await this.view.save(false);
      }
      if (
        !markdownImageSource &&
        this.view.excalidrawData.hasFile(selectedImage.fileId)
      ) {
        const fileId = selectedImage.fileId;
        const ef = this.view.excalidrawData.getFile(fileId);
        if (
          !ef.isHyperLink &&
          !ef.isLocalLink &&
          ef.file &&
          linkClickType === "md-properties"
        ) {
          this.view.updateScene({ appState: { contextMenu: null } });
          void this.view.openEmbeddedLinkEditor(selectedImage.id);
          return;
        }
        let secondOrderLinks: string = " ";

        const backlinks = this.view.app.metadataCache?.getBacklinksForFile(
          ef.file,
        )?.data;
        const secondOrderLinksSet = new Set<string>();
        if (backlinks && this.view.plugin.settings.showSecondOrderLinks) {
          const linkPaths = Object.keys(backlinks)
            .filter(
              (path) =>
                path !== this.view.file.path && path !== ef.file.path,
            )
            .map((path) => {
              const filepathParts =
                this.dependencies.splitFolderAndFilename(path);
              if (secondOrderLinksSet.has(path)) {
                return "";
              }
              secondOrderLinksSet.add(path);
              return `[[${path}|${t("LINKLIST_SECOND_ORDER_LINK")}: ${filepathParts.basename}]]`;
            });
          secondOrderLinks += linkPaths.join(" ");
        }

        if (
          this.view.plugin.settings.showSecondOrderLinks &&
          this.view.plugin.isExcalidrawFile(ef.file)
        ) {
          secondOrderLinks += this.dependencies.getExcalidrawFileForwardLinks(
            this.view.app,
            ef.file,
            secondOrderLinksSet,
          );
        }

        const linkString =
          (ef.isHyperLink || ef.isLocalLink
            ? `[](${ef.hyperlink}) `
            : `[[${ef.linkParts.original}]] `) +
          (imageElement.link
            ? imageElement.link.match(/$cmd:\/\/.*/) ||
              imageElement.link.match(
                this.dependencies.REG_LINKINDEX_HYPERLINK,
              )
              ? `[](${imageElement.link})`
              : imageElement.link
            : "");

        const result = await this.dependencies.linkPrompt(
          linkString + secondOrderLinks,
          this.view.app,
          this.view,
        );
        if (!result) {
          return;
        }
        [file, linkText, subpath] = result;
      }
    }

    if (!linkText) {
      if (allowLinearElementClick) {
        return;
      }
      new Notice(t("LINK_BUTTON_CLICK_NO_TEXT"), 20000);
      return;
    }

    const id =
      selectedImage.id ?? selectedText.id ?? selectedElementWithLink.id;
    const sceneElements = this.view.excalidrawAPI.getSceneElements() as readonly
      ExcalidrawElement[];
    const el = sceneElements.filter((element) => element.id === id)[0];
    if (this.view.handleLinkHookCall(el, linkText, ev)) {
      return;
    }

    try {
      if (linkClickType !== "active-pane" && this.view.isFullscreen()) {
        this.view.exitFullscreen();
      }
      if (!file) {
        new this.dependencies.NewFileActions({
          plugin: this.view.plugin,
          path: linkText,
          keys,
          view: this.view,
          sourceElement: el,
          followObsidianNewNoteLocation: true,
        }).open();
        return;
      }
      if (
        this.view.linksAlwaysOpenInANewPane &&
        !this.dependencies.anyModifierKeysPressed(keys)
      ) {
        keys = this.dependencies.emulateKeysForLinkClick("new-pane");
      }

      // Save before replacing this pane with the link destination.
      await this.dependencies.forceSaveIfRequired();
      const { promise } = this.dependencies.openLeaf({
        plugin: this.view.plugin,
        fnGetLeaf: () =>
          this.dependencies.getLeaf(
            this.view.plugin,
            this.view.leaf,
            keys,
          ),
        file,
        openState: {
          active: !this.view.linksAlwaysOpenInANewPane,
          ...(subpath ? { eState: { subpath } } : {}),
        },
      });
      await promise;
    } catch (e: unknown) {
      new Notice(e as string, 4000);
    }
  }

  /** Resolves the current selection and starts its configured link action. */
  public async handleLinkClick(
    ev: MouseEvent | ModifierKeys,
    allowLinearElementClick: boolean = false,
  ): Promise<void> {
    this.view.removeLinkTooltip();

    const selectedText = this.dependencies.getSelectedTextElement();
    const selectedImage = selectedText?.id
      ? null
      : this.dependencies.getSelectedImageElement();
    const selectedElementWithLink =
      selectedImage?.id || selectedText?.id
        ? null
        : this.dependencies.getSelectedElementWithLink();
    void this.view.linkClick(
      ev instanceof MouseEvent ? ev : null,
      selectedText,
      selectedImage,
      selectedElementWithLink,
      ev instanceof MouseEvent ? null : ev,
      allowLinearElementClick,
    );
  }
}
