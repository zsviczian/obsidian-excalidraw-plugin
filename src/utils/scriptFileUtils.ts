import { normalizePath, type TFile } from "obsidian";

export type ScriptFileExtension = "md" | "js";

/** Returns whether a path names a supported Excalidraw Automate script file. */
export const isScriptFilePath = (path: string): boolean =>
  /\.(?:md|js)$/i.test(path);

/** Returns a script path with its final `.md` or `.js` suffix replaced. */
export const replaceScriptFileExtension = (
  path: string,
  extension: ScriptFileExtension,
): string =>
  isScriptFilePath(path)
    ? path.replace(/\.(?:md|js)$/i, `.${extension}`)
    : path;

/** Returns the filename stem shared by equivalent `.md` and `.js` scripts. */
export const getScriptFileStem = (filename: string): string =>
  filename.replace(/\.(?:md|js)$/i, "");

/**
 * Collapses equivalent `.md` and `.js` paths to one script, preferring the
 * Markdown file when both exist.
 */
export const getPreferredScriptFiles = (files: Iterable<TFile>): TFile[] => {
  const filesByStem = new Map<string, TFile>();
  for (const file of files) {
    const stem = getScriptFileStem(file.path);
    const existing = filesByStem.get(stem);
    if (
      !existing ||
      (existing.extension.toLowerCase() === "js" &&
        file.extension.toLowerCase() === "md")
    ) {
      filesByStem.set(stem, file);
    }
  }
  return Array.from(filesByStem.values());
};

/**
 * Returns the extension used for locally managed scripts. JavaScript storage
 * is effective only when JavaScript script loading is also enabled.
 */
export const getManagedScriptFileExtension = (
  allowJavaScriptFiles: boolean,
  storeScriptFilesAsJavaScript: boolean,
): ScriptFileExtension =>
  allowJavaScriptFiles && storeScriptFilesAsJavaScript ? "js" : "md";

/** Resolves a configured startup path while preserving the `.md` default. */
export const resolveConfiguredStartupScriptPath = (
  configuredPath: string,
): string | null => {
  const path = normalizePath(configuredPath.trim());
  if (!path) {
    return null;
  }
  return isScriptFilePath(path) ? path : `${path}.md`;
};
