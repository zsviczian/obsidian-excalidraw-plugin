import { setStyle } from "../../utils/styleUtils";
import { isInstanceOfHTMLElement } from "../../utils/typechecks";

const FULLSCREEN_HIDDEN_CLASS = "excalidraw-hidden";
const FULLSCREEN_VISIBLE_CLASS = "excalidraw-visible";

interface FullscreenToolsPanel {
  setFullscreen(isFullscreen: boolean): void;
}

/**
 * Minimal view surface required by {@link ViewFullscreenManager}.
 *
 * `ownerDocument` must remain view-scoped so fullscreen DOM changes target the
 * correct Obsidian window when the view is hosted in a popout.
 */
export interface ViewFullscreenHost {
  contentEl: HTMLElement;
  readonly ownerDocument: Document;
  excalidrawWrapperRef: { current: HTMLDivElement | null } | null;
  toolsPanelRef: { current: FullscreenToolsPanel | null } | null;
  plugin: {
    readonly leafChangeTimeout: number | null;
    clearLeafChangeTimeout(): void;
  };
}

/**
 * Applies and restores the DOM classes used by one Excalidraw view's
 * fullscreen mode.
 */
export class ViewFullscreenManager {
  public constructor(private readonly host: ViewFullscreenHost) {}

  /** Enters fullscreen mode within the view's owning Obsidian document. */
  public gotoFullscreen(): void {
    if (this.host.plugin.leafChangeTimeout) {
      // The timeout is created on the main window by EventManager.
      window.clearTimeout(this.host.plugin.leafChangeTimeout);
      this.host.plugin.clearLeafChangeTimeout();
    }
    if (!this.host.excalidrawWrapperRef) {
      return;
    }
    if (this.host.toolsPanelRef?.current) {
      this.host.toolsPanelRef.current.setFullscreen(true);
    }

    const hide = (el: HTMLElement) => {
      setStyle(el, { marginTop: "0px" });
      let tmpEl = el;
      while (tmpEl && !tmpEl.hasClass("workspace-split")) {
        el.addClass(FULLSCREEN_VISIBLE_CLASS);
        el = tmpEl;
        tmpEl = el.parentElement;
      }
      if (el) {
        el.addClass(FULLSCREEN_VISIBLE_CLASS);
        el.querySelectorAll(
          `div.workspace-split:not(.${FULLSCREEN_VISIBLE_CLASS})`,
        ).forEach((node) => {
          if (node !== el) {
            node.addClass(FULLSCREEN_VISIBLE_CLASS);
          }
        });
        el.querySelector(
          `div.workspace-leaf-content.${FULLSCREEN_VISIBLE_CLASS} > .view-header`,
        ).addClass(FULLSCREEN_VISIBLE_CLASS);
        el.querySelectorAll(
          `div.workspace-tab-container.${FULLSCREEN_VISIBLE_CLASS} > div.workspace-leaf:not(.${FULLSCREEN_VISIBLE_CLASS})`,
        ).forEach((node) => node.addClass(FULLSCREEN_VISIBLE_CLASS));
        el.querySelectorAll(
          `div.workspace-tabs.${FULLSCREEN_VISIBLE_CLASS} > div.workspace-tab-header-container`,
        ).forEach((node) => node.addClass(FULLSCREEN_VISIBLE_CLASS));
        el.querySelectorAll(
          `div.workspace-split.${FULLSCREEN_VISIBLE_CLASS} > div.workspace-tabs:not(.${FULLSCREEN_VISIBLE_CLASS})`,
        ).forEach((node) => node.addClass(FULLSCREEN_VISIBLE_CLASS));
      }
      const doc = this.host.ownerDocument;
      doc.body
        .querySelectorAll(
          `div.workspace-split:not(.${FULLSCREEN_VISIBLE_CLASS})`,
        )
        .forEach((node) => {
          if (node !== tmpEl) {
            node.addClass(FULLSCREEN_HIDDEN_CLASS);
          } else {
            node.addClass(FULLSCREEN_VISIBLE_CLASS);
          }
        });
      doc.body
        .querySelector(
          `div.workspace-leaf-content.${FULLSCREEN_VISIBLE_CLASS} > .view-header`,
        )
        .addClass(FULLSCREEN_HIDDEN_CLASS);
      doc.body
        .querySelectorAll(
          `div.workspace-tab-container.${FULLSCREEN_VISIBLE_CLASS} > div.workspace-leaf:not(.${FULLSCREEN_VISIBLE_CLASS})`,
        )
        .forEach((node) => node.addClass(FULLSCREEN_HIDDEN_CLASS));
      doc.body
        .querySelectorAll(
          `div.workspace-tabs.${FULLSCREEN_VISIBLE_CLASS} > div.workspace-tab-header-container`,
        )
        .forEach((node) => node.addClass(FULLSCREEN_HIDDEN_CLASS));
      doc.body
        .querySelectorAll(
          `div.workspace-split.${FULLSCREEN_VISIBLE_CLASS} > div.workspace-tabs:not(.${FULLSCREEN_VISIBLE_CLASS})`,
        )
        .forEach((node) => node.addClass(FULLSCREEN_HIDDEN_CLASS));
      doc.body
        .querySelectorAll("div.workspace-ribbon")
        .forEach((node) => node.addClass(FULLSCREEN_HIDDEN_CLASS));
      doc.body
        .querySelectorAll("div.mobile-navbar")
        .forEach((node) => node.addClass(FULLSCREEN_HIDDEN_CLASS));
      doc.body
        .querySelectorAll("div.status-bar")
        .forEach((node) => node.addClass(FULLSCREEN_HIDDEN_CLASS));
      doc.body
        .querySelectorAll("div.titlebar")
        .forEach((node) => node.addClass(FULLSCREEN_HIDDEN_CLASS));
      const topPadding = doc.body.querySelector(
        ".is-mobile .workspace > .mod-root",
      );
      if (topPadding && isInstanceOfHTMLElement(topPadding)) {
        setStyle(topPadding, { paddingTop: "0px" });
      }
    };

    hide(this.host.contentEl);
  }

  /** Returns whether this view's owning document contains fullscreen classes. */
  public isFullscreen(): boolean {
    return Boolean(
      this.host.ownerDocument.body.querySelector(
        `.${FULLSCREEN_HIDDEN_CLASS}`,
      ),
    );
  }

  /** Restores DOM classes and layout styles applied by fullscreen mode. */
  public exitFullscreen(): void {
    if (!this.isFullscreen()) {
      return;
    }
    if (this.host.toolsPanelRef?.current) {
      this.host.toolsPanelRef.current.setFullscreen(false);
    }
    const doc = this.host.ownerDocument;
    doc
      .querySelectorAll(`.${FULLSCREEN_HIDDEN_CLASS}`)
      .forEach((el) => el.removeClass(FULLSCREEN_HIDDEN_CLASS));
    doc
      .querySelectorAll(`.${FULLSCREEN_VISIBLE_CLASS}`)
      .forEach((el) => el.removeClass(FULLSCREEN_VISIBLE_CLASS));
    const topPadding = doc.body.querySelector(
      ".is-mobile .workspace > .mod-root",
    );
    if (topPadding && isInstanceOfHTMLElement(topPadding)) {
      setStyle(topPadding, { paddingTop: "" });
    }
    setStyle(this.host.contentEl, { marginTop: "" });
  }
}
