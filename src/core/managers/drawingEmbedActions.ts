import type { DrawingEmbedActions } from "src/types/drawingEmbedTypes";

// A generated image owns its capabilities. No plugin/editor lookup through DOM globals.
const actions = new WeakMap<Element, DrawingEmbedActions>();
let labelId = 0;

/** Name an element without triggering Obsidian's aria-label hover tooltip. */
export function labelDrawingEmbedControl(element: HTMLElement, text: string): void {
  const id = `excalidraw-embed-label-${++labelId}`;
  element.removeAttribute("aria-label");
  element.setAttribute("aria-labelledby", id);
  element.createSpan({ cls: "excalidraw-embed-accessible-label", text, attr: { id } });
}

/** Publish capabilities only for images produced by the drawing renderer. */
export function setDrawingEmbedActions(image: Element, value: DrawingEmbedActions): void {
  actions.set(image, value);
}

/** Unrecognized, ordinary or stale image nodes have no drawing capabilities. */
export function getDrawingEmbedActions(image: Element): DrawingEmbedActions | undefined {
  return actions.get(image);
}
