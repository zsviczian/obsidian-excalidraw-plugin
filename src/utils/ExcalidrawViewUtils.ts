
import { MAX_IMAGE_SIZE } from "src/Constants";
import { TFile } from "obsidian";
import { IMAGE_TYPES } from "src/Constants";
import { ExcalidrawAutomate } from "src/ExcalidrawAutomate";

export const insertImageToView = async (
  ea: ExcalidrawAutomate,
  position: { x: number, y: number },
  file: TFile,
  scale?: boolean,
) => {
  ea.clear();
  const api = ea.getExcalidrawAPI();
  ea.canvas.theme = api.getAppState().theme;
  await ea.addImage(
    position.x,
    position.y,
    file,
    scale,
  );
  ea.addElementsToView(false, false, true);
}

export const insertIFrameToView = async (
  ea: ExcalidrawAutomate,
  position: { x: number, y: number },
  file?: TFile,
  link?: string,
) => {
  ea.clear();
  if(file && IMAGE_TYPES.contains(file.extension) || ea.isExcalidrawFile(file)) {
    await insertImageToView(ea, position, file);
  } else {
    ea.addIFrame(
      position.x,
      position.y,
      MAX_IMAGE_SIZE,
      MAX_IMAGE_SIZE,
      link,
      file,
    );
    ea.addElementsToView(false, false, true);
  }
}