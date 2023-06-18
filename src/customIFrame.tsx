import { NonDeletedExcalidrawElement } from "@zsviczian/excalidraw/types/element/types";
import ExcalidrawView from "./ExcalidrawView";
import { Notice, Workspace, WorkspaceLeaf, WorkspaceSplit } from "obsidian";
import * as React from "react";
import { isObsidianThemeDark } from "./utils/ObsidianUtils";
import { REGEX_LINK, REG_LINKINDEX_HYPERLINK } from "./ExcalidrawData";
import { getLinkParts } from "./utils/Utils";
import { DEVICE, REG_LINKINDEX_INVALIDCHARS } from "./Constants";
import { UIAppState } from "@zsviczian/excalidraw/types/types";

declare module "obsidian" {
  interface Workspace {
    floatingSplit: any;
  }

  interface WorkspaceSplit {
    containerEl: HTMLDivElement;
  }
}

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
    //leafMap.set(element.id, leaf);
    const workspaceLeaf:HTMLDivElement = rootSplit.containerEl.querySelector("div.workspace-leaf");
    if(workspaceLeaf) workspaceLeaf.style.borderRadius = `${radius}px`;
    leafRef.current.openFile(file, subpath ? { eState: { subpath }, state: {mode:"preview"} } : undefined);

    return () => {}; //cleanup on unmount
  }, [linkText, subpath]);
  
  const handleClick = react.useCallback(() => {
    if (isActiveRef.current && !isEditingRef.current) {
      if (!leafRef.current?.view || leafRef.current.view.getViewType() !== 'markdown') {
        return;
      }
      if(element.angle !== 0) {
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
    }
  }, [leafRef.current, element]);

  react.useEffect(() => {
    if(!containerRef?.current) {
      return;
    }

    const stopPropagation = (event:KeyboardEvent) => {
      event.stopPropagation(); // Stop the event from propagating up the DOM tree
    }

    containerRef.current.addEventListener("keydown", stopPropagation);
    containerRef.current.addEventListener("keyup", stopPropagation);
    containerRef.current.addEventListener("keypress", stopPropagation);
    containerRef.current.addEventListener("click", handleClick);

    return () => {
      if(!containerRef?.current) {
        return;
      }
      containerRef.current.removeEventListener("keydown", stopPropagation);
      containerRef.current.removeEventListener("keyup", stopPropagation);
      containerRef.current.removeEventListener("keypress", stopPropagation);
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

    isActiveRef.current = appState.activeIFrameElement === element;
  
    if(!isActiveRef.current) {
      //@ts-ignore
      leafRef.current.view.setMode(modes["preview"]);
      isEditingRef.current = false;
      app.workspace.setActiveLeaf(view.leaf);
      return;
    }  
  }, [appState.activeIFrameElement, element]);

  return null;
};

export const CustomIFrame: React.FC<{element: NonDeletedExcalidrawElement; radius: number; view: ExcalidrawView; appState: UIAppState; linkText: string}> = ({ element, radius, view, appState, linkText }) => {
  const react = view.plugin.getPackage(view.ownerWindow).react;
  const containerRef: React.RefObject<HTMLDivElement> = react.useRef(null);
  return (
    <div
      ref={containerRef}
      style = {{
        width: `100%`,
        height: `100%`,
        borderRadius: `${radius}px`,
        color: `var(--text-normal)`,
      }}
      className={isObsidianThemeDark() ? "theme-dark" : "theme-light"}
    >
      <RenderObsidianView
        element={element}
        linkText={linkText}
        radius={radius}
        view={view}
        containerRef={containerRef}
        appState={appState}/>
    </div>
  )
}