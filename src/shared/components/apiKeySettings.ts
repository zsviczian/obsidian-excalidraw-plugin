import { App, Setting } from "obsidian";
import { t } from "src/lang/helpers";
import type { APIKeyStorage } from "src/utils/apiKeyStorage";
import { hideElement, showElement } from "src/utils/styleUtils";

/** Renders the same explicit credential choice for provider profiles and OCR. */
export function renderAPIKeySettings(
  app: App,
  container: HTMLElement,
  config: APIKeyStorage,
  onChange: () => void,
  labels: { name: string; description: string | DocumentFragment },
): { refresh: () => void } {
  const source = new Setting(container)
    .setName(t("API_KEY_SOURCE_NAME"))
    .setDesc(t("API_KEY_SOURCE_DESC"));
  const manual = new Setting(container).setName(labels.name).setDesc(labels.description);
  const secret = new Setting(container).setName(t("API_KEY_SECRET_NAME")).setDesc(t("API_KEY_SECRET_DESC"));
  let refresh = () => {};
  let updateManual = () => {};
  source.addDropdown((dropdown) => {
    dropdown.addOption("settings", t("API_KEY_SOURCE_SETTINGS"));
    // Preserve an unavailable selection on older hosts; never silently change its source.
    if (app.secretStorage || config.apiKeySource === "secret") dropdown.addOption("secret", t("API_KEY_SOURCE_SECRET"));
    dropdown.setValue(config.apiKeySource ?? "settings").onChange((value) => {
      config.apiKeySource = value === "secret" ? "secret" : "settings";
      if (config.apiKeySource === "secret") config.apiKey = "";
      updateManual();
      refresh();
      onChange();
    });
  });
  manual.addText((text) => {
    text.inputEl.type = "password";
    text.inputEl.autocomplete = "off";
    text.inputEl.spellcheck = false;
    text.inputEl.addEventListener("focus", () => { text.inputEl.type = "text"; });
    text.inputEl.addEventListener("blur", () => { text.inputEl.type = "password"; });
    updateManual = () => { text.setValue(config.apiKey); };
    updateManual();
    text.onChange((value) => { config.apiKey = value; onChange(); });
  });
  secret.addDropdown((dropdown) => {
    dropdown.addOption("", t("API_KEY_SECRET_SELECT"));
    const ids = app.secretStorage?.listSecrets() ?? [];
    if (config.apiKeySecret && !ids.includes(config.apiKeySecret)) ids.push(config.apiKeySecret);
    ids.forEach((id) => { void dropdown.addOption(id, id); });
    dropdown.setValue(config.apiKeySecret ?? "").setDisabled(!app.secretStorage).onChange((value) => {
      config.apiKeySecret = value;
      onChange();
    });
  });
  refresh = () => {
    if (config.apiKeySource === "secret") { hideElement(manual.settingEl); showElement(secret.settingEl); }
    else { showElement(manual.settingEl); hideElement(secret.settingEl); }
  };
  refresh();
  return { refresh: () => { updateManual(); refresh(); } };
}
