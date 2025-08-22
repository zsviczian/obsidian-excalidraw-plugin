import {  ExcalidrawEmbeddableElement, NonDeletedExcalidrawElement } from "@zsviczian/excalidraw/types/element/src/types";
import ExcalidrawView from "src/view/ExcalidrawView";
import { Notice, WorkspaceLeaf, WorkspaceSplit } from "obsidian";
import * as React from "react";
import { ConstructableWorkspaceSplit, getContainerForDocument, isObsidianThemeDark } from "src/utils/obsidianUtils";
import { DEVICE, EXTENDED_EVENT_TYPES, KEYBOARD_EVENT_TYPES } from "src/constants/constants";
import { ExcalidrawImperativeAPI, UIAppState } from "@zsviczian/excalidraw/types/excalidraw/types";
import { ObsidianCanvasNode } from "src/view/managers/CanvasNodeFactory";
import { processLinkText, patchMobileView, setFileToLocalGraph } from "src/utils/customEmbeddableUtils";
import { EmbeddableMDCustomProps } from "src/shared/Dialogs/EmbeddableSettings";

const CANVAS_VIEWTYPES = new Set(["markdown", "bases", "audio", "video"]);

declare module "obsidian" {
  interface Workspace {
    floatingSplit: any;
  }

  interface WorkspaceSplit {
    containerEl: HTMLDivElement;
  }
}

function getTheme (view: ExcalidrawView, theme:string): string {
  return view.excalidrawData.embeddableTheme === "dark"
  ? "theme-dark"
  : view.excalidrawData.embeddableTheme === "light" 
    ? "theme-light"
    : view.excalidrawData.embeddableTheme === "auto"
      ? theme === "dark" ? "theme-dark" : "theme-light"
      : isObsidianThemeDark() ? "theme-dark" : "theme-light";
}

//--------------------------------------------------------------------------------
//Render webview for anything other than Vimeo and Youtube
//Vimeo and Youtube are rendered by Excalidraw because of the window messaging
//required to control the video
//--------------------------------------------------------------------------------
export function renderWebView (src: string, view: ExcalidrawView, id: string, _: UIAppState):JSX.Element {
  const isDataURL = src.startsWith("data:");
  if(DEVICE.isDesktop && !isDataURL) {
    return (
      <webview
        ref={(ref) => view.updateEmbeddableRef(id, ref)}
        className="excalidraw__embeddable"
        title="Excalidraw Embedded Content"
        allowFullScreen={true}
        src={src}
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
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      src={isDataURL ? null : src}
      style={{
        overflow: "hidden",
        borderRadius: "var(--embeddable-radius)",
      }}
      srcDoc={isDataURL ? atob(src.split(',')[1]) : null}
    />
  );
}

//--------------------------------------------------------------------------------
//Render WorkspaceLeaf or CanvasNode
//--------------------------------------------------------------------------------
function RenderObsidianView(
  { mdProps, element, linkText, view, containerRef, activeEmbeddable, theme, canvasColor }:{
  mdProps: EmbeddableMDCustomProps;
  element: ExcalidrawEmbeddableElement;
  linkText: string;
  view: ExcalidrawView;
  containerRef: React.RefObject<HTMLDivElement>;
  activeEmbeddable: {element: ExcalidrawEmbeddableElement; state: string};
  theme: string;
  canvasColor: string;
}): JSX.Element {
  
  const { subpath, file } = processLinkText(linkText, view);

  if (!file) {
    return null;
  }
  const React = view.packages.react;
  
  //@ts-ignore
  const leafRef = React.useRef<{leaf: WorkspaceLeaf; node?: ObsidianCanvasNode, editNode?: Function} | null>(null);
  const isEditingRef = React.useRef(false);
  const isActiveRef = React.useRef(false);
  const themeRef = React.useRef(theme);
  const elementRef = React.useRef(element);

  // Update themeRef when theme changes
  React.useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  // Update elementRef when element changes
  React.useEffect(() => {
    elementRef.current = element;
  }, [element]);
 
  //--------------------------------------------------------------------------------
  //block propagation of events to the parent if the iframe element is active
  //--------------------------------------------------------------------------------
  const stopPropagation = React.useCallback((event:React.PointerEvent<HTMLElement>) => {
    if(isActiveRef.current) {
      event.stopPropagation(); // Stop the event from propagating up the DOM tree
    }
  }, [isActiveRef.current]);

  //runs once after mounting of the component and when the component is unmounted
  React.useEffect(() => {
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

  //blocking or not the propagation of events to the parent if the iframe is active
  React.useEffect(() => {
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

  //set local graph to view when deactivating embeddables
  React.useEffect(() => {
    if(file === view.file) {
      return;
    }
    if(!isActiveRef.current) {
      setFileToLocalGraph(view.app, view.file);
    }
  }, [isActiveRef.current]);

  const setKeepOnTop = () => {
    const keepontop = (view.app.workspace.activeLeaf === view.leaf) && DEVICE.isDesktop;
    if (keepontop) {
      //@ts-ignore
      if(!view.ownerWindow.electronWindow.isAlwaysOnTop()) {
        //@ts-ignore
        view.ownerWindow.electronWindow.setAlwaysOnTop(true);
        setTimeout(() => {
          //@ts-ignore
          view.ownerWindow.electronWindow.setAlwaysOnTop(false);
        }, 500);
      }
    }
  }

  //--------------------------------------------------------------------------------
  //Mount the workspace leaf or the canvas node depending on subpath
  //--------------------------------------------------------------------------------
  React.useEffect(() => {
    if(!containerRef?.current) {
      return;
    }

    while(containerRef.current.hasChildNodes()) {
      containerRef.current.removeChild(containerRef.current.lastChild);
    }

    containerRef.current.parentElement.style.padding = "";

    const doc = view.ownerDocument;
    const rootSplit:WorkspaceSplit = new (WorkspaceSplit as ConstructableWorkspaceSplit)(view.app.workspace, "vertical");
    rootSplit.getRoot = () => view.app.workspace[doc === document ? 'rootSplit' : 'floatingSplit'];
    rootSplit.getContainer = () => getContainerForDocument(doc);
    rootSplit.containerEl.style.width = '100%';
    rootSplit.containerEl.style.height = '100%';
    rootSplit.containerEl.style.borderRadius = "var(--embeddable-radius)";
    view.plugin.setDebounceActiveLeafChangeHandler();
    leafRef.current = {
      leaf: view.app.workspace.createLeafInParent(rootSplit, 0),
      node: null,
      editNode: null,
    };

    //if subpath is defined, create a canvas node else create a workspace leaf
    if(subpath && view.canvasNodeFactory.isInitialized()) {
      setKeepOnTop();
      leafRef.current.node = view.canvasNodeFactory.createFileNote(file, subpath, containerRef.current, element.id);
      view.updateEmbeddableLeafRef(element.id, leafRef.current);
    } else {
      (async () => {
        await leafRef.current.leaf.openFile(file, {
          active: false,
          state: {mode:"preview"},
          ...subpath ? { eState: { subpath }}:{},
        });
        const viewType = leafRef.current.leaf.view?.getViewType();
        if(viewType === "canvas") {
          leafRef.current.leaf.view.canvas?.setReadonly(true);
        }
        if (CANVAS_VIEWTYPES.has(viewType) && view.canvasNodeFactory.isInitialized()) {
          setKeepOnTop();
          //I haven't found a better way of deciding if an .md file has its own view (e.g., kanban) or not
          //This runs only when the file is added, thus should not be a major performance issue
          await leafRef.current.leaf.setViewState({state: {file:null}})
          leafRef.current.node = view.canvasNodeFactory.createFileNote(file, subpath, containerRef.current, element.id);
          setColors(containerRef.current, element, mdProps, canvasColor, viewType);
        } else {
          const workspaceLeaf:HTMLDivElement = rootSplit.containerEl.querySelector("div.workspace-leaf");
          if(workspaceLeaf) workspaceLeaf.style.borderRadius = "var(--embeddable-radius)";
          rootSplit.containerEl.addClass("mod-visible");
          containerRef.current.appendChild(rootSplit.containerEl);
          setColors(containerRef.current, element, mdProps, canvasColor, viewType);
        }
        patchMobileView(view);
        view.updateEmbeddableLeafRef(element.id, leafRef.current);
      })();
    }

    return () => {
      if(!leafRef.current) {
        return;
      }
      view.canvasNodeFactory.removeNode(leafRef.current.node);
      leafRef.current.leaf?.detach();
      leafRef.current = null;
    }; //cleanup on unmount
  }, [linkText, subpath, containerRef]);
  
  //--------------------------------------------------------------------------------
  //Set colors of the canvas node
  //--------------------------------------------------------------------------------
  function setColors (canvasNode: HTMLDivElement, element: ExcalidrawEmbeddableElement, mdProps: EmbeddableMDCustomProps, canvasColor: string, viewType: string) {
    if(!mdProps) return;
    if (!leafRef.current?.hasOwnProperty("node")) return;

    const canvasNodeContainer = containerRef.current?.firstElementChild as HTMLElement;
    
    if(mdProps.useObsidianDefaults) {
      canvasNode?.style.removeProperty("--canvas-background");
      canvasNodeContainer?.style.removeProperty("background-color");
      canvasNode?.style.removeProperty("--canvas-border");
      canvasNodeContainer?.style.removeProperty("border-color");
      return;
    }

    const ea = view.plugin.ea;
    if(mdProps.backgroundMatchElement) {
      const opacity = (mdProps?.backgroundOpacity ?? 50)/100;
      const color = element?.backgroundColor 
        ? (element.backgroundColor.toLowerCase() === "transparent"
          ? "transparent"
          : ea.getCM(element.backgroundColor).alphaTo(opacity).stringHEX({alpha: true}))
        : "transparent";
      
      color === "transparent" ? canvasNode?.addClass("transparent") : canvasNode?.removeClass("transparent");        
      canvasNode?.style.setProperty("--canvas-background", color);
      canvasNode?.style.setProperty("--background-primary", color);
      canvasNodeContainer?.style.setProperty("background-color", color);
    } else if (!(mdProps.backgroundMatchElement ?? true )) {
      const opacity = (mdProps.backgroundOpacity??100)/100;
      const color = mdProps.backgroundMatchCanvas
        ? (canvasColor.toLowerCase() === "transparent"
          ? "transparent"
          : ea.getCM(canvasColor).alphaTo(opacity).stringHEX({alpha: true}))
        : ea.getCM(mdProps.backgroundColor).alphaTo((mdProps.backgroundOpacity??100)/100).stringHEX({alpha: true});
      
      color === "transparent" ? canvasNode?.addClass("transparent") : canvasNode?.removeClass("transparent");
      canvasNode?.style.setProperty("--canvas-background", color);
      canvasNode?.style.setProperty("--background-primary", color);
      canvasNodeContainer?.style.setProperty("background-color", color);
    }
    switch (viewType) {
      case "bases": 
        canvasNode?.style.setProperty("--bases-cards-container-background","var(--background-primary)");
        canvasNode?.style.setProperty("--bases-embed-border-color","var(--background-modifier-border)");
        canvasNode?.style.setProperty("--bases-table-header-color","var(--text-muted)");
        canvasNode?.style.setProperty("--bases-table-header-background","var(--background-primary)");
        canvasNode?.style.setProperty("--bases-table-header-background-hover","var(--background-modifier-hover)");
        canvasNode?.style.setProperty("--bases-table-header-sort-mask","linear-gradient(to left, transparent var(--size-4-6), black var(--size-4-6))");
        canvasNode?.style.setProperty("--bases-table-border-color","var(--table-border-color)");
        canvasNode?.style.setProperty("--bases-table-row-background-hover","var(--table-row-background-hover)");
        canvasNode?.style.setProperty("--bases-table-cell-shadow-active","0 0 0 2px var(--interactive-accent)");
        canvasNode?.style.setProperty("--bases-table-cell-background-active","var(--background-primary)");
        canvasNode?.style.setProperty("--bases-table-cell-background-disabled","var(--background-primary-alt)");
        canvasNode?.style.setProperty("--bases-cards-container-background","var(--background-primary)");
        canvasNode?.style.setProperty("--bases-cards-background","var(--background-primary)");
        canvasNode?.style.setProperty("--bases-cards-cover-background","var(--background-primary-alt)");
        canvasNode?.style.setProperty("--bases-cards-shadow","0 0 0 1px var(--background-modifier-border)");
        canvasNode?.style.setProperty("--bases-cards-shadow-hover","0 0 0 1px var(--background-modifier-border-hover)");
        break;
      case "pdf":
        canvasNode?.style.setProperty("--pdf-sidebar-background","var(--background-primary)");
        canvasNode?.style.setProperty("--pdf-background","var(--background-primary)");
        canvasNode?.style.setProperty("--pdf-sidebar-background","var(--background-primary)");
      break;
    }

    if(mdProps.borderMatchElement) {
      const opacity = (mdProps?.borderOpacity ?? 50)/100;
      const color = element?.strokeColor
        ? (element.strokeColor.toLowerCase() === "transparent"
          ? "transparent"
          : ea.getCM(element.strokeColor).alphaTo(opacity).stringHEX({alpha: true}))
        : "transparent";
      canvasNode?.style.setProperty("--canvas-border", color);
      canvasNode?.style.setProperty("--canvas-color", color);
      //canvasNodeContainer?.style.setProperty("border-color", color);
    } else if(!(mdProps?.borderMatchElement ?? true)) {
      const color = ea.getCM(mdProps.borderColor).alphaTo((mdProps.borderOpacity??100)/100).stringHEX({alpha: true});
      canvasNode?.style.setProperty("--canvas-border", color);
      canvasNode?.style.setProperty("--canvas-color", color);
      //canvasNodeContainer?.style.setProperty("border-color", color);
    }
  }

  //--------------------------------------------------------------------------------
  //Set colors of the canvas node
  //--------------------------------------------------------------------------------
  React.useEffect(() => {
    if(!containerRef.current) {
      return;
    }
    const element = elementRef.current;
    const canvasNode = containerRef.current;
    if(!canvasNode.hasClass("canvas-node")) return;
    const viewType = leafRef.current.leaf.view?.getViewType();
    setColors(canvasNode, element, mdProps, canvasColor, viewType);
  }, [
    mdProps?.useObsidianDefaults,
    mdProps?.backgroundMatchCanvas,
    mdProps?.backgroundMatchElement,
    mdProps?.backgroundColor,
    mdProps?.backgroundOpacity,
    mdProps?.borderMatchElement,
    mdProps?.borderColor,
    mdProps?.borderOpacity,
    elementRef.current,
    containerRef.current,
    canvasColor,
    leafRef.current,
  ])

  //--------------------------------------------------------------------------------
  //Switch to preview mode when the iframe is not active
  //--------------------------------------------------------------------------------
  React.useEffect(() => {
    if(isEditingRef.current) {
      if(leafRef.current?.node) {
        containerRef.current?.addClasses(["is-editing", "is-focused"]);
        view.canvasNodeFactory.stopEditing(leafRef.current.node);
      }
      isEditingRef.current = false;
    }
  }, [isEditingRef.current, leafRef]);

  //--------------------------------------------------------------------------------
  //Switch to edit mode when markdown view is clicked
  //--------------------------------------------------------------------------------
  const handleClick = React.useCallback((event?: React.PointerEvent<HTMLElement>) => {
    if(isActiveRef.current) {
      event?.stopPropagation();
    }

    if(isActiveRef.current && leafRef.current?.leaf) {
      setKeepOnTop();
      view.app.workspace.setActiveLeaf(leafRef.current.leaf, { focus: true });
    }

    if (isActiveRef.current && !isEditingRef.current && leafRef.current?.leaf) {
      if(leafRef.current.leaf.view?.getViewType() === "markdown") {
        const api:ExcalidrawImperativeAPI = view.excalidrawAPI;
        const el = api.getSceneElements().filter(el=>el.id === element.id)[0];

        if(!el || el.angle !== 0) {
          new Notice("Sorry, cannot edit rotated markdown documents");
          return;
        }
        //@ts-ignore
        const modes = leafRef.current.leaf.view.modes;
        if (!modes) {
          return;
        }
        leafRef.current.leaf.view.setMode(modes['source']);
        isEditingRef.current = true;
        patchMobileView(view);
      } else if (leafRef.current?.node) {
        //Handle canvas node
        const newTheme = getTheme(view, themeRef.current);
        containerRef.current?.addClasses(["is-editing", "is-focused"]);
        view.canvasNodeFactory.startEditing(leafRef.current.node, newTheme);
      }
    }
  }, [leafRef.current?.leaf, element.id, view, themeRef.current, isActiveRef.current, isEditingRef.current]);

  if(leafRef.current)  leafRef.current.editNode = handleClick;
  // Event listener for key press
  React.useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === "Enter" && !isActiveRef.current) {
        handleClick(event); // Call handleClick function when Enter key is pressed
      }
    };

    document.addEventListener("keydown", handleKeyPress); // Add event listener for key press

    return () => {
      document.removeEventListener("keydown", handleKeyPress); // Remove event listener when component unmounts
    };
  }, [handleClick, isActiveRef.current]);

  //--------------------------------------------------------------------------------
  // Set isActiveRef and switch to preview mode when the iframe is not active
  //--------------------------------------------------------------------------------
  React.useEffect(() => {
    if(!containerRef?.current || !leafRef?.current) {
      return;
    }

    const previousIsActive = isActiveRef.current;
    isActiveRef.current = (activeEmbeddable?.element.id === element.id) && (activeEmbeddable?.state === "active");
    
    const node = leafRef.current?.node as ObsidianCanvasNode;
    if (previousIsActive === isActiveRef.current) {
      return;
    }

    if(leafRef.current?.leaf) {
      setKeepOnTop();
      view.app.workspace.setActiveLeaf(leafRef.current.leaf, { focus: true });
    }

    if(file !== view.file) {
      setFileToLocalGraph(view.app, file);
    }

    if(leafRef.current.leaf?.view?.getViewType() === "markdown") {
      //Handle markdown leaf
      //@ts-ignore
      const modes = leafRef.current.leaf.view.modes;
      if(!modes) {
        return;
      }
    
      if(!isActiveRef.current) {
        //@ts-ignore
        leafRef.current.leaf.view.setMode(modes["preview"]);
        isEditingRef.current = false;
        return;
      }  
    } else if (node) {
      //Handle canvas node
      if(isActiveRef.current && view.plugin.settings.markdownNodeOneClickEditing && !containerRef.current?.hasClass("is-editing")) { //!node.isEditing
        const newTheme = getTheme(view, themeRef.current);
        containerRef.current?.addClasses(["is-editing", "is-focused"]);
        view.canvasNodeFactory.startEditing(node, newTheme);
      } else {
        containerRef.current?.removeClasses(["is-editing", "is-focused"]);
        view.canvasNodeFactory.stopEditing(node);
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
    themeRef.current
  ]);

  return null;
};


export const CustomEmbeddable: React.FC<{element: ExcalidrawEmbeddableElement; view: ExcalidrawView; appState: UIAppState; linkText: string}> = ({ element, view, appState, linkText }) => {
  const React = view.packages.react;
  const containerRef: React.RefObject<HTMLDivElement> = React.useRef(null);
  const theme = getTheme(view, appState.theme);
  const mdProps: EmbeddableMDCustomProps = element.customData?.mdProps || null;
  return (
    <div
      ref={containerRef}
      style = {{
        width: `100%`,
        height: `100%`,
        borderRadius: "var(--embeddable-radius)",
        color: `var(--text-normal)`,
      }}
      className={`${theme} canvas-node ${
        mdProps?.filenameVisible && !mdProps.useObsidianDefaults ? "" : "excalidraw-mdEmbed-hideFilename"}`}
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
      />
    </div>
  )
}