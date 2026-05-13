import { sanitizeHTMLToDom, setIcon } from "obsidian";

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

export const setElementIconAndText = (
  el: HTMLElement,
  iconId: string,
  text: string,
): void => {
  setIcon(el, iconId);
  el.append(text ?? "");
};
