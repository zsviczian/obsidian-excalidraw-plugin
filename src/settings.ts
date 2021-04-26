import {
  App, 
  PluginSettingTab, 
  Setting
} from 'obsidian';
import type ExcalidrawPlugin from "./main";

export interface ExcalidrawSettings {
  folder: string,
  templateFilePath: string,
  width: string,
  exportWithTheme: boolean,
  exportWithBackground: boolean,
  autoexportSVG: boolean,
  keepInSync: boolean,
  library: string,
}

export const DEFAULT_SETTINGS: ExcalidrawSettings = {
  folder: 'Excalidraw',
  templateFilePath: 'Excalidraw/Template.excalidraw',
  width: '400',
  exportWithTheme: true,
  exportWithBackground: true,
  autoexportSVG: false,
  keepInSync: false,
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
    .setName('Excalidraw folder') 
    .setDesc('Default location for your Excalidraw drawings. Leaving this empty means drawings will be created in the Vault root.')
    .addText(text => text
      .setPlaceholder('Excalidraw')
      .setValue(this.plugin.settings.folder)
      .onChange(async (value) => {
        this.plugin.settings.folder = value;
        await this.plugin.saveSettings();
      }));

    new Setting(containerEl)
      .setName('Excalidraw template file') 
      .setDesc('Full path to file containing the file you want to use as the template for new Excalidraw drawings. '+
               'Note that Excalidraw files will have an extension of ".excalidraw" ' +
               'Assuming your template is in the default excalidraw folder, the setting would be: excalidraw/Template.excalidraw')
      .addText(text => text
        .setPlaceholder('Excalidraw/Template.excalidraw')
        .setValue(this.plugin.settings.templateFilePath)
        .onChange(async (value) => {
          this.plugin.settings.templateFilePath = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Default width of embedded image') 
      .setDesc('The default width of an embedded drawing. You can specify a different ' +
               'width when embedding an image using the [[drawing.excalidraw|100]] or ' +
               '[[drawing.excalidraw|100x100]] format.')
      .addText(text => text
        .setPlaceholder('400')
        .setValue(this.plugin.settings.width)
        .onChange(async (value) => {
          this.plugin.settings.width = value;
          await this.plugin.saveSettings();
        }));

    

    this.containerEl.createEl('h1', {text: 'Embedded image settings'});

    new Setting(containerEl)
      .setName('Export image with background') 
      .setDesc('If turned of the exported image will be transparent.')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.exportWithBackground)
        .onChange(async (value) => {
          this.plugin.settings.exportWithBackground = value;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('Export image with theme') 
      .setDesc('Export the image matching the dark/light theme setting used for your drawing in Excalidraw')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.exportWithTheme)
        .onChange(async (value) => {
          this.plugin.settings.exportWithTheme = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Auto export SVG') 
      .setDesc('Automatically create an SVG export of your drawing matching the title of your .excalidraw file, saved in the same folder. '+
               'You can use this file ("my drawing.svg") to embed into documents in a platform independent way. ' +
               'The file will get updated every time you edit the excalidraw drawing.')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.autoexportSVG)
        .onChange(async (value) => {
          this.plugin.settings.autoexportSVG = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Keep .svg filename in sync with the .excalidraw filename') 
      .setDesc('Automaticaly update the .svg filename when .excalidraw file in the same folder is renamed. ' +
               'Automatically delete the .svg file when the .excalidraw file in the same folder is deleted. ')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.keepInSync)
        .onChange(async (value) => {
          this.plugin.settings.keepInSync = value;
          await this.plugin.saveSettings();
        }));

  }
}