import {
  App, 
  parseFrontMatterAliases, 
  PluginSettingTab, 
  Setting
} from 'obsidian';
import type ExcalidrawPlugin from "./main";

export interface ExcalidrawSettings {
  folder: string,
  templateFilePath: string,
  width: string,
  ribbonInNewPane: boolean,
  exportWithTheme: boolean,
  exportWithBackground: boolean,
  autoexportSVG: boolean,
  autoexportPNG: boolean,
  keepInSync: boolean,
  library: string,
}

export const DEFAULT_SETTINGS: ExcalidrawSettings = {
  folder: 'Excalidraw',
  templateFilePath: 'Excalidraw/Template.excalidraw',
  width: '400',
  ribbonInNewPane: false,
  exportWithTheme: true,
  exportWithBackground: true,
  autoexportSVG: false,
  autoexportPNG: false,
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
               'Note that Excalidraw files will have the extension ".excalidraw". ' +
               'Assuming your template is in the default Excalidraw folder, the setting would be: Excalidraw/Template.excalidraw')
      .addText(text => text
        .setPlaceholder('Excalidraw/Template.excalidraw')
        .setValue(this.plugin.settings.templateFilePath)
        .onChange(async (value) => {
          this.plugin.settings.templateFilePath = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Default width of embedded (transcluded) image') 
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

    new Setting(containerEl)
      .setName('Ribbon button to open Excalidraw in a new workspace pane by splitting active pane') 
      .setDesc('If set, pressing the ribbon button will create a new drawing in a new pane by splitting the active pane. ' +
               'If not set, pressing the button will create a new drawing in the currently active pane.')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.ribbonInNewPane)
        .onChange(async (value) => {
          this.plugin.settings.ribbonInNewPane = value;
          await this.plugin.saveSettings();
        }));
  
    

    this.containerEl.createEl('h1', {text: 'Embedded image settings'});

    new Setting(containerEl)
      .setName('Export image with background') 
      .setDesc('If turned off, the exported image will be transparent.')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.exportWithBackground)
        .onChange(async (value) => {
          this.plugin.settings.exportWithBackground = value;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('Export image with theme') 
      .setDesc('Export the image matching the dark/light theme setting used for your drawing in Excalidraw. If turned off, ' +
               'drawings created in drak mode will appear as they would in light mode.')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.exportWithTheme)
        .onChange(async (value) => {
          this.plugin.settings.exportWithTheme = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Auto-export SVG') 
      .setDesc('Automatically create an SVG export of your drawing matching the title of your "my drawing.excalidraw" file. ' + 
               'The plugin will save the .SVG file in the same folder as the drawing. '+
               'You can use this file ("my drawing.svg") to embed your drawing into documents in a platform independent way. ' +
               'While the auto export switch is on, this file will get updated every time you edit the excalidraw drawing with the matching name.')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.autoexportSVG)
        .onChange(async (value) => {
          this.plugin.settings.autoexportSVG = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Auto-export PNG') 
      .setDesc('Same as the auto-export SVG, but for PNG.')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.autoexportPNG)
        .onChange(async (value) => {
          this.plugin.settings.autoexportPNG = value;
          await this.plugin.saveSettings();
        }));
  

    new Setting(containerEl)
      .setName('Keep the .SVG and/or .PNG filenames in sync with the .excalidraw file') 
      .setDesc('When turned on, the plugin will automaticaly update the filename of the .SVG and/or .PNG files when the .excalidraw file in the same folder (and same name) is renamed. ' +
               'The plugin will also automatically delete the .SVG and/or .PNG files when the .excalidraw file in the same folder (and same name) is deleted. ')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.keepInSync)
        .onChange(async (value) => {
          this.plugin.settings.keepInSync = value;
          await this.plugin.saveSettings();
        }));

  }
}