import { Component, Platform, setIcon, setTooltip } from "obsidian";
import { t } from "src/lang/helpers";
import type { VisualResource } from "src/types/visualResourceTypes";
import { setStyle } from "src/utils/styleUtils";
import type { VisualResources } from "./VisualResources";

const PAGE_SIZE = 48;
const PREVIEW_CONCURRENCY = 3;
const KIND_ICONS = { icon: "star", image: "image", drawing: "pen-tool", frame: "frame",
  note: "file-text", stencil: "library", framework: "layout-template" } as const;

export const KIND_NAMES = {
  icon: "VR_ICON", image: "VR_IMAGE", drawing: "VR_DRAWING", frame: "VR_FRAME",
  note: "VR_NOTE", stencil: "VR_STENCIL", framework: "VR_FRAMEWORKS", lucide: "VR_LUCIDE", other: "VR_OTHER",
} as const;

interface GalleryActions {
  activate: (resource: VisualResource) => void;
  deferredActivation?: (resource: VisualResource) => () => void;
  open?: (resource: VisualResource) => void;
  canActivate?: (resource: VisualResource) => boolean;
  favorite?: (resource: VisualResource) => void;
  frames?: (resource: VisualResource) => void;
  inspectFrames?: (resource: VisualResource) => Promise<VisualResource[]>;
  menu?: (resource: VisualResource, button: HTMLElement, event: MouseEvent) => void;
  rename?: (resource: VisualResource, name: string) => void;
  drag?: (resource: VisualResource, transfer: DataTransfer) => void;
  escape?: () => void;
  selected?: (resource: VisualResource) => boolean;
}

interface GalleryOptions {
  list?: boolean;
  size?: number;
  background?: string;
}
type PreviewTask = {
  resource: VisualResource;
  element: HTMLElement;
  generation: number;
  frameButton?: HTMLButtonElement;
  frameCount?: HTMLElement;
};

/** Create a compact keyboard- and touch-accessible control with a native button target. */
export function visualResourceButton(parent: HTMLElement, icon: string, label: string, pressed?: boolean): HTMLButtonElement {
  const button = parent.createEl("button", { cls: "clickable-icon", attr: { type: "button", "aria-label": label } });
  if (pressed !== undefined) button.setAttribute("aria-pressed", String(pressed));
  setIcon(button, icon);
  return button;
}

/** Viewport-driven previews and shared card semantics for sidepanel and picker. */
export class VisualResourceGallery extends Component {
  private resources: readonly VisualResource[] = [];
  private options: GalleryOptions = {};
  private page = 0;
  private generation = 0;
  private active = 0;
  private pending: PreviewTask[] = [];
  private observed = new Map<Element, PreviewTask>();
  private observer: IntersectionObserver | null = null;
  private click: { win: Window; id: number } | null = null;
  private disposed = false;
  private controls: HTMLElement[] = [];
  private checkboxes = new Map<HTMLInputElement, VisualResource>();
  public readonly root: HTMLElement;

  constructor(parent: HTMLElement, private readonly service: VisualResources, private readonly actions: GalleryActions) {
    super();
    this.root = parent.createDiv({ cls: "excalidraw-resource-gallery" });
  }

  /** Attach shared navigation and cleanup to the gallery's lifecycle. */
  public onload(): void {
    this.registerDomEvent(this.root, "keydown", event => {
      if (event.key === "Escape") { this.cancelClick(); this.actions.escape?.(); return; }
      const index = this.controls.indexOf(event.target as HTMLElement);
      if (index < 0) return;
      const top = this.controls[0].getBoundingClientRect().top;
      const wrap = this.controls.findIndex(button => Math.abs(button.getBoundingClientRect().top - top) > 4);
      const columns = this.options.list ? 1 : wrap === -1 ? this.controls.length : wrap;
      const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns };
      const offset = offsets[event.key as keyof typeof offsets];
      if (offset === undefined) return;
      event.preventDefault();
      this.controls[Math.max(0, Math.min(this.controls.length - 1, index + offset))]?.focus();
    });
    this.register(() => {
      this.disposed = true;
      this.resetPreviews();
      this.cancelClick();
      this.root.remove();
    });
  }

  /** Focus the first rendered resource from the search field. */
  public focusFirst(): void { this.controls[0]?.focus(); }

  /** Synchronize visible checkboxes while keeping focus and thumbnails in place. */
  public updateSelection(): void {
    for (const [checkbox, resource] of this.checkboxes) {
      checkbox.checked = this.actions.selected?.(resource) ?? false;
    }
  }

  /** Stop a pending pointer gesture when the target changes, a drag starts, or the gallery moves. */
  public cancelClick(): void {
    if (this.click) this.click.win.clearTimeout(this.click.id);
    this.click = null;
  }

  /** Render a bounded page of matching descriptors. */
  public show(resources: readonly VisualResource[], options: GalleryOptions = {}, reset = true): void {
    if (reset) this.page = 0;
    this.resources = resources;
    this.options = options;
    this.page = Math.min(this.page, Math.max(0, Math.ceil(resources.length / PAGE_SIZE) - 1));
    this.render();
  }

  private resetPreviews(): void {
    this.generation++;
    this.observer?.disconnect();
    this.observer = null;
    this.pending = [];
    this.observed.clear();
  }

  private render(): void {
    this.resetPreviews();
    this.root.empty();
    this.controls = [];
    this.checkboxes.clear();
    const grid = this.root.createDiv({ cls: "excalidraw-resource-grid" });
    grid.toggleClass("is-list", !!this.options.list);
    setStyle(grid, { "--excalidraw-resource-size": (this.options.size ?? 100) + "px" });
    const win = this.root.ownerDocument.defaultView;
    if (win?.IntersectionObserver) {
      this.observer = new win.IntersectionObserver(entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const task = this.observed.get(entry.target);
          this.observer?.unobserve(entry.target);
          this.observed.delete(entry.target);
          if (task) this.enqueue(task);
        }
      }, { rootMargin: "64px" });
    }
    const offset = this.page * PAGE_SIZE;
    for (const resource of this.resources.slice(offset, offset + PAGE_SIZE)) this.card(grid, resource);
    if (!this.resources.length) grid.createDiv({ cls: "excalidraw-resource-status", text: t("VR_EMPTY") });
    if (this.resources.length > PAGE_SIZE) {
      const pages = this.root.createDiv({ cls: "excalidraw-resource-toolbar" });
      const previous = visualResourceButton(pages, "chevron-left", t("LUCIDE_PREVIOUS"));
      const next = visualResourceButton(pages, "chevron-right", t("LUCIDE_NEXT"));
      previous.disabled = offset === 0;
      next.disabled = offset + PAGE_SIZE >= this.resources.length;
      previous.onclick = () => this.changePage(-1);
      next.onclick = () => this.changePage(1);
    }
  }

  private changePage(offset: number): void {
    this.cancelClick();
    this.page += offset;
    this.render();
    this.focusFirst();
  }

  private card(grid: HTMLElement, resource: VisualResource): void {
    const win = grid.ownerDocument.defaultView;
    const card = grid.createDiv({ cls: "excalidraw-resource-card" });
    const selected = this.actions.selected?.(resource);
    const rename = selected === undefined && resource.locator.provider === "stencil" && this.actions.rename;
    const row = rename ? card.createDiv({ cls: "excalidraw-resource-body is-renamable" }) : card;
    const button = selected === undefined ? row.createEl("button", {
      cls: rename ? "excalidraw-resource-preview-button" : "excalidraw-resource-body",
      attr: { type: "button", "aria-label": resource.title },
    }) : null;
    const body = button ?? card.createEl("label", { cls: "excalidraw-resource-body" });
    if (button) {
      if (this.actions.canActivate && !this.actions.canActivate(resource)) button.setAttribute("aria-disabled", "true");
      this.controls.push(button);
    } else {
      const checkbox = body.createEl("input", {
        cls: "excalidraw-resource-checkbox", type: "checkbox", attr: { "aria-label": resource.title },
      });
      checkbox.checked = selected;
      checkbox.onchange = () => this.actions.activate(resource);
      this.controls.push(checkbox);
      this.checkboxes.set(checkbox, resource);
    }
    const preview = body.createSpan({ cls: "excalidraw-resource-preview", attr: { "aria-hidden": "true" } });
    if (this.options.background) setStyle(preview, { backgroundColor: this.options.background });
    const icon = resource.locator.provider === "lucide" ? "sparkles" : KIND_ICONS[resource.kind];
    setIcon(preview, icon);
    const text = (rename ? row : body).createSpan({ cls: "excalidraw-resource-label" });
    if (rename) this.editableTitle(text, resource, name => rename(resource, name));
    else text.createSpan({ text: resource.title });
    if (this.options.list) text.createSpan({ text: resource.source, cls: "excalidraw-resource-source" });
    setIcon(card.createSpan({ cls: "excalidraw-resource-kind", attr: {
      role: "img", "aria-label": t(KIND_NAMES[resource.locator.provider === "lucide" ? "lucide" : resource.kind]),
    } }), icon);
    const actions = card.createDiv({ cls: "excalidraw-resource-actions" });
    const task: PreviewTask = { resource, element: preview, generation: this.generation };
    if (resource.inspectFrames && this.actions.frames) {
      task.frameButton = visualResourceButton(actions, "frame", t("VR_FRAME"));
      task.frameButton.addClass("excalidraw-display-none");
      task.frameCount = task.frameButton.createSpan();
      task.frameButton.onclick = () => { this.cancelClick(); this.actions.frames?.(resource); };
    }
    if (this.actions.favorite) {
      const { favorite } = this.service.collections.state(resource.locator);
      const star = visualResourceButton(actions, "bookmark", t(favorite ? "VR_UNFAVORITE" : "VR_FAVORITE"), favorite);
      star.onclick = () => { this.cancelClick(); this.actions.favorite?.(resource); };
    }
    if (this.actions.menu) {
      const menu = visualResourceButton(actions, "ellipsis", t("VR_ACTIONS"));
      menu.onclick = event => { this.cancelClick(); this.actions.menu?.(resource, menu, event); };
      card.oncontextmenu = event => { event.preventDefault(); this.cancelClick(); this.actions.menu?.(resource, menu, event); };
    }
    if (button) {
      const canOpen = !!this.actions.open && resource.locator.provider === "vault";
      button.onclick = event => {
        if (event.detail > 1) return;
        if (this.actions.canActivate && !this.actions.canActivate(resource)) return;
        if (!canOpen || !Platform.isDesktopApp || !event.detail) {
          this.actions.activate(resource);
          return;
        }
        this.cancelClick();
        const activate = this.actions.deferredActivation?.(resource) ?? (() => this.actions.activate(resource));
        this.click = { win, id: win.setTimeout(() => { this.click = null; activate(); }, 500) };
      };
      if (canOpen) button.ondblclick = () => {
        this.cancelClick();
        this.actions.open?.(resource);
      };
      if (this.actions.drag) {
        button.draggable = true;
        button.ondragstart = event => {
          this.cancelClick();
          if (event.dataTransfer) this.actions.drag?.(resource, event.dataTransfer);
        };
        button.ondragend = () => this.service.endDrag();
      }
    }
    if (this.observer) {
      this.observed.set(preview, task);
      this.observer.observe(preview);
    } else this.enqueue(task);
  }

  private editableTitle(label: HTMLElement, resource: VisualResource, rename: (name: string) => void): void {
    const name = label.createEl("button", { cls: "excalidraw-resource-rename", text: resource.title,
      attr: { type: "button", "aria-label": t("VR_RENAME") + " " + resource.title } });
    setTooltip(name, t("VR_RENAME"));
    name.onclick = () => {
      const input = label.createEl("input", { cls: "excalidraw-resource-name-input", type: "text",
        value: resource.title, attr: { "aria-label": t("VR_NAME") } });
      const finish = (save: boolean, refocus: boolean) => {
        input.onblur = null;
        if (!input.isConnected) return;
        input.replaceWith(name);
        if (refocus) name.focus();
        const title = input.value.trim();
        if (save && title && title !== resource.title) rename(title);
      };
      input.onblur = () => finish(true, false);
      input.oncontextmenu = event => event.stopPropagation();
      input.onkeydown = event => {
        if (event.isComposing || event.key !== "Enter" && event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        finish(event.key === "Enter", true);
      };
      name.remove();
      input.focus();
      input.select();
    };
  }

  private enqueue(task: PreviewTask): void {
    this.pending.push(task);
    this.drain();
  }

  private drain(): void {
    while (this.active < PREVIEW_CONCURRENCY && this.pending.length && !this.disposed) {
      const task = this.pending.shift();
      this.active++;
      void this.loadPreview(task).catch(() => {}).finally(() => { this.active--; this.drain(); });
    }
  }

  private async loadPreview(task: PreviewTask): Promise<void> {
    const current = () => task.generation === this.generation && task.element.isConnected;
    if (task.frameButton && this.actions.inspectFrames) {
      const frames = await this.actions.inspectFrames(task.resource).catch((): VisualResource[] => []);
      if (!current()) return;
      if (frames.length) {
        task.frameButton.removeClass("excalidraw-display-none");
        task.frameButton.setAttribute("aria-label", t("VR_FRAME") + " (" + frames.length + ")");
        task.frameCount.setText(String(frames.length));
      }
    }
    const dark = task.element.ownerDocument.body.hasClass("theme-dark");
    const preview = await this.service.preview(task.resource, dark);
    if (!preview || !current()) return;
    task.element.empty();
    if (typeof preview === "string") task.element.createEl("img", { attr: { src: preview, alt: "", draggable: "false" } });
    else task.element.append(preview);
  }
}
