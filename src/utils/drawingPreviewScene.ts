import type { TFile, Vault } from "obsidian";
import type { ExcalidrawElement } from "@zsviczian/excalidraw/types/element/src/types";
import { JSON_parse } from "src/constants/constants";
import { getJSON } from "src/shared/excalidrawMarkdownParsing";

/** Read saved geometry only, without constructing a model or refreshing text/images. */
export async function readDrawingPreviewElements(vault: Vault, file: TFile): Promise<ExcalidrawElement[]> {
  const data = (await vault.cachedRead(file)).replace(/\r\n?/g, "\n");
  const scene = JSON_parse<{ elements: ExcalidrawElement[] }>(file.extension === "excalidraw" ? data : getJSON(data).scene);
  if (!Array.isArray(scene?.elements)) throw Error("Drawing elements are missing");
  return scene.elements.filter(element => !element.isDeleted);
}
