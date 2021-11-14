import { FileId } from "@zsviczian/excalidraw/types/element/types";
import { DataURL } from "@zsviczian/excalidraw/types/types";
import { TFile } from "obsidian";
import { IMAGE_TYPES } from "./constants";
import { ExportSettings } from "./ExcalidrawView";
import ExcalidrawPlugin from "./main";
import { svgToBase64 } from "./Utils";

export declare type MimeType = "image/svg+xml" | "image/png" | "image/jpeg" | "image/gif" | "application/octet-stream";

export class EmbeddedFilesLoader {
  private plugin:ExcalidrawPlugin;
  private processedFiles: Set<string> = new Set<string>();

  constructor(plugin: ExcalidrawPlugin) {
    this.plugin = plugin;
  }


  private async getObsidianImage (file: TFile)
  :Promise<{
      mimeType: MimeType,
      fileId: FileId, 
      dataURL: DataURL,
      created: number,
    size: {height: number, width: number},
  }> {
  if(!this.plugin || !file) return null;
  const app = this.plugin.app;
  const isExcalidrawFile = this.plugin.ea.isExcalidrawFile(file);
  if (!(IMAGE_TYPES.contains(file.extension) || isExcalidrawFile)) {
    return null;
  }
  const ab = await app.vault.readBinary(file);

  const getExcalidrawSVG = async () => {
    const exportSettings:ExportSettings = {
      withBackground: false,
      withTheme: false
    };
    this.plugin.ea.reset();
    return svgToBase64((await this.plugin.ea.createSVG(file.path,true,exportSettings)).outerHTML) as DataURL;
  }
  
  const excalidrawSVG = isExcalidrawFile
              ? await getExcalidrawSVG()
              : null;
  let mimeType:MimeType = "image/svg+xml";
  if (!isExcalidrawFile) {
    switch (file.extension) {
      case "png": mimeType = "image/png";break;
      case "jpeg":mimeType = "image/jpeg";break;
      case "jpg": mimeType = "image/jpeg";break;
      case "gif": mimeType = "image/gif";break;
      case "svg": mimeType = "image/svg+xml";break;
      default: mimeType = "application/octet-stream";
    }
  } 
  return {
      mimeType: mimeType,
      fileId: await generateIdFromFile(ab),
      dataURL: excalidrawSVG ?? (file.extension==="svg" ? await getSVGData(app,file) : await getDataURL(ab)),
      created: file.stat.mtime,
      size: await getImageSize(excalidrawSVG??app.vault.getResourcePath(file))
  }
}

}