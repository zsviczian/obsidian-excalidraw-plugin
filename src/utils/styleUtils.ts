import { Setting } from "obsidian";

export const setButtonBgColor = (
  button: HTMLButtonElement,
  state: "normal" | "accent" | "success",
) => {
  button.removeClass("excalidraw-button-bgcolor-normal");
  button.removeClass("excalidraw-button-bgcolor-accent");
  button.removeClass("excalidraw-button-bgcolor-success");
  button.addClass(`excalidraw-button-bgcolor-${state}`);
};

export const hideElement = (el: HTMLElement) => {
  el.addClass("excalidraw-display-none");
};

export const showElement = (el: HTMLElement) => {
  el.removeClass("excalidraw-display-none");
};

// Function to hide or show a component
export const setComponentVisibility = (comp: Setting, visible: boolean) => {
  if (visible) {
    showElement(comp.settingEl);
  } else {
    hideElement(comp.settingEl);
  }
};

export const setStyle = (
  element: HTMLElement | SVGSVGElement,
  styles: Partial<CSSStyleDeclaration>,
): void => {
  Object.assign(element.style, styles);
};
