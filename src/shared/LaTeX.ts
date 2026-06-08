import { DataURL } from "@zsviczian/excalidraw/types/excalidraw/types";
import { TFile } from "obsidian";
import ExcalidrawView from "../view/ExcalidrawView";
import { FileData, MimeType } from "src/types/embeddedFileLoaderTypes";
import { FileId } from "@zsviczian/excalidraw/types/element/src/types";
import ExcalidrawPlugin from "src/core/main";

export const updateEquation = async (
  equation: string,
  fileId: string,
  view: ExcalidrawView,
  addFiles: (files: FileData[], view: ExcalidrawView) => void,
) => {
  // view.plugin gives us access to the gateway
  const data = await tex2dataURL(equation, 4, view.plugin);
  if (data) {
    const files: FileData[] = [];
    files.push({
      mimeType: data.mimeType,
      id: fileId,
      dataURL: data.dataURL,
      created: data.created,
      size: data.size,
      hasSVGwithBitmap: false,
      shouldScale: true,
    });
    addFiles(files, view);
  }
};

export async function tex2dataURL(
  tex: string,
  scale: number = 4,
  plugin: ExcalidrawPlugin,
): Promise<{
  mimeType: MimeType;
  fileId: FileId;
  dataURL: DataURL;
  created: number;
  size: { height: number; width: number };
} | null> {
  // 1. Ask the gateway to verify the Extras plugin and return the MathJax API
  const mathjaxAPI = await plugin.extrasGateway.getMathJax();
  
  if (!mathjaxAPI) {
    // The Gateway handles the user prompts. If it returns null, the user cancelled, 
    // or they don't have the plugin/proper version. We abort cleanly.
    return null;
  }

  // 2. Resolve Preamble File using cachedRead for performance
  let preambleStr: string | null = null;
  const preamblePath = plugin.settings.latexPreambleLocation || "preamble.sty";
  const preambleFile = plugin.app.vault.getAbstractFileByPath(preamblePath);
  
  if (preambleFile instanceof TFile) {
    preambleStr = await plugin.app.vault.cachedRead(preambleFile);
  }

  // 3. Hand the request off to the cleanly isolated Extras plugin
  return await mathjaxAPI.tex2dataURL(tex, scale, preambleStr) as any;
}

export const clearMathJaxVariables = (plugin: ExcalidrawPlugin) => {
  // Try to access without prompting the user. 
  // If the plugin is disabled, we don't need to clear variables anyway.
  const api = (plugin.app as any).plugins.plugins["excalidraw-extras"]?.api;
  if (api?.mathjax) {
    api.mathjax.clearMathJaxVariables();
  }
};