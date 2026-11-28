import { Modal, Menu, Setting, SuggestModal, TFile, type App } from "obsidian";
import { t } from "src/lang/helpers";

/** Anchor keyboard and touch menus to the invoking control. */
export function showResourceMenu(menu: Menu, target: HTMLElement, event?: MouseEvent): void {
  if (event?.type === "contextmenu") { menu.showAtMouseEvent(event); return; }
  const rect = target.getBoundingClientRect();
  menu.showAtPosition({ x: rect.left, y: rect.bottom });
}

/** Show a cancellable native action dialog. */
export function resourceInput(app: App, title: string, options: { value?: string; message?: string; danger?: boolean } = {}): Promise<string | null> {
  return new Promise(resolve => {
    const modal = new Modal(app);
    modal.setTitle(title);
    modal.onClose = () => resolve(null);
    let value = options.value ?? "";
    const accept = () => {
      if (options.value !== undefined && !value.trim()) return;
      resolve(value.trim());
      modal.close();
    };
    if (options.message) modal.contentEl.createEl("p", { text: options.message });
    if (options.value !== undefined) {
      const input = modal.contentEl.createEl("input", { type: "text", value, attr: { "aria-label": t("VR_NAME") } });
      input.oninput = () => { value = input.value; };
      input.onkeydown = event => { if (event.key === "Enter") { event.preventDefault(); accept(); } };
    }
    new Setting(modal.contentEl).addButton(button => {
      if (options.danger) button.setWarning(); else button.setCta();
      button.setButtonText(t(options.danger ? "VR_DELETE" : "VR_SAVE")).onClick(accept);
    });
    modal.open();
  });
}

/** Select one visual resource from the existing vault index. */
export class VisualResourceFilePrompt extends SuggestModal<TFile> {
  private readonly files: TFile[];
  constructor(app: App, accept: (file: TFile) => boolean, private readonly chosen: (file: TFile) => void) {
    super(app);
    this.setPlaceholder(t("VR_ADD_FILE"));
    this.files = app.vault.getFiles().filter(accept);
  }
  public getSuggestions(query: string): TFile[] {
    const normalized = query.trim().toLowerCase();
    return this.files.filter(file => file.path.toLowerCase().includes(normalized)).slice(0, 100);
  }
  public renderSuggestion(file: TFile, el: HTMLElement): void { el.setText(file.path); }
  public onChooseSuggestion(file: TFile): void { this.chosen(file); }
}
