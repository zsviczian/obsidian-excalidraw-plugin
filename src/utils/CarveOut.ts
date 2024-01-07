import { ExcalidrawFrameElement, ExcalidrawImageElement } from "@zsviczian/excalidraw/types/excalidraw/element/types";
import { Mutable } from "@zsviczian/excalidraw/types/excalidraw/utility-types";
import { getEA } from "src";
import { ExcalidrawAutomate } from "src/ExcalidrawAutomate";
import { splitFolderAndFilename } from "./FileUtils";
import { TFile } from "obsidian";

export const CROPPED_PREFIX = "cropped_";

export const carveOutImage = async (sourceEA: ExcalidrawAutomate, viewImageEl: ExcalidrawImageElement) => {
  if(!viewImageEl?.fileId) return;
  if(!sourceEA?.targetView) return;

  const targetEA = getEA(sourceEA.targetView) as ExcalidrawAutomate;
  
  targetEA.copyViewElementsToEAforEditing([viewImageEl],true);
  const {height, width} = await sourceEA.getOriginalImageSize(viewImageEl);

  if(!height || !width || height === 0 || width === 0) return;

  const newImage = targetEA.getElement(viewImageEl.id) as Mutable<ExcalidrawImageElement>;
  newImage.x = 0;
  newImage.y = 0;
  newImage.width = width;
  newImage.height = height;

  const ef = sourceEA.targetView.excalidrawData.getFile(viewImageEl.fileId);
  let imageLink = "";
  let fname = "";
  if(ef.file) {
    fname = CROPPED_PREFIX + ef.file.basename;
    imageLink = `[[${ef.file.path}]]`;
  } else {
    const imagename = ef.hyperlink?.match(/^.*\/([^?]*)\??.*$/)?.[1];
    imageLink = ef.hyperlink;
    fname = viewImageEl
      ? CROPPED_PREFIX + imagename.substring(0,imagename.lastIndexOf("."))
      : CROPPED_PREFIX + "_image";
  }

  const attachmentPath = await sourceEA.getAttachmentFilepath(fname + ".md");
  const {folderpath: foldername, filename} = splitFolderAndFilename(attachmentPath);

  const newPath = await createImageCropperFile(targetEA, newImage.id, imageLink, foldername, filename);

  setTimeout(async ()=>{
    const file = sourceEA.plugin.app.metadataCache.getFirstLinkpathDest(newPath,"")
    sourceEA.clear();
    sourceEA.copyViewElementsToEAforEditing([viewImageEl]);
    const sourceImageEl = sourceEA.getElement(viewImageEl.id) as Mutable<ExcalidrawImageElement>;
    sourceImageEl.isDeleted = true;

    const replacingImageID = await sourceEA.addImage(sourceImageEl.x, sourceImageEl.y, file, true);
    const replacingImage = sourceEA.getElement(replacingImageID) as Mutable<ExcalidrawImageElement>;
    replacingImage.width = sourceImageEl.width;
    replacingImage.height = sourceImageEl.height;
    sourceEA.addElementsToView(false, true, true);
  },1000);
}

export const createImageCropperFile = async (targetEA: ExcalidrawAutomate, imageID: string, imageLink:string, foldername: string, filename: string): Promise<string> => {
  const newImage = targetEA.getElement(imageID) as Mutable<ExcalidrawImageElement>;
  const { width, height } = newImage;
  newImage.opacity = 100;
  newImage.locked = true;

  const frameID = targetEA.addFrame(0,0,width,height,"Adjust frame to crop image. Add elements for mask: White shows, Black hides.");
  const frame = targetEA.getElement(frameID) as Mutable<ExcalidrawFrameElement>;
  frame.link = imageLink;

  newImage.frameId = frameID;
 
  targetEA.style.opacity = 50;
  targetEA.style.fillStyle = "solid";
  targetEA.style.strokeStyle = "solid";
  targetEA.style.strokeColor = "black";
  targetEA.style.backgroundColor = "black";
  targetEA.style.roughness = 0;
  targetEA.style.roundness = null;
  targetEA.canvas.theme = "light";
  targetEA.canvas.viewBackgroundColor = "#3d3d3d";

  const templateFile = app.vault.getAbstractFileByPath(targetEA.plugin.settings.templateFilePath);
  if(templateFile && templateFile instanceof TFile) {
    const {appState} = await targetEA.getSceneFromFile(templateFile);
    if(appState) {
      targetEA.style.fontFamily = appState.currentItemFontFamily;
      targetEA.style.fontSize = appState.currentItemFontSize;
    }
  }

  return await targetEA.create ({
    filename,
    foldername,
    onNewPane: true,
    frontmatterKeys: {
      "excalidraw-mask": true,
      "excalidraw-export-dark": false,
      "excalidraw-export-padding": 0,
      "excalidraw-export-transparent": true,
    }
  });
}