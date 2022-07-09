import { main } from "@popperjs/core";
import {
  App,
  normalizePath, Notice, WorkspaceLeaf
} from "obsidian";
import ExcalidrawPlugin from "../main";
import { checkAndCreateFolder, splitFolderAndFilename } from "./FileUtils";

export const getParentOfClass = (element: HTMLElement, cssClass: string):HTMLElement | null => {
  let parent = element.parentElement;
  while (
    parent &&
    !(parent instanceof window.HTMLBodyElement) &&
    !parent.classList.contains(cssClass)
  ) {
    parent = parent.parentElement;
  }
  return parent?.classList?.contains(cssClass) ? parent : null;
};

export const getNewOrAdjacentLeaf = (
  plugin: ExcalidrawPlugin,
  leaf: WorkspaceLeaf
): WorkspaceLeaf => {
  if(plugin.settings.openInMainWorkspace) {
    let mainLeaf = app.workspace.getMostRecentLeaf();
    if(!mainLeaf || mainLeaf === leaf || mainLeaf.view?.containerEl.ownerDocument !== document) {
      mainLeaf = null;
      app.workspace.iterateAllLeaves(l=>{
        if(mainLeaf ||
          !l.view?.navigation || 
          l.view?.containerEl?.ownerDocument !== document ||
          leaf === l
        ) return;
        mainLeaf = l;
      })
      if(!mainLeaf) {
        leaf.view.navigation = false;
        mainLeaf = app.workspace.getLeaf(false)
        leaf.view.navigation = true;
      }
    }  
    if(plugin.settings.openInAdjacentPane || mainLeaf.view.getViewType() === 'empty') {
      return mainLeaf;
    }
    return app.workspace.createLeafBySplit(mainLeaf);
  }

  if (plugin.settings.openInAdjacentPane) {
    //if in popout window
    if(leaf.view.containerEl.ownerDocument !== document) {
      const popoutLeaves = new Set<WorkspaceLeaf>();  
      app.workspace.iterateAllLeaves(l=>{
        if(l !== leaf && l.view.navigation && l.view.containerEl.ownerDocument === leaf.view.containerEl.ownerDocument) {
          popoutLeaves.add(l);
        }
      });
      if(popoutLeaves.size === 0) {
        return app.workspace.getLeaf(true);
      }
      return Array.from(popoutLeaves)[0];
    }

    const inHoverEditorLeaf = leaf.view?.containerEl 
      ? getParentOfClass(leaf.view.containerEl, "popover") !== null
      : false;
    if(inHoverEditorLeaf) {
      const leaves = new Set<WorkspaceLeaf>();
      app.workspace.iterateAllLeaves(l=>{
        //@ts-ignore
        if(l!==leaf && leaf.containerEl.parentElement === l.containerEl.parentElement) leaves.add(l);
      })
      if(leaves.size === 0) {
        return plugin.app.workspace.createLeafBySplit(leaf);      
      }
      return Array.from(leaves)[0];
    }

    leaf.view.navigation = false;
    const leafToUse = app.workspace.getLeaf(false)
    leaf.view.navigation = true;
    return leafToUse
  }


  return plugin.app.workspace.createLeafBySplit(leaf);
};

export const getAttachmentsFolderAndFilePath = async (
  app: App,
  activeViewFilePath: string,
  newFileName: string
): Promise<{ folder: string; filepath: string; }> => {
  let folder = app.vault.getConfig("attachmentFolderPath");
  // folder == null: save to vault root
  // folder == "./" save to same folder as current file
  // folder == "folder" save to specific folder in vault
  // folder == "./folder" save to specific subfolder of current active folder
  if (folder && folder.startsWith("./")) {
    // folder relative to current file
    const activeFileFolder = `${splitFolderAndFilename(activeViewFilePath).folderpath}/`;
    folder = normalizePath(activeFileFolder + folder.substring(2));
  }
  if (!folder || folder === "/") {
    folder = "";
  }
  await checkAndCreateFolder(app.vault, folder);
  return {
    folder,
    filepath: normalizePath(
      folder === "" ? newFileName : `${folder}/${newFileName}`
    ),
  };
};

export const isObsidianThemeDark = () => document.body.classList.contains("theme-dark");
