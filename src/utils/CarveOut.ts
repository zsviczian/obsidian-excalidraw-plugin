import { ExcalidrawFrameElement, ExcalidrawImageElement } from "@zsviczian/excalidraw/types/excalidraw/element/types";
import { Mutable } from "@zsviczian/excalidraw/types/excalidraw/utility-types";
import { getEA } from "src";
import { ExcalidrawAutomate } from "src/ExcalidrawAutomate";
import { splitFolderAndFilename } from "./FileUtils";
import { Notice, TFile } from "obsidian";
import ExcalidrawView from "src/ExcalidrawView";
import { ExcalidrawImperativeAPI } from "@zsviczian/excalidraw/types/excalidraw/types";

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
  const scale = newImage.scale;
  const angle = newImage.angle;
  newImage.scale = [1,1];
  newImage.angle = 0;

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

  const file = await createImageCropperFile(targetEA, newImage.id, imageLink, foldername, filename);
  if(!file) return;

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
  sourceEA.addElementsToView(false, true, true);
}

export const createImageCropperFile = async (targetEA: ExcalidrawAutomate, imageID: string, imageLink:string, foldername: string, filename: string): Promise<TFile> => {
  const workspace = targetEA.plugin.app.workspace;
  const vault = targetEA.plugin.app.vault;
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

  const newPath = await targetEA.create ({
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

  /*
  //wait for the new ExcalidrawView to open and initialize
  counter = 0;
  let newView = workspace.getActiveViewOfType(ExcalidrawView) as ExcalidrawView;
  while(
    (workspace.getActiveFile() !== file ||
     newView?.file !== file ||
     !newView?.isLoaded ||
     !Boolean(newView?.excalidrawAPI)) &&
    counter < 100
  ) {
    await sleep(100);
    newView = workspace.getActiveViewOfType(ExcalidrawView) as ExcalidrawView;
    counter++;
  }
  //console.log({counter});
  if(newView?.file !== file || !newView?.isLoaded ||!Boolean(newView?.excalidrawAPI)) {
    new Notice("View did not initialize. NewExcalidraw Drawing is taking too long to open. Please try again.");
    return;
  }

  //wait for the image to load to the new view
  const api = newView.excalidrawAPI as ExcalidrawImperativeAPI;
  counter = 0;
  while(Object.keys(api.getFiles()).length === 0 && counter < 100) {
    await sleep(100);
    counter++;
  }

  if(Object.keys(api.getFiles()).length === 0) {
    new Notice("Image did not load to the view. NewExcalidraw Drawing is taking too long to load. Please try again.");
    return;
  }
*/
  //console.log({counter, path: workspace.getActiveFile()?.path, newView, files: api.getFiles()});

  return file;
}