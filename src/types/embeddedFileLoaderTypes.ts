import { FileId } from "@zsviczian/excalidraw/types/element/src/types";
import { BinaryFileData, DataURL } from "@zsviczian/excalidraw/types/excalidraw/types";
import { ValueOf } from "../types/types";

export const IMAGE_MIME_TYPES = {
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  ico: "image/x-icon",
  avif: "image/avif",
  jfif: "image/jfif",
} as const;

export type ImgData = {
  mimeType: MimeType;
  fileId: FileId;
  dataURL: DataURL;
  created: number;
  hasSVGwithBitmap: boolean;
  size: Size;
  pdfPageViewProps?: PDFPageViewProps;
};

export declare type MimeType = ValueOf<typeof IMAGE_MIME_TYPES> | "application/octet-stream";

export type FileData = BinaryFileData & {
  size: Size;
  hasSVGwithBitmap: boolean;
  shouldScale: boolean; //true if image should maintain its area, false if image should display at 100% its size
  pdfPageViewProps?: PDFPageViewProps;
};

export type PDFPageViewProps = {
  left: number;
  bottom: number;
  right: number;
  top: number;
  rotate?: number; //may be undefined in legacy files
}

export type Size = {
  height: number;
  width: number;
};

export interface ColorMap {
  [color: string]: string;
};