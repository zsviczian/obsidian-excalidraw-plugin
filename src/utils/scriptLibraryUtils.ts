import {
  normalizePath,
  Notice,
  request,
  TFile,
  TFolder,
  type App,
} from "obsidian";
import { SCRIPT_INSTALL_FOLDER } from "src/constants/constants";
import { URLs } from "src/constants/safeUrls";
import { t } from "src/lang/helpers";
import type { RemoteDirectoryInfo } from "src/types/githubTypes";
import type { ScriptStoreInstallState } from "src/types/scriptStoreTypes";
import { ExcalidrawSidepanelView } from "src/view/sidepanel/Sidepanel";
import { errorlog } from "./coreUtils";
import { createOrOverwriteFile, getIMGFilename } from "./fileUtils";
import {
  getManagedScriptFileExtension,
  getPreferredScriptFiles,
  getScriptFileStem,
  isScriptFilePath,
} from "./scriptFileUtils";
import { hideElement, setButtonBgColor, showElement } from "./styleUtils";

type ScriptLibrarySettings = {
  scriptFolderPath: string;
  allowJavaScriptFiles: boolean;
  storeScriptFilesAsJavaScript: boolean;
};

type ScriptLibraryScriptEngine = {
  scriptIconMap: Record<string, unknown> | null;
  getScriptName(file: TFile | string): string;
  loadScripts(generation?: number): Promise<void>;
  reloadScripts(): Promise<void>;
  renameManagedScriptFile(file: TFile, destinationPath: string): Promise<void>;
};

/** Narrow plugin surface required by the community-script library helpers. */
export type ScriptLibraryPluginContext = {
  app: App;
  settings: ScriptLibrarySettings;
  scriptEngine: ScriptLibraryScriptEngine;
};

const REMOTE_METADATA_CACHE_TTL = 15 * 60 * 1000;
let directoryInfoPromise: Promise<Map<string, number> | null> | null = null;
let directoryInfoFetchedAt = 0;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isRemoteDirectoryInfo = (value: unknown): value is RemoteDirectoryInfo =>
  isRecord(value) &&
  typeof value.fname === "string" &&
  typeof value.mtime === "number";

const getDownloadedScriptsFolder = (
  plugin: ScriptLibraryPluginContext,
): string =>
  normalizePath(
    `${plugin.settings.scriptFolderPath}/${SCRIPT_INSTALL_FOLDER}`,
  );

const decodeRemoteFilename = (source: string): string => {
  try {
    const decodedURI = decodeURI(source);
    return decodedURI.substring(decodedURI.lastIndexOf("/") + 1);
  } catch (error: unknown) {
    errorlog({
      where: "scriptLibraryUtils.decodeRemoteFilename",
      source,
      error,
    });
    return source.substring(source.lastIndexOf("/") + 1);
  }
};

const isInDownloadedScriptsFolder = (
  plugin: ScriptLibraryPluginContext,
  file: TFile,
): boolean => {
  const root = getDownloadedScriptsFolder(plugin);
  return Boolean(root) && file.path.startsWith(`${root}/`);
};

const sortManagedCopies = (
  plugin: ScriptLibraryPluginContext,
  files: TFile[],
): TFile[] => {
  const root = getDownloadedScriptsFolder(plugin);
  return [...files].sort((a, b) => {
    const aRelative = a.path.slice(root.length + 1);
    const bRelative = b.path.slice(root.length + 1);
    const aDepth = aRelative.split("/").length - 1;
    const bDepth = bRelative.split("/").length - 1;
    return aDepth - bDepth || a.path.localeCompare(b.path);
  });
};

const getLocalScriptFiles = (
  plugin: ScriptLibraryPluginContext,
  remoteFilename: string,
): TFile[] => {
  const stem = getScriptFileStem(remoteFilename);
  const matches = getPreferredScriptFiles(
    plugin.app.vault
      .getFiles()
      .filter(
        (file) =>
          isInDownloadedScriptsFolder(plugin, file) &&
          isScriptFilePath(file.path) &&
          getScriptFileStem(file.name) === stem,
      ),
  );
  return sortManagedCopies(plugin, matches);
};

const getLocalScriptFile = (
  plugin: ScriptLibraryPluginContext,
  remoteFilename: string,
): TFile | null => getLocalScriptFiles(plugin, remoteFilename)[0] ?? null;

/** Returns all managed local copies for one community script. */
export const getInstalledScriptFiles = (
  plugin: ScriptLibraryPluginContext,
  source: string,
): TFile[] => getLocalScriptFiles(plugin, decodeRemoteFilename(source));

/**
 * Returns the primary managed local copy for one community script.
 * A copy directly under Downloaded wins; otherwise the shallowest grouped copy
 * is used. Additional copies are intentionally ignored for update detection.
 */
export const getInstalledScriptFile = (
  plugin: ScriptLibraryPluginContext,
  source: string,
): TFile | null => getInstalledScriptFiles(plugin, source)[0] ?? null;

/** Returns existing group folders relative to the Downloaded folder. */
export const getInstalledScriptGroups = (
  plugin: ScriptLibraryPluginContext,
): string[] => {
  const rootPath = getDownloadedScriptsFolder(plugin);
  const root = plugin.app.vault.getFolderByPath(rootPath);
  if (!root) {
    return [];
  }

  const groups: string[] = [];
  const visit = (folder: TFolder): void => {
    folder.children.forEach((child) => {
      if (!(child instanceof TFolder)) {
        return;
      }
      groups.push(child.path.slice(rootPath.length + 1));
      visit(child);
    });
  };
  visit(root);
  return groups.sort((a, b) => a.localeCompare(b));
};

const getManagedScriptFile = (
  plugin: ScriptLibraryPluginContext,
  source: string,
  localPath?: string,
): TFile | null => {
  const files = getInstalledScriptFiles(plugin, source);
  if (!localPath) {
    return files[0] ?? null;
  }
  const normalizedPath = normalizePath(localPath);
  return files.find((file) => file.path === normalizedPath) ?? null;
};

const ensureFolderPath = async (
  plugin: ScriptLibraryPluginContext,
  folderPath: string,
): Promise<void> => {
  const normalized = normalizePath(folderPath);
  const parts = normalized.split("/").filter(Boolean);
  let current = "";
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    if (plugin.app.vault.getFolderByPath(current)) {
      continue;
    }
    if (plugin.app.vault.getFileByPath(current)) {
      throw new Error(
        `Cannot create script group because a file exists at ${current}`,
      );
    }
    await plugin.app.vault.createFolder(current);
  }
};

/** Moves an installed script and its optional icon to a relative script group. */
export const moveInstalledScriptToGroup = async (
  plugin: ScriptLibraryPluginContext,
  source: string,
  relativeGroup: string,
  localPath?: string,
): Promise<TFile> => {
  const scriptFile = getManagedScriptFile(plugin, source, localPath);
  if (!scriptFile) {
    throw new Error("Script is not installed");
  }

  const root = getDownloadedScriptsFolder(plugin);
  const requestedGroup = relativeGroup.trim();
  const group = requestedGroup ? normalizePath(requestedGroup) : "";
  const destinationFolder = group ? normalizePath(`${root}/${group}`) : root;
  if (destinationFolder !== root && !destinationFolder.startsWith(`${root}/`)) {
    throw new Error("Invalid script group");
  }
  await ensureFolderPath(plugin, destinationFolder);

  const destinationPath = normalizePath(
    `${destinationFolder}/${scriptFile.name}`,
  );
  if (destinationPath === scriptFile.path) {
    return scriptFile;
  }
  const destinationStem = getScriptFileStem(scriptFile.name);
  const conflictingScript = ["md", "js"]
    .map((extension) =>
      plugin.app.vault.getFileByPath(
        normalizePath(`${destinationFolder}/${destinationStem}.${extension}`),
      ),
    )
    .find((file) => file && file.path !== scriptFile.path);
  if (conflictingScript) {
    throw new Error("A script with this name already exists in that group");
  }

  const sourceIconPath = getIMGFilename(scriptFile.path, "svg");
  const destinationIconPath = getIMGFilename(destinationPath, "svg");
  const iconFile = plugin.app.vault.getFileByPath(sourceIconPath);
  if (iconFile && plugin.app.vault.getFileByPath(destinationIconPath)) {
    throw new Error(
      "A script icon with this name already exists in that group",
    );
  }

  let iconMoved = false;
  try {
    if (iconFile) {
      await plugin.app.fileManager.renameFile(iconFile, destinationIconPath);
      iconMoved = true;
    }
    await plugin.scriptEngine.renameManagedScriptFile(
      scriptFile,
      destinationPath,
    );
  } catch (error: unknown) {
    if (iconMoved) {
      const movedIcon = plugin.app.vault.getFileByPath(destinationIconPath);
      if (movedIcon) {
        try {
          await plugin.app.fileManager.renameFile(movedIcon, sourceIconPath);
        } catch (rollbackError: unknown) {
          errorlog({
            where: "scriptLibraryUtils.moveInstalledScriptToGroup.rollback",
            source: destinationIconPath,
            error: rollbackError,
          });
        }
      }
    }
    throw error;
  }

  return plugin.app.vault.getFileByPath(destinationPath) ?? scriptFile;
};

/** Removes an installed community script and its optional local icon. */
export const uninstallScript = async (
  plugin: ScriptLibraryPluginContext,
  source: string,
  localPath?: string,
): Promise<void> => {
  const scriptFile = getManagedScriptFile(plugin, source, localPath);
  if (!scriptFile) {
    return;
  }
  const iconFile = plugin.app.vault.getFileByPath(
    getIMGFilename(scriptFile.path, "svg"),
  );
  await plugin.app.fileManager.trashFile(scriptFile);
  if (iconFile) {
    try {
      await plugin.app.fileManager.trashFile(iconFile);
    } catch (error: unknown) {
      errorlog({
        where: "scriptLibraryUtils.uninstallScript.icon",
        source: iconFile.path,
        error,
      });
    }
  }
  await plugin.scriptEngine.reloadScripts();
};

const getDirectoryInfo = async (): Promise<Map<string, number> | null> => {
  if (
    !directoryInfoPromise ||
    Date.now() - directoryInfoFetchedAt > REMOTE_METADATA_CACHE_TTL
  ) {
    directoryInfoFetchedAt = Date.now();
    directoryInfoPromise = (async () => {
      try {
        const parsed: unknown = JSON.parse(
          await request({
            url: URLs.RAW_GITHUBUSERCONTENT_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_MASTER_EA_SCRIPTS_DIRECTORY_INFO_JSON,
          }),
        ) as unknown;
        if (!Array.isArray(parsed)) {
          return null;
        }
        const files = new Map<string, number>();
        parsed.forEach((entry: unknown) => {
          if (isRemoteDirectoryInfo(entry)) {
            files.set(entry.fname, entry.mtime);
          }
        });
        return files.size > 0 ? files : null;
      } catch (error: unknown) {
        errorlog({
          where: "scriptLibraryUtils.getDirectoryInfo",
          error,
        });
        return null;
      }
    })();
  }
  return await directoryInfoPromise;
};

const getInstallStateFromDirectoryInfo = (
  plugin: ScriptLibraryPluginContext,
  scriptFile: TFile,
  remoteFilename: string,
  files: Map<string, number>,
): ScriptStoreInstallState => {
  if (!files.has(remoteFilename)) {
    return "error";
  }

  const scriptMtime = files.get(remoteFilename) ?? 0;
  if (scriptMtime > scriptFile.stat.mtime) {
    return "update";
  }

  const iconFilename = getIMGFilename(remoteFilename, "svg");
  const iconMtime = files.get(iconFilename);
  if (!iconMtime) {
    return "up-to-date";
  }
  const iconFile = plugin.app.vault.getFileByPath(
    getIMGFilename(scriptFile.path, "svg"),
  );
  return !iconFile || iconMtime > iconFile.stat.mtime
    ? "update"
    : "up-to-date";
};

/**
 * Resolves one community script's install/update state using the legacy mtime
 * contract. directory-info.json is the compatibility source of truth.
 */
export const getScriptInstallState = async (
  plugin: ScriptLibraryPluginContext,
  source: string,
): Promise<ScriptStoreInstallState> => {
  const remoteFilename = decodeRemoteFilename(source);
  const scriptFile = getLocalScriptFile(plugin, remoteFilename);
  if (!scriptFile) {
    return "install";
  }
  const files = await getDirectoryInfo();
  if (!files) {
    return "error";
  }
  return getInstallStateFromDirectoryInfo(
    plugin,
    scriptFile,
    remoteFilename,
    files,
  );
};

const restartSidepanelTabIfActive = async (
  plugin: ScriptLibraryPluginContext,
  scriptFile: TFile,
): Promise<void> => {
  const scriptName = plugin.scriptEngine.getScriptName(scriptFile);
  const spView = ExcalidrawSidepanelView.getExisting(false);
  if (!spView || !scriptName || !spView.getTabByScript(scriptName)) {
    return;
  }
  try {
    await spView.restartTabForScript(scriptName);
  } catch (error: unknown) {
    errorlog({
      where: "scriptLibraryUtils.restartSidepanelTabIfActive",
      error,
      scriptName,
    });
  }
};

export type InstalledScriptResult = {
  scriptFile: TFile;
  iconFile: TFile | null;
};

/** Installs or updates one managed community script. */
export const installScript = async (
  plugin: ScriptLibraryPluginContext,
  source: string,
  showNotice = true,
): Promise<InstalledScriptResult> => {
  const remoteFilename = decodeRemoteFilename(source);
  const scriptStem = getScriptFileStem(remoteFilename);
  const folder = getDownloadedScriptsFolder(plugin);
  let scriptFile = getLocalScriptFile(plugin, remoteFilename);
  const getLocalScriptPath = (): string => {
    const targetFolder = scriptFile?.parent?.path ?? folder;
    return `${targetFolder}/${scriptStem}.${getManagedScriptFileExtension(
      plugin.settings.allowJavaScriptFiles,
      plugin.settings.storeScriptFilesAsJavaScript,
    )}`;
  };

  let scriptPath = getLocalScriptPath();
  let iconFile = plugin.app.vault.getFileByPath(
    getIMGFilename(scriptPath, "svg"),
  );

  const download = async (
    url: string,
    file: TFile | null,
    localPath: string,
  ): Promise<TFile | null> => {
    const data = await request({ url });
    if (!data || data.startsWith("404: Not Found")) {
      return null;
    }
    return await createOrOverwriteFile(
      plugin.app,
      file?.path ?? localPath,
      data,
    );
  };

  try {
    scriptPath = getLocalScriptPath();
    if (scriptFile && scriptFile.path !== scriptPath) {
      if (plugin.app.vault.getFileByPath(scriptPath)) {
        scriptPath = scriptFile.path;
      } else {
        await plugin.scriptEngine.renameManagedScriptFile(scriptFile, scriptPath);
      }
    }

    scriptFile = await download(source, scriptFile, scriptPath);
    if (!scriptFile) {
      throw new Error("Script file not found");
    }

    const iconPath = getIMGFilename(scriptFile.path, "svg");
    iconFile = await download(
      getIMGFilename(source, "svg"),
      plugin.app.vault.getFileByPath(iconPath),
      iconPath,
    );

    if (Object.keys(plugin.scriptEngine.scriptIconMap ?? {}).length === 0) {
      await plugin.scriptEngine.loadScripts();
    }
    await restartSidepanelTabIfActive(plugin, scriptFile);
    if (showNotice) {
      new Notice(`${t("SCRIPT_INSTALLED_NOTICE")}: ${scriptFile.basename}`);
    }
    return { scriptFile, iconFile };
  } catch (error: unknown) {
    if (showNotice) {
      new Notice(`${t("SCRIPT_INSTALL_ERROR_NOTICE")}: ${remoteFilename}`);
    }
    errorlog({
      where: "scriptLibraryUtils.installScript",
      source,
      error,
    });
    throw error;
  }
};

/**
 * Returns community scripts with updates, considering only managed copies under
 * the Downloaded folder. When duplicate managed copies exist, update detection
 * uses the same primary-copy selection as the script-store details page.
 */
export const getInstalledScriptUpdates = async (
  plugin: ScriptLibraryPluginContext,
): Promise<string[]> => {
  if (!plugin.settings.scriptFolderPath) {
    return [];
  }

  const managedFiles = getPreferredScriptFiles(
    plugin.app.vault
      .getFiles()
      .filter(
        (file) =>
          isInDownloadedScriptsFolder(plugin, file) &&
          isScriptFilePath(file.path),
      ),
  );
  if (managedFiles.length === 0) {
    return [];
  }

  const files = await getDirectoryInfo();
  if (!files) {
    return [];
  }

  const copiesByStem = new Map<string, TFile[]>();
  managedFiles.forEach((file) => {
    const stem = getScriptFileStem(file.name);
    const copies = copiesByStem.get(stem) ?? [];
    copies.push(file);
    copiesByStem.set(stem, copies);
  });

  const updates: string[] = [];
  copiesByStem.forEach((copies, stem) => {
    const scriptFile = sortManagedCopies(plugin, copies)[0];
    if (!scriptFile) {
      return;
    }
    const remoteFilename = files.has(`${stem}.md`)
      ? `${stem}.md`
      : files.has(`${stem}.js`)
        ? `${stem}.js`
        : null;
    if (!remoteFilename) {
      return;
    }
    if (
      getInstallStateFromDirectoryInfo(
        plugin,
        scriptFile,
        remoteFilename,
        files,
      ) === "update"
    ) {
      updates.push(stem);
    }
  });

  return updates.sort((a, b) => a.localeCompare(b));
};

export const installButton = async (
  plugin: ScriptLibraryPluginContext,
  button: HTMLButtonElement,
  button2: HTMLButtonElement | null,
  source: string,
): Promise<void> => {
  const setButtonText = (
    text: "CHECKING" | "INSTALL" | "UPTODATE" | "UPDATE" | "ERROR",
  ) => {
    if (button2) {
      hideElement(button2);
    }
    switch (text) {
      case "CHECKING":
        button.setText(t("CHECKING_SCRIPT"));
        setButtonBgColor(button, "normal");
        break;
      case "INSTALL":
        button.setText(t("INSTALL_SCRIPT"));
        setButtonBgColor(button, "accent");
        break;
      case "UPTODATE":
        button.setText(t("UPTODATE_SCRIPT"));
        setButtonBgColor(button, "normal");
        break;
      case "UPDATE":
        button.setText(t("UPDATE_SCRIPT"));
        setButtonBgColor(button, "success");
        if (button2) {
          showElement(button2);
        }
        break;
      case "ERROR":
        button.setText(t("UNABLETOCHECK_SCRIPT"));
        setButtonBgColor(button, "normal");
        break;
    }
  };

  button.addClass("mod-muted");
  setButtonText(
    getLocalScriptFile(plugin, decodeRemoteFilename(source))
      ? "CHECKING"
      : "INSTALL",
  );

  button.onclick = async () => {
    setButtonText("CHECKING");
    try {
      await installScript(plugin, source);
      setButtonText("UPTODATE");
    } catch {
      setButtonText("ERROR");
    }
  };
  if (button2) {
    button2.onclick = button.onclick;
  }

  const state = await getScriptInstallState(plugin, source);
  switch (state) {
    case "install":
      setButtonText("INSTALL");
      break;
    case "update":
      setButtonText("UPDATE");
      break;
    case "up-to-date":
      setButtonText("UPTODATE");
      break;
    case "error":
      setButtonText("ERROR");
      break;
  }
};
