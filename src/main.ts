import { 
	TFile, 
	TFolder, 
	Plugin, 
	WorkspaceLeaf, 
	addIcon, 
	App, 
	PluginManifest, 
	EventRef, 
	Menu,
	TAbstractFile 
} from 'obsidian';
import { BLANK_DRAWING, VIEW_TYPE_EXCALIDRAW, PALETTE_ICON } from './constants';
import ExcalidrawView from './ExcalidrawView';
import {
	ExcalidrawSettings, 
	DEFAULT_SETTINGS, 
	ExcalidrawSettingTab
} from './settings';
import {OpenFileDialog} from './openDrawing';
import {getDateString} from './utils'


export default class ExcalidrawPlugin extends Plugin {
	public settings: ExcalidrawSettings;
	public view: ExcalidrawView;
	private openDialog: OpenFileDialog;
	private activeDrawing: TFile;
	private activeDrawingFilename: string;

  
	constructor(app: App, manifest: PluginManifest) {
    super(app, manifest);
		this.activeDrawing = null;
		this.activeDrawingFilename = '';
  }
  
	async onload() {
		addIcon("excalidraw", PALETTE_ICON);

    this.registerView(
      VIEW_TYPE_EXCALIDRAW, 
      (leaf: WorkspaceLeaf) => (this.view = new ExcalidrawView(leaf))
    );

    this.registerExtensions(["excalidraw"],"excalidraw");

		await this.loadSettings();
		this.addSettingTab(new ExcalidrawSettingTab(this.app, this));

		this.openDialog = new OpenFileDialog(this.app, this);
		this.addRibbonIcon('excalidraw', 'Excalidraw', async () => {
			this.openDialog.start();
		});

		this.addCommand({
			id: "excalidraw-open",
			name: "Open existing drawing or create new one",
			callback: () => {
				this.openDialog.start();
			},
		});

    this.addCommand({
			id: "excalidraw-autocreate",
			name: "Create a new drawing",
			callback: () => {
				this.createDrawing(this.getNextDefaultFilename());
			},
		});
	}

	private async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
  	await this.saveData(this.settings);
	}

	public async openDrawing(drawingFile: TFile) {
		this.activeDrawing = drawingFile;
		this.saveSettings();
    const leaf = this.view ? this.view.leaf : this.app.workspace.activeLeaf;
    leaf.setViewState({
      type: VIEW_TYPE_EXCALIDRAW,
      state: {file: drawingFile.path}}
    );
	}

	private getNextDefaultFilename():string {
		return this.settings.folder+'/Drawing ' + getDateString('yyyy-MM-dd HH.mm.ss')+'.excalidraw';
	}
 
	public async createDrawing(filename: string) {
		if(!(this.app.vault.getAbstractFileByPath(this.settings.folder) as TFile)) {
			this.app.vault.createFolder(this.settings.folder);
		}

		const file = (this.app.vault.getAbstractFileByPath(this.settings.templateFilePath) as TFile);
		if(file) {
			this.app.vault.read(file).then(async (content: string) => {
		    this.openDrawing(await this.app.vault.create(filename,content==''?BLANK_DRAWING:content))   
			});
		} else {
		  this.openDrawing(await this.app.vault.create(filename,BLANK_DRAWING));
		}
	}
}