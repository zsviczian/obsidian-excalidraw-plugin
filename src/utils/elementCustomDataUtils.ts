import type { Mutable } from "@zsviczian/excalidraw/types/common/src/utility-types";
import type {
  ExcalidrawElement,
  ExcalidrawImageElement,
} from "@zsviczian/excalidraw/types/element/src/types";
import type { PDFPageViewProps } from "src/types/embeddedFileLoaderTypes";

export const MARKDOWN_IMAGE_CUSTOM_DATA_KEY = "markdownImage";

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

/**
 * Records the SVG intrinsic size independently of an image element's canvas
 * dimensions. Copies with one file ID each retain their own canvas geometry.
 */
export function setMarkdownImageRenderedSize(
  element: Mutable<ExcalidrawImageElement>,
  size: { width: number; height: number },
): void {
  const markdownImage: unknown = element.customData?.[
    MARKDOWN_IMAGE_CUSTOM_DATA_KEY
  ];
  if (!markdownImage || typeof markdownImage !== "object") {
    return;
  }
  addAppendUpdateCustomData(element, {
    [MARKDOWN_IMAGE_CUSTOM_DATA_KEY]: {
      ...markdownImage,
      renderedSize: { ...size },
    },
  });
}

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
