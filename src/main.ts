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
import { BLANK_DRAWING, VIEW_TYPE_EXCALIDRAW } from './constants';
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
		addIcon("palette", `<path fill="currentColor" stroke="currentColor" d="M52.6,0C40.5,0,28.8,3.8,20.2,11.6S6,31.4,6,47.4c0,26,20.2,52.6,48.8,52.6h0.4c0,0,0,0,0.1,0c5.9-0.1,11.6-2.1,15.8-5.9 c4.2-3.8,6.9-9.4,6.9-16.4c0-3.9-1.8-6.9-2.8-9.3c0,0,0,0,0-0.1c-1.4-3.5-0.9-5.1,0.4-6.8c1.3-1.8,4-3.5,7-5.7 c6.1-4.4,13.5-11.2,13.4-25.9c0-5.2-2.9-12.5-9.7-18.7C79.5,4.9,68.6,0,52.6,0L52.6,0z M52.6,4c15.2,0,25,4.6,31.1,10.1 c6.1,5.5,8.3,12.1,8.3,15.8c0.1,13.5-5.9,18.5-11.8,22.7c-2.9,2.1-5.8,3.9-7.8,6.6c-2,2.6-2.6,6.3-0.9,10.6c0,0,0,0,0,0.1 c1.1,2.8,2.4,5.4,2.4,7.9c0,6-2.2,10.4-5.6,13.5s-8.1,4.8-13.2,4.9h-0.4C28.7,96,10,71.3,10,47.4c0-15,5.1-25.7,12.9-32.8 S41.3,4,52.6,4z M53,10c-2.6,0-4.9,1.4-6.5,3.4c-1.6,2-2.5,4.7-2.5,7.6c0,2.9,0.9,5.5,2.5,7.6c1.6,2,3.9,3.4,6.5,3.4 c2.6,0,4.9-1.4,6.5-3.4c1.6-2,2.5-4.7,2.5-7.6s-0.9-5.5-2.5-7.6C57.9,11.4,55.6,10,53,10z M53,14c1.2,0,2.4,0.6,3.4,1.9 c1,1.2,1.6,3.1,1.6,5.1s-0.7,3.9-1.6,5.1c-1,1.2-2.1,1.9-3.4,1.9s-2.4-0.6-3.4-1.9c-1-1.2-1.6-3.1-1.6-5.1c0-2.1,0.7-3.9,1.6-5.1 C50.6,14.6,51.8,14,53,14z M31,20c-2.6,0-4.9,1.4-6.5,3.4c-1.6,2-2.5,4.7-2.5,7.6s0.9,5.5,2.5,7.6c1.6,2,3.9,3.4,6.5,3.4 s4.9-1.4,6.5-3.4c1.6-2,2.5-4.7,2.5-7.6s-0.9-5.5-2.5-7.6C35.9,21.4,33.6,20,31,20z M75,20c-2.6,0-4.9,1.4-6.5,3.4 c-1.6,2-2.5,4.7-2.5,7.6s0.9,5.5,2.5,7.6c1.6,2,3.9,3.4,6.5,3.4s4.9-1.4,6.5-3.4c1.6-2,2.5-4.7,2.5-7.6s-0.9-5.5-2.5-7.6 C79.9,21.4,77.6,20,75,20z M31,24c1.2,0,2.4,0.6,3.4,1.9S36,28.9,36,31s-0.7,3.9-1.6,5.1c-1,1.2-2.1,1.9-3.4,1.9 c-1.2,0-2.4-0.6-3.4-1.9c-1-1.2-1.6-3.1-1.6-5.1s0.7-3.9,1.6-5.1S29.8,24,31,24z M75,24c1.2,0,2.4,0.6,3.4,1.9 c1,1.2,1.6,3.1,1.6,5.1s-0.7,3.9-1.6,5.1c-1,1.2-2.1,1.9-3.4,1.9s-2.4-0.6-3.4-1.9c-1-1.2-1.6-3.1-1.6-5.1s0.7-3.9,1.6-5.1 S73.8,24,75,24z M29,46c-2.6,0-4.9,1.4-6.5,3.4c-1.6,2-2.5,4.7-2.5,7.6s0.9,5.5,2.5,7.6c1.6,2,3.9,3.4,6.5,3.4s4.9-1.4,6.5-3.4 S38,59.9,38,57s-0.9-5.5-2.5-7.6C33.9,47.4,31.6,46,29,46z M29,50c1.2,0,2.4,0.6,3.4,1.9c1,1.2,1.6,3.1,1.6,5.1s-0.7,3.9-1.6,5.1 c-1,1.2-2.1,1.9-3.4,1.9c-1.2,0-2.4-0.6-3.4-1.9c-1-1.2-1.6-3.1-1.6-5.1s0.7-3.9,1.6-5.1C26.6,50.6,27.8,50,29,50z M54,66 c-6.6,0-12,5.4-12,12s5.4,12,12,12s12-5.4,12-12S60.6,66,54,66z M54,70c4.6,0,8,3.4,8,8s-3.4,8-8,8s-8-3.4-8-8S49.4,70,54,70z"/>`);

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