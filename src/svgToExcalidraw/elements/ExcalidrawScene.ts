import { GITHUB_RELEASES } from "src/constants";
import { ExcalidrawGenericElement } from "./ExcalidrawElement";

declare const PLUGIN_VERSION:string;

class ExcalidrawScene {
  type = "excalidraw";
  version = 2;
  source = GITHUB_RELEASES+PLUGIN_VERSION;
  elements: ExcalidrawGenericElement[] = [];

  constructor(elements:any = []) {
    this.elements = elements;
  }

  toExJSON(): any {
    return {
      ...this,
      elements: this.elements.map((el) => ({ ...el })),
    };
  }
}

export default ExcalidrawScene;
