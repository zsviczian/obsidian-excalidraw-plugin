import { CARD_HEIGHT, CARD_WIDTH, CaptureUpdateAction } from "../../constants/constants";
import { cloneElement } from "../../utils/excalidrawElementUtils";
import type ExcalidrawView from "../ExcalidrawView";

const MIN_CODE_CARD_HEIGHT = 100;
const MAX_CODE_CARD_HEIGHT = 1000;

/**
 * Finish a code-card insertion whose undo capture was deferred with EVENTUALLY.
 * Fit only that new card to its native Markdown preview. Rendering is
 * asynchronous, so wait briefly for stable content without retaining observers.
 * A manual resize, file change or retired editor cancels the initial fit.
 */
export async function fitPastedCodeBlockCard(
  view: ExcalidrawView,
  id: string,
): Promise<void> {
  const api = view.excalidrawAPI;
  const file = view.file;
  if (!api || !file) {
    return;
  }
  const deadline = Date.now() + 3000;
  let previousHeight: number | undefined;
  let stableSince = Date.now();
  let fittedHeight: number | undefined;
  try {
    while (Date.now() < deadline) {
      if (view.excalidrawAPI !== api || view.file !== file || view.isClosingOrMigrating()) {
        return;
      }
      const element = api.getSceneElements().find(element => element.id === id);
      if (
        element?.type !== "embeddable" ||
        element.width !== CARD_WIDTH || element.height !== CARD_HEIGHT
      ) {
        return;
      }
      const host = view.getEmbeddableLeafElementById(id);
      // A fallback workspace leaf can render the whole drawing note, including
      // other code blocks. Only the native section node identifies this card.
      const container = host?.node?.containerEl;
      const preview = container?.querySelector<HTMLElement>(".markdown-preview-view");
      const pre = preview?.querySelector<HTMLElement>("pre");
      if (container?.isConnected && container.ownerDocument === view.ownerDocument && pre) {
        const bounds = container.getBoundingClientRect();
        const scale = bounds.width / element.width;
        if (scale > 0 && pre.getBoundingClientRect().height > 0) {
          const style = view.ownerWindow.getComputedStyle(pre);
          const padding = parseFloat(style.marginBottom) || 0;
          const contentHeight = (pre.getBoundingClientRect().bottom - bounds.top) / scale +
            preview.scrollTop + padding + (parseFloat(view.ownerWindow.getComputedStyle(preview).paddingBottom) || 0);
          const height = Math.min(MAX_CODE_CARD_HEIGHT, Math.max(MIN_CODE_CARD_HEIGHT, Math.ceil(contentHeight)));
          if (height !== previousHeight) {
            previousHeight = height;
            stableSince = Date.now();
          } else if (Date.now() - stableSince >= 100) {
            fittedHeight = height;
            return;
          }
        }
      }
      // Persistence/lifecycle work must not depend on a popout window staying alive.
      await new Promise<void>(resolve => window.setTimeout(resolve, 50));
    }
  } finally {
    // Capture once, including a manual resize or the fallback default height.
    // The initial fit must survive redo without becoming a second undo step.
    if (view.excalidrawAPI === api && view.file === file && !view.isClosingOrMigrating()) {
      const elements = api.getSceneElements();
      const card = elements.find(element => element.id === id);
      if (card?.type === "embeddable") {
        // Pass an immutable change: mutating the current scene first would hide
        // the insertion from Excalidraw's comparison against the current state.
        const fitted = cloneElement(card);
        if (fittedHeight !== undefined && card.width === CARD_WIDTH && card.height === CARD_HEIGHT) {
          fitted.height = fittedHeight;
          // Insertion centered the default-sized card at the paste position.
          fitted.y = card.y + (card.height - fittedHeight) / 2;
        }
        api.updateScene({
          elements: elements.map(element => element.id === id ? fitted : element),
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
      }
    }
  }
}
