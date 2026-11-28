import { Modal, Notice, Setting } from "obsidian";
import type ExcalidrawPlugin from "src/core/main";
import { t } from "src/lang/helpers";
import { getKplexPublicRead, isPublicRecord } from "src/utils/kplexPublicApi";
import { setElementHidden } from "src/utils/htmlUtils";

const DEFAULT_PROPERTY = "excalidraw-svg-sources";
const directions = { parent: "VR_REL_PARENT", child: "VR_REL_CHILD", left: "VR_REL_LEFT", right: "VR_REL_RIGHT",
  previous: "LUCIDE_PREVIOUS", next: "LUCIDE_NEXT" } as const;
type Direction = keyof typeof directions;

function ontologyFields(owner: Window): { name: string; roles: Direction[] }[] {
  try {
    const operation = getKplexPublicRead(owner, "ontology");
    if (!operation) return [];
    const result: unknown = operation.read.call(operation.api, { includeDiscovered: false, limit: 2048 });
    if (!isPublicRecord(result) || result.ok !== true || !isPublicRecord(result.value) ||
        !Array.isArray(result.value.fields) || result.value.fields.length > 2048) return [];
    return result.value.fields.flatMap(field => {
      if (!isPublicRecord(field) || field.configured !== true || typeof field.name !== "string" ||
          !field.name || field.name.length > 1024 || !Array.isArray(field.roles)) return [];
      const offeredRoles: readonly unknown[] = field.roles;
      const roles = Object.keys(directions).filter((role): role is Direction => offeredRoles.includes(role));
      return roles.length ? [{ name: field.name, roles }] : [];
    });
  } catch { return []; }
}

/** Choose the source relationship as part of stroke insertion, or edit its default anywhere. */
export class SvgStrokeOptions extends Modal {
  constructor(private readonly plugin: ExcalidrawPlugin, private readonly insert?: (property: string | false) => void) {
    super(plugin.app);
  }

  public onOpen(): void {
    this.setTitle(t(this.insert ? "VR_INSERT_STROKES" : "VR_SVG_OPTIONS"));
    const preferences = this.plugin.settings.visualResources;
    let enabled = !!preferences.linkSvgSource;
    let property = preferences.svgSourceProperty || DEFAULT_PROPERTY;
    const fields = ontologyFields(this.contentEl.ownerDocument.defaultView);
    const link = new Setting(this.contentEl).setName(t("VR_SVG_RETAIN_LINK"));
    const fieldsRoot = this.contentEl.createDiv();
    link.addToggle(toggle => toggle.setValue(enabled).onChange(value => {
      enabled = value;
      setElementHidden(fieldsRoot, !enabled);
    }));
    setElementHidden(fieldsRoot, !enabled);
    let propertyInput: HTMLInputElement;
    new Setting(fieldsRoot).setName(t("VR_SVG_PROPERTY")).addText(input => {
      propertyInput = input.setValue(property).onChange(value => { property = value; }).inputEl;
      propertyInput.maxLength = 1024;
    });
    if (fields.length) {
      const available = Object.keys(directions).filter((role): role is Direction => fields.some(field => field.roles.includes(role as Direction)));
      let direction = fields.find(field => field.name === property)?.roles[0] ?? available[0];
      let options: HTMLSelectElement;
      const update = () => {
        options.empty();
        options.createEl("option", { value: "", text: t("VR_KPLEX_CHOOSE") });
        for (const field of fields.filter(item => item.roles.includes(direction))) options.createEl("option", { value: field.name, text: field.name });
        options.value = [...options.options].some(option => option.value === property) ? property : "";
      };
      const picker = fieldsRoot.createDiv();
      new Setting(picker).setName(t("VR_KPLEX_DIRECTION")).addDropdown(control => {
        for (const role of available) control.addOption(role, t(directions[role]));
        control.setValue(direction).onChange(value => { direction = value as Direction; update(); });
      });
      new Setting(picker).setName(t("VR_KPLEX_FIELD")).addDropdown(control => {
        options = control.selectEl;
        control.onChange(value => {
          if (value) propertyInput.value = property = value;
        });
      });
      update();
    }
    new Setting(this.contentEl).addButton(button => button.setCta()
      .setButtonText(t(this.insert ? "VR_INSERT_STROKES" : "VR_SAVE")).onClick(async () => {
        const field = property.trim() || DEFAULT_PROPERTY;
        preferences.linkSvgSource = enabled;
        preferences.svgSourceProperty = field;
        button.setDisabled(true);
        try {
          await this.plugin.saveSettings();
          if (!this.contentEl.isConnected) return;
          this.close();
          this.insert?.(enabled ? field : false);
        } catch {
          new Notice(t("VR_ACTION_FAILED"));
          button.setDisabled(false);
        }
      }));
  }
}
