
import { MAX_IMAGE_SIZE, IMAGE_TYPES } from "src/constants";
import { TFile } from "obsidian";
import { ExcalidrawAutomate } from "src/ExcalidrawAutomate";

export const insertImageToView = async (
  ea: ExcalidrawAutomate,
  position: { x: number, y: number },
  file: TFile | string,
  scale?: boolean,
):Promise<string> => {
  ea.clear();
  ea.style.strokeColor = "transparent";
  ea.style.backgroundColor = "transparent";
  const api = ea.getExcalidrawAPI();
  ea.canvas.theme = api.getAppState().theme;
  const id = await ea.addImage(
    position.x,
    position.y,
    file,
    scale,
  );
  await ea.addElementsToView(false, true, true);
  return id;
}

export const insertEmbeddableToView = async (
  ea: ExcalidrawAutomate,
  position: { x: number, y: number },
  file?: TFile,
  link?: string,
):Promise<string> => {
  ea.clear();
  ea.style.strokeColor = "transparent";
  ea.style.backgroundColor = "transparent";
  if(file && IMAGE_TYPES.contains(file.extension) || ea.isExcalidrawFile(file)) {
    return await insertImageToView(ea, position, file);
  } else {
    const id = ea.addEmbeddable(
      position.x,
      position.y,
      MAX_IMAGE_SIZE,
      MAX_IMAGE_SIZE,
      link,
      file,
    );
    await ea.addElementsToView(false, true, true);
    return id;
  }
}