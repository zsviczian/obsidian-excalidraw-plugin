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
  private static readonly active = new WeakMap<Document, ViewFullscreenManager>();
  private document: Document | null = null;
  private readonly classes = new Map<Element, Set<string>>();

  public constructor(private readonly host: ViewFullscreenHost) {}

  private addClass(element: Element, name: string): void {
    if (element.hasClass(name)) return;
    element.addClass(name);
    if (!this.classes.has(element)) this.classes.set(element, new Set());
    this.classes.get(element).add(name);
  }

  /** Keeps the complete ancestor path visible, hiding only surrounding panes. */
  public gotoFullscreen(): void {
    if (this.document || !this.host.excalidrawWrapperRef?.current) return;
    if (this.host.plugin.leafChangeTimeout) {
      // The timeout is owned by EventManager in the main window.
      window.clearTimeout(this.host.plugin.leafChangeTimeout);
      this.host.plugin.clearLeafChangeTimeout();
    }
    const doc = this.host.ownerDocument;
    ViewFullscreenManager.active.get(doc)?.exitFullscreen();
    this.document = doc;
    ViewFullscreenManager.active.set(doc, this);
    this.host.toolsPanelRef?.current?.setFullscreen(true);
    this.addClass(this.host.contentEl, "excalidraw-fullscreen-content");
    for (let node: HTMLElement | null = this.host.contentEl; node && node !== doc.body; node = node.parentElement) {
      this.addClass(node, FULLSCREEN_VISIBLE_CLASS);
      if (node.hasClass("mod-root")) this.addClass(node, "excalidraw-fullscreen-root");
      for (const sibling of Array.from(node.parentElement?.children ?? [])) {
        if (sibling !== node && sibling.matches(
          ".workspace-split, .workspace-tabs, .workspace-leaf, .view-header, .workspace-tab-header-container",
        )) this.addClass(sibling, FULLSCREEN_HIDDEN_CLASS);
      }
    }
    doc.body.querySelectorAll(".workspace-ribbon, .mobile-navbar, .status-bar, .titlebar")
      .forEach(node => this.addClass(node, FULLSCREEN_HIDDEN_CLASS));
  }

  /** Returns whether this view owns an active fullscreen operation. */
  public isFullscreen(): boolean { return this.document !== null; }

  /** Restores only classes added by this operation, including after window migration. */
  public exitFullscreen(): void {
    if (!this.document) return;
    this.host.toolsPanelRef?.current?.setFullscreen(false);
    for (const [element, names] of this.classes) {
      for (const name of names) element.removeClass(name);
    }
    this.classes.clear();
    ViewFullscreenManager.active.delete(this.document);
    this.document = null;
  }
}
