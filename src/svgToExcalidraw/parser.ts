import ExcalidrawScene from "./elements/ExcalidrawScene";
import Group from "./elements/Group";
import { createTreeWalker, walk } from "./walker";

export type ConversionResult = {
  hasErrors: boolean;
  errors: string;
  content: any; // Serialized Excalidraw JSON
};

export const svgToExcalidraw = (svgString: string): ConversionResult => {
  try {
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

      const hasVisibleElements = Boolean(scene.elements.find((el)=>el.opacity !== 0));
      if (!hasVisibleElements) {
        scene.elements.forEach((el) => {
          el.opacity = 100;
        });
      }
      scene.elements.forEach((el) => {
        if(el.opacity <= 1) el.opacity = 100;
      });
      content = scene.elements; //scene.toExJSON();
    }

    return {
      hasErrors,
      errors: hasErrors ? `${[...errorsElements].map((el) => el.innerHTML)}` : "",
      content,
    };
  } catch (error) {
    console.log(error);
    return {
      hasErrors: true,
      errors:  `${error}`,
      content:[],
    };
  }
};
