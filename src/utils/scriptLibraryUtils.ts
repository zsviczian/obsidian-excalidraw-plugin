import { TFile, Notice, request } from "obsidian";
import { SCRIPT_INSTALL_FOLDER } from "src/constants/constants";
import { URLs } from "src/constants/safeUrls";
import { t } from "src/lang/helpers";
import { RemoteDirectoryInfo } from "src/types/githubTypes";
import { ExcalidrawSidepanelView } from "src/view/sidepanel/Sidepanel";
import { errorlog } from "./coreUtils";
import { getIMGFilename, createOrOverwriteFile } from "./fileUtils";
import { hideElement, setButtonBgColor, showElement } from "./styleUtils";
import ExcalidrawPlugin from "src/core/main";

export const installButton = async (
  plugin: ExcalidrawPlugin,
  button: HTMLButtonElement,
  button2: HTMLButtonElement,
  source: string,
) => {
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
  let decodedURI = source;
  try {
    decodedURI = decodeURI(source);
  } catch (e) {
    errorlog({
      where:
        "ExcalidrawPlugin.registerInstallCodeblockProcessor.codeblockProcessor.onClick",
      source,
      error: e,
    });
  }
  const fname = decodedURI.substring(decodedURI.lastIndexOf("/") + 1);
  const folder = `${plugin.settings.scriptFolderPath}/${SCRIPT_INSTALL_FOLDER}`;
  const downloaded = plugin.app.vault
    .getFiles()
    .filter((f) => f.path.startsWith(folder) && f.name === fname)
    .sort((a, b) => (a.path > b.path ? 1 : -1));
  let scriptFile = downloaded[0];
  const scriptPath = scriptFile?.path ?? `${folder}/${fname}`;
  const svgPath = getIMGFilename(scriptPath, "svg");
  let svgFile = plugin.app.vault.getFileByPath(svgPath);
  setButtonText(scriptFile ? "CHECKING" : "INSTALL");
  button.onclick = async () => {
    const download = async (
      url: string,
      file: TFile,
      localPath: string,
    ): Promise<TFile> => {
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
      scriptFile = await download(source, scriptFile, scriptPath);
      if (!scriptFile) {
        setButtonText("ERROR");
        throw "File not found";
      }
      svgFile = await download(getIMGFilename(source, "svg"), svgFile, svgPath);
      setButtonText("UPTODATE");
      if (Object.keys(plugin.scriptEngine.scriptIconMap).length === 0) {
        plugin.scriptEngine.loadScripts();
      }
      const restartSidepanelTabIfActive = async () => {
        if (!plugin.scriptEngine || !(scriptFile instanceof TFile)) {
          return;
        }
        const scriptName = plugin.scriptEngine.getScriptName(scriptFile);
        const spView = ExcalidrawSidepanelView.getExisting(false);
        if (!spView || !scriptName || !spView.getTabByScript(scriptName)) {
          return;
        }
        try {
          await spView.restartTabForScript(scriptName);
        } catch (error) {
          errorlog({
            where:
              "ExcalidrawPlugin.registerInstallCodeblockProcessor.restartSidepanelTab",
            error,
            scriptName,
          });
        }
      };
      await restartSidepanelTabIfActive();
      new Notice(`Installed: ${scriptFile.basename}`);
    } catch (e) {
      new Notice(`Error installing script: ${fname}`);
      errorlog({
        where:
          "ExcalidrawPlugin.registerInstallCodeblockProcessor.codeblockProcessor.onClick",
        error: e,
      });
    }
  };
  if (button2) {
    button2.onclick = button.onclick;
  }

  //check modified date on github
  //https://superuser.com/questions/1406875/how-to-get-the-latest-commit-date-of-a-file-from-a-given-github-reposotiry
  if (!scriptFile || !(scriptFile instanceof TFile)) {
    return;
  }

  const files = new Map<string, number>();
  JSON.parse(
    await request({
      url: URLs.RAW_GITHUBUSERCONTENT_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_MASTER_EA_SCRIPTS_DIRECTORY_INFO_JSON,
    }),
  ).forEach((f: RemoteDirectoryInfo) => files.set(f.fname, f.mtime));

  const checkModifyDate = (
    gitFilename: string,
    file: TFile,
  ): "ERROR" | "UPDATE" | "UPTODATE" => {
    if (files.size === 0 || !files.has(gitFilename)) {
      //setButtonText("ERROR");
      return "ERROR";
    }
    const mtime = files.get(gitFilename);
    if (!file || mtime > file.stat.mtime) {
      //setButtonText("UPDATE");
      return "UPDATE";
    }
    return "UPTODATE";
  };

  const scriptButtonText = checkModifyDate(fname, scriptFile);
  const svgButtonText = checkModifyDate(
    getIMGFilename(fname, "svg"),
    !svgFile || !(svgFile instanceof TFile) ? null : svgFile,
  );

  setButtonText(
    scriptButtonText === "UPTODATE" && svgButtonText === "UPTODATE"
      ? "UPTODATE"
      : scriptButtonText === "UPTODATE" && svgButtonText === "ERROR"
        ? "UPTODATE"
        : scriptButtonText === "ERROR"
          ? "ERROR"
          : scriptButtonText === "UPDATE" || svgButtonText === "UPDATE"
            ? "UPDATE"
            : "UPTODATE",
  );
};
