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
import ExcalidrawView from './view';
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
		addIcon("palette", PALETTE_ICON);

		this.registerView(
			VIEW_TYPE_EXCALIDRAW,
			(leaf: WorkspaceLeaf) => (this.view = new ExcalidrawView(leaf))
		);	

		await this.loadSettings();
		this.addSettingTab(new ExcalidrawSettingTab(this.app, this));

		this.openDialog = new OpenFileDialog(this.app, this);
		this.addRibbonIcon('palette', 'Excalidraw', async () => {
			this.openDialog.start();
		});

		this.addCommand({
			id: "excalidraw-open",
			name: "Open Excalidraw",
			callback: () => {
				this.openDialog.start();
			},
		});

/*		this.addCommand({
      id: "excalidraw-new-drawing",
      name: "Open Excalidraw View",
      callback: () => {
				if (this.app.workspace.layoutReady) {
					this.initLeaf();
				} else {
					this.registerEvent(
						this.app.workspace.on("layout-ready", this.initLeaf.bind(this)));
				}
      },
    });*/

		if (this.app.workspace.layoutReady) {
			this.initLeaf();
		} else {
			this.registerEvent(
				this.app.workspace.on("layout-ready", this.initLeaf.bind(this)));
		}
	}

	onunload():void {
		this.view.unload();
	}

	initLeaf(): void {
		if (this.app.workspace.getLeavesOfType(VIEW_TYPE_EXCALIDRAW).length) {
			this.app.workspace.revealLeaf(this.view.leaf);
			this.loadLastDrawing(this.activeDrawingFilename);
			return;
		}

		this.app.workspace.getRightLeaf(false).setViewState({
			type: VIEW_TYPE_EXCALIDRAW,
		});
		
		this.app.workspace.revealLeaf(this.view.leaf);

		this.loadLastDrawing(this.activeDrawingFilename);
	}

	private async loadSettings() {
		const savedData = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, savedData?.settings);
		this.activeDrawingFilename = savedData?.openFile != null ? savedData.openFile : '';
	}

	async saveSettings() {
		if(this.view != null) {
			await this.saveData({
				openFile: this.activeDrawing?.path || '',
				settings: this.settings,
		  });
		}
	}

	public openDrawing(drawingFile: TFile) {
		this.activeDrawing = drawingFile;
		this.saveSettings();
		this.view.loadDrawing(drawingFile);
	}

  private loadLastDrawing(fname: string) {
    let file:TFile = null;

    if(fname != '') {
			const fileToOpen = (this.app.vault.getAbstractFileByPath(fname) as TFile);
      if (fileToOpen) {			
				file = fileToOpen;
			}
		}

		if(file) {
			this.openDrawing(file);
		} else {
		  this.createDrawing(this.getNextDefaultFilename());
		}

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