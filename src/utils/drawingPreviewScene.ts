import type { TFile, Vault } from "obsidian";
import type { ExcalidrawElement } from "@zsviczian/excalidraw/types/element/src/types";
import { JSON_parse } from "src/constants/constants";
import { DRAWING_COMPRESSED_REG, getJSON } from "src/shared/excalidrawMarkdownParsing";
import { decompressAsync } from "./sceneDataUtils";

/** Read saved geometry only, without constructing a model or refreshing text/images. */
export async function readDrawingPreviewElements(vault: Vault, file: TFile, maxSceneLength = Infinity): Promise<ExcalidrawElement[]> {
  const data = (await vault.cachedRead(file)).replace(/\r\n?/g, "\n");
  const match: IteratorResult<RegExpMatchArray, undefined> | undefined = maxSceneLength < Infinity && file.extension !== "excalidraw"
    ? data.matchAll(DRAWING_COMPRESSED_REG).next() : undefined;
  const compressed = match && !match.done ? match.value[2] : undefined;
  const decoded = compressed ? await decompressAsync(compressed) : undefined;
  const json = file.extension === "excalidraw" ? data : decoded ? decoded.slice(0, decoded.lastIndexOf("}") + 1) : getJSON(data).scene;
  if (!json || json.length > maxSceneLength) throw Error("Drawing geometry exceeds the preview budget");
  const scene = JSON_parse<{ elements: ExcalidrawElement[] }>(json);
  if (!Array.isArray(scene?.elements)) throw Error("Drawing elements are missing");
  return scene.elements.filter(element => !element.isDeleted);
}
