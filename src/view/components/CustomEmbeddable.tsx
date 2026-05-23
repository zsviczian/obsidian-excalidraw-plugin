import { ExcalidrawEmbeddableElement } from "@zsviczian/excalidraw/types/element/src/types";
import ExcalidrawView from "src/view/ExcalidrawView";
import { Notice, requireApiVersion } from "obsidian";
import * as React from "react";
import { isObsidianThemeDark } from "src/utils/obsidianUtils";
import {
  DEVICE,
  EXTENDED_EVENT_TYPES,
  KEYBOARD_EVENT_TYPES,
  mainDocument,
} from "src/constants/constants";
import {
  ExcalidrawImperativeAPI,
  UIAppState,
} from "@zsviczian/excalidraw/types/excalidraw/types";
import { ObsidianCanvasNode } from "src/view/managers/CanvasNodeFactory";
import {
  processLinkText,
  patchMobileView,
  setFileToLocalGraph,
  createLeaf,
  predictViewType,
} from "src/utils/customEmbeddableUtils";
import { EmbeddableMDCustomProps } from "src/shared/Dialogs/EmbeddableSettings";
import { EmbeddableLeafRef } from "src/types/excalidrawViewTypes";
import { t } from "src/lang/helpers";

type PdfViewLike = {
  containerEl?: HTMLElement;
  viewer?: {
    child?: {
      pdfViewer?: {
        setBackground?(color: string | null, isInverted: boolean): void;
      };
    };
  };
};

type PdfObserverRef = React.MutableRefObject<MutationObserver | null> & {
  currentCleanup?: () => void;
};

const CANVAS_VIEWTYPES = new Set([
  "markdown",
  "bases",
  "audio",
  "video",
  "pdf",
]);

const DATA_URL_IFRAME_SANDBOX = "allow-scripts allow-forms allow-popups";
const DATA_URL_IFRAME_CSP =
  "default-src 'none'; script-src https: data: 'unsafe-inline'; style-src https: 'unsafe-inline'; img-src https: data: blob:; font-src https: data:; connect-src https:; media-src https: data: blob:; frame-src https: data:; form-action https:; base-uri 'none'";

function decodeDataUrlToHtml(dataUrl: string): string | null {
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex === -1) {
    return null;
  }

  const header = dataUrl.slice(0, commaIndex).toLowerCase();
  const payload = dataUrl.slice(commaIndex + 1);

  try {
    return header.includes(";base64")
      ? atob(payload)
      : decodeURIComponent(payload);
  } catch {
    return null;
  }
}

function injectDefensiveCsp(html: string): string {
  if (!html || /http-equiv\s*=\s*["']content-security-policy["']/i.test(html)) {
    return html;
  }

  const cspTag = `<meta http-equiv="Content-Security-Policy" content="${DATA_URL_IFRAME_CSP}">`;

  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (head) => `${head}${cspTag}`);
  }

  if (/<html[^>]*>/i.test(html)) {
    return html.replace(
      /<html[^>]*>/i,
      (htmlOpen) => `${htmlOpen}<head>${cspTag}</head>`,
    );
  }

  return `<!doctype html><html><head>${cspTag}</head><body>${html}</body></html>`;
}

function getSandboxedDataUrlSrcDoc(src: string): string | null {
  const decodedHtml = decodeDataUrlToHtml(src);
  if (!decodedHtml) {
    return null;
  }
  return injectDefensiveCsp(decodedHtml);
}

let noticeTimer: number;
function showNoticeOnce(message: string) {
  if (noticeTimer) {
    return;
  }
  noticeTimer = window.setTimeout(() => {
    noticeTimer = undefined;
  }, 1000);
  new Notice(message, 6000);
}

function getTheme(view: ExcalidrawView, theme: string): string {
  return view.excalidrawData.embeddableTheme === "dark"
    ? "theme-dark"
    : view.excalidrawData.embeddableTheme === "light"
      ? "theme-light"
      : view.excalidrawData.embeddableTheme === "auto"
        ? theme === "dark"
          ? "theme-dark"
          : "theme-light"
        : isObsidianThemeDark()
          ? "theme-dark"
          : "theme-light";
}

function setPDFViewTheme(view: ExcalidrawView, pdfView: PdfViewLike | null) {
  if (!pdfView) {
    return;
  }
  if (view.excalidrawData.embeddableTheme === "auto") {
    pdfView.viewer?.child?.pdfViewer?.setBackground?.(null, false);
    const pdfContainerEl = pdfView.containerEl?.querySelector(".pdf-container");
    if (pdfContainerEl) {
      pdfContainerEl.classList.remove("mod-themed");
    }
    const thumbnailViewEl = pdfView.containerEl?.querySelector(
      ".pdf-thumbnail-view",
    );
    if (thumbnailViewEl instanceof HTMLElement) {
      thumbnailViewEl.style.filter = "var(--theme-filter)";
    }
  } else {
    const pdfViewerEl = pdfView.containerEl?.querySelector("div.pdfViewer");
    if (pdfViewerEl) {
      pdfViewerEl.addClass("mod-nofilter");
    }
  }
  if (["dark", "light"].includes(view.excalidrawData.embeddableTheme)) {
    const pdfContainerEl = pdfView.containerEl?.querySelector(".pdf-container");
    if (pdfContainerEl && !pdfContainerEl.classList.contains("mod-themed")) {
      pdfContainerEl.classList.add("mod-themed");
    }
  }
  if (view.excalidrawData.embeddableTheme === "light") {
    pdfView.viewer?.child?.pdfViewer?.setBackground?.(null, false);
  }
  if (view.excalidrawData.embeddableTheme === "dark") {
    pdfView.viewer?.child?.pdfViewer?.setBackground?.(
      mainDocument.body.getCssPropertyValue("--color-base-00"),
      true,
    );
  }
}

function setupPdfViewEnhancements(
  view: ExcalidrawView,
  leafRef: React.MutableRefObject<EmbeddableLeafRef | null>,
  pdfObserverRef: PdfObserverRef,
  pdfObserverDisabledRef: React.MutableRefObject<boolean>,
) {
  const pdfView = leafRef.current?.node?.child;
  if (!pdfView) {
    return;
  }

  const patchPDF = () => {
    // Disable observer while applying the theme to avoid loops
    pdfObserverDisabledRef.current = true;
    setPDFViewTheme(view, pdfView);
    window.requestAnimationFrame(() => {
      pdfObserverDisabledRef.current = false;
    });

    // Observe inline height changes on the PDF root container and reset them
    // this could be an obsidian bug, should be revisted later 2025-08-23
    const containerEl = pdfView.containerEl;
    let prevHeight = containerEl?.style?.height || "";
    let heightObserver: MutationObserver | null = null;
    if (containerEl) {
      heightObserver = new MutationObserver(() => {
        const h = containerEl.style.height || "";
        if (h !== prevHeight) {
          prevHeight = h;
          if (h) {
            containerEl.style.height = "";
            prevHeight = "";
          }
        }
      });
      heightObserver.observe(containerEl, {
        attributes: true,
        attributeFilter: ["style"],
      });
    }

    // Transform-aware MMB drag-to-scroll (bypasses Chromium autoscroll)
    const scroller =
      pdfView.containerEl?.querySelector(".pdf-viewer-container") || null;
    let active = false;
    let lastX = 0;
    let lastY = 0;
    let scaleX = 1;
    let scaleY = 1;

    const getScaleFromAncestor = (target: Element | null) => {
      // Read scale from the outer excalidraw embeddable container transform
      const container = target?.closest(".excalidraw__embeddable-container");
      if (!container) {
        return { sx: 1, sy: 1 };
      }
      const t = getComputedStyle(container).transform;
      // t can be "none", "matrix(a,b,c,d,tx,ty)" or "matrix3d(...)"
      if (!t || t === "none") {
        return { sx: 1, sy: 1 };
      }
      if (t.startsWith("matrix3d(")) {
        // matrix3d: m11=a1, m12=b1, m21=a2, m22=b2 in the first 6 entries
        const m = t.slice(9, -1).split(",").map(Number);
        const a = m[0];
        const b = m[1];
        const c = m[4];
        const d = m[5];
        // scaleX = length of first column, scaleY = length of second column
        return { sx: Math.hypot(a, b) || 1, sy: Math.hypot(c, d) || 1 };
      }
      if (t.startsWith("matrix(")) {
        const m = t.slice(7, -1).split(",").map(Number); // [a,b,c,d,tx,ty]
        const a = m[0];
        const b = m[1];
        const c = m[2];
        const d = m[3];
        return { sx: Math.hypot(a, b) || 1, sy: Math.hypot(c, d) || 1 };
      }
      return { sx: 1, sy: 1 };
    };

    const onPointerDownCapture = (e: PointerEvent) => {
      if (
        (DEVICE.isDesktop && e.button !== 1) ||
        (DEVICE.isMobile && e.button !== 0) ||
        !scroller
      ) {
        return;
      }
      // Start custom pan, cancel browser autoscroll and prevent Excalidraw from handling it.
      e.preventDefault();
      e.stopPropagation();

      active = true;
      lastX = e.clientX;
      lastY = e.clientY;

      const { sx, sy } = getScaleFromAncestor(scroller);
      scaleX = sx;
      scaleY = sy;

      // Listen on window so we keep panning even if we leave the element.
      window.addEventListener("pointermove", onPointerMove, { capture: true });
      window.addEventListener("pointerup", onPointerUp, {
        capture: true,
        once: true,
      });
      window.addEventListener("pointercancel", onPointerUp, {
        capture: true,
        once: true,
      });

      try {
        view.contentEl.style.cursor = "grabbing";
      } catch {}
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!active || !scroller) {
        return;
      }
      // Continue only while the pointer button is held:
      // - Desktop: middle mouse button (bit 3 = 4)
      // - Mobile: primary/left button (bit 0 = 1)
      if (
        (DEVICE.isDesktop && (e.buttons & 4) === 0) ||
        (DEVICE.isMobile && (e.buttons & 1) === 0)
      ) {
        return;
      }

      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;

      // Convert viewport dx/dy to local CSS px by dividing on scale.
      scroller.scrollLeft -= dx / (scaleX || 1);
      scroller.scrollTop -= dy / (scaleY || 1);

      e.preventDefault();
      e.stopPropagation();
    };

    const onPointerUp = (_e: PointerEvent) => {
      active = false;
      try {
        view.contentEl.style.cursor = "";
      } catch {}
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerup", onPointerUp, true);
      window.removeEventListener("pointercancel", onPointerUp, true);
    };

    const root = pdfView.containerEl;
    root?.addEventListener("pointerdown", onPointerDownCapture, {
      capture: true,
    });

    const cleanupPan = () => {
      root?.removeEventListener("pointerdown", onPointerDownCapture, true);
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerup", onPointerUp, true);
      window.removeEventListener("pointercancel", onPointerUp, true);
      heightObserver?.disconnect();
      heightObserver = null;
    };
    pdfObserverRef.currentCleanup = () => {
      cleanupPan();
    };

    if (view.excalidrawData.embeddableTheme !== "default") {
      const pdfContainerEl =
        pdfView.containerEl?.querySelector(".pdf-container");
      if (pdfContainerEl) {
        pdfObserverRef.current?.disconnect();
        pdfObserverRef.current = new MutationObserver(() => {
          if (pdfObserverDisabledRef.current) {
            return;
          }
          pdfObserverDisabledRef.current = true;
          try {
            setPDFViewTheme(view, pdfView);
            if (view.excalidrawData.embeddableTheme !== "default") {
              showNoticeOnce(t("NOTICE_PDF_THEME"));
            }
          } finally {
            window.requestAnimationFrame(() => {
              pdfObserverDisabledRef.current = false;
            });
          }
        });
        pdfObserverRef.current.observe(pdfContainerEl, {
          attributes: true,
          attributeFilter: ["class"],
        });

        // https://github.com/RyotaUshio/obsidian-pdf-plus/issues/477
        // Watch for the PDF container being removed from DOM (e.g. by PDF+)
        const rootEl = pdfView.containerEl;
        if (rootEl) {
          let detachObserver: MutationObserver | null = new MutationObserver(
            (_muts, obs) => {
              // If the tracked pdfContainerEl is gone/replaced, clean up and reattach
              if (
                !pdfContainerEl.isConnected ||
                !rootEl.contains(pdfContainerEl)
              ) {
                obs.disconnect();
                detachObserver = null;

                // Cleanup existing handlers/observers
                try {
                  pdfObserverRef.currentCleanup?.();
                } catch {}
                try {
                  pdfObserverRef.current?.disconnect();
                } catch {}

                // Re-setup on next tick to allow DOM to settle
                window.setTimeout(() => {
                  if (leafRef.current?.node?.child?.containerEl?.isConnected) {
                    setupPdfViewEnhancements(
                      view,
                      leafRef,
                      pdfObserverRef,
                      pdfObserverDisabledRef,
                    );
                  }
                }, 0);
              }
            },
          );
          detachObserver.observe(rootEl, { childList: true, subtree: true });

          // Extend cleanup to also stop the detachObserver and the class observer
          const prevCleanup = pdfObserverRef.currentCleanup;
          pdfObserverRef.currentCleanup = () => {
            try {
              prevCleanup?.();
            } catch {}
            try {
              pdfObserverRef.current?.disconnect();
            } catch {}
            try {
              detachObserver?.disconnect();
            } catch {}
            detachObserver = null;
          };
        }
      }
    }
  };

  const root = leafRef?.current?.node?.child?.containerEl;
  if (root) {
    const selector = ".pdf-viewer-container";
    const existing = root.querySelector(selector);
    if (existing) {
      patchPDF();
    } else {
      let timeoutId: number | null = null;
      const mo = new MutationObserver((_, obs) => {
        const el = root.querySelector(selector);
        if (el) {
          patchPDF();
          obs.disconnect();
          if (timeoutId) {
            window.clearTimeout(timeoutId);
          }
        }
      });
      mo.observe(root, { childList: true, subtree: true });
      timeoutId = window.setTimeout(() => {
        mo.disconnect();
      }, 10000);
    }
  }
}

//--------------------------------------------------------------------------------
//Render webview for anything other than Vimeo and Youtube
//Vimeo and Youtube are rendered by Excalidraw because of the window messaging
//required to control the video
//--------------------------------------------------------------------------------
export function renderWebView(
  src: string,
  view: ExcalidrawView,
  id: string,
  _: UIAppState,
): JSX.Element {
  let isAllowed = false;
  try {
    const url = new URL(src);
    // Explicitly allow safe protocols to prevent execution of
    // javascript:, vbscript:, file:, etc.
    isAllowed = ["http:", "https:", "data:"].includes(url.protocol);
  } catch (e) {
    // If URL parsing fails, consider it unsafe
    isAllowed = false;
  }

  const safeSrc = isAllowed ? src : "about:blank";

  const isDataURL = safeSrc.startsWith("data:");
  const srcDoc = isDataURL ? getSandboxedDataUrlSrcDoc(safeSrc) : null;
  if (DEVICE.isDesktop && !isDataURL) {
    return (
      <webview
        ref={(ref) => view.updateEmbeddableRef(id, ref)}
        className="excalidraw__embeddable"
        title="Excalidraw Embedded Content"
        allowFullScreen={true}
        src={safeSrc}
        webpreferences="autoplayPolicy=document-user-activation-required"
        style={{
          overflow: "hidden",
          borderRadius: "var(--embeddable-radius)",
        }}
      />
    );
  }
  return (
    <iframe
      ref={(ref) => view.updateEmbeddableRef(id, ref)}
      className="excalidraw__embeddable"
      title="Excalidraw Embedded Content"
      allowFullScreen={true}
      allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      sandbox={isDataURL ? DATA_URL_IFRAME_SANDBOX : undefined}
      src={isDataURL ? null : safeSrc}
      style={{
        overflow: "hidden",
        borderRadius: "var(--embeddable-radius)",
      }}
      srcDoc={srcDoc}
    />
  );
}

//--------------------------------------------------------------------------------
//Render WorkspaceLeaf or CanvasNode
//--------------------------------------------------------------------------------
function RenderObsidianView({
  mdProps,
  element,
  linkText,
  view,
  containerRef,
  activeEmbeddable,
  theme,
  canvasColor,
  selectedElementId,
  sceneZoom,
}: {
  mdProps: EmbeddableMDCustomProps;
  element: ExcalidrawEmbeddableElement;
  linkText: string;
  view: ExcalidrawView;
  containerRef: React.RefObject<HTMLDivElement>;
  activeEmbeddable: { element: ExcalidrawEmbeddableElement; state: string };
  theme: string;
  canvasColor: string;
  selectedElementId: string;
  sceneZoom: number;
}): JSX.Element {
  const { subpath, file } = processLinkText(linkText, view);

  if (!file) {
    return null;
  }
  const React = view.packages.react;
  const leafRef = React.useRef(
    null,
  ) as React.MutableRefObject<EmbeddableLeafRef | null>;
  const isEditingRef = React.useRef(false);
  const isActiveRef = React.useRef(false);
  const viewTypeRef = React.useRef("empty");
  const themeRef = React.useRef(theme);
  const pdfObserverRef = React.useRef<MutationObserver | null>(
    null,
  ) as PdfObserverRef;
  const pdfObserverDisabledRef = React.useRef(false);
  const mobilePatchCleanupRef = React.useRef(null);
  const initialViewFileRef = React.useRef(view.file);

  // Update themeRef when theme changes
  React.useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  //--------------------------------------------------------------------------------
  //block propagation of events to the parent if the embeddable element is active
  //--------------------------------------------------------------------------------
  const stopPropagation = React.useCallback(
    (event: Event) => {
      if (isActiveRef.current) {
        event.stopPropagation(); // Stop the event from propagating up the DOM tree
      }
    },
    [isActiveRef.current],
  );

  //runs once after mounting of the component and when the component is unmounted
  React.useEffect(() => {
    if (!containerRef?.current) {
      return;
    }

    KEYBOARD_EVENT_TYPES.forEach((type) =>
      containerRef.current.addEventListener(type, stopPropagation),
    );
    containerRef.current.addEventListener("click", handleClick);

    return () => {
      if (!containerRef?.current) {
        return;
      }
      KEYBOARD_EVENT_TYPES.forEach((type) =>
        containerRef.current.removeEventListener(type, stopPropagation),
      );
      EXTENDED_EVENT_TYPES.forEach((type) =>
        containerRef.current.removeEventListener(type, stopPropagation),
      );
      containerRef.current.removeEventListener("click", handleClick);
    }; //cleanup on unmount
  }, []);

  //blocking or not the propagation of events to the parent if the embeddable element is active
  React.useEffect(() => {
    EXTENDED_EVENT_TYPES.forEach((type) =>
      containerRef.current.removeEventListener(type, stopPropagation),
    );
    if (!containerRef?.current) {
      return;
    }

    if (isActiveRef.current) {
      EXTENDED_EVENT_TYPES.forEach((type) =>
        containerRef.current.addEventListener(type, stopPropagation),
      );
    }

    return () => {
      if (!containerRef?.current) {
        return;
      }
      EXTENDED_EVENT_TYPES.forEach((type) =>
        containerRef.current.removeEventListener(type, stopPropagation),
      );
    }; //cleanup on unmount
  }, [isActiveRef.current, containerRef.current]);

  //set local graph to view when deactivating embeddables
  React.useEffect(() => {
    if (file === view.file) {
      return;
    }
    if (!isActiveRef.current) {
      setFileToLocalGraph(view.app, view.file);
    }
  }, [isActiveRef.current]);

  const setKeepOnTop = () => {
    const keepontop =
      view.app.workspace.activeLeaf === view.leaf && DEVICE.isDesktop;
    if (keepontop) {
      if (!view.ownerWindow.electronWindow.isAlwaysOnTop()) {
        view.ownerWindow.electronWindow.setAlwaysOnTop(true);
        window.setTimeout(() => {
          view.ownerWindow.electronWindow.setAlwaysOnTop(false);
        }, 500);
      }
    }
  };

  //--------------------------------------------------------------------------------
  //Mount the workspace leaf or the canvas node depending on subpath
  //--------------------------------------------------------------------------------
  React.useEffect(() => {
    if (!containerRef?.current) {
      return;
    }

    while (containerRef.current.hasChildNodes()) {
      containerRef.current.removeChild(containerRef.current.lastChild);
    }

    containerRef.current.parentElement.style.padding = "";

    leafRef.current = {
      leaf: null,
      node: null,
      editNode: null,
    };

    const createNode = (viewType: string) => {
      if (!requireApiVersion("1.9.10")) {
        setKeepOnTop();
      }
      leafRef.current.node = view.canvasNodeFactory.createFileNote(
        file,
        subpath,
        containerRef.current,
        element.id,
      );
      setColors(containerRef.current, element, mdProps, canvasColor, viewType);
      view.updateEmbeddableLeafRef(element.id, leafRef.current);
      viewTypeRef.current = "markdown";
    };

    patchMobileView(view);
    //if subpath is defined, create a canvas node else create a workspace leaf
    if (
      subpath &&
      view.canvasNodeFactory.isInitialized() &&
      file.extension.toLowerCase() === "md"
    ) {
      createNode("markdown");
    } else {
      const viewType = predictViewType(view.app, file);
      // markdown could still be a kanban board or other custom view on top of markdown, those need to be displayed in leaves
      if (
        viewType !== "markdown" &&
        CANVAS_VIEWTYPES.has(viewType) &&
        view.canvasNodeFactory.isInitialized()
      ) {
        createNode(viewType);
        if (viewType === "pdf") {
          // Moved PDF setup logic into a helper for readability
          setupPdfViewEnhancements(
            view,
            leafRef,
            pdfObserverRef,
            pdfObserverDisabledRef,
          );
        }
      } else {
        void (async () => {
          const { rootSplit, leaf } = createLeaf(view);
          leafRef.current.leaf = leaf;
          await leafRef.current.leaf.openFile(file, {
            active: false,
            state: { mode: "preview" },
            ...(subpath ? { eState: { subpath } } : {}),
          });
          const viewType = leafRef.current.leaf.view?.getViewType();
          viewTypeRef.current = viewType;
          if (viewType === "canvas") {
            leafRef.current.leaf.view.canvas?.setReadonly(true);
          }
          if (
            viewType === "markdown" &&
            view.canvasNodeFactory.isInitialized()
          ) {
            createNode("markdown");
            //I haven't found a better way of deciding if an .md file has its own view (e.g., kanban) or not
            //This runs only when the file is added, thus should not be a major performance issue
            await leafRef.current.leaf.setViewState({
              type: "markdown",
              state: { file: null },
            });
            leafRef.current.leaf?.detach();
          } else {
            const workspaceLeaf: HTMLDivElement =
              rootSplit.containerEl.querySelector("div.workspace-leaf");
            if (workspaceLeaf) {
              workspaceLeaf.style.borderRadius = "var(--embeddable-radius)";
            }
            rootSplit.containerEl.addClass("mod-visible");
            containerRef.current.appendChild(rootSplit.containerEl);
            setColors(
              containerRef.current,
              element,
              mdProps,
              canvasColor,
              viewType,
            );
            view.updateEmbeddableLeafRef(element.id, leafRef.current);
          }
        })();
      }
    }

    return () => {
      // disconnect observer if any
      pdfObserverRef.currentCleanup?.();
      pdfObserverRef.current?.disconnect();
      pdfObserverRef.current = null;

      // cleanup persistent mobile patch if active
      try {
        mobilePatchCleanupRef.current?.();
      } catch {}
      mobilePatchCleanupRef.current = null;

      view.updateEmbeddableLeafRef(element.id);

      if (!leafRef.current) {
        return;
      }
      view.canvasNodeFactory.removeNode(leafRef.current.node);
      leafRef.current.leaf?.detach();
      leafRef.current = null;
    }; //cleanup on unmount
  }, [linkText, subpath, containerRef, element.id, file.path]);

  //--------------------------------------------------------------------------------
  //Set colors of the canvas node
  //--------------------------------------------------------------------------------
  function roundEmbeddableSize(value: number): number {
    return Math.round(value * 1000) / 1000;
  }

  function setEmbeddableSizeVars(
    canvasNode: HTMLDivElement,
    element: ExcalidrawEmbeddableElement,
    sceneZoom: number,
  ) {
    const scaleX = Math.abs(element.scale?.[0] ?? 1);
    const scaleY = Math.abs(element.scale?.[1] ?? 1);
    const width = roundEmbeddableSize(element.width / scaleX);
    const height = roundEmbeddableSize(element.height / scaleY);
    canvasNode?.style.setProperty("--embeddable-width", `${width}px`);
    canvasNode?.style.setProperty("--embeddable-height", `${height}px`);
    canvasNode?.style.setProperty(
      "--embeddable-scaleX",
      `${roundEmbeddableSize(scaleX)}`,
    );
    canvasNode?.style.setProperty(
      "--embeddable-scaleY",
      `${roundEmbeddableSize(scaleY)}`,
    );
    canvasNode?.style.setProperty(
      "--scene-zoom",
      `${roundEmbeddableSize(sceneZoom ?? 1)}`,
    );
  }

  function setColors(
    canvasNode: HTMLDivElement,
    element: ExcalidrawEmbeddableElement,
    mdProps: EmbeddableMDCustomProps,
    canvasColor: string,
    viewType: string,
  ) {
    setEmbeddableSizeVars(canvasNode, element, sceneZoom);
    if (!mdProps) {
      return;
    }
    if (!leafRef.current?.hasOwnProperty("node")) {
      return;
    }

    const canvasNodeContainer = containerRef.current
      ?.firstElementChild as HTMLElement;

    if (mdProps.useObsidianDefaults) {
      canvasNode?.style.removeProperty("--canvas-background");
      canvasNodeContainer?.style.removeProperty("background-color");
      canvasNode?.style.removeProperty("--canvas-border");
      canvasNodeContainer?.style.removeProperty("border-color");
      return;
    }

    const ea = view.plugin.ea;
    if (mdProps.backgroundMatchElement) {
      const opacity = (mdProps?.backgroundOpacity ?? 50) / 100;
      const color = element?.backgroundColor
        ? element.backgroundColor.toLowerCase() === "transparent"
          ? "transparent"
          : ea
              .getCM(element.backgroundColor)
              .alphaTo(opacity)
              .stringHEX({ alpha: true })
        : "transparent";

      color === "transparent"
        ? canvasNode?.addClass("transparent")
        : canvasNode?.removeClass("transparent");
      canvasNode?.style.setProperty("--canvas-background", color);
      canvasNode?.style.setProperty("--background-primary", color);
      canvasNodeContainer?.style.setProperty("background-color", color);
    } else if (!(mdProps.backgroundMatchElement ?? true)) {
      const opacity = (mdProps.backgroundOpacity ?? 100) / 100;
      const color = mdProps.backgroundMatchCanvas
        ? canvasColor.toLowerCase() === "transparent"
          ? "transparent"
          : ea.getCM(canvasColor).alphaTo(opacity).stringHEX({ alpha: true })
        : ea
            .getCM(mdProps.backgroundColor)
            .alphaTo((mdProps.backgroundOpacity ?? 100) / 100)
            .stringHEX({ alpha: true });

      color === "transparent"
        ? canvasNode?.addClass("transparent")
        : canvasNode?.removeClass("transparent");
      canvasNode?.style.setProperty("--canvas-background", color);
      canvasNode?.style.setProperty("--background-primary", color);
      canvasNodeContainer?.style.setProperty("background-color", color);
    }
    switch (viewType) {
      case "bases":
        canvasNode?.style.setProperty(
          "--bases-cards-container-background",
          "var(--background-primary)",
        );
        canvasNode?.style.setProperty(
          "--bases-embed-border-color",
          "var(--background-modifier-border)",
        );
        canvasNode?.style.setProperty(
          "--bases-table-header-color",
          "var(--text-muted)",
        );
        canvasNode?.style.setProperty(
          "--bases-table-header-background",
          "var(--background-primary)",
        );
        canvasNode?.style.setProperty(
          "--bases-table-header-background-hover",
          "var(--background-modifier-hover)",
        );
        canvasNode?.style.setProperty(
          "--bases-table-header-sort-mask",
          "linear-gradient(to left, transparent var(--size-4-6), black var(--size-4-6))",
        );
        canvasNode?.style.setProperty(
          "--bases-table-border-color",
          "var(--table-border-color)",
        );
        canvasNode?.style.setProperty(
          "--bases-table-row-background-hover",
          "var(--table-row-background-hover)",
        );
        canvasNode?.style.setProperty(
          "--bases-table-cell-shadow-active",
          "0 0 0 2px var(--interactive-accent)",
        );
        canvasNode?.style.setProperty(
          "--bases-table-cell-background-active",
          "var(--background-primary)",
        );
        canvasNode?.style.setProperty(
          "--bases-table-cell-background-disabled",
          "var(--background-primary-alt)",
        );
        canvasNode?.style.setProperty(
          "--bases-cards-container-background",
          "var(--background-primary)",
        );
        canvasNode?.style.setProperty(
          "--bases-cards-background",
          "var(--background-primary)",
        );
        canvasNode?.style.setProperty(
          "--bases-cards-cover-background",
          "var(--background-primary-alt)",
        );
        canvasNode?.style.setProperty(
          "--bases-cards-shadow",
          "0 0 0 1px var(--background-modifier-border)",
        );
        canvasNode?.style.setProperty(
          "--bases-cards-shadow-hover",
          "0 0 0 1px var(--background-modifier-border-hover)",
        );
        break;
      case "pdf":
        canvasNode?.style.setProperty(
          "--pdf-sidebar-background",
          "var(--background-primary)",
        );
        canvasNode?.style.setProperty(
          "--pdf-background",
          "var(--background-primary)",
        );
        canvasNode?.style.setProperty(
          "--pdf-sidebar-background",
          "var(--background-primary)",
        );
        break;
    }

    if (mdProps.borderMatchElement) {
      const opacity = (mdProps?.borderOpacity ?? 50) / 100;
      const color = element?.strokeColor
        ? element.strokeColor.toLowerCase() === "transparent"
          ? "transparent"
          : ea
              .getCM(element.strokeColor)
              .alphaTo(opacity)
              .stringHEX({ alpha: true })
        : "transparent";
      canvasNode?.style.setProperty("--canvas-border", color);
      canvasNode?.style.setProperty("--canvas-color", color);
      //canvasNodeContainer?.style.setProperty("border-color", color);
    } else if (!(mdProps?.borderMatchElement ?? true)) {
      const color = ea
        .getCM(mdProps.borderColor)
        .alphaTo((mdProps.borderOpacity ?? 100) / 100)
        .stringHEX({ alpha: true });
      canvasNode?.style.setProperty("--canvas-border", color);
      canvasNode?.style.setProperty("--canvas-color", color);
      //canvasNodeContainer?.style.setProperty("border-color", color);
    }
  }

  //--------------------------------------------------------------------------------
  //Set colors of the canvas node
  //--------------------------------------------------------------------------------
  React.useEffect(() => {
    if (!containerRef.current) {
      return;
    }
    const canvasNode = containerRef.current;
    if (!canvasNode.hasClass("canvas-node")) {
      return;
    }
    setColors(canvasNode, element, mdProps, canvasColor, viewTypeRef.current);
  }, [
    mdProps?.useObsidianDefaults,
    mdProps?.backgroundMatchCanvas,
    mdProps?.backgroundMatchElement,
    mdProps?.backgroundColor,
    mdProps?.backgroundOpacity,
    mdProps?.borderMatchElement,
    mdProps?.borderColor,
    mdProps?.borderOpacity,
    element.backgroundColor,
    element.strokeColor,
    element.width,
    element.height,
    element.scale?.[0],
    element.scale?.[1],
    sceneZoom,
    containerRef.current,
    canvasColor,
    viewTypeRef.current,
  ]);

  React.useEffect(() => {
    if (!containerRef.current) {
      return;
    }
    setEmbeddableSizeVars(containerRef.current, element, sceneZoom);
  }, [
    element.width,
    element.height,
    element.scale?.[0],
    element.scale?.[1],
    sceneZoom,
  ]);

  //--------------------------------------------------------------------------------
  //Switch to preview mode when the iframe is not active
  //--------------------------------------------------------------------------------
  React.useEffect(() => {
    if (isEditingRef.current) {
      if (leafRef.current?.node) {
        containerRef.current?.addClasses(["is-editing", "is-focused"]);
        view.canvasNodeFactory.stopEditing(leafRef.current.node);
      }
      isEditingRef.current = false;
    }
  }, [isEditingRef.current, leafRef]);

  //--------------------------------------------------------------------------------
  //Switch to edit mode when markdown view is clicked
  //--------------------------------------------------------------------------------
  const handleClick = React.useCallback(
    (event?: Event) => {
      if (view.file !== initialViewFileRef.current) {
        return;
      }

      if (isActiveRef.current) {
        event?.stopPropagation();
      }

      if (!isActiveRef.current || isEditingRef.current || !leafRef.current) {
        return;
      }

      /*if(isActiveRef.current && leafRef.current?.leaf) {
      setKeepOnTop();
      view.app.workspace.setActiveLeaf(leafRef.current.leaf, { focus: true });
    }*/

      if (leafRef.current.node) {
        //Handle canvas node
        const newTheme = getTheme(view, themeRef.current);
        containerRef.current?.addClasses(["is-editing", "is-focused"]);
        void view.canvasNodeFactory.startEditing(
          leafRef.current.node,
          newTheme,
        );
        return;
      }

      if (leafRef.current.leaf && viewTypeRef.current === "markdown") {
        const api: ExcalidrawImperativeAPI = view.excalidrawAPI;
        const el = api
          .getSceneElements()
          .filter((el) => el.id === element.id)[0];
        if (!el || el.angle !== 0) {
          new Notice("Sorry, cannot edit rotated markdown documents");
          return;
        }
        const modes = leafRef.current.leaf.view.modes;
        if (!modes) {
          return;
        }
        patchMobileView(view);
        leafRef.current.leaf.view.setMode(modes.source);
        isEditingRef.current = true;
      }
    },
    [
      leafRef.current?.leaf,
      element.id,
      view,
      themeRef.current,
      isActiveRef.current,
      isEditingRef.current,
      viewTypeRef.current,
    ],
  );

  const startEditing = React.useCallback(() => {
    if (view.file !== initialViewFileRef.current) {
      return;
    }
    if (isActiveRef.current && isEditingRef.current) {
      return;
    }
    isActiveRef.current = true;
    handleClick();
  }, [isActiveRef.current, isEditingRef.current, handleClick, view]);

  if (leafRef.current) {
    leafRef.current.editNode = startEditing;
  }
  // Event listener for key press
  React.useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Deactivate active embeddable on Escape
      if (event.key === "Escape" && isActiveRef.current) {
        event.preventDefault();
        event.stopPropagation();
        view.updateScene({ appState: { activeEmbeddable: null } });
        return;
      }
      // Existing Enter behavior

      if (
        event.key === "Enter" &&
        !isEditingRef.current &&
        (selectedElementId === element.id ||
          activeEmbeddable?.element?.id === element.id)
      ) {
        startEditing(); // Call handleClick function when Enter key is pressed
      }
    };

    // Use capture so this runs even if container stops bubbling
    view.ownerDocument.addEventListener("keydown", handleKeyPress, true);

    return () => {
      view.ownerDocument.removeEventListener("keydown", handleKeyPress, true);
    };
  }, [
    handleClick,
    isActiveRef.current,
    view,
    activeEmbeddable,
    element,
    selectedElementId,
  ]);

  //--------------------------------------------------------------------------------
  // Set isActiveRef and switch to preview mode when the embeddable is not active
  //--------------------------------------------------------------------------------
  React.useEffect(() => {
    if (view.file !== initialViewFileRef.current) {
      return;
    }

    if (!containerRef?.current || !leafRef?.current) {
      return;
    }

    const previousIsActive = isActiveRef.current;
    isActiveRef.current =
      activeEmbeddable?.element.id === element.id &&
      activeEmbeddable?.state === "active";

    if (previousIsActive === isActiveRef.current) {
      return;
    }

    if (file !== view.file) {
      setFileToLocalGraph(view.app, file);
    }

    const node = leafRef.current?.node;
    if (node) {
      //Handle canvas node
      if (
        isActiveRef.current &&
        view.plugin.settings.markdownNodeOneClickEditing &&
        !containerRef.current?.hasClass("is-editing")
      ) {
        //!node.isEditing
        const newTheme = getTheme(view, themeRef.current);
        containerRef.current?.addClasses(["is-editing", "is-focused"]);
        void view.canvasNodeFactory.startEditing(node, newTheme);
      } else {
        containerRef.current?.removeClasses(["is-editing", "is-focused"]);
        view.canvasNodeFactory.stopEditing(node);
      }
      return;
    }

    if (leafRef.current.leaf) {
      // Manage persistent mobile patch lifecycle for LEAF on phones
      if (DEVICE.isPhone) {
        if (isActiveRef.current) {
          // start persistent observer if not running
          if (!mobilePatchCleanupRef.current) {
            const cleanup = patchMobileView(view, {
              keepAlive: true,
              isActive: () => isActiveRef.current,
            });
            mobilePatchCleanupRef.current =
              typeof cleanup === "function" ? cleanup : null;
          }
        } else {
          // stop persistent observer when deactivated
          try {
            mobilePatchCleanupRef.current?.();
          } catch {}
          mobilePatchCleanupRef.current = null;
        }
      }

      //I think this no longer happens since markdown is always a canvas node if canvasNodeFactory is initialized
      if (viewTypeRef.current === "markdown") {
        //Handle markdown leaf
        const modes = leafRef.current.leaf?.view.modes;
        if (!modes) {
          return;
        }

        if (!isActiveRef.current) {
          leafRef.current.leaf.view.setMode(modes.preview);
          isEditingRef.current = false;
        }
      }
    }
  }, [
    containerRef,
    leafRef,
    activeEmbeddable?.state,
    isActiveRef,
    activeEmbeddable?.element,
    activeEmbeddable?.state,
    element,
    view,
    isEditingRef,
    view.canvasNodeFactory,
    themeRef.current,
  ]);

  return null;
}

export const CustomEmbeddable: React.FC<{
  element: ExcalidrawEmbeddableElement;
  view: ExcalidrawView;
  appState: UIAppState;
  linkText: string;
}> = ({ element, view, appState, linkText }) => {
  const React = view.packages.react;
  const containerRef: React.RefObject<HTMLDivElement> = React.useRef(null);
  const theme = getTheme(view, appState.theme);
  const mdProps: EmbeddableMDCustomProps = element.customData?.mdProps || null;
  const selectedElementIds = Object.keys(appState.selectedElementIds);
  return (
    <div
      ref={containerRef}
      style={{
        width: `100%`,
        height: `100%`,
        borderRadius: "var(--embeddable-radius)",
        color: `var(--text-normal)`,
        touchAction: "auto",
      }}
      className={`${theme} canvas-node ${
        mdProps?.filenameVisible && !mdProps.useObsidianDefaults
          ? ""
          : "excalidraw-mdEmbed-hideFilename"
      }`}
    >
      <RenderObsidianView
        mdProps={mdProps}
        element={element}
        linkText={linkText}
        view={view}
        containerRef={containerRef}
        activeEmbeddable={appState.activeEmbeddable}
        theme={appState.theme}
        canvasColor={appState.viewBackgroundColor}
        selectedElementId={
          selectedElementIds.length === 1 ? selectedElementIds[0] : null
        }
        sceneZoom={appState.zoom.value}
      />
    </div>
  );
};
