import {
  ExcalidrawArrowElement,
  ExcalidrawElement,
  ExcalidrawTextElement,
} from "@zsviczian/excalidraw/types/element/src/types";
import { Mutable } from "@zsviczian/excalidraw/types/common/src/utility-types";

export function updateElementIdsInScene(
  { elements: sceneElements }: { elements: Mutable<ExcalidrawElement>[] },
  elementToChange: Mutable<ExcalidrawElement>,
  newID: string,
) {
  if (elementToChange.type === "text") {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- text branch needs mutable text-specific fields.
    const textElement = elementToChange as Mutable<ExcalidrawTextElement>;
    if (textElement.containerId) {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- scene lookup returns union; mutation path requires mutable element.
      const containerEl = sceneElements.find(
        (el) => el.id === textElement.containerId,
      ) as unknown as Mutable<ExcalidrawElement>;
      containerEl.boundElements
        ?.filter((x) => x.id === textElement.id)
        .forEach((x) => {
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- bound element ids are writable in this migration update path.
          (x.id as Mutable<string>) = newID;
        });
    }
  }

  if (elementToChange.boundElements?.length > 0) {
    elementToChange.boundElements.forEach((binding) => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- scene lookup returns union; mutation path requires mutable element.
      const boundEl = sceneElements.find(
        (el) => el.id === binding.id,
      ) as unknown as Mutable<ExcalidrawElement>;
      if (!boundEl) {
        return;
      }
      boundEl.boundElements
        ?.filter((x) => x.id === elementToChange.id)
        .forEach((x) => {
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- bound element ids are writable in this migration update path.
          (x.id as Mutable<string>) = newID;
        });
      if (boundEl.type === "text") {
        boundEl.containerId = newID;
      }
      if (boundEl.type === "arrow") {
        const arrow = boundEl as Mutable<ExcalidrawArrowElement>;
        if (arrow.startBinding?.elementId === elementToChange.id) {
          arrow.startBinding.elementId = newID;
        }
        if (arrow.endBinding?.elementId === elementToChange.id) {
          arrow.endBinding.elementId = newID;
        }
      }
    });
  }

  if (elementToChange.type === "frame") {
    sceneElements
      .filter((el) => el.frameId === elementToChange.id)
      .forEach((x) => {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- frame links must be rewritten during id update.
        (x.frameId as Mutable<string>) = newID;
      });
  }

  elementToChange.id = newID;
}
