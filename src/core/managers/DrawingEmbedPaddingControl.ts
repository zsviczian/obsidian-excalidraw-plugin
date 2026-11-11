import { Component, Notice, SliderComponent, setIcon, setTooltip } from "obsidian";
import type { DrawingEmbedActions, EmbedSourceBinding } from "src/types/drawingEmbedTypes";
import { t } from "src/lang/helpers";
import { setStyle } from "src/utils/styleUtils";
import { getDrawingPreviewParts } from "src/utils/drawingPreviewLink";
import { OUTER_PADDING_MAX } from "src/utils/drawingPadding";

/** One source-owned padding gesture; preview payloads never replace the editor widget. */
export class DrawingEmbedPaddingControl extends Component {
  private active = false;
  private generation = 0;
  private timer: number | null = null;
  private popup: HTMLElement;
  private overlay: HTMLElement;
  private payload: HTMLElement | null = null;
  private value: number | null;
  private changed = false;

  constructor(
    private readonly frame: HTMLElement,
    private readonly opener: HTMLElement,
    private readonly actions: DrawingEmbedActions,
    private readonly source: EmbedSourceBinding,
    private readonly onClosed: () => void,
  ) {
    super();
    this.value = actions.padding.value;
  }

  /** Portal outside native widget paint containment, in the opener's document. */
  onload(): void {
    this.active = true;
    this.frame.addClass("excalidraw-embed-padding-open");
    this.opener.setAttribute("aria-expanded", "true");
    const doc = this.frame.ownerDocument, win = doc.defaultView;
    const area = getDrawingPreviewParts(this.actions.target ?? "")?.hasArearef;
    const label = t(area ? "PREVIEW_AREA_EXPANSION" : "PREVIEW_OUTER_PADDING");
    this.popup = doc.body.createDiv({ cls: "excalidraw-embed-padding-popover", attr: { role: "dialog", "aria-label": label } });
    const row = this.popup.createDiv({ cls: "excalidraw-embed-padding-row" });
    const track = row.createDiv({ cls: "excalidraw-embed-padding-track" });
    let maximum = OUTER_PADDING_MAX;
    const control = new SliderComponent(track).setLimits(0, maximum, 1).setValue(Math.min(this.value, maximum));
    const slider = control.sliderEl;
    slider.disabled = !!area && !!this.actions.padding.getMax;
    slider.setAttribute("aria-label", label);
    slider.setAttribute("aria-valuetext", String(this.value));
    const output = this.popup.createEl("output", { cls: "excalidraw-padding-value", text: String(this.value), attr: { "aria-live": "polite" } });
    const update = () => {
      if (slider.disabled) return;
      if (!this.current()) { this.close(false); return; }
      this.value = Number(slider.value);
      slider.setAttribute("aria-valuetext", String(this.value));
      output.setText(String(this.value));
      this.changed = this.value !== this.actions.padding.value;
      this.queuePreview();
    };
    this.registerDomEvent(slider, "input", update);
    this.registerDomEvent(slider, "wheel", event => {
      if (!event.deltaY) return;
      if (slider.disabled) return;
      event.preventDefault(); event.stopPropagation();
      control.setValue(Math.max(0, Math.min(maximum, Number(slider.value) - Math.sign(event.deltaY))));
      update();
    }, { passive: false });
    const reset = row.createEl("button", { cls: "clickable-icon", attr: { type: "button", "aria-label": t("EMBED_RESET_PADDING") } });
    setIcon(reset, "rotate-ccw");
    setTooltip(reset, t("EMBED_RESET_PADDING"));
    this.registerDomEvent(reset, "click", () => { this.value = null; this.changed = true; this.close(true); });
    this.popup.createDiv({ cls: "excalidraw-embed-padding-help", text: t(area ? "PREVIEW_AREA_HELP" : "PREVIEW_PADDING_HELP") });
    this.registerDomEvent(this.popup, "pointerdown", event => event.stopPropagation());
    this.registerDomEvent(this.popup, "click", event => event.stopPropagation());
    this.registerDomEvent(doc, "pointerdown", event => {
      if (!event.composedPath().includes(this.popup) && !event.composedPath().includes(this.opener)) this.close(true);
    });
    this.registerDomEvent(doc, "keydown", event => {
      if (event.key === "Escape" || event.key === "Enter") {
        event.preventDefault(); event.stopPropagation(); this.close(event.key === "Enter");
      }
    }, true);
    this.registerDomEvent(win, "blur", () => this.close(false));
    this.registerDomEvent(win, "resize", () => this.place());
    this.registerDomEvent(doc, "scroll", () => this.place(), true);
    this.place(); slider.focus({ preventScroll: true });
    if (slider.disabled) void (async () => {
      try {
        const limit = await this.actions.padding.getMax();
        if (!this.current()) return;
        maximum = Number.isFinite(limit) ? Math.max(OUTER_PADDING_MAX, Math.ceil(limit)) : OUTER_PADDING_MAX;
        control.setLimits(0, maximum, 1).setValue(Math.min(this.value, maximum));
      } catch { /* Saved geometry may be unavailable; keep the conservative initial range. */ }
      finally { if (this.current()) { slider.disabled = false; slider.focus({ preventScroll: true }); } }
    })();
  }

  private current(): boolean {
    return this.active && this.frame.isConnected && this.opener.ownerDocument === this.frame.ownerDocument &&
      this.actions.isCurrent() && this.source.isCurrent();
  }

  private place(): void {
    if (!this.current()) { this.close(false); return; }
    const win = this.frame.ownerDocument.defaultView;
    const bounds = (this.opener.closest(".excalidraw-embed-toolbar") ?? this.opener).getBoundingClientRect();
    const popup = this.popup.getBoundingClientRect();
    const top = bounds.bottom + popup.height + 8 <= win.innerHeight ? bounds.bottom + 4 : bounds.top - popup.height - 4;
    setStyle(this.popup, {
      left: `${Math.max(4, Math.min(bounds.right - popup.width, win.innerWidth - popup.width - 4))}px`,
      top: `${Math.max(4, Math.min(top, win.innerHeight - popup.height - 4))}px`,
    });
  }

  private queuePreview(): void {
    this.generation++;
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => { this.timer = null; void this.preview(); }, 400);
  }

  private async preview(): Promise<void> {
    const generation = this.generation;
    const current = () => this.current() && generation === this.generation;
    if (!current()) return;
    try {
      const image = await this.actions.padding.create(this.value, current);
      if (!image) return;
      if (!current()) { this.actions.discard(image); return; }
      this.overlay ??= this.frame.createDiv({ cls: "excalidraw-embed-padding-preview" });
      const original = this.frame.querySelector<HTMLElement>(".excalidraw-embedded-img");
      const visual = original?.querySelector("img, svg") ?? original;
      if (visual) {
        const bounds = visual.getBoundingClientRect(), frame = this.frame.getBoundingClientRect();
        setStyle(this.overlay, { left: `${bounds.left - frame.left}px`, top: `${bounds.top - frame.top}px`, width: `${bounds.width}px`, height: `${bounds.height}px` });
      }
      if (this.payload) this.actions.discard(this.payload);
      this.overlay.empty(); this.overlay.append(image); this.payload = image;
      this.frame.addClass("excalidraw-embed-padding-previewing");
    } catch (error: unknown) {
      if (current()) console.error("Excalidraw padding preview failed", error);
    }
  }

  /** Closing commits once; Escape, stale ownership and component unload cancel. */
  close(commit: boolean): void {
    if (!this.active) return;
    const save = commit && this.changed && this.current();
    this.unload();
    if (save && !this.source.replacePadding(this.value)) new Notice(t("EMBED_SOURCE_CHANGED"));
  }

  /** Release timers, the portal and fresh image URLs even during a pending export. */
  onunload(): void {
    this.active = false; this.generation++;
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
    if (this.payload) this.actions.discard(this.payload);
    this.payload = null; this.overlay?.remove(); this.popup?.remove();
    this.frame.removeClass("excalidraw-embed-padding-previewing", "excalidraw-embed-padding-open");
    this.opener.setAttribute("aria-expanded", "false");
    if (this.opener.isConnected) this.opener.focus({ preventScroll: true });
    this.onClosed();
  }
}
