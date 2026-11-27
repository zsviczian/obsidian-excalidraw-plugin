import { Component, Platform, setIcon, setTooltip } from "obsidian";
import { t } from "src/lang/helpers";
import type { VisualResource } from "src/types/visualResourceTypes";
import { setElementHidden } from "src/utils/htmlUtils";
import { removeStyle, setStyle } from "src/utils/styleUtils";
import type { VisualResources } from "./VisualResources";
import { visualResourceKey } from "./visualResourceModel";

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
  frameCount?: (resource: VisualResource) => number | null;
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
type PreviewSlot = { element: HTMLElement; desired?: string; ready?: string; loading?: string };
type GalleryCard = {
  element: HTMLElement;
  variant: string;
  preview: PreviewSlot;
  control: HTMLElement;
  checkbox?: HTMLInputElement;
  update: (resource: VisualResource, selected: boolean | undefined) => void;
};
type PreviewTask = {
  card: GalleryCard;
  resource: VisualResource;
  stamp: string;
  dark: boolean;
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
  private cards = new Map<string, GalleryCard>();
  private active = 0;
  private pending: PreviewTask[] = [];
  private observed = new Map<Element, PreviewTask>();
  private observer: IntersectionObserver | null = null;
  private click: { win: Window; id: number } | null = null;
  private disposed = false;
  private controls: HTMLElement[] = [];
  private checkboxes = new Map<HTMLInputElement, VisualResource>();
  public readonly root: HTMLElement;
  private readonly grid: HTMLElement;
  private readonly empty: HTMLElement;
  private readonly pager: HTMLElement;
  private readonly previous: HTMLButtonElement;
  private readonly next: HTMLButtonElement;

  constructor(parent: HTMLElement, private readonly service: VisualResources, private readonly actions: GalleryActions) {
    super();
    this.root = parent.createDiv({ cls: "excalidraw-resource-gallery" });
    this.grid = this.root.createDiv({ cls: "excalidraw-resource-grid" });
    this.empty = this.grid.createDiv({ cls: "excalidraw-resource-status", text: t("VR_EMPTY") });
    this.pager = this.root.createDiv({ cls: "excalidraw-resource-toolbar" });
    this.previous = visualResourceButton(this.pager, "chevron-left", t("LUCIDE_PREVIOUS"));
    this.next = visualResourceButton(this.pager, "chevron-right", t("LUCIDE_NEXT"));
  }

  /** Attach shared navigation and cleanup to the gallery's lifecycle. */
  public onload(): void {
    this.registerDomEvent(this.previous, "click", () => this.changePage(-1));
    this.registerDomEvent(this.next, "click", () => this.changePage(1));
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
      this.cards.clear();
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
    this.observer?.disconnect();
    this.observer = null;
    this.pending = [];
    this.observed.clear();
  }

  private render(): void {
    this.resetPreviews();
    this.controls = [];
    this.checkboxes.clear();
    this.grid.toggleClass("is-list", !!this.options.list);
    setStyle(this.grid, { "--excalidraw-resource-size": (this.options.size ?? 100) + "px" });
    const win = this.root.ownerDocument.defaultView;
    if (win?.IntersectionObserver) {
      const observer = this.observer = new win.IntersectionObserver(entries => {
        if (this.observer !== observer) return;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const task = this.observed.get(entry.target);
          observer.unobserve(entry.target);
          this.observed.delete(entry.target);
          if (task) this.enqueue(task);
        }
      }, { rootMargin: "64px" });
    }
    const offset = this.page * PAGE_SIZE;
    const visible = this.resources.slice(offset, offset + PAGE_SIZE);
    const keys = new Set(visible.map(resource => visualResourceKey(resource.locator)));
    for (const [key, card] of this.cards) {
      if (keys.has(key)) continue;
      card.element.remove();
      this.cards.delete(key);
    }
    const focused = this.root.ownerDocument.activeElement as HTMLElement | null;
    const dark = this.root.ownerDocument.body.hasClass("theme-dark");
    let next = this.empty.nextElementSibling;
    for (const resource of visible) {
      const key = visualResourceKey(resource.locator);
      const selected = this.actions.selected?.(resource);
      const variant = JSON.stringify([resource.kind, selected !== undefined, !!resource.inspectFrames, !!this.options.list]);
      let card = this.cards.get(key);
      if (card?.variant !== variant) {
        const old = card;
        card = this.card(resource, selected, variant, old?.preview);
        if (old) {
          if (next === old.element) next = next.nextElementSibling;
          old.element.remove();
        }
        this.cards.set(key, card);
      }
      if (card.element !== next) this.grid.insertBefore(card.element, next);
      next = card.element.nextElementSibling;
      card.update(resource, selected);
      this.controls.push(card.control);
      if (card.checkbox) this.checkboxes.set(card.checkbox, resource);
      this.queuePreview(card, resource, dark);
    }
    if (focused?.isConnected && this.root.contains(focused) && this.root.ownerDocument.activeElement !== focused) {
      focused.focus({ preventScroll: true });
    }
    setElementHidden(this.empty, !!visible.length);
    setElementHidden(this.pager, this.resources.length <= PAGE_SIZE);
    this.previous.disabled = offset === 0;
    this.next.disabled = offset + PAGE_SIZE >= this.resources.length;
  }

  private changePage(offset: number): void {
    this.cancelClick();
    this.page += offset;
    this.render();
    this.focusFirst();
  }

  private card(resource: VisualResource, selected: boolean | undefined, variant: string, reused?: PreviewSlot): GalleryCard {
    const card = this.grid.createDiv({ cls: "excalidraw-resource-card" });
    const rename = selected === undefined && resource.locator.provider === "stencil" && this.actions.rename;
    const row = rename ? card.createDiv({ cls: "excalidraw-resource-body is-renamable" }) : card;
    const button = selected === undefined ? row.createEl("button", {
      cls: rename ? "excalidraw-resource-preview-button" : "excalidraw-resource-body",
      attr: { type: "button", "aria-label": resource.title },
    }) : null;
    const body = button ?? card.createEl("label", { cls: "excalidraw-resource-body" });
    const checkbox = button ? undefined : body.createEl("input", {
      cls: "excalidraw-resource-checkbox", type: "checkbox", attr: { "aria-label": resource.title },
    });
    if (checkbox) checkbox.onchange = () => this.actions.activate(resource);
    const preview = reused ?? { element: body.createSpan({ cls: "excalidraw-resource-preview", attr: { "aria-hidden": "true" } }) };
    const icon = resource.locator.provider === "lucide" ? "sparkles" : KIND_ICONS[resource.kind];
    if (reused) body.append(preview.element);
    else setIcon(preview.element, icon);
    const text = (rename ? row : body).createSpan({ cls: "excalidraw-resource-label" });
    const title = rename ? this.editableTitle(text, () => resource.title, name => rename(resource, name)) : text.createSpan();
    const source = this.options.list ? text.createSpan({ cls: "excalidraw-resource-source" }) : undefined;
    setIcon(card.createSpan({ cls: "excalidraw-resource-kind", attr: {
      role: "img", "aria-label": t(KIND_NAMES[resource.locator.provider === "lucide" ? "lucide" : resource.kind]),
    } }), icon);
    const actions = card.createDiv({ cls: "excalidraw-resource-actions" });
    let frameButton: HTMLButtonElement;
    let frameCount: HTMLElement;
    if (resource.inspectFrames && this.actions.frames) {
      frameButton = visualResourceButton(actions, "frame", t("VR_FRAME"));
      frameCount = frameButton.createSpan();
      setElementHidden(frameButton, true);
      frameButton.onclick = () => { this.cancelClick(); this.actions.frames?.(resource); };
    }
    const star = this.actions.favorite ? visualResourceButton(actions, "bookmark", "") : undefined;
    if (star) star.onclick = () => { this.cancelClick(); this.actions.favorite?.(resource); };
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
        const win = card.ownerDocument.defaultView;
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
    const control = button ?? checkbox;
    return { element: card, variant, preview, control, checkbox, update: (next, checked) => {
      resource = next;
      title.setText(resource.title);
      if (rename) title.setAttribute("aria-label", t("VR_RENAME") + " " + resource.title);
      source?.setText(resource.source);
      control.setAttribute("aria-label", resource.title);
      if (checkbox) checkbox.checked = checked;
      if (button) {
        if (this.actions.canActivate && !this.actions.canActivate(resource)) button.setAttribute("aria-disabled", "true");
        else button.removeAttribute("aria-disabled");
      }
      if (star) {
        const { favorite } = this.service.collections.state(resource.locator);
        star.setAttribute("aria-pressed", String(favorite));
        star.setAttribute("aria-label", t(favorite ? "VR_UNFAVORITE" : "VR_FAVORITE"));
      }
      if (frameButton) {
        const count = this.actions.frameCount?.(resource) ?? null;
        setElementHidden(frameButton, count === null);
        frameButton.setAttribute("aria-label", t("VR_BROWSE_FRAMES") + (count ? " (" + count + ")" : ""));
        frameCount.setText(count ? String(count) : "");
      }
      if (this.options.background) setStyle(preview.element, { backgroundColor: this.options.background });
      else removeStyle(preview.element, ["backgroundColor"]);
    } };
  }

  private editableTitle(label: HTMLElement, title: () => string, rename: (name: string) => void): HTMLButtonElement {
    const name = label.createEl("button", { cls: "excalidraw-resource-rename", attr: { type: "button" } });
    setTooltip(name, t("VR_RENAME"));
    name.onclick = () => {
      const input = label.createEl("input", { cls: "excalidraw-resource-name-input", type: "text",
        value: title(), attr: { "aria-label": t("VR_NAME") } });
      const finish = (save: boolean, refocus: boolean) => {
        input.onblur = null;
        if (!input.isConnected) return;
        input.replaceWith(name);
        if (refocus) name.focus();
        const next = input.value.trim();
        if (save && next && next !== title()) rename(next);
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
    return name;
  }

  private enqueue(task: PreviewTask): void {
    this.pending.push(task);
    this.drain();
  }

  private queuePreview(card: GalleryCard, resource: VisualResource, dark: boolean): void {
    const stamp = this.service.previewKey(resource, dark);
    const { preview } = card;
    preview.desired = stamp;
    if (preview.ready === stamp || preview.loading === stamp) return;
    const task = { card, resource, stamp, dark };
    if (this.observer) {
      this.observed.set(preview.element, task);
      this.observer.observe(preview.element);
    } else this.enqueue(task);
  }

  private drain(): void {
    while (this.active < PREVIEW_CONCURRENCY && this.pending.length && !this.disposed) {
      const task = this.pending.shift();
      this.active++;
      void this.loadPreview(task).catch(() => {}).finally(() => { this.active--; this.drain(); });
    }
  }

  private async loadPreview(task: PreviewTask): Promise<void> {
    const { preview } = task.card;
    const current = () => preview.element.isConnected && preview.desired === task.stamp;
    if (!current() || preview.ready === task.stamp || preview.loading === task.stamp) return;
    preview.loading = task.stamp;
    try {
      const image = await this.service.preview(task.resource, task.dark, current);
      if (!current()) return;
      preview.ready = task.stamp;
      if (typeof image === "string" && preview.element.querySelector("img")?.getAttribute("src") === image) return;
      preview.element.empty();
      if (typeof image === "string") preview.element.createEl("img", { attr: { src: image, alt: "", draggable: "false" } });
      else if (image) preview.element.append(image);
      else setIcon(preview.element, task.resource.locator.provider === "lucide" ? "sparkles" : KIND_ICONS[task.resource.kind]);
    } finally {
      if (preview.loading === task.stamp) preview.loading = undefined;
    }
  }
}
