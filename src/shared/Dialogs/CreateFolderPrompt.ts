import { Notice, normalizePath } from "obsidian";
import type ExcalidrawPlugin from "src/core/main";
import { t } from "src/lang/helpers";
import { MultiOptionConfirmationPrompt } from "./Prompt";

/** Confirms and creates a missing vault folder without overwriting files. */
export const confirmAndCreateFolder = async (
  plugin: ExcalidrawPlugin,
  requestedPath: string,
): Promise<boolean> => {
  const path = normalizePath(requestedPath.trim());
  if (!path) {
    return false;
  }

  if (plugin.app.vault.getFolderByPath(path)) {
    return true;
  }
  if (plugin.app.vault.getFileByPath(path)) {
    new Notice(t("CREATE_FOLDER_PATH_IS_FILE").replace("{PATH}", path), 6000);
    return false;
  }

  const confirmed = await new MultiOptionConfirmationPrompt<boolean | null>(
    plugin,
    t("CREATE_FOLDER_CONFIRM").replace("{PATH}", path),
    new Map<string, boolean | null>([
      [t("CREATE_FOLDER_NEVER_MIND"), false],
      [t("CREATE_FOLDER_YES"), true],
    ]),
    t("CREATE_FOLDER_YES"),
  ).waitForClose;
  if (confirmed !== true) {
    return false;
  }

  try {
    await plugin.app.vault.createFolder(path);
    new Notice(t("CREATE_FOLDER_SUCCESS").replace("{PATH}", path));
    return true;
  } catch (error) {
    console.error(`Could not create folder '${path}'`, error);
    new Notice(t("CREATE_FOLDER_FAILED").replace("{PATH}", path), 6000);
    return false;
  }
};
