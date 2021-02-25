import { TFile, Plugin, MarkdownView, debounce, Debouncer, WorkspaceLeaf, addIcon } from 'obsidian';
import { VIEW_TYPE_STATS_TRACKER } from './constants';
import StatsTrackerView from './view';

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
	debouncedUpdate: Debouncer<[contents: string, filepath: string]>;

	private view: StatsTrackerView;

	async onload() {
		await this.loadSettings();

		this.statusBarEl = this.addStatusBarItem();
		this.updateDate();
		if (this.settings.dayCounts.hasOwnProperty(this.today)) {
			this.updateCounts();
		} else {
			this.currentWordCount = 0;
		}

		this.debouncedUpdate = debounce((contents: string, filepath: string) => {
			this.updateWordCount(contents, filepath);
		}, 400, false);

		this.registerView(
			VIEW_TYPE_STATS_TRACKER,
			(leaf: WorkspaceLeaf) => (this.view = new StatsTrackerView(leaf, this.settings.dayCounts))
		);

		this.addCommand({
			id: "show-daily-stats-tracker-view",
			name: "Open tracker view",
			checkCallback: (checking: boolean) => {
				if (checking) {
					return (
						this.app.workspace.getLeavesOfType(VIEW_TYPE_STATS_TRACKER).length === 0
					);
				}
				this.initLeaf();
			},
		});

		this.registerEvent(
			this.app.workspace.on("quit", this.onunload.bind(this))
		);

		this.registerEvent(
			this.app.workspace.on("quick-preview", this.onQuickPreview.bind(this))
		);

		this.registerInterval(
			window.setInterval(() => {
				this.statusBarEl.setText(this.currentWordCount + " words today ");
			}, 200)
		);

		addIcon("bar-graph", `<path fill="currentColor" stroke="currentColor" d="M122.88,105.98H9.59v-0.02c-2.65,0-5.05-1.08-6.78-2.81c-1.72-1.72-2.79-4.11-2.79-6.75H0V0h12.26v93.73h110.62V105.98 L122.88,105.98z M83.37,45.6h19.55c1.04,0,1.89,0.85,1.89,1.89v38.46c0,1.04-0.85,1.89-1.89,1.89H83.37 c-1.04,0-1.89-0.85-1.89-1.89V47.5C81.48,46.46,82.33,45.6,83.37,45.6L83.37,45.6z M25.36,22.07h19.55c1.04,0,1.89,0.85,1.89,1.89 v62c0,1.04-0.85,1.89-1.89,1.89H25.36c-1.04,0-1.89-0.85-1.89-1.89v-62C23.47,22.92,24.32,22.07,25.36,22.07L25.36,22.07 L25.36,22.07z M54.37,8.83h19.54c1.04,0,1.89,0.85,1.89,1.89v75.24c0,1.04-0.85,1.89-1.89,1.89H54.37c-1.04,0-1.89-0.85-1.89-1.89 V10.72C52.48,9.68,53.33,8.83,54.37,8.83L54.37,8.83z"/>`);
		this.registerInterval(window.setInterval(() => {
			this.updateDate();
			this.saveSettings();
		}, 1000));

		if (this.app.workspace.layoutReady) {
			this.initLeaf();
		} else {
			this.registerEvent(
				this.app.workspace.on("layout-ready", this.initLeaf.bind(this))
			);
		}
	}

	initLeaf(): void {
		if (this.app.workspace.getLeavesOfType(VIEW_TYPE_STATS_TRACKER).length) {
			return;
		}
		this.app.workspace.getRightLeaf(false).setViewState({
			type: VIEW_TYPE_STATS_TRACKER,
		});
	}

	async onunload() {
		await this.saveSettings();
	}

	onQuickPreview(file: TFile, contents: string) {
		if (this.app.workspace.getActiveViewOfType(MarkdownView)) {
			this.debouncedUpdate(contents, file.path);
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

	updateWordCount(contents: string, filepath: string) {
		const curr = this.getWordCount(contents);
		if (this.settings.dayCounts.hasOwnProperty(this.today)) {
			if (this.settings.todaysWordCount.hasOwnProperty(filepath)) {//updating existing file
				this.settings.todaysWordCount[filepath].current = curr;
			} else {//created new file during session
				this.settings.todaysWordCount[filepath] = { initial: curr, current: curr };
			}
		} else {//new day, flush the cache
			this.settings.todaysWordCount = {};
			this.settings.todaysWordCount[filepath] = { initial: curr, current: curr };
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
		if (Object.keys(this.settings.dayCounts).length > 0) { //ensuring we never reset the data by accident
			await this.saveData(this.settings);
		}
	}
}