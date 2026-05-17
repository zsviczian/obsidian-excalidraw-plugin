import { sanitizeHTMLToDom, setIcon } from "obsidian";

const DISPLAY_CLASSES = [
  "excalidraw-display-none",
  "excalidraw-display-block",
  "excalidraw-display-flex",
];

export const sanitizedFragment = (html: string): DocumentFragment =>
  sanitizeHTMLToDom(html ?? "");

export const setSanitizedHtml = (el: HTMLElement, html: string): void => {
  el.empty();
  el.appendChild(sanitizedFragment(html));
};

export const setStyleText = (
  styleEl: HTMLStyleElement,
  cssText: string,
): void => {
  styleEl.textContent = cssText ?? "";
};

const clearDisplayClasses = (el: HTMLElement): void => {
  DISPLAY_CLASSES.forEach((className) => el.classList.remove(className));
};

export const setElementHidden = (el: HTMLElement, hidden: boolean): void => {
  el.classList.toggle("excalidraw-display-none", hidden);
};

export const setElementDisplay = (
  el: HTMLElement,
  display: "none" | "flex" | "",
): void => {
  clearDisplayClasses(el);
  switch (display) {
    case "none":
      setElementHidden(el, true);
      break;
    case "flex":
      setElementHidden(el, false);
      el.classList.add("excalidraw-display-flex");
      break;
    default:
      setElementHidden(el, false);
      break;
  }
};

export const setElementIconAndText = (
  el: HTMLElement,
  iconId: string,
  text: string,
): void => {
  setIcon(el, iconId);
  el.append(text ?? "");
};
