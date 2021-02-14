import { TFile, Plugin } from 'obsidian';

interface DayStats {
	date: Date;
	wordCount: number;
	initialNoteWordCount: Record<string, number>;
}

interface DailyStatsSettings {
	stats: DayStats[];
}

const DEFAULT_SETTINGS: DailyStatsSettings = {
	stats: []
}

export default class DailyStats extends Plugin {
	settings: DailyStatsSettings;
	currentFile: TFile;
	statusBar: StatusBar;
	currentWordCount: number;

	async onload() {
		await this.loadSettings();

		let statusBarEl = this.addStatusBarItem();
		this.statusBar = new StatusBar(statusBarEl);

		let files: TFile[] = this.app.vault.getMarkdownFiles();
		this.currentWordCount = 0;
		for (const file of files) {
			const toAdd = await this.getTodaysWords(file);
			this.currentWordCount += toAdd;
		};

		this.registerInterval(
			window.setInterval(async () => {
				let files: TFile[] = this.app.vault.getMarkdownFiles();
				var todaysWords = 0;
				for (const file of files) {
					const toAdd = await this.getTodaysWords(file);
					todaysWords += toAdd;
				};
				this.currentWordCount = todaysWords;
				this.statusBar.displayText(this.currentWordCount + " words today ");
				this.settings.stats.find((dayStat) => isSameDay(new Date(dayStat.date), new Date())).wordCount = this.currentWordCount;
				this.saveSettings();
			}, 500)
		);
	}

	onunload() {
		var currDayStat = this.settings.stats.find((dayStat) => isSameDay(new Date(dayStat.date), new Date()));
		if (currDayStat) {
			currDayStat.wordCount = this.currentWordCount;
			this.saveSettings();
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

	async getTodaysWords(file: TFile) {
		const contents = await this.app.vault.cachedRead(file);
		const curr = this.getWordCount(contents);
		var dayStat = this.settings.stats.find((dayStat) => isSameDay(new Date(dayStat.date), new Date()));
		var prev = curr;
		if (dayStat) {
			if (file.name in dayStat.initialNoteWordCount) {
				prev = dayStat.initialNoteWordCount[file.name];
			} else {
				dayStat.initialNoteWordCount[file.name] = curr;
				await this.saveSettings();
			}
		} else {
			this.currentWordCount = 0;
			var newRecord: Record<string, number> = {};
			newRecord[file.name] = curr;
			this.settings.stats.push({ date: new Date(), wordCount: 0, initialNoteWordCount: newRecord });
			await this.saveSettings();
		}
		return Math.max(0, curr - prev);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class StatusBar {
	private statusBarEl: HTMLElement;

	constructor(statusBarEl: HTMLElement) {
		this.statusBarEl = statusBarEl;
	}

	displayText(text: string) {
		this.statusBarEl.setText(text);
	}
}

const isSameDay = (first: Date, second: Date) =>
	first.getFullYear() === second.getFullYear() &&
	first.getMonth() === second.getMonth() &&
	first.getDate() === second.getDate();
