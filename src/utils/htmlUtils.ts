import { sanitizeHTMLToDom, setIcon } from "obsidian";
import { mainDocument } from "src/constants/constants";

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

export const makeEntitiesXmlSafe = (svgString: string): string => {
  // Create an in-memory textarea element to act as our native decoder
  const textarea = mainDocument.createElement("textarea");

  // Regex to find all named entities (e.g., &nbsp;, &copy;, &mdash;)
  return svgString.replace(/&[a-zA-Z0-9]+;/g, (match) => {
    // 1. Leave the 5 standard XML entities alone
    const validXmlEntities = ["&amp;", "&lt;", "&gt;", "&quot;", "&apos;"];
    if (validXmlEntities.includes(match)) {
      return match;
    }

    // 2. Let the browser decode the HTML entity
    textarea.innerHTML = match;
    const decodedStr = textarea.value;

    // 3. If the browser didn't recognize it, return it as-is
    if (decodedStr === match) {
      return match;
    }

    // 4. Convert the decoded character(s) into XML-safe numeric entities
    // We use Array.from and codePointAt to safely handle potential emojis/special chars
    return Array.from(decodedStr)
      .map((char) => `&#${char.codePointAt(0)};`)
      .join("");
  });
};
