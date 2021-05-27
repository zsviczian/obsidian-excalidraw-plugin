import {
  App, 
  parseFrontMatterAliases, 
  PluginSettingTab, 
  Setting
} from 'obsidian';
import { EXCALIDRAW_FILE_EXTENSION } from './constants';
import type ExcalidrawPlugin from "./main";

export interface ExcalidrawSettings {
  folder: string,
  templateFilePath: string,
  drawingFilenamePrefix: string,
  drawingFilenameDateTime: string,
  width: string,
  exportWithTheme: boolean,
  exportWithBackground: boolean,
  autoexportSVG: boolean,
  autoexportPNG: boolean,
  keepInSync: boolean,
  library: string,
  /*Excalidraw Sync Begin*/
  syncFolder: string,
  excalidrawSync: boolean,
  /*Excalidraw Sync End*/
}

export const DEFAULT_SETTINGS: ExcalidrawSettings = {
  folder: 'Excalidraw',
  templateFilePath: 'Excalidraw/Template.excalidraw',
  drawingFilenamePrefix: 'Drawing ',
  drawingFilenameDateTime: 'YYYY-MM-DD HH.mm.ss',
  width: '400',
  exportWithTheme: true,
  exportWithBackground: true,
  autoexportSVG: false,
  autoexportPNG: false,
  keepInSync: false,
  library: `{"type":"excalidrawlib","version":1,"library":[]}`,
  /*Excalidraw Sync Begin*/
  syncFolder: 'excalidraw_sync',
  excalidrawSync: false,
  /*Excalidraw Sync End*/
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
    .setName('Default width of embedded (transcluded) image') 
    .setDesc('The default width of an embedded drawing. You can specify a different ' +
             'width when embedding an image using the ![[drawing.excalidraw|100]] or ' +
             '[[drawing.excalidraw|100x100]] format.')
    .addText(text => text
      .setPlaceholder('400')
      .setValue(this.plugin.settings.width)
      .onChange(async (value) => {
        this.plugin.settings.width = value;
        await this.plugin.saveSettings();
        this.plugin.triggerEmbedUpdates();
      }));

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

    this.containerEl.createEl('h1', {text: 'New drawing filename'});
    containerEl.createDiv('',(el) => {
      el.innerHTML = '<p>The automatically generated filename consists of a prefix and a date. ' + 
                     'e.g."Drawing 2021-05-24 12.58.07".</p>'+
                     '<p>Click this link for the <a href="https://momentjs.com/docs/#/displaying/format/">'+
                     'date and time format reference</a>.</p>';

    });

    const getFilenameSample = () => {
      return 'The current file format is: <b>' + 
             this.plugin.settings.drawingFilenamePrefix + 
            window.moment().format(this.plugin.settings.drawingFilenameDateTime) +
            '.' + EXCALIDRAW_FILE_EXTENSION + '</b>';
    };

    const filenameEl = containerEl.createEl('p',{text: ''});
    filenameEl.innerHTML = getFilenameSample();
    
    new Setting(containerEl)
      .setName('Filename prefix') 
      .setDesc('The first part of the filename')
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
      .setName('Filename date') 
      .setDesc('The second part of the filename')
      .addText(text => text
        .setPlaceholder('YYYY-MM-DD HH.mm.ss')
        .setValue(this.plugin.settings.drawingFilenameDateTime)
        .onChange(async (value) => {
          this.plugin.settings.drawingFilenameDateTime = value.replaceAll(/[<>:"/\\|?*]/g,'_');
          text.setValue(this.plugin.settings.drawingFilenameDateTime);
          filenameEl.innerHTML = getFilenameSample();
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
          this.plugin.triggerEmbedUpdates();
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
          this.plugin.triggerEmbedUpdates();
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

    /*Excalidraw Sync Begin*/
    this.containerEl.createEl('h1', {text: 'Excalidraw sync'});
    this.containerEl.createEl('h3', {text: 'This is a hack and a temporary workaround. Turn it on only if you are comfortable with hacky solutions...'});
    this.containerEl.createEl('p', {text: 'By enabling this feature Excalidraw will sync drawings to a sync folder where drawings are stored in an ".md" file.  ' +
                                   'This will allow Obsidian sync to synchronize Excalidraw drawings as well... ' + 
                                   'Whenever your drawing changes, the corresponding file in the sync folder will also get updated. Similarly, whenever a file is synchronized to the sync folder ' +
                                   'by Obsidian sync, Excalidraw will sync it with the .excalidraw file in your vault.'});
    this.containerEl.createEl('p', {text: 'Because this is a temporary workaround until Obsidian sync is ready, I didn\'t implement extensive application logic to manage sync. ' +
                                   'Sync might get confused requiring some manual intervention.'});

    new Setting(containerEl)
    .setName('Excalidraw sync folder') 
    .setDesc('Configure the folder first, before activating the feature! ' +
             'This is the root folder for your mirrored excalidraw drawings. ' +
             'Don\'t save other files here, as my algorithm is not prepared to handle those... and I can\'t predict the outcome. ')
    .addText(text => text
      .setPlaceholder('.excalidraw_sync')
      .setValue(this.plugin.settings.syncFolder)
      .onChange(async (value) => {
        this.plugin.settings.syncFolder = value;
        await this.plugin.saveSettings();
      }));

    new Setting(containerEl)
      .setName('Excalidraw sync') 
      .setDesc('Enable Excalidraw Sync')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.excalidrawSync)
        .onChange(async (value) => {
          this.plugin.settings.excalidrawSync = value;
          await this.plugin.saveSettings();
          this.plugin.initiateSync();
        }));
      

    /*Excalidraw Sync End*/

  }
}