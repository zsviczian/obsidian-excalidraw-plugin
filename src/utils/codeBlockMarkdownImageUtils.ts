import { setStyleText } from "./htmlUtils";

declare const deliberateCreateElement: (document: Document, tagName: string) => HTMLElement;

export const CODE_BLOCK_IMAGE_MAX_WIDTH = 800;

/** Static images cannot expose scrolling: retain whitespace and wrap long tokens. */
export const MARKDOWN_IMAGE_CODE_WRAP_CSS = `
.excalidraw-md-host pre,
.excalidraw-md-host pre code {
  max-width: 100% !important;
  height: auto !important;
  max-height: none !important;
  white-space: pre-wrap !important;
  overflow-wrap: anywhere !important;
  word-break: break-word !important;
  overflow: visible !important;
}
.excalidraw-md-host pre code { display: block !important; }
.excalidraw-md-host pre code * {
  white-space: inherit !important;
  overflow-wrap: inherit !important;
  word-break: inherit !important;
}
`;

/** Measures natural code width in the styled, font-ready SVG measurement iframe. */
export function getCodeBlockMarkdownImageWidth(
  container: HTMLElement,
  maximumWidth: number,
  borderWidth: number,
): number {
  const className = "excalidraw-code-image-measure";
  const style = deliberateCreateElement(container.ownerDocument, "style") as HTMLStyleElement;
  setStyleText(style, `
.${className}, .${className} pre, .${className} pre code {
  width: max-content !important;
  min-width: 0 !important;
  max-width: none !important;
  white-space: pre !important;
}
`);
  container.ownerDocument.head.appendChild(style);
  container.classList.add(className);
  try {
    const naturalWidth = Math.ceil(container.getBoundingClientRect().width + borderWidth);
    return Math.min(maximumWidth, Math.max(180, naturalWidth));
  } finally {
    container.classList.remove(className);
    style.remove();
  }
}
