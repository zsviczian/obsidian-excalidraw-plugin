import { Component, Modal, Setting } from "obsidian";
import type ExcalidrawPlugin from "src/core/main";
import { navigateToSettingsPage } from "src/core/settings/settingsNavigation";
import { t } from "src/lang/helpers";
import type { VisualResource } from "src/types/visualResourceTypes";
import type { LibraryItem } from "@zsviczian/excalidraw/types/excalidraw/types";
import { setElementHidden } from "src/utils/htmlUtils";
import { VisualResourceGallery, visualResourceButton } from "../visualResources/VisualResourceGallery";
import { filterVisualResources } from "../visualResources/visualResourceModel";

export type FrameworkChoice = { kind: "framework"; item: LibraryItem } | { kind: "blank" } | { kind: "cancel" };
const SNOOZE = 7 * 24 * 60 * 60 * 1000;

/** Centered new-drawing chooser. The result is settled before any file or leaf is created. */
export class ThinkingFrameworksPicker extends Modal {
  public readonly result: Promise<FrameworkChoice>;
  private finish: (choice: FrameworkChoice) => void;
  private readonly lifetime = new Component();
  private openPicker = false;

  constructor(private readonly plugin: ExcalidrawPlugin) {
    super(plugin.app);
    this.result = new Promise(resolve => { this.finish = resolve; });
  }

  /** Render the same local resource gallery with blank and snooze actions. */
  public onOpen(): void {
    const service = this.plugin.visualResources;
    const catalog = service.frameworks;
    this.openPicker = true;
    this.lifetime.load();
    this.setTitle(t("VR_FRAMEWORKS"));
    const root = this.contentEl.createDiv({ cls: "excalidraw-framework-picker" });
    const toolbar = root.createDiv({ cls: "excalidraw-resource-toolbar" });
    const search = toolbar.createEl("input", { type: "search", placeholder: t("VR_SEARCH"), attr: { "aria-label": t("VR_SEARCH") } });
    const update = visualResourceButton(toolbar, "download", t("VR_UPDATE_FRAMEWORK"));
    setElementHidden(update, true);
    const settings = visualResourceButton(toolbar, "settings", t("VR_SETTINGS"));
    settings.onclick = () => {
      this.plugin.app.setting.open();
      if (!navigateToSettingsPage(this.plugin.app, this.plugin.manifest.id, [t("BASIC_HEAD"), t("BASIC_FILES_FOLDERS_HEAD")])) {
        this.plugin.app.setting.openTabById(this.plugin.manifest.id);
      }
    };
    const actions = root.createDiv({ cls: "excalidraw-framework-actions" });
    const download = actions.createEl("button", { text: t("VR_DOWNLOAD_FRAMEWORK"), attr: { type: "button" } });
    setElementHidden(download, true);
    const blank = actions.createEl("button", { text: t("PROMPT_BLANK_DRAWING"), cls: "mod-cta", attr: { type: "button" } });
    blank.onclick = () => this.choose({ kind: "blank" });
    const later = actions.createEl("button", { text: t("VR_SHOW_LATER"), attr: { type: "button" } });
    later.onclick = () => {
      this.plugin.settings.frameworksSnoozedUntil = Date.now() + SNOOZE;
      void this.plugin.saveSettings();
      this.choose({ kind: "blank" });
    };
    let resources: VisualResource[] = [];
    const gallery = this.lifetime.addChild(new VisualResourceGallery(root, service, {
      activate: resource => {
        void service.libraryItem(resource.locator).then(item => {
          if (!this.openPicker || !item) return;
          this.choose({ kind: "framework", item });
        }).catch(() => catalog.notifyFailure());
      },
      favorite: resource => {
        const record = service.collections.state(resource.locator);
        void service.collections.curate([resource.locator], { favorite: !record.favorite }).catch(() => catalog.notifyFailure());
      },
    }));
    const redraw = () => {
      if (this.openPicker) gallery.show(filterVisualResources(resources, search.value, ["framework"]));
    };
    const load = async () => {
      const local = await catalog.list();
      if (!this.openPicker) return;
      resources = local.map(({ path, item }): VisualResource => ({
        locator: { provider: "framework", path, id: item.id }, kind: "framework",
        title: item.name, source: path, keywords: [],
      }));
      setElementHidden(download, !!resources.length);
      redraw();
    };
    const install = async () => {
      update.disabled = download.disabled = true;
      try { await catalog.install(); await load(); setElementHidden(update, !(await catalog.updates()).length); }
      catch { if (this.openPicker) catalog.notifyFailure(); }
      finally { update.disabled = download.disabled = false; }
    };
    update.onclick = download.onclick = () => { void install(); };
    search.oninput = redraw;
    search.onkeydown = event => { if (event.key === "ArrowDown") { event.preventDefault(); gallery.focusFirst(); } };
    new Setting(root).setName(t("VR_DONT_SHOW")).addToggle(toggle => toggle
      .setValue(!this.plugin.settings.frameworksOnBlank).onChange(value => {
        this.plugin.settings.frameworksOnBlank = !value;
        this.plugin.settings.frameworksSnoozedUntil = 0;
        void this.plugin.saveSettings();
      }));
    this.lifetime.register(service.collections.subscribe(redraw));
    void service.collections.refresh().catch(() => {});
    void load().catch(() => catalog.notifyFailure());
    void catalog.updates().then(updates => {
      if (this.openPicker) setElementHidden(update, !updates.length);
    }).catch(() => {});
  }

  private choose(choice: FrameworkChoice): void {
    this.finish(choice);
    this.close();
  }

  /** Dismissing the picker is an explicit cancellation. */
  public onClose(): void {
    this.openPicker = false;
    this.finish({ kind: "cancel" });
    this.lifetime.unload();
    this.contentEl.empty();
  }
}
