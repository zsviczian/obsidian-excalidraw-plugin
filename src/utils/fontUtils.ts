import type { App, TFile } from "obsidian";

const LOCAL_FONT_EXTENSIONS = ["ttf", "woff", "woff2", "otf"];

/** Returns vault font files that are eligible for user-selectable font lists. */
export function getSelectableFontFiles(
  app: App,
  fontAssetsPath: string,
): TFile[] {
  return app.vault
    .getFiles()
    .filter(
      (file) =>
        LOCAL_FONT_EXTENSIONS.includes(file.extension) &&
        !file.path.startsWith(fontAssetsPath),
    );
}
