import {
  App, 
  PluginSettingTab, 
  Setting,
  TFile
} from 'obsidian';
import { VIEW_TYPE_EXCALIDRAW } from './constants';
import ExcalidrawView from './ExcalidrawView';
import { t } from './lang/helpers';
import type ExcalidrawPlugin from "./main";
import { splitFolderAndFilename } from './Utils';

export interface ExcalidrawSettings {
  folder: string,
  templateFilePath: string,
  drawingFilenamePrefix: string,
  drawingFilenameDateTime: string,
  width: string,
  showLinkBrackets: boolean,
  linkPrefix: string,
  //autosave: boolean;
  allowCtrlClick: boolean, //if disabled only the link button in the view header will open links 
  exportWithTheme: boolean,
  exportWithBackground: boolean,
  keepInSync: boolean,
  autoexportSVG: boolean,
  autoexportPNG: boolean,
  autoexportExcalidraw: boolean,
  syncExcalidraw: boolean,
  compatibilityMode: boolean,
  experimentalFileType: boolean,
  experimentalFileTag: string,
  loadCount: number, //version 1.2 migration counter
  drawingOpenCount: number,
  library: string,
}

export const DEFAULT_SETTINGS: ExcalidrawSettings = {
  folder: 'Excalidraw',
  templateFilePath: 'Excalidraw/Template.excalidraw',
  drawingFilenamePrefix: 'Drawing ',
  drawingFilenameDateTime: 'YYYY-MM-DD HH.mm.ss',
  width: '400',
  linkPrefix: "🔸",
  showLinkBrackets: true,
  //autosave: false,
  allowCtrlClick: true,
  exportWithTheme: true,
  exportWithBackground: true,
  keepInSync: false,
  autoexportSVG: false,
  autoexportPNG: false,
  autoexportExcalidraw: false,
  syncExcalidraw: false,
  experimentalFileType: false,
  experimentalFileTag: "✏️",
  compatibilityMode: false,
  loadCount: 0,
  drawingOpenCount: 0,
  library: `{"type":"excalidrawlib","version":1,"library":[]}`,
}

export class ExcalidrawSettingTab extends PluginSettingTab {
  plugin: ExcalidrawPlugin;

  constructor(app: App, plugin: ExcalidrawPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    let {containerEl} = this;
    this.containerEl.empty();

    new Setting(containerEl)
    .setName(t("FOLDER_NAME")) 
    .setDesc(t("FOLDER_DESC"))
    .addText(text => text
      .setPlaceholder('Excalidraw')
      .setValue(this.plugin.settings.folder)
      .onChange(async (value) => {
        this.plugin.settings.folder = value;
        await this.plugin.saveSettings();
      }));

    new Setting(containerEl)
      .setName(t("TEMPLATE_NAME")) 
      .setDesc(t("TEMPLATE_DESC"))
      .addText(text => text
        .setPlaceholder('Excalidraw/Template')
        .setValue(this.plugin.settings.templateFilePath)
        .onChange(async (value) => {
          this.plugin.settings.templateFilePath = value;
          await this.plugin.saveSettings();
        }));

/*    new Setting(containerEl)
      .setName(t("AUTOSAVE_NAME")) 
      .setDesc(t("AUTOSAVE_DESC"))
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.autosave)
        .onChange(async (value) => {
          this.plugin.settings.autosave = value;
          await this.plugin.saveSettings();
          const exs = this.plugin.app.workspace.getLeavesOfType(VIEW_TYPE_EXCALIDRAW);
          for(const v of exs) {
            if(v.view instanceof ExcalidrawView) {
              if(v.view.autosaveTimer) {
                clearInterval(v.view.autosaveTimer)
                v.view.autosaveTimer = null;
              }
              if(value) { 
                v.view.setupAutosaveTimer();
              }
            }
          }          
        }));*/

    this.containerEl.createEl('h1', {text: t("FILENAME_HEAD")});
    containerEl.createDiv('',(el) => {
      el.innerHTML = t("FILENAME_DESC");

    });

    const getFilenameSample = () => {
      return t("FILENAME_SAMPLE") + 
             this.plugin.settings.drawingFilenamePrefix + 
            window.moment().format(this.plugin.settings.drawingFilenameDateTime) + '</b>';
    };

    const filenameEl = containerEl.createEl('p',{text: ''});
    filenameEl.innerHTML = getFilenameSample();
    
    new Setting(containerEl)
      .setName(t("FILENAME_PREFIX_NAME")) 
      .setDesc(t("FILENAME_PREFIX_DESC"))
      .addText(text => text
        .setPlaceholder('Drawing ')
        .setValue(this.plugin.settings.drawingFilenamePrefix)
        .onChange(async (value) => {
          this.plugin.settings.drawingFilenamePrefix = value.replaceAll(/[<>:"/\\|?*]/g,'_');
          text.setValue(this.plugin.settings.drawingFilenamePrefix);
          filenameEl.innerHTML = getFilenameSample();
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName(t("FILENAME_DATE_NAME")) 
      .setDesc(t("FILENAME_DATE_DESC"))
      .addText(text => text
        .setPlaceholder('YYYY-MM-DD HH.mm.ss')
        .setValue(this.plugin.settings.drawingFilenameDateTime)
        .onChange(async (value) => {
          this.plugin.settings.drawingFilenameDateTime = value.replaceAll(/[<>:"/\\|?*]/g,'_');
          text.setValue(this.plugin.settings.drawingFilenameDateTime);
          filenameEl.innerHTML = getFilenameSample();
          await this.plugin.saveSettings();
        }));

    this.containerEl.createEl('h1', {text: t("LINKS_HEAD")});
    this.containerEl.createEl('p',{
      text: t("LINKS_DESC")});
    
    const reloadDrawings = async () => {
      const exs = this.plugin.app.workspace.getLeavesOfType(VIEW_TYPE_EXCALIDRAW);
      for(const v of exs) {
        if(v.view instanceof ExcalidrawView) {
          await v.view.save(false);
          v.view.reload(true);
        }
      }
      this.plugin.triggerEmbedUpdates();
    }

    new Setting(containerEl)
      .setName(t("LINK_BRACKETS_NAME")) 
      .setDesc(t("LINK_BRACKETS_DESC"))
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.showLinkBrackets)
        .onChange(async (value) => {
          this.plugin.settings.showLinkBrackets = value;
          await this.plugin.saveSettings();
          reloadDrawings();
        }));
    
    new Setting(containerEl)
      .setName(t("LINK_PREFIX_NAME"))
      .setDesc(t("LINK_PREFIX_DESC"))
      .addText(text => text
        .setPlaceholder('🔸')
        .setValue(this.plugin.settings.linkPrefix)
        .onChange(async (value) => {
          this.plugin.settings.linkPrefix = value;
          await this.plugin.saveSettings();
          reloadDrawings();
        }));

    new Setting(containerEl)
      .setName(t("LINK_CTRL_CLICK_NAME")) 
      .setDesc(t("LINK_CTRL_CLICK_DESC"))
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.allowCtrlClick)
        .onChange(async (value) => {
          this.plugin.settings.allowCtrlClick = value;
          await this.plugin.saveSettings();
        }));

    this.containerEl.createEl('h1', {text: t("EMBED_HEAD")});

    new Setting(containerEl)
      .setName(t("EMBED_WIDTH_NAME")) 
      .setDesc(t("EMBED_WIDTH_DESC"))
      .addText(text => text
        .setPlaceholder('400')
        .setValue(this.plugin.settings.width)
        .onChange(async (value) => {
          this.plugin.settings.width = value;
          await this.plugin.saveSettings();
          this.plugin.triggerEmbedUpdates();
        }));

    new Setting(containerEl)
      .setName(t("EXPORT_BACKGROUND_NAME")) 
      .setDesc(t("EXPORT_BACKGROUND_DESC"))
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.exportWithBackground)
        .onChange(async (value) => {
          this.plugin.settings.exportWithBackground = value;
          await this.plugin.saveSettings();
          this.plugin.triggerEmbedUpdates();
        }));
    
    new Setting(containerEl)
      .setName(t("EXPORT_THEME_NAME")) 
      .setDesc(t("EXPORT_THEME_DESC"))
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.exportWithTheme)
        .onChange(async (value) => {
          this.plugin.settings.exportWithTheme = value;
          await this.plugin.saveSettings();
          this.plugin.triggerEmbedUpdates();
        }));
    
    this.containerEl.createEl('h1', {text: t("EXPORT_HEAD")});
    
    new Setting(containerEl)
      .setName(t("EXPORT_SYNC_NAME")) 
      .setDesc(t("EXPORT_SYNC_DESC"))
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.keepInSync)
        .onChange(async (value) => {
          this.plugin.settings.keepInSync = value;
          await this.plugin.saveSettings();
        }));
        
    new Setting(containerEl)
      .setName(t("EXPORT_SVG_NAME")) 
      .setDesc(t("EXPORT_SVG_DESC"))
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.autoexportSVG)
        .onChange(async (value) => {
          this.plugin.settings.autoexportSVG = value;
          await this.plugin.saveSettings();
        }));

        
    new Setting(containerEl)
    .setName(t("EXPORT_PNG_NAME")) 
    .setDesc(t("EXPORT_PNG_DESC"))
    .addToggle(toggle => toggle
      .setValue(this.plugin.settings.autoexportPNG)
      .onChange(async (value) => {
        this.plugin.settings.autoexportPNG = value;
        await this.plugin.saveSettings();
      }));
         
    this.containerEl.createEl('h1', {text: t("COMPATIBILITY_HEAD")});

    new Setting(containerEl)
    .setName(t("COMPATIBILITY_MODE_NAME")) 
    .setDesc(t("COMPATIBILITY_MODE_DESC"))
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.compatibilityMode)
        .onChange(async (value) => {
          this.plugin.settings.compatibilityMode = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
    .setName(t("EXPORT_EXCALIDRAW_NAME")) 
    .setDesc(t("EXPORT_EXCALIDRAW_DESC"))
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.autoexportExcalidraw)
        .onChange(async (value) => {
          this.plugin.settings.autoexportExcalidraw = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName(t("SYNC_EXCALIDRAW_NAME")) 
      .setDesc(t("SYNC_EXCALIDRAW_DESC"))
        .addToggle(toggle => toggle
          .setValue(this.plugin.settings.syncExcalidraw)
          .onChange(async (value) => {
            this.plugin.settings.syncExcalidraw = value;
            await this.plugin.saveSettings();
          }));

    this.containerEl.createEl('h1', {text: t("EXPERIMENTAL_HEAD")});
    this.containerEl.createEl('p', {text: t("EXPERIMENTAL_DESC")});

    new Setting(containerEl)
    .setName(t("FILETYPE_NAME")) 
    .setDesc(t("FILETYPE_DESC"))
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.experimentalFileType)
        .onChange(async (value) => {
          this.plugin.settings.experimentalFileType = value;
          this.plugin.experimentalFileTypeDisplayToggle(value);
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
    .setName(t("FILETAG_NAME")) 
    .setDesc(t("FILETAG_DESC"))
    .addText(text => text
      .setPlaceholder('✏️')
      .setValue(this.plugin.settings.experimentalFileTag)
      .onChange(async (value) => {
        this.plugin.settings.experimentalFileTag = value;
        await this.plugin.saveSettings();
      }));    
  }
}