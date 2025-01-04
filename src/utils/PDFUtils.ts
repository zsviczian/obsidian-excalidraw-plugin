//for future use, not used currently

import { ImageCrop } from "@zsviczian/excalidraw/types/excalidraw/element/types";
import { PDFPageViewProps } from "src/shared/EmbeddedFileLoader";

export function getPDFCropRect (props: {
  scale: number,
  link: string,
  naturalHeight: number, 
  naturalWidth: number,
  pdfPageViewProps: PDFPageViewProps,
}) : ImageCrop | null {
  const rectVal = props.link.match(/&rect=(\d*),(\d*),(\d*),(\d*)/);
  if (!rectVal || rectVal.length !== 5) {
    return null;
  }

  const { left, bottom } = props.pdfPageViewProps;
  const R0 = parseInt(rectVal[1]);
  const R1 = parseInt(rectVal[2]);
  const R2 = parseInt(rectVal[3]);
  const R3 = parseInt(rectVal[4]);

  return {
    x: (R0 - left) * props.scale,
    y: (bottom + props.naturalHeight/props.scale - R3) * props.scale,
    width: (R2 - R0) * props.scale,
    height: (R3 - R1) * props.scale,
    naturalWidth: props.naturalWidth,
    naturalHeight: props.naturalHeight,
  }
}

export function getPDFRect({elCrop, scale, customData}:{
  elCrop: ImageCrop, scale: number, customData: Record<string, unknown>
}): string {
  const { left, bottom } = (customData && customData.pdfPageViewProps)
    ? customData.pdfPageViewProps as PDFPageViewProps
    : { left: 0, bottom: 0 };

  const R0 = elCrop.x / scale + left;
  const R2 = elCrop.width / scale + R0;
  const R3 = bottom + (elCrop.naturalHeight - elCrop.y) / scale;
  const R1 = R3 - elCrop.height / scale;
  return `&rect=${Math.round(R0)},${Math.round(R1)},${Math.round(R2)},${Math.round(R3)}`;
}