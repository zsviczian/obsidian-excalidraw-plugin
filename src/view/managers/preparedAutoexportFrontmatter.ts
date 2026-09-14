import type { AutoexportConfig } from "../../types/excalidrawViewTypes";
import type { PreparedSaveExportOptions } from "./saveSnapshot";

export interface PreparedAutoexportSettings {
  readonly exportOptions: PreparedSaveExportOptions;
  readonly autoexportConfig: Readonly<AutoexportConfig>;
}

type Frontmatter = Readonly<Record<string, unknown>>;

const hasValue = (value: unknown): boolean =>
  value !== null && typeof value !== "undefined";

const getScalarText = (value: unknown): string | null => {
  switch (typeof value) {
    case "string":
      return value;
    case "number":
    case "boolean":
      return `${value}`;
    default:
      return null;
  }
};

const parsePositiveNumber = (
  value: unknown,
  fallback: number,
): number => {
  if (!hasValue(value)) {
    return fallback;
  }
  const scalar = getScalarText(value);
  if (scalar === null) {
    return fallback;
  }
  const parsed = Number.parseFloat(scalar);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseInteger = (value: unknown, fallback: number): number => {
  if (!hasValue(value)) {
    return fallback;
  }
  const scalar = getScalarText(value);
  if (scalar === null) {
    return fallback;
  }
  const parsed = Number.parseInt(scalar, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/** Resolves automatic-export settings from the exact persisted frontmatter. */
export const resolvePreparedAutoexportSettings = (
  defaults: PreparedAutoexportSettings,
  frontmatter: Frontmatter,
): PreparedAutoexportSettings => {
  const exportDark = frontmatter["excalidraw-export-dark"];
  const embedScene = frontmatter["excalidraw-export-embed-scene"];
  const transparent = frontmatter["excalidraw-export-transparent"];
  const internalLinks = frontmatter["excalidraw-export-internal-links"];
  const mask = frontmatter["excalidraw-mask"];
  const padding = frontmatter["excalidraw-export-padding"];
  const legacyPadding = frontmatter["excalidraw-export-svgpadding"];
  const scale = frontmatter["excalidraw-export-pngscale"];

  const exportOptions: PreparedSaveExportOptions = {
    ...defaults.exportOptions,
    theme: hasValue(exportDark)
      ? exportDark
        ? "dark"
        : "light"
      : defaults.exportOptions.theme,
    embedScene: hasValue(embedScene)
      ? Boolean(embedScene)
      : defaults.exportOptions.embedScene,
    padding: hasValue(padding)
      ? parseInteger(padding, defaults.exportOptions.padding)
      : parseInteger(legacyPadding, defaults.exportOptions.padding),
    scale: parsePositiveNumber(scale, defaults.exportOptions.scale),
    withBackground: hasValue(transparent)
      ? !transparent
      : defaults.exportOptions.withBackground,
    includeInternalLinks: hasValue(internalLinks)
      ? Boolean(internalLinks)
      : defaults.exportOptions.includeInternalLinks,
    isMask: hasValue(mask) ? Boolean(mask) : defaults.exportOptions.isMask,
  };

  const autoexportConfig: AutoexportConfig = {
    ...defaults.autoexportConfig,
    theme:
      defaults.autoexportConfig.theme === "both"
        ? "both"
        : exportOptions.theme,
  };
  const autoexport = frontmatter["excalidraw-autoexport"];
  const autoexportText = getScalarText(autoexport)?.toLowerCase();
  if (autoexportText) {
    switch (autoexportText) {
      case "none":
        autoexportConfig.svg = false;
        autoexportConfig.png = false;
        break;
      case "both":
        autoexportConfig.svg = true;
        autoexportConfig.png = true;
        break;
      case "png":
        autoexportConfig.svg = false;
        autoexportConfig.png = true;
        break;
      case "svg":
        autoexportConfig.svg = true;
        autoexportConfig.png = false;
        break;
    }
  }

  return { exportOptions, autoexportConfig };
};
