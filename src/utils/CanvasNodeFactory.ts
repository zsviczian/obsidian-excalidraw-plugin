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
import { getContainerForDocument, ConstructableWorkspaceSplit } from "./ObsidianUtils";

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

interface ObsidianCanvasNode {
  startEditing: Function;
  child: any;
}

export class CanvasNodeFactory {
  leaf: WorkspaceLeaf;
  canvas: ObsidianCanvas;
  nodes = new Map<string, ObsidianCanvasNode>();

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
    this.canvas = canvasPlugin.views.canvas(this.leaf);
  }

  public createFileNote(file: TFile, subpath: string, containerEl: HTMLDivElement, elementId: string) {
    const node = this.canvas.createFileNode({pos: {x:0,y:0}, file, subpath, save: false});
    node.setFilePath(file.path,subpath);
    node.render();
    containerEl.style.background = "var(--background-primary)";
    containerEl.appendChild(node.contentEl)
    this.nodes.set(elementId, node);
  }

  public startEditing(elementId: string, theme: string) {
    const node = this.nodes.get(elementId);
    if(!node) return;
    node.startEditing();
    node.child.editor.containerEl.parentElement.parentElement.removeClass("theme-light");
    node.child.editor.containerEl.parentElement.parentElement.removeClass("theme-dark");
    node.child.editor.containerEl.parentElement.parentElement.addClass(theme);
  }

  public stopEditing(elementId: string) {
  }

  public purgeNodes() {
    this.nodes.forEach(node => {
      this.canvas.removeNode(node);      
    });
    this.nodes.clear();
  }
}
    