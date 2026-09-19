import { Notice, request, TFile, type App } from "obsidian";
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

const getDownloadedScriptsFolder = (plugin: ScriptLibraryPluginContext): string =>
  `${plugin.settings.scriptFolderPath}/${SCRIPT_INSTALL_FOLDER}`;

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

const getLocalScriptFile = (
  plugin: ScriptLibraryPluginContext,
  remoteFilename: string,
): TFile | null => {
  const folder = getDownloadedScriptsFolder(plugin);
  const stem = getScriptFileStem(remoteFilename);
  return (
    plugin.app.vault.getFileByPath(`${folder}/${stem}.md`) ??
    plugin.app.vault.getFileByPath(`${folder}/${stem}.js`)
  );
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

const getInstallStateFromDirectoryInfo = async (
  plugin: ScriptLibraryPluginContext,
  scriptFile: TFile,
  remoteFilename: string,
): Promise<ScriptStoreInstallState> => {
  const files = await getDirectoryInfo();
  if (!files?.has(remoteFilename)) {
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
  return await getInstallStateFromDirectoryInfo(
    plugin,
    scriptFile,
    remoteFilename,
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
  const getLocalScriptPath = (): string =>
    `${folder}/${scriptStem}.${getManagedScriptFileExtension(
      plugin.settings.allowJavaScriptFiles,
      plugin.settings.storeScriptFilesAsJavaScript,
    )}`;

  let scriptFile = getLocalScriptFile(plugin, remoteFilename);
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

/** Returns installed managed scripts with a newer script mtime. */
export const getInstalledScriptUpdates = async (
  plugin: ScriptLibraryPluginContext,
): Promise<string[]> => {
  if (!plugin.settings.scriptFolderPath) {
    return [];
  }
  const folder = getDownloadedScriptsFolder(plugin);
  const installedScripts = getPreferredScriptFiles(
    plugin.app.vault
      .getFiles()
      .filter(
        (file) => file.parent?.path === folder && isScriptFilePath(file.path),
      ),
  );
  if (installedScripts.length === 0) {
    return [];
  }

  const files = await getDirectoryInfo();
  if (!files) {
    return [];
  }

  return installedScripts
    .filter((scriptFile) => {
      const stem = getScriptFileStem(scriptFile.name);
      const scriptMtime = Math.max(
        files.get(`${stem}.md`) ?? 0,
        files.get(`${stem}.js`) ?? 0,
      );
      return scriptMtime > scriptFile.stat.mtime;
    })
    .map((scriptFile) => getScriptFileStem(scriptFile.name))
    .sort((a, b) => a.localeCompare(b));
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
