import type { App, TFile } from "obsidian";
import type { SelectableFontOption } from "src/types/fontTypes";

const LOCAL_FONT_EXTENSIONS = ["ttf", "woff", "woff2", "otf"];

const MARKDOWN_FONT_FAMILY_IDS = {
  Virgil: 1,
  Cascadia: 3,
  Excalifont: 5,
  "Comic Shanns": 8,
  "Liberation Sans": 9,
} as const;

type MarkdownFontFamily = keyof typeof MARKDOWN_FONT_FAMILY_IDS;

export const MARKDOWN_FONT_FAMILIES: readonly MarkdownFontFamily[] =
  Object.freeze(
    Object.keys(MARKDOWN_FONT_FAMILY_IDS) as MarkdownFontFamily[],
  );

/** Returns Excalidraw's numeric identifier for a built-in Markdown font. */
export function getMarkdownFontFamilyId(fontFamily: string): number | null {
  return Object.prototype.hasOwnProperty.call(
    MARKDOWN_FONT_FAMILY_IDS,
    fontFamily,
  )
    ? MARKDOWN_FONT_FAMILY_IDS[fontFamily as MarkdownFontFamily]
    : null;
}

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
