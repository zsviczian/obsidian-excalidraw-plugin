import { App, FuzzyMatch, FuzzySuggestModal, TFile } from "obsidian";
import { t } from "src/lang/helpers";

/** Blank and dismissal are distinct at the interactive creation boundary. */
export type TemplateSelection = { kind: "template"; file: TFile } | { kind: "blank" } | { kind: "cancel" };
type TemplateItem = Exclude<TemplateSelection, { kind: "cancel" }>;

/** Small dedicated chooser; shared link-prompt cancellation keeps its existing contract. */
export class TemplatePrompt extends FuzzySuggestModal<TemplateItem> {
  public readonly result: Promise<TemplateSelection>;
  private resolveResult: (result: TemplateSelection) => void;
  private selected = false;
  private readonly items: TemplateItem[];

  constructor(app: App, files: TFile[], private readonly templateRoot = "") {
    super(app);
    this.items = [{ kind: "blank" }, ...files.map(file => ({ kind: "template" as const, file }))];
    this.setPlaceholder(t("PROMPT_SELECT_TEMPLATE"));
    this.result = new Promise(resolve => { this.resolveResult = resolve; });
  }

  getItems(): TemplateItem[] { return this.items; }
  getItemText(item: TemplateItem): string {
    if (item.kind === "blank") return t("PROMPT_BLANK_DRAWING");
    const prefix = this.templateRoot.replace(/\/+$/, "") + "/";
    return item.file.path.startsWith(prefix) ? item.file.path.slice(prefix.length) : item.file.path;
  }
  selectSuggestion(value: FuzzyMatch<TemplateItem>, evt: MouseEvent | KeyboardEvent): void {
    this.selected = true;
    super.selectSuggestion(value, evt);
  }
  onChooseItem(item: TemplateItem): void { this.selected = true; this.resolveResult(item); }
  onClose(): void { super.onClose(); if (!this.selected) this.resolveResult({ kind: "cancel" }); }
}

export async function selectDrawingTemplate(files: TFile[] | null, app: App, templateRoot = ""): Promise<TemplateSelection> {
  if (!files?.length) return { kind: "blank" };
  if (files.length === 1) return { kind: "template", file: files[0] };
  const prompt = new TemplatePrompt(app, files, templateRoot);
  prompt.open();
  return prompt.result;
}
