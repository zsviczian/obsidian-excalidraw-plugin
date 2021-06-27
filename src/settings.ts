import {
  App, 
  PluginSettingTab, 
  Setting
} from 'obsidian';
import type ExcalidrawPlugin from "./main";

export interface ExcalidrawSettings {
  folder: string,
  templateFilePath: string,
  drawingFilenamePrefix: string,
  drawingFilenameDateTime: string,
  width: string,
  validLinksOnly: boolean, //valid link as in [[valid Obsidian link]] - how to treat text elements in drawings
  allowCtrlClick: boolean, //if disabled only the link button in the view header will open links 
  exportWithTheme: boolean,
  exportWithBackground: boolean,
  autoexportSVG: boolean,
  autoexportPNG: boolean,
  keepInSync: boolean,
  library: string,
}

export const DEFAULT_SETTINGS: ExcalidrawSettings = {
  folder: 'Excalidraw',
  templateFilePath: 'Excalidraw/Template',
  drawingFilenamePrefix: 'Drawing ',
  drawingFilenameDateTime: 'YYYY-MM-DD HH.mm.ss',
  width: '400',
  validLinksOnly: false,
  allowCtrlClick: true,
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
      .setDesc('Full path to the file you want to use as the template for new Excalidraw drawings. ' +
               'Assuming your template is in the default Excalidraw folder, the setting would be: Excalidraw/Template')
      .addText(text => text
        .setPlaceholder('Excalidraw/Template')
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
            window.moment().format(this.plugin.settings.drawingFilenameDateTime) + '</b>';
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

    this.containerEl.createEl('h1', {text: 'Links in drawings'});
    this.containerEl.createEl('p',{
      text: 'You can CTRL/META + click on text elements in your drawings to open them as links. ' + 
            'By default the plugin will handle any text as a link, and will try to open it. ' + 
            'If the text element includes a [[valid Obsidian link]] then the rest of the text element will be ignored ' + 
            'and only the [[valid Obsidian link]] will be processed as a link. ' +
            'If the text element starts as a valid web link (i.e. https:// or http://), then it will be treated as a web link ' +
            'and the plugin will try to open it in a browser window. ' +
            'The plugin indexes your drawings, and when Obsidian files change, the matching text in your drawings will also change. ' +
            'If you don\'t want text accidentally changing in your drawings, you can set the below toggle to limit the link ' +
            'feature to only [[valid Obsidian links]].'});
    new Setting(containerEl)
    .setName('Accept only [[valid Obsidian links]]') 
    .setDesc('If this is on, text in text elements will be ignored unless they contain a [[valid Obsidian link]]')
    .addToggle(toggle => toggle
      .setValue(this.plugin.settings.validLinksOnly)
      .onChange(async (value) => {
        this.plugin.settings.validLinksOnly = value;
//        this.plugin.reloadIndex();
        await this.plugin.saveSettings();
      }));
    new Setting(containerEl)
      .setName('CTRL + CLICK on text to open them as links') 
      .setDesc('You can turn this feature off if it interferes with default Excalidraw features you want to use. If ' +
               'this is turned off, only the link button in the title bar of the drawing will open links.')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.allowCtrlClick)
        .onChange(async (value) => {
          this.plugin.settings.allowCtrlClick = value;
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

  }
}