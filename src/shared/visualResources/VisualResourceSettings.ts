import { Modal, Notice, Setting, setTooltip } from "obsidian";
import type ExcalidrawPlugin from "src/core/main";
import { t } from "src/lang/helpers";
import type { VisualDiscoveryRule } from "src/types/visualResourceTypes";
import { compileVisualRules } from "./visualResourceModel";
import { visualResourceButton } from "./VisualResourceGallery";

const RULE_KINDS = [["icon", "VR_ICON"], ["drawing", "VR_DRAWING"], ["frame", "VR_FRAME_SEARCH_RULES"]] as const;
type RuleKind = typeof RULE_KINDS[number][0];

/** Edit named discovery blocks and test them against the vault's current metadata. */
export class VisualResourceSettings extends Modal {
  private draft: ExcalidrawPlugin["settings"]["visualResources"];
  private kind: RuleKind = "icon";
  private pages: Record<RuleKind, number> = { icon: 0, drawing: 0, frame: 0 };
  private readonly originalNames = new Map<VisualDiscoveryRule, string>();

  constructor(private readonly plugin: ExcalidrawPlugin, private readonly changed: () => void, scriptName?: string) {
    super(plugin.app);
    const old = plugin.visualResources.iconSettings(scriptName);
    this.draft = {
      iconWidth: old.iconWidth, thumbnailSize: old.thumbnailSize,
      lightBackground: old.lightBackground, darkBackground: old.darkBackground, excludeFolders: old.exclusion,
      ...plugin.settings.visualResources, rules: structuredClone(plugin.visualResources.rules(scriptName)),
    };
    for (const [kind] of RULE_KINDS) for (const rule of this.draft.rules[kind]) this.originalNames.set(rule, kind + ":" + rule.name);
  }

  /** Render the settings in the owning Obsidian modal. */
  public onOpen(): void {
    this.setTitle(t("VR_SETTINGS"));
    this.modalEl.addClass("excalidraw-resource-settings-modal");
    this.contentEl.addClass("excalidraw-resource-settings");
    this.render();
  }

  private render(): void {
    this.contentEl.empty();
    const copy = this.titleEl.createEl("button", { text: t("VR_COPY_PROMPT"), attr: { type: "button" } });
    copy.onclick = () => void this.contentEl.ownerDocument.defaultView.navigator.clipboard.writeText(t("VR_PROMPT"))
      .then(() => new Notice(t("VR_PROMPT_COPIED"))).catch(() => new Notice(t("VR_ACTION_FAILED")));
    this.contentEl.createEl("p", { cls: "setting-item-description", text: t("VR_COPY_PROMPT_DESC") });
    const header = this.contentEl.createDiv({ cls: "excalidraw-resource-settings-heading" });
    header.createEl("h3", { text: t("VR_DISCOVERY") });
    const scope = header.createEl("select", { attr: { "aria-label": t("VR_DISCOVERY") } });
    for (const [kind, name] of RULE_KINDS) scope.createEl("option", { value: kind, text: t(name) });
    scope.value = this.kind;
    this.contentEl.createEl("p", { cls: "setting-item-description", text: t("VR_RULES_DESC") });
    const deck = this.contentEl.createDiv();
    const tester = this.contentEl.createEl("details", { cls: "excalidraw-resource-settings-tester" });
    tester.createEl("summary", { text: t("VR_TEST") });
    const query = tester.createEl("input", { type: "search", placeholder: t("VR_TEST_PATH"), attr: { "aria-label": t("VR_TEST_PATH") } });
    const status = tester.createDiv({ cls: "excalidraw-resource-settings-test-results", attr: { "aria-live": "polite" } });
    const test = () => { if (tester.open) this.test(status, query.value); };
    const draw = () => { this.renderRule(deck, test); test(); };
    scope.onchange = () => { this.kind = scope.value as RuleKind; draw(); };
    tester.ontoggle = test;
    query.oninput = test;
    draw();
    const appearance = this.contentEl.createDiv({ cls: "excalidraw-resource-settings-appearance" });
    new Setting(appearance).setName(t("VR_EXCLUSIONS")).setDesc(t("VR_EXCLUSIONS_DESC")).addTextArea(text => {
      text.inputEl.rows = 2;
      text.setValue(this.draft.excludeFolders).onChange(value => { this.draft.excludeFolders = value; test(); });
    });
    this.number(appearance, "VR_ICON_WIDTH", "iconWidth", 20, 2000);
    this.number(appearance, "VR_THUMB_SIZE", "thumbnailSize", 64, 240);
    this.color(appearance, "VR_LIGHT_BG", "lightBackground");
    this.color(appearance, "VR_DARK_BG", "darkBackground");
    const footer = this.modalEl.createDiv({ cls: "excalidraw-resource-settings-footer" });
    new Setting(footer).addButton(button => button.setCta().setButtonText(t("VR_SAVE")).onClick(async () => {
      button.setDisabled(true);
      try {
        const renamed = new Map<string, string>();
        for (const [kind] of RULE_KINDS) {
          const seen = new Set<string>();
          for (const rule of this.draft.rules[kind]) {
            rule.name = rule.name.trim();
            if (!rule.name || seen.has(rule.name)) throw Error("Discovery rule names must be unique");
            seen.add(rule.name);
            new RegExp(rule.pattern);
            if (rule.folderPattern) new RegExp(rule.folderPattern);
            const original = this.originalNames.get(rule);
            if (original) renamed.set(original, kind + ":" + rule.name);
          }
        }
        const originals = new Set(this.originalNames.values());
        const remap = (groups: string[]) => groups.flatMap(group => renamed.get(group) ?? (originals.has(group) ? [] : [group]));
        const current = this.plugin.settings.visualResources;
        const { rules, iconWidth, thumbnailSize, lightBackground, darkBackground, excludeFolders } = this.draft;
        this.plugin.settings.visualResources = {
          ...current, rules, iconWidth, thumbnailSize, lightBackground, darkBackground, excludeFolders,
          groups: current.groups && remap(current.groups),
          iconGroups: current.iconGroups && Object.fromEntries(Object.entries(current.iconGroups).map(([script, groups]) => [script, remap(groups)])),
        };
        await this.plugin.saveSettings();
        this.changed();
        this.close();
      } catch { new Notice(t("VR_RULE_ERROR")); button.setDisabled(false); }
    }));
  }

  private number(parent: HTMLElement, label: "VR_ICON_WIDTH" | "VR_THUMB_SIZE", key: "iconWidth" | "thumbnailSize", min: number, max: number): void {
    new Setting(parent).setName(t(label)).addText(control => {
      control.inputEl.type = "number";
      control.inputEl.min = String(min);
      control.inputEl.max = String(max);
      control.setValue(String(this.draft[key])).onChange(value => {
        const number = Number(value);
        if (Number.isFinite(number) && number >= min && number <= max) this.draft[key] = number;
      });
      control.inputEl.onblur = () => { control.setValue(String(this.draft[key])); };
    });
  }

  private color(parent: HTMLElement, label: "VR_LIGHT_BG" | "VR_DARK_BG", key: "lightBackground" | "darkBackground"): void {
    const row = new Setting(parent).setName(t(label));
    const picker = row.controlEl.createEl("input", { type: "color", attr: { "aria-label": t(label) } });
    const base = (value: string) => /^#[a-f0-9]{6}(?:[a-f0-9]{2})?$/i.test(value) ? value.slice(0, 7) : "#ffffff";
    picker.value = base(this.draft[key]);
    row.addText(control => {
      control.setValue(this.draft[key]).setPlaceholder(t("VR_TRANSPARENT")).onChange(value => {
        this.draft[key] = value;
        picker.value = base(value);
      });
      picker.oninput = () => {
        const old = this.draft[key];
        const alpha = /^#[a-f0-9]{8}$/i.test(old) ? old.slice(7) : "";
        control.setValue(this.draft[key] = picker.value + alpha);
      };
    });
  }

  private renderRule(deck: HTMLElement, test: () => void): void {
    deck.empty();
    const definitions = this.draft.rules[this.kind];
    const index = this.pages[this.kind] = Math.min(this.pages[this.kind], Math.max(0, definitions.length - 1));
    const redraw = () => { this.renderRule(deck, test); test(); };
    const rule = definitions[index];
    if (rule) {
      const pager = deck.createDiv({ cls: "excalidraw-resource-settings-pager" });
      const prev = visualResourceButton(pager, "arrow-left", t("LUCIDE_PREVIOUS"));
      pager.createEl("strong", { text: t("VR_RULE_POSITION").replace("{CURRENT}", String(index + 1)).replace("{TOTAL}", String(definitions.length)) });
      const next = visualResourceButton(pager, "arrow-right", t("LUCIDE_NEXT"));
      prev.disabled = index === 0;
      next.disabled = index === definitions.length - 1;
      prev.onclick = () => { this.pages[this.kind]--; redraw(); };
      next.onclick = () => { this.pages[this.kind]++; redraw(); };
      const card = deck.createDiv({ cls: "excalidraw-resource-settings-card" });
      const header = card.createDiv({ cls: "excalidraw-resource-settings-card-header" });
      const name = header.createEl("input", { type: "text", value: rule.name, placeholder: t("VR_NAME"), attr: { "aria-label": t("VR_NAME") } });
      name.oninput = () => { rule.name = name.value; test(); };
      const remove = visualResourceButton(header, "trash-2", t("VR_DELETE"));
      setTooltip(remove, t("VR_DELETE"));
      remove.onclick = () => { definitions.splice(index, 1); redraw(); };
      type FieldKey = "pattern" | "folderPattern" | "extensions" | "maxKb" | "property" | "value";
      const field = (container: HTMLElement, key: FieldKey, label: Parameters<typeof t>[0], placeholder = "", type = "text") => {
        const wrapper = container.createEl("label");
        wrapper.createSpan({ text: t(label) });
        const input = wrapper.createEl("input", { type, value: rule[key] ?? "", placeholder });
        input.oninput = () => { rule[key] = input.value; test(); };
      };
      const grid = card.createDiv({ cls: "excalidraw-resource-settings-grid" });
      field(grid, "folderPattern", "VR_FOLDER_PATTERN");
      field(grid, "pattern", "VR_PATTERN", "(.+)");
      field(grid, "extensions", "VR_EXTENSIONS", "png, jpg, svg, md");
      field(grid, "maxKb", "VR_MAX_KB", t("VR_NO_LIMIT"), "number");
      const extra = card.createEl("details", { cls: "excalidraw-resource-settings-advanced" });
      extra.open = !!rule.property || !!rule.value || !!rule.frameType;
      extra.createEl("summary", { text: t("VR_RULE_ADVANCED") });
      const fields = extra.createDiv({ cls: "excalidraw-resource-settings-grid" });
      field(fields, "property", "VR_PROPERTY");
      field(fields, "value", "VR_PROPERTY_VALUE");
      if (this.kind === "frame") new Setting(extra).setName(t("VR_FRAME_TYPE")).addDropdown(control => control
        .addOption("", t("VR_ALL")).addOption("frame", t("VR_FRAME")).addOption("magicframe", t("VR_MARKER_FRAME"))
        .setValue(rule.frameType ?? "").onChange(value => {
          rule.frameType = value === "frame" || value === "magicframe" ? value : undefined;
          test();
        }));
    }
    const add = deck.createEl("button", { cls: "excalidraw-resource-settings-add", text: t("VR_ADD_RULE"), attr: { type: "button" } });
    add.onclick = () => {
      const stem = t("VR_RULE");
      let name = stem;
      for (let i = 2; definitions.some(item => item.name === name); i++) name = stem + " " + i;
      this.pages[this.kind] = definitions.push({ name, pattern: "(.+)" }) - 1;
      redraw();
      const input = deck.querySelector<HTMLInputElement>(".excalidraw-resource-settings-card-header input");
      input?.focus();
      input?.select();
    };
  }

  private test(status: HTMLElement, query: string): void {
    const match = compileVisualRules(this.kind, this.draft.rules[this.kind]);
    const results: string[] = [];
    for (const file of this.app.vault.getFiles()) {
      if (query && !file.path.toLowerCase().includes(query.trim().toLowerCase())) continue;
      const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
      const frames: unknown = frontmatter?.["excalidraw-anchors"];
      const names = this.kind === "frame" ? Array.isArray(frames) ? frames.filter(name => typeof name === "string") : [] : [""];
      for (const name of names) {
        const rules = match({
          path: file.path, basename: file.basename, folder: file.parent?.path ?? "", size: file.stat.size,
          extension: file.extension.toLowerCase(), drawing: this.plugin.isExcalidrawFile(file), image: false,
          properties: frontmatter, frame: name ? { name } : undefined,
        });
        if (rules.length) results.push(file.path + " · " + rules.map(rule => rule.keyword).join(", "));
      }
      if (results.length >= 25) break;
    }
    status.empty();
    if (!results.length) status.setText(t("VR_EMPTY"));
    else for (const result of results.slice(0, 25)) status.createDiv({ text: result });
  }
}
