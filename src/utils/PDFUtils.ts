//for future use, not used currently

import { ImageCrop } from "@zsviczian/excalidraw/types/excalidraw/element/types";
import { LinkParts } from "./Utils";

export function getPDFCropRect (props: {
  scale: number,
  linkParts: LinkParts, 
  naturalHeight: number, 
  naturalWidth: number,
}) : ImageCrop | null {
  const cropRect = props.linkParts.ref.split("rect=")[1]?.split(",").map(x=>parseInt(x));
  const validRect = cropRect && cropRect.length === 4 && cropRect.every(x=>!isNaN(x));

  if(!validRect) {
    return null;
  }

  return {
    x: cropRect[0] * props.scale,
    y: (props.naturalHeight/props.scale - cropRect[3]) * props.scale,
    width: (cropRect[2] - cropRect[0]) * props.scale,
    height: (cropRect[3] - cropRect[1]) * props.scale,
    naturalWidth: props.naturalWidth,
    naturalHeight: props.naturalHeight,
  }
}