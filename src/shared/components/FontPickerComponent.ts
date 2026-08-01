import { App, Menu, ValueComponent, type TFile } from "obsidian";
import { DEVICE } from "src/constants/constants";
import type { SelectableFontOption } from "src/types/fontTypes";
import { removeStyle, setStyle } from "src/utils/styleUtils";

type LoadedPreviewFont = {
  document: Document;
  face: FontFace;
  family: string;
  modified: number;
};

let fontPickerId = 0;

const quoteFontFamily = (fontFamily: string): string =>
  `"${fontFamily.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;

/**
 * Obsidian-styled font selector whose options preview their respective faces.
 *
 * The option provider is invoked whenever the menu opens, allowing vault font
 * additions, removals, and renames to appear without maintaining a file cache.
 * Local font binaries are loaded only for the selected option and visible menu
 * rows, and are registered in the document that owns the control.
 */
export class FontPickerComponent extends ValueComponent<string> {
  public readonly buttonEl: HTMLButtonElement;
  private readonly labelEl: HTMLSpanElement;
  private readonly id = ++fontPickerId;
  private previewFontId = 0;
  private value = "";
  private onChanged: (value: string) => void = () => {};
  private menu: Menu | null = null;
  private optionObserver: IntersectionObserver | null = null;
  private readonly loadedPreviewFonts = new Map<string, LoadedPreviewFont>();
  private readonly handleClick = (): void => this.openMenu();

  public constructor(
    containerEl: HTMLElement,
    private readonly app: App,
    private readonly getOptions: () => SelectableFontOption[],
  ) {
    super();
    this.buttonEl = containerEl.createEl("button", {
      cls: "dropdown excalidraw-font-picker",
      attr: {
        type: "button",
        "aria-haspopup": "menu",
        "aria-expanded": "false",
      },
    });
    this.labelEl = this.buttonEl.createSpan({
      cls: "excalidraw-font-picker__label",
    });
    this.buttonEl.addEventListener("click", this.handleClick);
  }

  /** Returns the currently selected font value. */
  public getValue(): string {
    return this.value;
  }

  /** Selects a font without invoking the change callback. */
  public setValue(value: string): this {
    this.value = value;
    this.updateTrigger(this.getOptions());
    return this;
  }

  /** Registers the callback invoked when the user selects a font. */
  public onChange(callback: (value: string) => void): this {
    this.onChanged = callback;
    return this;
  }

  /** Enables or disables interaction with the picker. */
  public setDisabled(disabled: boolean): this {
    this.disabled = disabled;
    this.buttonEl.disabled = disabled;
    return this;
  }

  /** Sets the accessible label on the picker trigger. */
  public setAriaLabel(label: string): this {
    this.buttonEl.setAttribute("aria-label", label);
    return this;
  }

  /** Releases menu, DOM, observer, and document font resources. */
  public destroy(): void {
    this.menu?.hide();
    this.menu = null;
    this.optionObserver?.disconnect();
    this.optionObserver = null;
    this.buttonEl.removeEventListener("click", this.handleClick);
    for (const loaded of this.loadedPreviewFonts.values()) {
      loaded.document.fonts.delete(loaded.face);
    }
    this.loadedPreviewFonts.clear();
    this.buttonEl.remove();
  }

  private openMenu(): void {
    if (this.disabled) {
      return;
    }
    this.menu?.hide();
    this.optionObserver?.disconnect();
    this.optionObserver = null;

    // Deliberately refresh on every open: the vault may have gained, lost, or
    // renamed a font since this settings page or sidepanel was rendered.
    const options = this.getOptions();
    this.prunePreviewFonts(options);
    this.updateTrigger(options);

    const doc = this.buttonEl.ownerDocument;
    const localPreviews: Array<{
      option: SelectableFontOption;
      element: HTMLSpanElement;
    }> = [];
    let firstOptionEl: HTMLSpanElement | null = null;
    const menu = new Menu().setUseNativeMenu(false);
    for (const option of options) {
      menu.addItem((item) => {
        const title = createFragment();
        const label = title.createSpan({
          cls: "excalidraw-font-picker__option",
          text: option.label,
        });
        firstOptionEl ??= label;
        if (option.fontFile) {
          localPreviews.push({ option, element: label });
        } else {
          this.applyPreview(option, label);
        }
        item
          .setTitle(title)
          .setChecked(option.value === this.value)
          .onClick(() => {
            this.setValue(option.value);
            this.onChanged(option.value);
          });
      });
    }

    menu.onHide(() => {
      this.optionObserver?.disconnect();
      this.optionObserver = null;
      this.buttonEl.setAttribute("aria-expanded", "false");
      if (this.menu === menu) {
        this.menu = null;
      }
    });
    this.menu = menu;
    this.buttonEl.setAttribute("aria-expanded", "true");
    const rect = this.buttonEl.getBoundingClientRect();
    if (!DEVICE.isMobile) {
      doc.body.classList.add("excalidraw-font-picker-menu-opening");
    }
    try {
      menu.showAtPosition(
        { x: rect.left, y: rect.bottom, width: rect.width },
        doc,
      );
      if (!DEVICE.isMobile) {
        firstOptionEl
          ?.closest<HTMLElement>(".menu")
          ?.classList.add("excalidraw-font-picker-menu--desktop");
      }
    } finally {
      doc.body.classList.remove("excalidraw-font-picker-menu-opening");
    }
    this.observeLocalPreviews(localPreviews, doc);
  }

  private observeLocalPreviews(
    previews: Array<{
      option: SelectableFontOption;
      element: HTMLSpanElement;
    }>,
    doc: Document,
  ): void {
    const ownerWindow = doc.defaultView;
    if (!ownerWindow?.IntersectionObserver) {
      previews.forEach(({ option, element }) =>
        this.applyPreview(option, element),
      );
      return;
    }
    const optionsByElement = new Map(
      previews.map(({ option, element }) => [element, option]),
    );
    this.optionObserver = new ownerWindow.IntersectionObserver(
      (entries, observer) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }
          const element = entry.target as HTMLSpanElement;
          const option = optionsByElement.get(element);
          if (option) {
            this.applyPreview(option, element);
          }
          observer.unobserve(element);
        }
      },
      { rootMargin: "80px 0px" },
    );
    previews.forEach(({ element }) => this.optionObserver?.observe(element));
  }

  private updateTrigger(options: SelectableFontOption[]): void {
    const option = options.find((candidate) => candidate.value === this.value);
    this.labelEl.textContent = option?.label ?? this.value;
    if (option) {
      this.applyPreview(option, this.labelEl);
    } else {
      removeStyle(this.labelEl, ["fontFamily"]);
    }
  }

  private applyPreview(
    option: SelectableFontOption,
    element: HTMLElement,
  ): void {
    const family = option.fontFile
      ? this.ensureLocalPreviewFont(option.fontFile)
      : option.value;
    if (!family) {
      removeStyle(element, ["fontFamily"]);
      return;
    }
    setStyle(element, { fontFamily: quoteFontFamily(family) });
  }

  private ensureLocalPreviewFont(file: TFile): string | null {
    const doc = this.buttonEl.ownerDocument;
    const existing = this.loadedPreviewFonts.get(file.path);
    if (
      existing &&
      existing.document === doc &&
      existing.modified === file.stat.mtime
    ) {
      return existing.family;
    }
    if (existing) {
      existing.document.fonts.delete(existing.face);
      this.loadedPreviewFonts.delete(file.path);
    }
    const ownerWindow = doc.defaultView;
    if (!ownerWindow) {
      return null;
    }
    const FontFaceConstructor: typeof FontFace | undefined = Reflect.get(
      ownerWindow,
      "FontFace",
    );
    if (!FontFaceConstructor) {
      return null;
    }
    const family = `Excalidraw Font Preview ${this.id} ${++this.previewFontId}`;
    const resourcePath = this.app.vault.getResourcePath(file);
    const face = new FontFaceConstructor(
      family,
      `url(${JSON.stringify(resourcePath)})`,
    );
    doc.fonts.add(face);
    this.loadedPreviewFonts.set(file.path, {
      document: doc,
      face,
      family,
      modified: file.stat.mtime,
    });
    void face.load().catch((): void => {});
    return family;
  }

  private prunePreviewFonts(options: SelectableFontOption[]): void {
    const currentFiles = new Map(
      options
        .filter(
          (option): option is SelectableFontOption & { fontFile: TFile } =>
            option.fontFile !== undefined,
        )
        .map((option) => [option.fontFile.path, option.fontFile.stat.mtime]),
    );
    for (const [path, loaded] of this.loadedPreviewFonts) {
      if (currentFiles.get(path) === loaded.modified) {
        continue;
      }
      loaded.document.fonts.delete(loaded.face);
      this.loadedPreviewFonts.delete(path);
    }
  }
}
