import { Modal, Notice, Setting } from "obsidian";
import type ExcalidrawPlugin from "src/core/main";
import { t } from "src/lang/helpers";
import type { VisualDiscoveryRule } from "src/types/visualResourceTypes";
import { compileVisualRules } from "./visualResourceModel";

const RULE_KINDS = [["icon", "VR_ICON"], ["drawing", "VR_DRAWING"], ["frame", "VR_FRAME"]] as const;
type RuleKind = typeof RULE_KINDS[number][0];

/** Edit named discovery blocks and test them against the vault's current metadata. */
export class VisualResourceSettings extends Modal {
  private draft: ExcalidrawPlugin["settings"]["visualResources"];
  private kind: RuleKind = "icon";

  constructor(private readonly plugin: ExcalidrawPlugin, private readonly changed: () => void, scriptName?: string) {
    super(plugin.app);
    const old = plugin.visualResources.iconSettings(scriptName);
    this.draft = {
      iconWidth: old.iconWidth, thumbnailSize: old.thumbnailSize,
      lightBackground: old.lightBackground, darkBackground: old.darkBackground, excludeFolders: old.exclusion,
      ...plugin.settings.visualResources, rules: structuredClone(plugin.visualResources.rules(scriptName)),
    };
  }

  /** Render the settings in the owning Obsidian modal. */
  public onOpen(): void {
    this.setTitle(t("VR_SETTINGS"));
    this.render();
  }

  private render(): void {
    this.contentEl.empty();
    const definitions = this.draft.rules[this.kind];
    new Setting(this.contentEl).setName(t("VR_DISCOVERY")).addDropdown(dropdown => {
      for (const [kind, name] of RULE_KINDS) dropdown.addOption(kind, t(name));
      dropdown.setValue(this.kind).onChange(kind => { this.kind = kind as RuleKind; this.render(); });
    }).addButton(button => button.setButtonText(t("VR_ADD_RULE")).onClick(() => {
      definitions.push({ name: t("VR_RULE"), pattern: "(.+)" });
      this.render();
    }));
    for (const [index, definition] of definitions.entries()) this.rule(definition, index);
    const status = this.contentEl.createDiv({ attr: { "aria-live": "polite" } });
    new Setting(this.contentEl)
      .addButton(button => button.setButtonText(t("VR_TEST")).onClick(() => this.test(status)))
      .addButton(button => button.setButtonText(t("VR_COPY_PROMPT")).onClick(() => {
        void this.contentEl.ownerDocument.defaultView.navigator.clipboard.writeText(t("VR_PROMPT"))
          .catch(() => new Notice(t("VR_ACTION_FAILED")));
      }));
    new Setting(this.contentEl).setName(t("VR_EXCLUSIONS")).addTextArea(text =>
      text.setValue(this.draft.excludeFolders).onChange(value => { this.draft.excludeFolders = value; }));
    this.number("VR_ICON_WIDTH", "iconWidth", 20, 2000);
    this.number("VR_THUMB_SIZE", "thumbnailSize", 64, 240);
    new Setting(this.contentEl).setName(t("VR_LIGHT_BG")).addText(text =>
      text.setValue(this.draft.lightBackground).onChange(value => { this.draft.lightBackground = value; }));
    new Setting(this.contentEl).setName(t("VR_DARK_BG")).addText(text =>
      text.setValue(this.draft.darkBackground).onChange(value => { this.draft.darkBackground = value; }));
    new Setting(this.contentEl).addButton(button => button.setCta().setButtonText(t("VR_SAVE")).onClick(async () => {
      try {
        for (const rule of Object.values(this.draft.rules).flat()) {
          if (!rule.name.trim()) throw Error("Missing discovery rule name");
          new RegExp(rule.pattern);
          if (rule.folderPattern) new RegExp(rule.folderPattern);
        }
        const { rules, iconWidth, thumbnailSize, lightBackground, darkBackground, excludeFolders } = this.draft;
        this.plugin.settings.visualResources = {
          ...this.plugin.settings.visualResources, rules, iconWidth, thumbnailSize, lightBackground, darkBackground, excludeFolders,
        };
        await this.plugin.saveSettings();
        this.changed();
        this.close();
      } catch { new Notice(t("VR_RULE_ERROR")); }
    }));
  }

  private number(label: "VR_ICON_WIDTH" | "VR_THUMB_SIZE", key: "iconWidth" | "thumbnailSize", min: number, max: number): void {
    new Setting(this.contentEl).setName(t(label)).addSlider(slider => slider.setLimits(min, max, 1)
      .setValue(this.draft[key]).setDynamicTooltip().onChange(value => { this.draft[key] = value; }));
  }

  private rule(definition: VisualDiscoveryRule, index: number): void {
    const details = this.contentEl.createEl("details", { attr: { open: index === this.draft.rules[this.kind].length - 1 ? "open" : null } });
    details.createEl("summary", { text: definition.name });
    const fields = [
      ["name", "VR_NAME"], ["pattern", "VR_PATTERN"], ["folderPattern", "VR_FOLDER_PATTERN"],
      ["extensions", "VR_EXTENSIONS"], ["maxKb", "VR_MAX_KB"], ["property", "VR_PROPERTY"], ["value", "VR_PROPERTY_VALUE"],
    ] as const;
    for (const [key, label] of fields) new Setting(details).setName(t(label)).addText(text =>
      text.setValue(definition[key] ?? "").onChange(value => { definition[key] = value; }));
    if (this.kind === "frame") new Setting(details).setName(t("VR_FRAME_TYPE")).addDropdown(dropdown => dropdown
      .addOption("", t("VR_ALL")).addOption("frame", t("VR_FRAME")).addOption("magicframe", t("VR_MARKER_FRAME"))
      .setValue(definition.frameType ?? "").onChange(value => {
        definition.frameType = value === "frame" || value === "magicframe" ? value : undefined;
      }));
    new Setting(details).addButton(button => button.setWarning().setButtonText(t("VR_DELETE")).onClick(() => {
      this.draft.rules[this.kind].splice(index, 1);
      this.render();
    }));
  }

  private test(status: HTMLElement): void {
    const match = compileVisualRules(this.kind, this.draft.rules[this.kind]);
    const results: string[] = [];
    for (const file of this.app.vault.getFiles()) {
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
