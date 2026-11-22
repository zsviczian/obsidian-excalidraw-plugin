import { Component, Setting, SliderComponent, setIcon } from "obsidian";
import type { ExcalidrawFrameElement } from "@zsviczian/excalidraw/types/element/src/types";
import type ExcalidrawView from "src/view/ExcalidrawView";
import type { EmbeddedFile } from "src/shared/EmbeddedFileLoader";
import { getDrawingPreviewParts, rewriteDrawingPreviewLink, type DrawingPreviewChanges } from "src/utils/drawingPreviewLink";
import { FloatingModal } from "./FloatingModal";
import { t } from "src/lang/helpers";
import { OUTER_PADDING_MAX } from "src/utils/drawingPadding";

/** Draft image-link controls: preview locally, then commit once after choosing scope. */
export class DrawingImagePreviewPopover extends FloatingModal {
  private events: Component | null = null;
  private popup: HTMLElement;
  private image: HTMLImageElement;
  private timer: number | null = null;
  private generation = 0;
  private active = false;
  private applying = false;
  private readonly original: string;
  private readonly changes: DrawingPreviewChanges = {};

  constructor(view: ExcalidrawView, private readonly source: EmbeddedFile,
    private readonly frames: readonly ExcalidrawFrameElement[], private readonly defaultPadding: number, private readonly areaPaddingMax: number,
    private readonly isCurrent: () => boolean,
    private readonly render: (link: string) => Promise<{ image: { dataURL: string } }>,
    private readonly commit: (changes: DrawingPreviewChanges) => Promise<boolean>, private readonly closed: () => void) {
    super(view.app); this.original = source.linkParts.original;
  }

  protected shouldNotStartDrag(target: HTMLElement, event: PointerEvent | TouchEvent): boolean {
    return !!target.closest(".setting-item-control") || super.shouldNotStartDrag(target, event);
  }

  /** Use the shared draggable modal without blocking interaction with the drawing. */
  onOpen(): void {
    this.active = true;
    this.events = new Component(); this.events.load();
    const doc = this.modalEl.ownerDocument;
    this.modalEl.addClass("excalidraw-drawing-preview-popover");
    this.modalEl.setAttribute("aria-label", t("PREVIEW_CONFIGURE"));
    this.setTitle(t("PREVIEW_CONFIGURE"));
    this.popup = this.contentEl;
    this.popup.createDiv({ cls: "setting-item-description", text: t("PREVIEW_CONFIGURE_HELP") });
    this.image = this.popup.createDiv({ cls: "excalidraw-drawing-preview-image" }).createEl("img", { attr: { alt: t("PREVIEW_VIEW") } });
    const parts = getDrawingPreviewParts(this.original), ref = parts.blockref ?? parts.sectionref;
    const initialFrame = parts.hasFrameref && ref === "" ? "whole" :
      !(parts.hasBlockref || parts.hasSectionref) || ref === "as-image" ? "default" :
        (parts.hasFrameref || parts.hasClippedFrameref) && this.frames.some(frame => frame.id === ref || frame.name === ref)
          ? "frame:" + this.frames.find(frame => frame.id === ref || frame.name === ref).id : "current";
    const paddingSetting = new Setting(this.popup);
    paddingSetting.settingEl.addClass("excalidraw-drawing-preview-padding");
    const updatePaddingLabel = () => {
      const next = getDrawingPreviewParts(rewriteDrawingPreviewLink(this.original, this.changes));
      const area = next.hasArearef;
      paddingSetting.setName(t(area ? "PREVIEW_AREA_EXPANSION" : "PREVIEW_OUTER_PADDING"))
        .setDesc(t(area ? "PREVIEW_AREA_HELP" : "PREVIEW_PADDING_HELP"));
      paddingSetting.nameEl.empty();
      setIcon(paddingSetting.nameEl, area ? "square-dot" : "box-select");
      paddingSetting.nameEl.appendText(" " + t(area ? "PREVIEW_AREA_EXPANSION" : "PREVIEW_OUTER_PADDING"));
      const maximum = area ? this.areaPaddingMax : OUTER_PADDING_MAX;
      const value = this.changes.padding === undefined ? initialPadding ?? defaultPadding : this.changes.padding ?? defaultPadding;
      slider.setLimits(0, maximum, 1).setValue(Math.min(value, maximum));
      slider.sliderEl.setAttribute("aria-label", t(area ? "PREVIEW_AREA_EXPANSION" : "PREVIEW_OUTER_PADDING"));
      output.setText(String(value));
    };
    const viewSetting = new Setting(this.popup).setName(t("PREVIEW_VIEW")).setDesc(t("PREVIEW_VIEW_HELP")).addDropdown(dropdown => {
      dropdown.addOption("default", t("FRAME_DEFAULT")).addOption("whole", t("FRAME_WHOLE"));
      if (initialFrame === "current") dropdown.addOption("current", t("PREVIEW_CURRENT"));
      for (const frame of this.frames) dropdown.addOption("frame:" + frame.id,
        frame.name?.trim() ? frame.name : `${t(frame.frameRole === "marker" ? "FRAME_UNNAMED_MARKER" : "FRAME_UNNAMED")} (${frame.id})`);
      dropdown.setValue(initialFrame).onChange(value => {
        if (value === initialFrame) delete this.changes.frame;
        else this.changes.frame = value === "default" ? null : value === "whole" ? "" : value.slice(6);
        updatePaddingLabel(); this.queuePreview();
      });
    });
    this.popup.insertBefore(viewSetting.settingEl, paddingSetting.settingEl);
    const defaultPadding = this.defaultPadding, initialPadding = parts.padding;
    let slider: SliderComponent;
    paddingSetting.addSlider(control => {
      slider = control; control.setLimits(0, OUTER_PADDING_MAX, 1).setValue(Math.min(initialPadding ?? defaultPadding, OUTER_PADDING_MAX)).onChange(value => {
        if (value === (initialPadding ?? defaultPadding)) delete this.changes.padding; else this.changes.padding = value;
        output.setText(String(value)); this.queuePreview();
      }); control.sliderEl.setAttribute("aria-label", t("PREVIEW_OUTER_PADDING"));
    }).addExtraButton(button => button.setIcon("rotate-ccw").setTooltip(t("EMBED_RESET_PADDING")).onClick(() => {
      if (initialPadding === undefined) delete this.changes.padding; else this.changes.padding = null;
      updatePaddingLabel(); this.queuePreview();
    }));
    const output = paddingSetting.controlEl.createEl("output", { cls: "excalidraw-padding-value", text: String(initialPadding ?? defaultPadding), attr: { "aria-live": "polite" } });
    updatePaddingLabel();
    const anchored = this.original.endsWith("|100%");
    new Setting(this.popup).setName(t("PREVIEW_ANCHOR")).setDesc(t("PREVIEW_ANCHOR_HELP")).addToggle(toggle =>
      toggle.setValue(anchored).onChange(value => { if (value === anchored) delete this.changes.anchored; else this.changes.anchored = value; }));
    const buttons = this.popup.createDiv({ cls: "excalidraw-drawing-preview-buttons" });
    const cancel = buttons.createEl("button", { text: t("PROMPT_BUTTON_CANCEL"), attr: { type: "button" } });
    const apply = buttons.createEl("button", { text: t("PREVIEW_APPLY"), cls: "mod-cta", attr: { type: "button" } });
    this.events.registerDomEvent(cancel, "click", () => { if (!this.applying) this.close(); });
    const save = async () => {
      if (this.applying || !this.current()) return;
      if (!Object.keys(this.changes).length) { this.close(); return; }
      this.applying = true; apply.disabled = true;
      try { if (await this.commit({ ...this.changes })) this.close(); }
      finally { this.applying = false; apply.disabled = false; }
    };
    this.events.registerDomEvent(apply, "click", () => { void save(); });
    this.events.registerDomEvent(this.popup, "wheel", event => event.stopPropagation());
    this.events.registerDomEvent(doc, "keydown", event => {
      if (event.key === "Escape" && !this.applying) { event.preventDefault(); event.stopPropagation(); this.close(); }
    }, true);
    this.queuePreview();
  }

  private current(): boolean { return this.active && this.isCurrent(); }

  private queuePreview(): void {
    const generation = ++this.generation;
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => { this.timer = null; void (async () => {
      const link = rewriteDrawingPreviewLink(this.original, this.changes);
      if (!link || !this.current()) return;
      try {
        const result = await this.render(link);
        if (this.current() && generation === this.generation) { this.image.src = result.image.dataURL; }
      } catch { /* The owned controller reports apply failures; a stale draft never writes. */ }
    })(); }, 300);
  }

  /** Cancel delayed renders and release this window's controls without a scene write. */
  onClose(): void {
    if (!this.active) return;
    this.active = false; this.generation++;
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null; this.events?.unload(); this.events = null;
    this.contentEl.empty(); this.closed();
  }
}
