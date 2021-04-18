import {App, PluginSettingTab, Setting} from 'obsidian';
import type ExcalidrawPlugin from "./main";

export interface ExcalidrawSettings {
	folder: string,
	templateFilePath: string,
}

export const DEFAULT_SETTINGS: ExcalidrawSettings = {
	folder: 'excalidraw',
	templateFilePath: '',
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
			.setDesc('Full path to file containing the file to use as the template for new Excalidraw drawings.')
			.addText(text => text
				.setPlaceholder('excalidraw')
        .setValue(this.plugin.settings.templateFilePath)
				.onChange(async (value) => {
					this.plugin.settings.templateFilePath = value;
					await this.plugin.saveSettings();
				}));
	}
}