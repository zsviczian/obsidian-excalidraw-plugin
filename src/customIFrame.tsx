import { NonDeletedExcalidrawElement } from "@zsviczian/excalidraw/types/element/types";
import ExcalidrawView from "./ExcalidrawView";
import { Notice, Workspace, WorkspaceLeaf, WorkspaceSplit } from "obsidian";
import * as React from "react";
import { getParentOfClass, isObsidianThemeDark } from "./utils/ObsidianUtils";
import { getLinkParts } from "./utils/Utils";
import { DEVICE, REG_LINKINDEX_INVALIDCHARS } from "./Constants";
import { ExcalidrawImperativeAPI, UIAppState } from "@zsviczian/excalidraw/types/types";

declare module "obsidian" {
  interface Workspace {
    floatingSplit: any;
  }

  interface WorkspaceSplit {
    containerEl: HTMLDivElement;
  }
}

const KEYBOARD_EVENT_TYPES = [
  "keydown",
  "keyup",
  "keypress"
];

const EXTENDED_EVENT_TYPES = [
/*  "pointerdown",
  "pointerup",
  "pointermove",
  "mousedown",
  "mouseup",
  "mousemove",
  "mouseover",
  "mouseout",
  "mouseenter",
  "mouseleave",
  "dblclick",
  "drag",
  "dragend",
  "dragenter",
  "dragexit",
  "dragleave",
  "dragover",
  "dragstart",
  "drop",*/
  "copy",
  "cut",
  "paste",
  /*"wheel",
  "touchstart",
  "touchend",
  "touchmove",*/
];

const YOUTUBE_REG =
  /^(?:http(?:s)?:\/\/)?(?:(?:w){3}.)?youtu(?:be|.be)?(?:\.com)?\/(?:embed\/|watch\?v=|shorts\/)?([a-zA-Z0-9_-]+)(?:\?t=|&t=)?([a-zA-Z0-9_-]+)?[^\s]*$/;
const VIMEO_REG =
  /^(?:http(?:s)?:\/\/)?(?:(?:w){3}.)?(?:player\.)?vimeo\.com\/(?:video\/)?([^?\s]+)(?:\?.*)?$/;
const TWITTER_REG = /^(?:http(?:s)?:\/\/)?(?:(?:w){3}.)?twitter.com/;

type ConstructableWorkspaceSplit = new (ws: Workspace, dir: "horizontal"|"vertical") => WorkspaceSplit;

const getContainerForDocument = (doc:Document) => {
  if (doc !== document && app.workspace.floatingSplit) {
    for (const container of app.workspace.floatingSplit.children) {
      if (container.doc === doc) return container;
    }
  }
  return app.workspace.rootSplit;
};

export const useDefaultExcalidrawFrame = (element: NonDeletedExcalidrawElement) => {
  return element.link.match(YOUTUBE_REG) || element.link.match(VIMEO_REG) || element.link.match(TWITTER_REG);
}

const leafMap = new Map<string, WorkspaceLeaf>();

export const renderWebView = (src: string, radius: number):JSX.Element =>{
  if(DEVICE.isIOS || DEVICE.isAndroid) {
    return null;
  }

  return (
    <webview
      className="excalidraw__iframe"
      title="Excalidraw Embedded Content"
      allowFullScreen={true}
      src={src}
      style={{
        overflow: "hidden",
        borderRadius: `${radius}px`,
      }}
    />
  );
}

function RenderObsidianView(
  { element, linkText, radius, view, containerRef, appState }:{
  element: NonDeletedExcalidrawElement;
  linkText: string;
  radius: number;
  view: ExcalidrawView;
  containerRef: React.RefObject<HTMLDivElement>;
  appState: UIAppState;
}): JSX.Element {
  
  //This is definitely not the right solution, feels like sticking plaster
  //patch disappearing content on mobile
  const patchMobileView = () => {
    if(DEVICE.isDesktop) return;
    console.log("patching mobile view");
    const parent = getParentOfClass(view.containerEl,"mod-top");
    if(parent) {
      if(!parent.hasClass("mod-visible")) {
        parent.addClass("mod-visible");
      }
    }
  }

  let subpath:string = null;

  if (linkText.search("#") > -1) {
    const linkParts = getLinkParts(linkText, view.file);
    subpath = `#${linkParts.isBlockRef ? "^" : ""}${linkParts.ref}`;
    linkText = linkParts.path;
  }

  if (linkText.match(REG_LINKINDEX_INVALIDCHARS)) {
    return null;
  }

  const file = app.metadataCache.getFirstLinkpathDest(
    linkText,
    view.file.path,
  );

  if (!file) {
    return null;
  }
  const react = view.plugin.getPackage(view.ownerWindow).react;
  
  //@ts-ignore
  const leafRef = react.useRef<WorkspaceLeaf | null>(null);
  const isEditingRef = react.useRef(false);
  const isActiveRef = react.useRef(false);

  const stopPropagation = react.useCallback((event:React.PointerEvent<HTMLElement>) => {
    if(isActiveRef.current) {
      event.stopPropagation(); // Stop the event from propagating up the DOM tree
    }
  }, [isActiveRef.current]);

  react.useEffect(() => {
    EXTENDED_EVENT_TYPES.forEach((type) => containerRef.current.removeEventListener(type, stopPropagation));
    if(!containerRef?.current) {
      return;
    }

    if(isActiveRef.current) {
      EXTENDED_EVENT_TYPES.forEach((type) => containerRef.current.addEventListener(type, stopPropagation));
    }

    return () => {
      if(!containerRef?.current) {
        return;
      }
      EXTENDED_EVENT_TYPES.forEach((type) => containerRef.current.removeEventListener(type, stopPropagation));
    }; //cleanup on unmount
  }, [isActiveRef.current, containerRef.current]);

  react.useEffect(() => {
    if(!containerRef?.current) {
      return;
    }

    while(containerRef.current.hasChildNodes()) {
      containerRef.current.removeChild(containerRef.current.lastChild);
    }

    const doc = view.ownerDocument;
    const rootSplit:WorkspaceSplit = new (WorkspaceSplit as ConstructableWorkspaceSplit)(app.workspace, "vertical");
    rootSplit.getRoot = () => app.workspace[doc === document ? 'rootSplit' : 'floatingSplit'];
    rootSplit.getContainer = () => getContainerForDocument(doc);
    containerRef.current.appendChild(rootSplit.containerEl);
    rootSplit.containerEl.style.width = '100%';
    rootSplit.containerEl.style.height = '100%';
    rootSplit.containerEl.style.borderRadius = `${radius}px`;
    leafRef.current = app.workspace.createLeafInParent(rootSplit, 0);
    const workspaceLeaf:HTMLDivElement = rootSplit.containerEl.querySelector("div.workspace-leaf");
    if(workspaceLeaf) workspaceLeaf.style.borderRadius = `${radius}px`;
    (async () => {
      await leafRef.current.openFile(file, subpath ? { eState: { subpath }, state: {mode:"preview"} } : undefined);
      if (leafRef.current.view?.getViewType() === "canvas") {
        leafRef.current.view.canvas?.setReadonly(true);
      }
      patchMobileView();
    })();
    return () => {}; //cleanup on unmount
  }, [linkText, subpath]);
  
  const handleClick = react.useCallback((event: React.PointerEvent<HTMLElement>) => {
    if(isActiveRef.current) {
      event.stopPropagation();
    }

    if (isActiveRef.current && !isEditingRef.current) {
      if (!leafRef.current?.view || leafRef.current.view.getViewType() !== 'markdown') {
        return;
      }

      const api:ExcalidrawImperativeAPI = view.excalidrawAPI;
      const el = api.getSceneElements().filter(el=>el.id === element.id)[0];

      if(!el || el.angle !== 0) {
        new Notice("Sorry, cannot edit rotated markdown documents");
        return;
      }
      //@ts-ignore
      const modes = leafRef.current.view.modes;
      if (!modes) {
        return;
      }
      leafRef.current.view.setMode(modes['source']);
      app.workspace.setActiveLeaf(leafRef.current);
      isEditingRef.current = true;
      patchMobileView();
    }
  }, [leafRef.current, isActiveRef.current, element]);

  react.useEffect(() => {
    if(!containerRef?.current) {
      return;
    }

    KEYBOARD_EVENT_TYPES.forEach((type) => containerRef.current.addEventListener(type, stopPropagation));
    containerRef.current.addEventListener("click", handleClick);

    return () => {
      if(!containerRef?.current) {
        return;
      }
      KEYBOARD_EVENT_TYPES.forEach((type) => containerRef.current.removeEventListener(type, stopPropagation));
      EXTENDED_EVENT_TYPES.forEach((type) => containerRef.current.removeEventListener(type, stopPropagation));
      containerRef.current.removeEventListener("click", handleClick);
    }; //cleanup on unmount
  }, []);


  react.useEffect(() => {
    if(!containerRef?.current) {
      return;
    }

    if(!leafRef.current?.view || leafRef.current.view.getViewType() !== "markdown") {
      return;
    }

    //@ts-ignore
    const modes = leafRef.current.view.modes;
    if(!modes) {
      return;
    }

    isActiveRef.current = (appState.activeIFrame?.element.id === element.id) && (appState.activeIFrame?.state === "active");
  
    if(!isActiveRef.current) {
      //@ts-ignore
      leafRef.current.view.setMode(modes["preview"]);
      isEditingRef.current = false;
      app.workspace.setActiveLeaf(view.leaf);
      return;
    }  
  }, [appState.activeIFrame?.element, appState.activeIFrame?.state, element.id]);

  return null;
};

export const CustomIFrame: React.FC<{element: NonDeletedExcalidrawElement; radius: number; view: ExcalidrawView; appState: UIAppState; linkText: string}> = ({ element, radius, view, appState, linkText }) => {
  const react = view.plugin.getPackage(view.ownerWindow).react;
  const containerRef: React.RefObject<HTMLDivElement> = react.useRef(null);
  const theme = view.excalidrawData.iFrameTheme === "dark"
    ? "theme-dark"
    : view.excalidrawData.iFrameTheme === "light" 
      ? "theme-light"
      : view.excalidrawData.iFrameTheme === "auto"
        ? appState.theme === "dark" ? "theme-dark" : "theme-light"
        : isObsidianThemeDark() ? "theme-dark" : "theme-light";

  return (
    <div
      ref={containerRef}
      style = {{
        width: `100%`,
        height: `100%`,
        borderRadius: `${radius}px`,
        color: `var(--text-normal)`,
      }}
      className={theme}
    >
      <RenderObsidianView
        element={element}
        linkText={linkText}
        radius={radius}
        view={view}
        containerRef={containerRef}
        appState={appState}/>
      {(appState.activeIFrame?.element === element && appState.activeIFrame?.state === "hover") && (<div
        style={{
          content: "",
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: `100%`,
          height: `100%`,
          background: `radial-gradient(
            ellipse at center,
            rgba(0, 0, 0, 0) 20%,
            rgba(0, 0, 0, 0.6) 80%
          )`,
        }}/>)}
    </div>
  )
}