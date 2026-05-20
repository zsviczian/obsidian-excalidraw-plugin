import type {
  ExcalidrawElement,
  ExcalidrawImageElement,
} from "@zsviczian/excalidraw/types/element/src/types";
import type { Mutable } from "@zsviczian/excalidraw/types/common/src/utility-types";
import { getCommonBoundingBox, restoreElements } from "src/constants/constants";
import { getEA } from "src/core";
import { t } from "src/lang/helpers";
import type ExcalidrawView from "src/view/ExcalidrawView";

function estimateBounds(
  elements: ExcalidrawElement[],
): [number, number, number, number] {
  const bb = getCommonBoundingBox(elements);
  return [bb.minX, bb.minY, bb.maxX, bb.maxY];
}

export function repositionElementsToCursor(
  elements: ExcalidrawElement[],
  newPosition: { x: number; y: number },
  center: boolean = false,
): ExcalidrawElement[] {
  const [x1, y1, x2, y2] = estimateBounds(elements);
  let [offsetX, offsetY] = [0, 0];
  if (center) {
    [offsetX, offsetY] = [
      newPosition.x - (x1 + x2) / 2,
      newPosition.y - (y1 + y2) / 2,
    ];
  } else {
    [offsetX, offsetY] = [newPosition.x - x1, newPosition.y - y1];
  }

  elements.forEach((element: Mutable<ExcalidrawElement>) => {
    element.x = element.x + offsetX;
    element.y = element.y + offsetY;
  });

  return restoreElements(elements, null, {
    refreshDimensions: true,
    repairBindings: true,
  });
}

export const cloneElement = (
  el: ExcalidrawElement,
): Mutable<ExcalidrawElement> => {
  const newEl = JSON.parse(JSON.stringify(el)) as Mutable<ExcalidrawElement>;
  newEl.version = el.version + 1;
  newEl.updated = Date.now();
  newEl.versionNonce = Math.floor(Math.random() * 1000000000);
  return newEl;
};

export const getBoundTextElementId = (container: ExcalidrawElement | null) => {
  return container?.boundElements?.length
    ? container.boundElements.find((ele) => ele.type === "text")?.id || null
    : null;
};

export const insertLaTeXToView = (
  view: ExcalidrawView,
  center: boolean = false,
) => {
  const app = view.plugin.app;
  const ea = getEA(view);
  void import("src/shared/Dialogs/Prompt").then(({ LaTexPrompt }) => {
    LaTexPrompt.Prompt(
      app,
      t("ENTER_LATEX"),
      view.plugin.settings.latexBoilerplate,
    ).then(
      async (formula: string) => {
        const lastLatexEl = ea
          .getViewElements()
          .filter(
            (el) =>
              el.type === "image" && view.excalidrawData.hasEquation(el.fileId),
          )
          .reduce(
            (maxel, curr) =>
              !maxel || curr.updated > maxel.updated ? curr : maxel,
            undefined,
          ) as ExcalidrawImageElement;
        let scaleX = 1;
        let scaleY = 1;
        if (lastLatexEl) {
          const equation = view.excalidrawData.getEquation(lastLatexEl.fileId);
          const dataurl = await ea.tex2dataURL(equation.latex);
          if (dataurl.size.width > 0 && dataurl.size.height > 0) {
            scaleX = lastLatexEl.width / dataurl.size.width;
            scaleY = lastLatexEl.height / dataurl.size.height;
          }
        }
        if (formula) {
          const id = await ea.addLaTex(0, 0, formula, scaleX, scaleY);
          if (center) {
            const el = ea.getElement(id);
            const { width, height } = el;
            const { x, y } = ea.getViewCenterPosition();
            el.x = x - width / 2;
            el.y = y - height / 2;
          }
          await ea.addElementsToView(!center, false, true);
          ea.selectElementsInView([id]);
        }
        ea.destroy();
      },
      () => {},
    );
  });
};

export const search = async (view: ExcalidrawView) => {
  const ea = view.plugin.ea;
  ea.reset();
  ea.setView(view);
  const elements = ea
    .getViewElements()
    .filter(
      (el) =>
        el.type === "text" ||
        el.type === "frame" ||
        el.link ||
        el.type === "image",
    );
  if (elements.length === 0) {
    return;
  }
  const { ScriptEngine } = await import("src/shared/Scripts");
  let text = await ScriptEngine.inputPrompt(
    view,
    view.plugin,
    view.plugin.app,
    "Search for",
    "use quotation marks for exact match",
    "",
  );
  if (!text) {
    return;
  }
  const res = text.matchAll(/"(.*?)"/g);
  let query: string[] = [];
  let parts;
  while (!(parts = res.next()).done) {
    query.push(parts.value[1]);
  }
  text = text.replaceAll(/"(.*?)"/g, "");
  query = query.concat(text.split(" ").filter((s: string) => s.length !== 0));

  ea.targetView.selectElementsMatchingQuery(elements, query);
};
