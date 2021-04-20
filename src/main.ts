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
	TAbstractFile,
  MarkdownPostProcessorContext,
  MarkdownView,
  Editor,
} from 'obsidian';
import { BLANK_DRAWING, VIEW_TYPE_EXCALIDRAW, PALETTE_ICON } from './constants';
import ExcalidrawView from './ExcalidrawView';
import {
	ExcalidrawSettings, 
	DEFAULT_SETTINGS, 
	ExcalidrawSettingTab
} from './settings';
import {openDialogAction, OpenFileDialog} from './openDrawing';
import {getDateString} from './utils'
import { exportToSvg } from '@excalidraw/excalidraw';


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

    this.registerMarkdownCodeBlockProcessor('excalidraw', (source,el,ctx) => {
      const parseError = (message: string) => {
        el.createDiv("excalidraw-error",(el)=> {
          el.createEl("p","Please provide a link to an excalidraw file: [[file.excalidraw]]");
          el.createEl("p",message);
          el.createEl("p",source);
        })  
      }

      const filename = source.match(/\[{2}(.*)\]{2}/m);
      if(filename.length==2) {
        const file:TFile = (this.app.vault.getAbstractFileByPath(filename[1]) as TFile);
        if(file) {
          if(file.extension == "excalidraw") {
            this.app.vault.read(file).then(async (content: string) => {
              const svg = ExcalidrawView.getSVG(content);
              if(svg) {
                el.createDiv("excalidraw-svg",(el)=> {
                  el.appendChild(svg);
                })        
          
              } else parseError("Parse error. Not a valid Excalidraw file.");
            });
          } else parseError("Not an excalidraw file. Must have extension .excalidraw");
        } else parseError("File does not exist");
      } else parseError("No link to file found in codeblock.");
    });

		await this.loadSettings();
		this.addSettingTab(new ExcalidrawSettingTab(this.app, this));

		this.openDialog = new OpenFileDialog(this.app, this);
		this.addRibbonIcon('excalidraw', 'Excalidraw', async () => {
			this.openDialog.start(openDialogAction.openFile);
		});

		this.addCommand({
			id: "excalidraw-open",
			name: "Open existing drawing or create new one",
			callback: () => {
				this.openDialog.start(openDialogAction.openFile);
			},
		});

		this.addCommand({
			id: "excalidraw-insert-transclusion",
			name: "Insert link to .excalidraw file into markdown document",
			callback: () => {
				this.openDialog.start(openDialogAction.insertLink);
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
   
  public insertCodeblock(data:string) {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if(activeView) {
      const editor = activeView.editor;
      let doc = editor.getDoc();
      doc.replaceSelection(
        String.fromCharCode(96,96,96) + 
        "excalidraw\n[["+data+"]]\n" +
        String.fromCharCode(96,96,96));
      editor.focus();
    }
  
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