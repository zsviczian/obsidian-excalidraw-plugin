import {
  App,
  normalizePath, WorkspaceLeaf
} from "obsidian";
import ExcalidrawPlugin from "../main";
import { checkAndCreateFolder, splitFolderAndFilename } from "./FileUtils";


export const getNewOrAdjacentLeaf = (
  plugin: ExcalidrawPlugin,
  leaf: WorkspaceLeaf
): WorkspaceLeaf => {
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
