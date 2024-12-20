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
import ExcalidrawView from "src/view/ExcalidrawView";
import { getContainerForDocument, ConstructableWorkspaceSplit, isObsidianThemeDark } from "../../utils/obsidianUtils";
import { CustomMutationObserver, DEBUGGING } from "../../utils/debugHelper";

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
  detach: Function;
}

export class CanvasNodeFactory {
  leaf: WorkspaceLeaf;
  canvas: ObsidianCanvas;
  nodes = new Map<string, ObsidianCanvasNode>();
  initialized: boolean = false;
  public isInitialized = () => this.initialized;
  private observer: CustomMutationObserver | MutationObserver;

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
    const rootSplit:WorkspaceSplit = new (WorkspaceSplit as ConstructableWorkspaceSplit)(this.view.app.workspace, "vertical");
    rootSplit.getRoot = () => this.view.app.workspace[doc === document ? 'rootSplit' : 'floatingSplit'];
    rootSplit.getContainer = () => getContainerForDocument(doc);
    this.leaf = this.view.app.workspace.createLeafInParent(rootSplit, 0);
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
    //containerEl.style.background = "var(--background-primary)";
    node.containerEl.querySelector(".canvas-node-content-blocker")?.remove();
    containerEl.appendChild(node.containerEl)
    this.nodes.set(elementId, node);
    return node;
  }

  private async waitForEditor(node: ObsidianCanvasNode): Promise<HTMLElement | null> {
    let counter = 0;
    while (!node.child.editor?.containerEl?.parentElement?.parentElement && counter++ < 100) {
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    return node.child.editor?.containerEl?.parentElement?.parentElement;
  }

  private setupThemeObserver(editorEl: HTMLElement, obsidianTheme: string, theme: string) {
    const nodeObserverFn: MutationCallback = (mutationsList) => {
      for (const mutation of mutationsList) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          const targetElement = mutation.target as HTMLElement;
          if (targetElement.classList.contains(obsidianTheme)) {
            targetElement.classList.remove(obsidianTheme);
            targetElement.classList.add(theme);
          }
        }
      }
    };

    this.observer?.disconnect();
    this.observer = DEBUGGING
      ? new CustomMutationObserver(nodeObserverFn, "CanvasNodeFactory")
      : new MutationObserver(nodeObserverFn);

    this.observer.observe(editorEl, { attributes: true });
  }

  public async startEditing(node: ObsidianCanvasNode, theme: string) {
    if (!this.initialized || !node) return;
    
    try {
      //if (node.file === this.view.file) {
        await this.view.setEmbeddableNodeIsEditing();
      //}
      node.startEditing();
      node.isEditing = true;

      const obsidianTheme = isObsidianThemeDark() ? "theme-dark" : "theme-light";
      if (obsidianTheme === theme) return;

      const editorEl = await this.waitForEditor(node);
      if (!editorEl) return;

      editorEl.classList.remove(obsidianTheme);
      editorEl.classList.add(theme);
      
      this.setupThemeObserver(editorEl, obsidianTheme, theme);
    } catch (error) {
      console.error('Error starting edit:', error);
      node.isEditing = false;
    }
  }

  public stopEditing(node: ObsidianCanvasNode) {
    if (!this.initialized || !node || !node.isEditing) return;
    
    try {
      //if (node.file === this.view.file) {
        this.view.clearEmbeddableNodeIsEditing();
      //}
      node.child.showPreview();
      node.isEditing = false;
      this.observer?.disconnect();
    } catch (error) {
      console.error('Error stopping edit:', error);
    }
  }

  removeNode(node: ObsidianCanvasNode) {
    if(!this.initialized || !node) return;
    this.nodes.delete(node.file.path);
    this.canvas.removeNode(node);
    node.detach();
  }

  public purgeNodes() {
    if(!this.initialized) return;
    this.nodes.forEach(node => {
      this.canvas.removeNode(node);
      node.detach(); 
    });
    this.nodes.clear();
  }

  destroy() {
    this.purgeNodes();
    this.initialized = false;  //calling after purgeNodes becaues purge nodes checks for initialized
    this.observer?.disconnect();
    this.view = null;
    this.canvas = null;
    this.leaf = null;
  }
}
    