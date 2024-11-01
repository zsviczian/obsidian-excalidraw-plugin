//for future use, not used currently

import { ImageCrop } from "@zsviczian/excalidraw/types/excalidraw/element/types";

export function getPDFCropRect (props: {
  scale: number,
  link: string,
  naturalHeight: number, 
  naturalWidth: number,
}) : ImageCrop | null {
  const rectVal = props.link.match(/&rect=(\d*),(\d*),(\d*),(\d*)/);
  if (!rectVal || rectVal.length !== 5) {
    return null;
  }

  const R0 = parseInt(rectVal[1]);
  const R1 = parseInt(rectVal[2]);
  const R2 = parseInt(rectVal[3]);
  const R3 = parseInt(rectVal[4]);

  return {
    x: R0 * props.scale,
    y: (props.naturalHeight/props.scale - R3) * props.scale,
    width: (R2 - R0) * props.scale,
    height: (R3 - R1) * props.scale,
    naturalWidth: props.naturalWidth,
    naturalHeight: props.naturalHeight,
  }
}

export function getPDFRect(elCrop: ImageCrop, scale: number): string {
  const R0 = elCrop.x / scale;
  const R2 = elCrop.width / scale + R0;
  const R3 = (elCrop.naturalHeight - elCrop.y) / scale;
  const R1 = R3 - elCrop.height / scale;
  return `&rect=${Math.round(R0)},${Math.round(R1)},${Math.round(R2)},${Math.round(R3)}`;
}