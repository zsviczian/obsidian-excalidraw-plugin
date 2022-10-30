import { ExcalidrawGenericElement } from "./ExcalidrawElement";

class ExcalidrawScene {
  type = "excalidraw";
  version = 2;
  source = "https://excalidraw.com";
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
