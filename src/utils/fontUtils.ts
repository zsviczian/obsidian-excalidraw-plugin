import type { App, TFile } from "obsidian";
import type { SelectableFontOption } from "src/types/fontTypes";

const LOCAL_FONT_EXTENSIONS = ["ttf", "woff", "woff2", "otf"];

export const MARKDOWN_FONT_FAMILIES = [
  "Virgil",
  "Cascadia",
  "Excalifont",
  "Comic Shanns",
  "Liberation Sans",
] as const;

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

/** Builds a fresh font option list from bundled names and current vault files. */
export function getSelectableFontOptions(
  app: App,
  fontAssetsPath: string,
  builtInFonts: readonly string[] = MARKDOWN_FONT_FAMILIES,
): SelectableFontOption[] {
  return [
    ...builtInFonts.map((font) => ({ value: font, label: font })),
    ...getSelectableFontFiles(app, fontAssetsPath).map((fontFile) => ({
      value: fontFile.path,
      label: fontFile.name,
      fontFile,
    })),
  ];
}
