import { ExcalidrawElement,  FileId } from "@zsviczian/excalidraw/types/excalidraw/element/types";
import { BinaryFileData } from "@zsviczian/excalidraw/types/excalidraw/types";
import { Mutable } from "@zsviczian/excalidraw/types/excalidraw/utility-types";
import { Notice } from "obsidian";

import { getEA } from "src/core";
import { ExcalidrawAutomate } from "src/shared/ExcalidrawAutomate";
import { cloneElement } from "src/utils/excalidrawAutomateUtils";
import { ExportSettings } from "src/view/ExcalidrawView";
import { nanoid } from "src/constants/constants";
import { svgToBase64 } from "../utils/utils";

/**
 * Creates a masked image from an Excalidraw scene.
 * 
 * The scene must contain:
 * - One element.type="frame" element that defines the crop area
 * - One or more element.type="image" elements
 * - Zero or more non-image shape elements (rectangles, ellipses etc) that define the mask
 * 
 * The class splits the scene into two parts:
 * 1. Images (managed in imageEA)
 * 2. Mask shapes (managed in maskEA)
 * 
 * A transparent rectangle matching the combined bounding box is added to both
 * imageEA and maskEA to ensure consistent sizing between image and mask.
 * 
 * For performance, if there is only one image, it is not rotated, and
 * its size matches the bounding box,
 * the image data is used directly from cache rather than regenerating.
 * 
 * @example
 * const cropper = new CropImage(elements, files);
 * const pngBlob = await cropper.getCroppedPNG();
 * cropper.destroy();
 */
export class CropImage {
  private imageEA: ExcalidrawAutomate;
  private maskEA: ExcalidrawAutomate;
  private bbox: {topX: number, topY: number, width: number, height: number};

  constructor (
    private elements: ExcalidrawElement[],
    files: Map<FileId,BinaryFileData>,
  ) {
    const imageEA = getEA() as ExcalidrawAutomate;
    this.imageEA = imageEA;
    const maskEA = getEA() as ExcalidrawAutomate;
    this.maskEA = maskEA;

    this.bbox = imageEA.getBoundingBox(elements);
    //this makes both the image and the mask the same size
    //Adding the bounding element first so it is at the bottom of the layers - does not override the image.
    this.setBoundingEl(imageEA, "transparent");
    this.setBoundingEl(maskEA, "white"); //the bbox should not mask the image. White lets everything through.

    elements.forEach(el => {
      const newEl = cloneElement(el) as Mutable<ExcalidrawElement>;
      if(el.type !== "image" && el.type !== "frame") {
        newEl.opacity = 100;
        maskEA.elementsDict[el.id] = newEl;
      }
      if(el.type === "image") {
        imageEA.elementsDict[el.id] = newEl;
      }
    })

    Object.values(files).forEach(file => {
      imageEA.imagesDict[file.id] = file;
    })
  }

  public destroy() {
    this.imageEA.destroy();
    this.maskEA.destroy();
    this.imageEA = null;
    this.maskEA = null;
    this.elements = null;
    this.bbox = null;
  }
  
  private setBoundingEl(ea: ExcalidrawAutomate, bgColor: string) {
    const {topX, topY, width, height} = this.bbox;
    ea.style.backgroundColor = bgColor;
    ea.style.strokeColor = "transparent";
    //@ts-ignore: Setting this to string "0" will produce a rectangle with zero stroke width
    ea.style.strokeWidth = "0";
    ea.style.strokeStyle = "solid";
    ea.style.fillStyle = "solid";
    ea.style.roughness = 0;
    ea.addRect(topX, topY, width, height);
  }

  private getViewBoxAndSize(): {viewBox: string, vbWidth: number, vbHeight: number, width: number, height: number} {
    const frames = this.elements.filter(el=>el.type === "frame");
    if(frames.length > 1) {
      new Notice("Multiple frames are not supported for image cropping. Discarding frames from mask.");
    }
    const images = this.imageEA.getElements().filter(el=>el.type === "image");
    const {x: frameX, y: frameY, width: frameWidth, height: frameHeight} = frames.length === 1
      ? frames[0]
      : mapToXY(this.imageEA.getBoundingBox(images));
    const {topX, topY, width, height} = this.bbox;
    return {
      viewBox: `${frameX-topX} ${frameY-topY} ${frameWidth} ${frameHeight}`,
      vbWidth: frameWidth,
      vbHeight: frameHeight,
      width,
      height,
    }
  }

  private async getMaskSVG():Promise<{style: string, mask: string}> {
    const exportSettings:ExportSettings = {
      withBackground: false,
      withTheme: false,
      isMask: false,
    }

    const maskSVG = await this.maskEA.createSVG(null,true,exportSettings,null,null,0);
    const defs = maskSVG.querySelector("defs");
    const styleEl = maskSVG.querySelector("style");
    const style = styleEl ? styleEl.outerHTML : "";
    defs.parentElement.removeChild(defs);
    return {style, mask:maskSVG.innerHTML};
  }

  private async getImage() {
    const exportSettings:ExportSettings = {
      withBackground: false,
      withTheme: false,
      isMask: false,
    }
    const images = this.imageEA.getElements().filter(el=>el.type === "image" && el.isDeleted === false);
    const isRotated = images.some(el=>el.angle !== 0);
    const imageDataURLs = Object.values(this.imageEA.imagesDict);
    if(!isRotated && images.length === 1 && imageDataURLs.length === 1) {
      const { width, height } = this.bbox;
      if(images[0].width === width && images[0].height === height) {
        //get image from the cache if mask is not bigger than the image, and if there is a single image element
        return imageDataURLs[0].dataURL;
      }
    }
    return await this.imageEA.createPNGBase64(null,1,exportSettings,null,null,0);
  }

  private async buildSVG(): Promise<SVGSVGElement> {
    if(this.imageEA.getElements().filter(el=>el.type === "image").length === 0) {
      new Notice("No image found. Cannot crop.");
      return;
    }
    const maskID = nanoid();
    const imageID = nanoid();
    const {viewBox, vbWidth, vbHeight, width, height} = this.getViewBoxAndSize();
    const parser = new DOMParser();
    const {style, mask} = await this.getMaskSVG();
    const svgString = `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${viewBox}" width="${vbWidth}" height="${vbHeight}">\n` +
      `<symbol id="${imageID}"><image width="100%" height="100%" href="${await this.getImage()}"/></symbol>\n` +
      `<defs>${style}\n<mask id="${maskID}" x="0" y="0" width="${width}" height="${height}" maskUnits="userSpaceOnUse">\n${mask}\n</mask>\n</defs>\n` +
      `<use x="0" y="0" width="${width}" height="${height}" mask="url(#${maskID})" mask-type="alpha" href="#${imageID}"/>\n</svg>`;
    return parser.parseFromString(
      svgString,
      "image/svg+xml",
    ).firstElementChild as SVGSVGElement
    
  }

  async getCroppedPNG(): Promise<Blob> {
    //@ts-ignore
    const PLUGIN = app.plugins.plugins["obsidian-excalidraw-plugin"];
    const svg = await this.buildSVG();
    return new Promise((resolve, reject) => {
      //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2026
      const svgData = svg.outerHTML;
      //const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
  
      if (!context) {
        reject('Unable to get 2D context');
        return;
      }
  
      canvas.width = svg.width.baseVal.value;
      canvas.height = svg.height.baseVal.value;
  
      const image = new Image();
      image.onload = () => {
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0);
  
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to convert to PNG'));
            }
          },
          'image/png',
          1 // image quality (0 - 1)
        );
      };
      image.src = svgToBase64(svgData);
    });
  }

  async getCroppedSVG() {
    return await this.buildSVG();
  }
}

const mapToXY = ({topX, topY, width, height}: {topX: number, topY: number, width: number, height: number}): {x: number, y: number, width: number, height: number} => {
  return {
    x: topX,
    y: topY,
    width,
    height,
  }
}