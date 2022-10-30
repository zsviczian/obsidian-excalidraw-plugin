import ExcalidrawScene from "./elements/ExcalidrawScene";
import Group from "./elements/Group";
import { createTreeWalker, walk } from "./walker";

export type ConversionResult = {
  hasErrors: boolean;
  errors: NodeListOf<Element> | null;
  content: any; // Serialized Excalidraw JSON
};

export const svgToExcalidraw = (svgString: string): ConversionResult => {
  const parser = new DOMParser();
  const svgDOM = parser.parseFromString(svgString, "image/svg+xml");

  // was there a parsing error?
  const errorsElements = svgDOM.querySelectorAll("parsererror");
  const hasErrors = errorsElements.length > 0;
  let content = null;

  if (hasErrors) {
    console.error(
      "There were errors while parsing the given SVG: ",
      [...errorsElements].map((el) => el.innerHTML),
    );
  } else {
    const tw = createTreeWalker(svgDOM);
    const scene = new ExcalidrawScene();
    const groups: Group[] = [];

    walk({ tw, scene, groups, root: svgDOM }, tw.nextNode());

    content = scene.elements; //scene.toExJSON();
  }

  return {
    hasErrors,
    errors: hasErrors ? errorsElements : null,
    content,
  };
};
