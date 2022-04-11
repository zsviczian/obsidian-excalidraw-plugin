import {
  App,
  normalizePath, WorkspaceLeaf
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
  return parent.classList.contains(cssClass) ? parent : null;
};

export const getNewOrAdjacentLeaf = (
  plugin: ExcalidrawPlugin,
  leaf: WorkspaceLeaf
): WorkspaceLeaf => {
  const inHoverEditorLeaf = leaf.view?.containerEl 
    ? getParentOfClass(leaf.view.containerEl, "popover") !== null
    : false;

  if (inHoverEditorLeaf) {
    const mainLeaves = app.workspace.getLayout().main.children.filter((c:any) => c.type === "leaf");
    if(mainLeaves.length === 0) {
      //@ts-ignore
      return leafToUse = app.workspace.createLeafInParent(app.workspace.rootSplit);
    }
    const targetLeaf = app.workspace.getLeafById(mainLeaves[0].id);
    if (plugin.settings.openInAdjacentPane) {
      return targetLeaf;
    }
    return plugin.app.workspace.createLeafBySplit(targetLeaf);
  }

  if (plugin.settings.openInAdjacentPane) {
    let leafToUse = plugin.app.workspace.getAdjacentLeafInDirection(
      leaf,
      "right"
    );
    if (!leafToUse) {
      leafToUse = plugin.app.workspace.getAdjacentLeafInDirection(leaf, "left");
    }
    if (!leafToUse) {
      leafToUse = plugin.app.workspace.getAdjacentLeafInDirection(
        leaf,
        "bottom"
      );
    }
    if (!leafToUse) {
      leafToUse = plugin.app.workspace.getAdjacentLeafInDirection(leaf, "top");
    }
    if (!leafToUse) {
      leafToUse = plugin.app.workspace.createLeafBySplit(leaf);
    }
    return leafToUse;
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
  if (!folder) {
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
