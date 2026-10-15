import type { Mutable } from "@zsviczian/excalidraw/types/common/src/utility-types";
import type {
  ExcalidrawElement,
  ExcalidrawImageElement,
} from "@zsviczian/excalidraw/types/element/src/types";
import type { PDFPageViewProps } from "src/types/embeddedFileLoaderTypes";

export type ExcalidrawCustomDataValue =
  | string
  | number
  | boolean
  | null
  | ExcalidrawCustomDataValue[]
  | { [key: string]: ExcalidrawCustomDataValue };

export type ExcalidrawCustomData = Record<
  string,
  ExcalidrawCustomDataValue | undefined
>;

export type ExcalidrawCustomDataPatch = Partial<ExcalidrawCustomData>;

export type ExcalidrawPDFCustomData = ExcalidrawCustomData & {
  pdfPageViewProps?: PDFPageViewProps;
};

export type ExcalidrawLatexCustomData = ExcalidrawCustomData & {
  latex?: string;
  latexscale?: number;
};

export type ExcalidrawImageWithCustomData<
  TCustomData extends ExcalidrawCustomData = ExcalidrawCustomData,
> = ExcalidrawImageElement & {
  customData?: TCustomData;
};

export function addAppendUpdateCustomData(
  el: Mutable<ExcalidrawElement>,
  newData: ExcalidrawCustomDataPatch,
): ExcalidrawElement {
  if (!newData) {
    return el;
  }
  if (!el.customData) {
    el.customData = {};
  }
  for (const key in newData) {
    if (typeof newData[key] === "undefined") {
      delete el.customData[key];
      continue;
    }
    el.customData[key] = newData[key];
  }
  return el;
}

/** Versioned, bounded descriptive image annotations for CLI previews (#3004). */
export const CLI_IMAGE_CUSTOM_DATA_KEY = "excalidrawCLI";
export type CLIImageMetadata = {
  version: 1;
  label?: string;
  tags?: string[];
};

/** Ignore malformed/forward-versioned annotations without dropping other customData. */
export function getCLIImageMetadata(element: ExcalidrawImageElement): CLIImageMetadata | null {
  const value: unknown = (element as ExcalidrawImageWithCustomData).customData?.[CLI_IMAGE_CUSTOM_DATA_KEY];
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const metadata = value as Record<string, unknown>;
  if (metadata.version !== 1) return null;
  return {
    version: 1,
    ...(typeof metadata.label === "string" && metadata.label.length <= 80 ? { label: metadata.label } : {}),
    ...(Array.isArray(metadata.tags) && metadata.tags.length <= 12 && metadata.tags.every(tag => typeof tag === "string" && tag.length <= 32) ? { tags: metadata.tags as string[] } : {}),
  };
}

/** Reject unbounded or invalid metadata before a guarded element mutation. */
export function cliImageMetadataPatch(element: ExcalidrawImageElement, label: unknown, tags: unknown): ExcalidrawCustomData {
  const customData = element.customData as ExcalidrawCustomData | undefined;
  const previous = customData?.[CLI_IMAGE_CUSTOM_DATA_KEY];
  if (previous !== undefined && (!previous || typeof previous !== "object" || Array.isArray(previous) || previous.version !== 1)) throw new Error("Unsupported image metadata version; existing annotations were preserved.");
  const next: Record<string, ExcalidrawCustomDataValue> = { ...(previous as Record<string, ExcalidrawCustomDataValue> | undefined), version: 1 };
  if (label !== undefined) {
    if (label !== null && (typeof label !== "string" || !label.trim() || label.length > 80)) throw new Error("Image label must be 1–80 characters or null to clear.");
    if (label === null) delete next.label;
    else next.label = label as string;
  }
  if (tags !== undefined) {
    if (tags !== null && (!Array.isArray(tags) || tags.length > 12 || tags.some(tag => typeof tag !== "string" || !tag.trim() || tag.length > 32) || new Set(tags).size !== tags.length)) throw new Error("Image tags must be a list of up to 12 unique short strings or null to clear.");
    if (tags === null) delete next.tags;
    else next.tags = [...(tags as string[])];
  }
  return { ...(element.customData ?? {}), [CLI_IMAGE_CUSTOM_DATA_KEY]: next };
}
