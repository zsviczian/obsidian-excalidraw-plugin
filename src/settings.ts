import {App, PluginSettingTab, Setting} from 'obsidian';
import type ExcalidrawPlugin from "./main";

export interface ExcalidrawSettings {
	folder: string,
	templateFilePath: string,
  width: string,
}

export const DEFAULT_SETTINGS: ExcalidrawSettings = {
	folder: 'excalidraw',
	templateFilePath: '',
  width: '400',
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
			.setDesc('Default location for Excalidraw drawings. Leaving this empty means drawings will be saved to the Vault root.')
			.addText(text => text
				.setPlaceholder('excalidraw')
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
				.setPlaceholder('excalidraw')
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
	}
}