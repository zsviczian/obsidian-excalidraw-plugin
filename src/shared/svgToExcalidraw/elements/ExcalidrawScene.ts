import { URLs } from "src/constants/safeUrls";
import { ExcalidrawGenericElement } from "./ExcalidrawElement";

declare const PLUGIN_VERSION: string;

class ExcalidrawScene {
  type = "excalidraw";
  version = 2;
  source = `${URLs.GITHUB_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_RELEASES_TAG}/${PLUGIN_VERSION}`;
  elements: ExcalidrawGenericElement[] = [];

  constructor(elements: ExcalidrawGenericElement[] = []) {
    this.elements = elements;
  }

  toExJSON() {
    return {
      ...this,
      elements: this.elements.map((el) => ({ ...el })),
    };
  }
}

export default ExcalidrawScene;
