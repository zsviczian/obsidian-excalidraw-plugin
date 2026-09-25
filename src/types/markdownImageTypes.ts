export { MARKDOWN_IMAGE_CUSTOM_DATA_KEY } from "../utils/elementCustomDataUtils";
export const MARKDOWN_IMAGE_EMBEDDED_FILE_TOKEN = "markdown-image";
export const MARKDOWN_IMAGE_SCHEMA_VERSION = 1;

export type MarkdownImageSource = "local" | "external";

/** Persisted behavior for deleting a local Markdown image from the scene. */
export type MarkdownImageDeletionPreference = "ask" | "keep" | "delete";

export type MarkdownImageTransclusionRenderSettings = {
  enabled: boolean;
  fontFamily: string;
  fontColor: string;
  border: {
    enabled: boolean;
    color: string;
  };
  css: string;
};

export type MarkdownImageRenderSettings = {
  width: number;
  paddingBottom: number;
  fontFamily: string;
  fontColor: string;
  border: {
    enabled: boolean;
    color: string;
  };
  css: string;
  transclusion: MarkdownImageTransclusionRenderSettings;
};

export type MarkdownImageCustomData = {
  /** Intrinsic size of the last SVG rendered for this element. */
  renderedSize?: { width: number; height: number };
  schemaVersion: typeof MARKDOWN_IMAGE_SCHEMA_VERSION;
  /** Advisory revision for changes made through the Excalidraw UI. */
  version: number;
  source: MarkdownImageSource;
  render: MarkdownImageRenderSettings;
};

export type MarkdownImageData = {
  markdown: string;
};

export type MarkdownImageSettings = {
  defaults: MarkdownImageRenderSettings;
};
