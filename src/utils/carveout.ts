import { ExcalidrawEmbeddableElement, ExcalidrawFrameElement, ExcalidrawImageElement } from "@zsviczian/excalidraw/types/excalidraw/element/types";
import { Mutable } from "@zsviczian/excalidraw/types/excalidraw/utility-types";
import { getEA } from "src/core";
import { ExcalidrawAutomate } from "src/shared/ExcalidrawAutomate";
import { getCropFileNameAndFolder, getListOfTemplateFiles, splitFolderAndFilename } from "./fileUtils";
import { Notice, TFile } from "obsidian";
import { Radians } from "@zsviczian/excalidraw/types/math";

export const CROPPED_PREFIX = "cropped_";
export const ANNOTATED_PREFIX = "annotated_";

export const carveOutImage = async (sourceEA: ExcalidrawAutomate, viewImageEl: ExcalidrawImageElement) => {
  if(!viewImageEl?.fileId) return;
  if(!sourceEA?.targetView) return;

  const targetEA = getEA(sourceEA.targetView) as ExcalidrawAutomate;
  
  targetEA.copyViewElementsToEAforEditing([viewImageEl],true);
  const {height, width} = await sourceEA.getOriginalImageSize(viewImageEl);

  if(!height || !width || height === 0 || width === 0) {
    targetEA.destroy();
    return;
  }

  const newImage = targetEA.getElement(viewImageEl.id) as Mutable<ExcalidrawImageElement>;
  newImage.x = 0;
  newImage.y = 0;
  newImage.width = width;
  newImage.height = height;
  const scale = newImage.scale;
  const angle = newImage.angle;
  newImage.scale = [1,1];
  newImage.angle = 0 as Radians;

  const ef = sourceEA.targetView.excalidrawData.getFile(viewImageEl.fileId);
  let imageLink = "";
  let fname = "";
  if(ef.file) {
    fname = ef.file.basename;
    const ref = ef.linkParts?.ref ? `#${ef.linkParts.ref}` : ``;
    imageLink = `[[${ef.file.path}${ref}]]`;
  } else {
    const imagename = ef.hyperlink?.match(/^.*\/([^?]*)\??.*$/)?.[1];
    imageLink = ef.hyperlink;
    fname = viewImageEl
      ? imagename.substring(0,imagename.lastIndexOf("."))
      : "_image";
  }

  const {folderpath, filename} = await getCropFileNameAndFolder(sourceEA.plugin,sourceEA.targetView.file.path,fname);

  const file = await createImageCropperFile(targetEA, newImage.id, imageLink, folderpath, filename);
  if(!file) {
    targetEA.destroy();
    return;
  }

  //console.log(await app.vault.read(file));
  sourceEA.clear();
  sourceEA.copyViewElementsToEAforEditing([viewImageEl]);
  const sourceImageEl = sourceEA.getElement(viewImageEl.id) as Mutable<ExcalidrawImageElement>;
  sourceImageEl.isDeleted = true;

  const replacingImageID = await sourceEA.addImage(sourceImageEl.x, sourceImageEl.y, file, true);
  const replacingImage = sourceEA.getElement(replacingImageID) as Mutable<ExcalidrawImageElement>;
  replacingImage.width = sourceImageEl.width;
  replacingImage.height = sourceImageEl.height;
  replacingImage.scale = scale;
  replacingImage.angle = angle;
  await sourceEA.addElementsToView(false, true, true);
  targetEA.destroy();
}

export const carveOutPDF = async (sourceEA: ExcalidrawAutomate, embeddableEl: ExcalidrawEmbeddableElement, pdfPathWithPage: string, pdfFile: TFile) => {
  if(!embeddableEl || !pdfPathWithPage || !sourceEA?.targetView) return;

  const targetEA = getEA(sourceEA.targetView) as ExcalidrawAutomate;
  
  let {height, width} = embeddableEl;

  if(!height || !width || height === 0 || width === 0) {
    targetEA.destroy();
    return;
  }

  const imageId = await targetEA.addImage(0,0, pdfPathWithPage);
  const newImage = targetEA.getElement(imageId) as Mutable<ExcalidrawImageElement>;
  newImage.x = 0;
  newImage.y = 0;
  const angle = embeddableEl.angle;

  const fname = pdfFile.basename;
  const imageLink = `[[${pdfPathWithPage}]]`;

  const {folderpath, filename} = await getCropFileNameAndFolder(sourceEA.plugin,sourceEA.targetView.file.path,fname);

  const file = await createImageCropperFile(targetEA, newImage.id, imageLink, folderpath, filename);
  if(!file) {
    targetEA.destroy();
    return;
  }

  //console.log(await app.vault.read(file));
  sourceEA.clear();
  const replacingImageID = await sourceEA.addImage(embeddableEl.x + embeddableEl.width + 10, embeddableEl.y, file, true);
  const replacingImage = sourceEA.getElement(replacingImageID) as Mutable<ExcalidrawImageElement>;
  const imageAspectRatio = replacingImage.width / replacingImage.height;
  if(imageAspectRatio > 1) {
    replacingImage.width = embeddableEl.width;
    replacingImage.height = replacingImage.width / imageAspectRatio;
  } else {
    replacingImage.height = embeddableEl.height;
    replacingImage.width = replacingImage.height * imageAspectRatio;
  }
  replacingImage.angle = angle;
  await sourceEA.addElementsToView(false, true, true);
  targetEA.destroy();
}


export const createImageCropperFile = async (targetEA: ExcalidrawAutomate, imageID: string, imageLink:string, foldername: string, filename: string): Promise<TFile> => {
  const vault = targetEA.plugin.app.vault;
  const newImage = targetEA.getElement(imageID) as Mutable<ExcalidrawImageElement>;
  const { width, height } = newImage;
  const isPDF = imageLink.match(/\[\[([^#]*)#.*]]/)?.[1]?.endsWith(".pdf");

  newImage.opacity = 100;
  newImage.locked = true;
  newImage.link = imageLink;

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
  targetEA.canvas.viewBackgroundColor = isPDF ? "#5d5d5d" : "#3d3d3d";

  const templates = getListOfTemplateFiles(targetEA.plugin);
  const templateFile = templates && templates.length > 0 ? templates[0] : null;
  if(templateFile && templateFile instanceof TFile) {
    const {appState} = await targetEA.getSceneFromFile(templateFile);
    if(appState) {
      targetEA.style.fontFamily = appState.currentItemFontFamily;
      targetEA.style.fontSize = appState.currentItemFontSize;
    }
  }

  const newPath = await targetEA.create ({
    filename,
    foldername,
    onNewPane: true,
    frontmatterKeys: {
      "excalidraw-mask": true,
      "excalidraw-export-dark": false,
      "excalidraw-export-padding": 0,
      "excalidraw-export-transparent": true,
      ...isPDF ? {"cssclasses": "excalidraw-cropped-pdfpage"} : {},
    }
  });

  //console.log({newPath});

  //wait for file to be created/indexed by Obsidian
  let file = vault.getAbstractFileByPath(newPath);
  let counter = 0;
  while((!file || !targetEA.isExcalidrawFile(file as TFile)) && counter < 50) {
    await sleep(100);
    file = vault.getAbstractFileByPath(newPath);
    counter++;
  }
  //console.log({counter, file});
  if(!file || !(file instanceof TFile)) {
    new Notice("File not found. NewExcalidraw Drawing is taking too long to create. Please try again.");
    return;
  }

  return file;
}