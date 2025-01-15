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

  const rotate = props.pdfPageViewProps.rotate ?? 0;
  const { left, bottom } = props.pdfPageViewProps;
  const R0 = parseInt(rectVal[1]);
  const R1 = parseInt(rectVal[2]);
  const R2 = parseInt(rectVal[3]);
  const R3 = parseInt(rectVal[4]);

  if(rotate === 90) {
    const _top = R0;
    const _left = R1;
    const _bottom = R2;
    const _right = R3;

    const x = _left * props.scale;
    const y = _top * props.scale;
    return {
      x,
      y,
      width: _right*props.scale - x,
      height: _bottom*props.scale - y,
      naturalWidth: props.naturalWidth,
      naturalHeight: props.naturalHeight,
    }
  }
  if(rotate === 180) {
    const _right = R0;
    const _top = R1;
    const _left = R2;
    const _bottom = R3;

    const y = _top * props.scale;
    const x = props.naturalWidth - _left * props.scale;

    return {
      x,
      y,
      width: props.naturalWidth - x - _right * props.scale,
      height: _bottom * props.scale - y,
      naturalWidth: props.naturalWidth,
      naturalHeight: props.naturalHeight,
    }
  }
  if(rotate === 270) {
    const _bottom = R0;
    const _right = R1;
    const _top = R2;
    const _left = R3;

    const x = props.naturalWidth - _left * props.scale;
    const y = props.naturalHeight - _top * props.scale;
    return {
      x,
      y,
      width: props.naturalWidth - x - _right * props.scale,
      height: props.naturalHeight - y - _bottom * props.scale,
      naturalWidth: props.naturalWidth,
      naturalHeight: props.naturalHeight,
    }
  }
  // default to 0° rotation
  const _left = R0;
  const _bottom = R1;
  const _right = R2;
  const _top = R3;

  return {
    x: (_left - left) * props.scale,
    y: props.naturalHeight - (_top - bottom) * props.scale,
    width: (_right - _left) * props.scale,
    height: (_top - _bottom) * props.scale,
    naturalWidth: props.naturalWidth,
    naturalHeight: props.naturalHeight,
  }
}

export function getPDFRect({elCrop, scale, customData}:{
  elCrop: ImageCrop, scale: number, customData: Record<string, unknown>
}): string {
  const rotate = (customData.pdfPageViewProps as PDFPageViewProps)?.rotate ?? 0;
  const { left, bottom } = (customData && customData.pdfPageViewProps)
    ? customData.pdfPageViewProps as PDFPageViewProps
    : { left: 0, bottom: 0 };

  if(rotate === 90) {
    const _top = (elCrop.y) / scale;
    const _left = (elCrop.x) / scale;
    const _bottom = (elCrop.height + elCrop.y) / scale;
    const _right = (elCrop.width + elCrop.x) / scale;
    return `&rect=${Math.round(_top)},${Math.round(_left)},${Math.round(_bottom)},${Math.round(_right)}`;
  }
  if(rotate === 180) {
    const _right = (elCrop.naturalWidth-elCrop.x-elCrop.width) / scale;
    const _top = (elCrop.y) / scale;
    const _left = (elCrop.naturalWidth - elCrop.x) / scale;
    const _bottom = (elCrop.height + elCrop.y) / scale;
    return `&rect=${Math.round(_right)},${Math.round(_top)},${Math.round(_left)},${Math.round(_bottom)}`;
    
  }
  if(rotate === 270) {
    const _bottom = (elCrop.naturalHeight - elCrop.height-elCrop.y) / scale;
    const _right = (elCrop.naturalWidth - elCrop.width - elCrop.x) / scale;
    const _top = (elCrop.naturalHeight - elCrop.y) / scale;
    const _left = (elCrop.naturalWidth - elCrop.x) / scale;
    return `&rect=${Math.round(_bottom)},${Math.round(_right)},${Math.round(_top)},${Math.round(_left)}`;
  }
  const _left = elCrop.x / scale + left;
  const _right = elCrop.width / scale + _left;
  const _top = bottom + (elCrop.naturalHeight - elCrop.y) / scale;
  const _bottom = _top - elCrop.height / scale;
  return `&rect=${Math.round(_left)},${Math.round(_bottom)},${Math.round(_right)},${Math.round(_top)}`;
}
