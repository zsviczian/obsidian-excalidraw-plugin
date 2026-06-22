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

type StyleObject = Partial<CSSStyleDeclaration> & {
  [key: `--${string}`]: string | undefined;
};

export const setStyle = (
  element: HTMLElement | SVGElement | null | undefined,
  styles: StyleObject,
): void => {
  if (!element) {
    return;
  }

  for (const [key, value] of Object.entries(styles)) {
    if (value === undefined || value === null) {
      continue;
    }

    if (key.startsWith("--")) {
      // Explicitly casting value as string fixes the type error safely
      element.style.setProperty(key, value as string);
    } else {
      // @ts-ignore: safe fallback for dynamic string keys matching standard CSS properties
      element.style[key] = value;
    }
  }
};

export const removeStyle = (
  element: HTMLElement | SVGSVGElement | null | undefined,
  properties: string[],
): void => {
  if (!element) {
    return;
  }

  for (const prop of properties) {
    const propStr = prop;

    if (propStr.startsWith("--")) {
      element.style.removeProperty(propStr);
    } else {
      // Handle camelCase (e.g., backgroundColor -> background-color)
      const kebabCase = propStr.replace(/([A-Z])/g, "-$1").toLowerCase();
      element.style.removeProperty(kebabCase);
    }
  }
};
