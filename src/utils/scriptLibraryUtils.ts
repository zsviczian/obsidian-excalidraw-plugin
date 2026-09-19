import { Notice, request, TFile } from "obsidian";
import { SCRIPT_INSTALL_FOLDER } from "src/constants/constants";
import { URLs } from "src/constants/safeUrls";
import { t } from "src/lang/helpers";
import type ExcalidrawPlugin from "src/core/main";
import type {
  GitHubRepositoryContentFile,
  RemoteDirectoryInfo,
} from "src/types/githubTypes";
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

const REMOTE_METADATA_CACHE_TTL = 15 * 60 * 1000;
let remoteScriptFilesPromise: Promise<
  Map<string, GitHubRepositoryContentFile> | null
> | null = null;
let remoteScriptFilesFetchedAt = 0;
let legacyDirectoryInfoPromise: Promise<Map<string, number> | null> | null =
  null;
let legacyDirectoryInfoFetchedAt = 0;

const getDownloadedScriptsFolder = (plugin: ExcalidrawPlugin): string =>
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

/**
 * Returns the current GitHub file listing for ea-scripts. The result is cached
 * so rendering many script cards costs one API request, not one request per
 * script.
 */
export const getRemoteScriptFiles = async (): Promise<
  Map<string, GitHubRepositoryContentFile> | null
> => {
  if (
    !remoteScriptFilesPromise ||
    Date.now() - remoteScriptFilesFetchedAt > REMOTE_METADATA_CACHE_TTL
  ) {
    remoteScriptFilesFetchedAt = Date.now();
    remoteScriptFilesPromise = (async () => {
      try {
        const result = JSON.parse(
          await request({
            url: URLs.API_GITHUB_COM_REPOS_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_CONTENTS_EA_SCRIPTS,
          }),
        ) as unknown;
        if (!Array.isArray(result)) {
          return null;
        }
        const files = new Map<string, GitHubRepositoryContentFile>();
        result.forEach((entry: GitHubRepositoryContentFile) => {
          if (entry?.type === "file" && entry.name && entry.sha) {
            files.set(entry.name, entry);
          }
        });
        return files.size > 0 ? files : null;
      } catch (error: unknown) {
        errorlog({
          where: "scriptLibraryUtils.getRemoteScriptFiles",
          error,
        });
        return null;
      }
    })();
  }
  return await remoteScriptFilesPromise;
};

const getLegacyDirectoryInfo = async (): Promise<Map<string, number> | null> => {
  if (
    !legacyDirectoryInfoPromise ||
    Date.now() - legacyDirectoryInfoFetchedAt > REMOTE_METADATA_CACHE_TTL
  ) {
    legacyDirectoryInfoFetchedAt = Date.now();
    legacyDirectoryInfoPromise = (async () => {
      try {
        const directoryInfo = JSON.parse(
          await request({
            url: URLs.RAW_GITHUBUSERCONTENT_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_MASTER_EA_SCRIPTS_DIRECTORY_INFO_JSON,
          }),
        ) as RemoteDirectoryInfo[];
        const files = new Map<string, number>();
        directoryInfo.forEach((file) => files.set(file.fname, file.mtime));
        return files.size > 0 ? files : null;
      } catch (error: unknown) {
        errorlog({
          where: "scriptLibraryUtils.getLegacyDirectoryInfo",
          error,
        });
        return null;
      }
    })();
  }
  return await legacyDirectoryInfoPromise;
};

const getLocalScriptFile = (
  plugin: ExcalidrawPlugin,
  remoteFilename: string,
): TFile | null => {
  const folder = getDownloadedScriptsFolder(plugin);
  const stem = getScriptFileStem(remoteFilename);
  return (
    plugin.app.vault.getFileByPath(`${folder}/${stem}.md`) ??
    plugin.app.vault.getFileByPath(`${folder}/${stem}.js`)
  );
};

const getGitBlobSha = async (
  plugin: ExcalidrawPlugin,
  file: TFile,
): Promise<string> => {
  const fileData = new Uint8Array(await plugin.app.vault.readBinary(file));
  const header = new TextEncoder().encode(`blob ${fileData.byteLength}\0`);
  const blob = new Uint8Array(header.byteLength + fileData.byteLength);
  blob.set(header, 0);
  blob.set(fileData, header.byteLength);
  const digest = await crypto.subtle.digest("SHA-1", blob);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const isRemoteFileDifferent = async (
  plugin: ExcalidrawPlugin,
  localFile: TFile | null,
  remoteFile: GitHubRepositoryContentFile | undefined,
): Promise<boolean> => {
  if (!remoteFile) {
    return false;
  }
  if (!localFile) {
    return true;
  }
  return (await getGitBlobSha(plugin, localFile)) !== remoteFile.sha;
};

const getLegacyInstallState = async (
  plugin: ExcalidrawPlugin,
  scriptFile: TFile,
  remoteFilename: string,
): Promise<ScriptStoreInstallState> => {
  const files = await getLegacyDirectoryInfo();
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
 * Resolves one library script's install/update state. SHA comparison is the
 * primary path; directory-info.json remains a compatibility fallback.
 */
export const getScriptInstallState = async (
  plugin: ExcalidrawPlugin,
  source: string,
  remoteFiles?: Map<string, GitHubRepositoryContentFile> | null,
): Promise<ScriptStoreInstallState> => {
  const remoteFilename = decodeRemoteFilename(source);
  const scriptFile = getLocalScriptFile(plugin, remoteFilename);
  if (!scriptFile) {
    return "install";
  }

  const files = remoteFiles ?? (await getRemoteScriptFiles());
  const remoteScript = files?.get(remoteFilename);
  if (!files || !remoteScript) {
    return await getLegacyInstallState(plugin, scriptFile, remoteFilename);
  }

  if (await isRemoteFileDifferent(plugin, scriptFile, remoteScript)) {
    return "update";
  }

  const remoteIcon = files.get(getIMGFilename(remoteFilename, "svg"));
  if (!remoteIcon) {
    return "up-to-date";
  }
  const localIcon = plugin.app.vault.getFileByPath(
    getIMGFilename(scriptFile.path, "svg"),
  );
  return (await isRemoteFileDifferent(plugin, localIcon, remoteIcon))
    ? "update"
    : "up-to-date";
};

const restartSidepanelTabIfActive = async (
  plugin: ExcalidrawPlugin,
  scriptFile: TFile,
): Promise<void> => {
  if (!plugin.scriptEngine) {
    return;
  }
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
  plugin: ExcalidrawPlugin,
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
  const iconPath = getIMGFilename(scriptPath, "svg");
  let iconFile = plugin.app.vault.getFileByPath(iconPath);

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

    const resolvedIconPath = getIMGFilename(scriptFile.path, "svg");
    iconFile = await download(
      getIMGFilename(source, "svg"),
      plugin.app.vault.getFileByPath(resolvedIconPath),
      resolvedIconPath,
    );

    if (
      plugin.scriptEngine.scriptIconMap &&
      Object.keys(plugin.scriptEngine.scriptIconMap).length === 0
    ) {
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

/** Returns the installed managed scripts whose Git blob differs from GitHub. */
export const getInstalledScriptUpdates = async (
  plugin: ExcalidrawPlugin,
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

  const remoteFiles = await getRemoteScriptFiles();
  if (remoteFiles) {
    const updates: string[] = [];
    for (const scriptFile of installedScripts) {
      const stem = getScriptFileStem(scriptFile.name);
      const remoteScript =
        remoteFiles.get(`${stem}.md`) ?? remoteFiles.get(`${stem}.js`);
      if (!remoteScript) {
        continue;
      }
      if (await isRemoteFileDifferent(plugin, scriptFile, remoteScript)) {
        updates.push(stem);
        continue;
      }
      const remoteIcon = remoteFiles.get(`${stem}.svg`);
      if (!remoteIcon) {
        continue;
      }
      const localIcon = plugin.app.vault.getFileByPath(
        `${scriptFile.parent?.path}/${stem}.svg`,
      );
      if (await isRemoteFileDifferent(plugin, localIcon, remoteIcon)) {
        updates.push(stem);
      }
    }
    return updates.sort((a, b) => a.localeCompare(b));
  }

  const legacyFiles = await getLegacyDirectoryInfo();
  if (!legacyFiles) {
    return [];
  }
  return installedScripts
    .filter((scriptFile) => {
      const stem = getScriptFileStem(scriptFile.name);
      const remoteMtime = Math.max(
        legacyFiles.get(`${stem}.md`) ?? 0,
        legacyFiles.get(`${stem}.js`) ?? 0,
      );
      return remoteMtime > scriptFile.stat.mtime;
    })
    .map((scriptFile) => getScriptFileStem(scriptFile.name))
    .sort((a, b) => a.localeCompare(b));
};

export const installButton = async (
  plugin: ExcalidrawPlugin,
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
