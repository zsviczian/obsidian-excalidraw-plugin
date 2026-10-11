import { MarkdownPostProcessorContext, MarkdownRenderChild } from "obsidian";

interface EmbedRenderer {
  enqueue: (task: () => Promise<void>) => Promise<void>;
  createImage: (isCurrent: () => boolean) => Promise<HTMLDivElement>;
  discardImage: (image: Element) => void;
  isPluginLoaded: () => boolean;
}

// One render owner per embed, including repeated postprocessor callbacks.
const children = new WeakMap<HTMLElement, MarkdownEmbedRenderChild>();

/** DOM attachment is temporary; the Markdown render context owns our lifetime. */
class MarkdownEmbedRenderChild extends MarkdownRenderChild {
  private active = false;
  private generation = 0;
  private pending: Promise<void> | null = null;
  private ready = false;
  private image: HTMLDivElement | null = null;
  private timer: number | null = null;

  constructor(containerEl: HTMLElement, private renderer: EmbedRenderer) {
    super(containerEl);
  }

  onload(): void {
    this.active = true;
    const ownerWindow = this.containerEl.ownerDocument.defaultView;
    const observer = new ownerWindow.MutationObserver((mutations) => {
      if (!mutations.some((m) => ["alt", "width", "height"].includes(m.attributeName))) {
        return;
      }
      // Invalidate immediately: an old result must not win during the debounce.
      this.generation++;
      this.pending = null;
      this.ready = false;
      this.containerEl.removeAttribute("ready");
      if (this.timer !== null) ownerWindow.clearTimeout(this.timer);
      this.timer = ownerWindow.setTimeout(() => {
        this.timer = null;
        void this.render();
      }, 500);
    });
    observer.observe(this.containerEl, {
      attributes: true,
      attributeFilter: ["alt", "width", "height"],
    });
    this.register(() => {
      observer.disconnect();
      if (this.timer !== null) ownerWindow.clearTimeout(this.timer);
      this.timer = null;
    });
    void this.render();
  }

  onunload(): void {
    this.active = false;
    this.generation++;
    this.pending = null;
    this.ready = false;
    this.image = null;
    this.containerEl.removeAttribute("ready");
    this.renderer.discardImage(this.containerEl);
    if (children.get(this.containerEl) === this) children.delete(this.containerEl);
  }

  render(): Promise<void> {
    if (!this.active || !this.renderer.isPluginLoaded() || this.timer !== null) {
      return Promise.resolve();
    }
    if (this.ready && this.image?.parentElement === this.containerEl) return Promise.resolve();
    this.ready = false;
    this.containerEl.removeAttribute("ready");
    if (this.pending !== null) return this.pending;

    const generation = ++this.generation;
    const isCurrent = () => this.active && this.renderer.isPluginLoaded() && generation === this.generation;
    const pending = this.renderer.enqueue(async () => {
      if (!isCurrent()) return;
      const image = await this.renderer.createImage(isCurrent);
      if (!image) return;
      if (!isCurrent()) {
        this.renderer.discardImage(image);
        return;
      }
      // A live context may be temporarily detached by Obsidian. Rendering into
      // its container lets the image appear when that same section is reattached.
      this.renderer.discardImage(this.containerEl);
      this.containerEl.empty();
      this.containerEl.appendChild(image);
      this.image = image;
      this.ready = true;
      this.containerEl.setAttribute("ready", "");
    }).catch((error: unknown) => {
      if (isCurrent()) console.error("Excalidraw Markdown embed render failed", error);
    }).finally(() => {
      if (generation === this.generation) this.pending = null;
    });
    this.pending = pending;
    return pending;
  }
}

export const renderMarkdownEmbed = async (
  el: HTMLElement,
  containerEl: HTMLElement,
  ctx: MarkdownPostProcessorContext,
  renderer: EmbedRenderer,
): Promise<void> => {
  let child = children.get(containerEl);
  if (!child) {
    el.empty();
    containerEl.empty();
    containerEl.removeAttribute("ready");
    child = new MarkdownEmbedRenderChild(containerEl, renderer);
    children.set(containerEl, child);
    ctx.addChild(child);
  }
  await child.render();
};
