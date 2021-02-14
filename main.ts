import { TFile, Plugin } from 'obsidian';

interface WordCount {
	initial: number;
	current: number;
}

interface DailyStatsSettings {
	dayCounts: Record<string, number>;
	todaysWordCount: Record<string, WordCount>;
}

const DEFAULT_SETTINGS: DailyStatsSettings = {
	dayCounts: {},
	todaysWordCount: {}
}

export default class DailyStats extends Plugin {
	settings: DailyStatsSettings;
	statusBarEl: HTMLElement;
	currentWordCount: number;
	today: string;

	async onload() {
		await this.loadSettings();

		this.statusBarEl = this.addStatusBarItem();
		this.updateDate();
		if (this.today in this.settings.dayCounts) {
			this.updateCounts();
		} else {
			this.currentWordCount = 0;
		}

		this.registerEvent(
			this.app.workspace.on("quit", this.onunload, this)
		);

		this.registerEvent(
			this.app.workspace.on("quick-preview", this.onQuickPreview, this)
		);

		this.registerInterval(
			window.setInterval(() => {
				this.statusBarEl.setText(this.currentWordCount + " words today ");
			}, 200)
		);

		this.registerInterval(window.setInterval(() => {
			this.updateDate();
			this.saveSettings();
		}, 1000));
	}

	async onunload() {
		await this.saveSettings();
	}

	//Credit: better-word-count by Luke Leppan (https://github.com/lukeleppan/better-word-count)
	onQuickPreview(file: TFile, contents: string) {
		const leaf = this.app.workspace.activeLeaf;

		if (leaf && leaf.view.getViewType() === "markdown") {
			this.updateWordCount(contents, file.name);
		}
	}

	//Credit: better-word-count by Luke Leppan (https://github.com/lukeleppan/better-word-count)
	getWordCount(text: string) {
		let words: number = 0;

		const matches = text.match(
			/[a-zA-Z0-9_\u0392-\u03c9\u00c0-\u00ff\u0600-\u06ff]+|[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3040-\u309f\uac00-\ud7af]+/gm
		);

		if (matches) {
			for (let i = 0; i < matches.length; i++) {
				if (matches[i].charCodeAt(0) > 19968) {
					words += matches[i].length;
				} else {
					words += 1;
				}
			}
		}

		return words;
	}

	updateWordCount(contents: string, filename: string) {
		const curr = this.getWordCount(contents);
		if (this.today in this.settings.dayCounts) {
			if (filename in this.settings.todaysWordCount) {//updating existing file
				this.settings.todaysWordCount[filename].current = curr;
			} else {//created new file during session
				this.settings.todaysWordCount[filename] = { initial: curr, current: curr };
			}
		} else {//new day, flush the cache
			this.settings.todaysWordCount = {};
			this.settings.todaysWordCount[filename] = { initial: curr, current: curr };
		}
		this.updateCounts();
	}

	updateDate() {
		const d = new Date();
		this.today = d.getFullYear() + "/" + d.getMonth() + "/" + d.getDate();
	}

	updateCounts() {
		this.currentWordCount = Object.values(this.settings.todaysWordCount).map((wordCount) => Math.max(0, wordCount.current - wordCount.initial)).reduce((a, b) => a + b, 0);
		this.settings.dayCounts[this.today] = this.currentWordCount;
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}