/*
l = app.workspace.activeLeaf
canvas = app.internalPlugins.plugins["canvas"].views.canvas(l)
f = app.vault.getAbstractFileByPath("Daily Notes/2022-03-18 Friday.md")
node = canvas.canvas.createFileNode({pos: {x:0,y:0}, file:f, subpath: "#Work", save: false})
node.setFilePath("Daily Notes/2022-03-18 Friday.md","#Work");
node.render();
container.appendChild(node.contentEl)
*/

import { TFile, WorkspaceLeaf, WorkspaceSplit } from "obsidian";
import ExcalidrawView from "src/ExcalidrawView";
import { getContainerForDocument, ConstructableWorkspaceSplit, isObsidianThemeDark } from "./ObsidianUtils";

declare module "obsidian" {
  interface Workspace {
    floatingSplit: any;
  }

  interface WorkspaceSplit {
    containerEl: HTMLDivElement;
  }
}

interface ObsidianCanvas {
  createFileNode: Function;
  removeNode: Function;
}

export interface ObsidianCanvasNode {
  startEditing: Function;
  child: any;
  isEditing: boolean;
  file: TFile;
}

export class CanvasNodeFactory {
  leaf: WorkspaceLeaf;
  canvas: ObsidianCanvas;
  nodes = new Map<string, ObsidianCanvasNode>();
  initialized: boolean = false;
  public isInitialized = () => this.initialized;

  constructor(
    private view: ExcalidrawView,
  ) {
  }

  public async initialize() {
    //@ts-ignore
    const canvasPlugin = app.internalPlugins.plugins["canvas"];
    
    if(!canvasPlugin._loaded) {
      await canvasPlugin.load();
    }
    const doc = this.view.ownerDocument;
    const rootSplit:WorkspaceSplit = new (WorkspaceSplit as ConstructableWorkspaceSplit)(app.workspace, "vertical");
    rootSplit.getRoot = () => app.workspace[doc === document ? 'rootSplit' : 'floatingSplit'];
    rootSplit.getContainer = () => getContainerForDocument(doc);
    this.leaf = app.workspace.createLeafInParent(rootSplit, 0);
    this.canvas = canvasPlugin.views.canvas(this.leaf).canvas;
    this.initialized = true;
  }

  public createFileNote(file: TFile, subpath: string, containerEl: HTMLDivElement, elementId: string): ObsidianCanvasNode {
    if(!this.initialized) return;
    subpath = subpath ?? "";
    if(this.nodes.has(elementId)) {
      this.canvas.removeNode(this.nodes.get(elementId));
      this.nodes.delete(elementId);
    }
    const node = this.canvas.createFileNode({pos: {x:0,y:0}, file, subpath, save: false});
    node.setFilePath(file.path,subpath);
    node.render();
    containerEl.style.background = "var(--background-primary)";
    containerEl.appendChild(node.contentEl)
    this.nodes.set(elementId, node);
    return node;
  }

  public startEditing(node: ObsidianCanvasNode, theme: string) {
    if (!this.initialized || !node) return;
    node.startEditing();
  
    const obsidianTheme = isObsidianThemeDark() ? "theme-dark" : "theme-light";
    if (obsidianTheme === theme) return;
  
    (async () => {
      let counter = 0;
      while (!node.child.editor?.containerEl?.parentElement?.parentElement && counter++ < 100) {
        await sleep(25);
      }
      if (!node.child.editor?.containerEl?.parentElement?.parentElement) return;
      node.child.editor.containerEl.parentElement.parentElement.classList.remove(obsidianTheme);
      node.child.editor.containerEl.parentElement.parentElement.classList.add(theme);
  
      const observer = new MutationObserver((mutationsList) => {
        for (const mutation of mutationsList) {
          if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            const targetElement = mutation.target as HTMLElement;
            if (targetElement.classList.contains(obsidianTheme)) {
              targetElement.classList.remove(obsidianTheme);
              targetElement.classList.add(theme);
            }
          }
        }
      });
  
      observer.observe(node.child.editor.containerEl.parentElement.parentElement, { attributes: true });
    })();
  } 

  public stopEditing(node: ObsidianCanvasNode) {
    if(!this.initialized || !node) return;
    if(!node.child.editMode) return;
    node.child.showPreview();
  }

  public purgeNodes() {
    if(!this.initialized) return;
    this.nodes.forEach(node => {
      this.canvas.removeNode(node);      
    });
    this.nodes.clear();
  }
}
    