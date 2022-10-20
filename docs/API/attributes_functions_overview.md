# [◀ Excalidraw Automate How To](../readme.md)
## Attributes and functions overview
Here's the interface implemented by ExcalidrawAutomate:

```typescript
export declare class ExcalidrawAutomate implements ExcalidrawAutomateInterface {
  plugin: ExcalidrawPlugin;
  targetView: ExcalidrawView = null; //the view currently edited
  elementsDict: {[key:string]:any}; //contains the ExcalidrawElements currently edited in Automate indexed by el.id
  imagesDict: {[key: FileId]: any}; //the images files including DataURL, indexed by fileId
  mostRecentMarkdownSVG:SVGSVGElement = null; //Markdown renderer will drop a copy of the most recent SVG here for debugging purposes
  style: {
    strokeColor: string; //https://www.w3schools.com/colors/default.asp
    backgroundColor: string;
    angle: number; //radian
    fillStyle: FillStyle; //type FillStyle = "hachure" | "cross-hatch" | "solid"
    strokeWidth: number;
    strokeStyle: StrokeStyle; //type StrokeStyle = "solid" | "dashed" | "dotted"
    roughness: number;
    opacity: number;
    strokeSharpness: StrokeSharpness; //type StrokeSharpness = "round" | "sharp"
    fontFamily: number; //1: Virgil, 2:Helvetica, 3:Cascadia, 4:LocalFont
    fontSize: number;
    textAlign: string; //"left"|"right"|"center"
    verticalAlign: string; //"top"|"bottom"|"middle" :for future use, has no effect currently
    startArrowHead: string; //"triangle"|"dot"|"arrow"|"bar"|null
    endArrowHead: string;
  };
  canvas: {
    theme: string; //"dark"|"light"
    viewBackgroundColor: string;
    gridSize: number;
  };
    constructor(plugin: ExcalidrawPlugin, view?: ExcalidrawView);
    /**
     *
     * @returns
     */
    getAPI(view?: ExcalidrawView): ExcalidrawAutomate;
    /**
     * @param val //0:"hachure", 1:"cross-hatch" 2:"solid"
     * @returns
     */
    setFillStyle(val: number): "hachure" | "cross-hatch" | "solid";
    /**
     * @param val //0:"solid", 1:"dashed", 2:"dotted"
     * @returns
     */
    setStrokeStyle(val: number): "solid" | "dashed" | "dotted";
    /**
     * @param val //0:"round", 1:"sharp"
     * @returns
     */
    setStrokeSharpness(val: number): "round" | "sharp";
    /**
     * @param val //1: Virgil, 2:Helvetica, 3:Cascadia
     * @returns
     */
    setFontFamily(val: number): "Virgil, Segoe UI Emoji" | "Helvetica, Segoe UI Emoji" | "Cascadia, Segoe UI Emoji" | "LocalFont";
    /**
     * @param val //0:"light", 1:"dark"
     * @returns
     */
    setTheme(val: number): "light" | "dark";
    /**
     * @param objectIds
     * @returns
     */
    addToGroup(objectIds: string[]): string;
    /**
     * @param templatePath
     */
    toClipboard(templatePath?: string): Promise<void>;
    /**
     * get all elements from ExcalidrawAutomate elementsDict
     * @returns elements from elemenetsDict
     */
    getElements(): ExcalidrawElement[];
    /**
     * get single element from ExcalidrawAutomate elementsDict
     * @param id
     * @returns
     */
    getElement(id: string): ExcalidrawElement;
    /**
     * create a drawing and save it to filename
     * @param params
     *   filename: if null, default filename as defined in Excalidraw settings
     *   foldername: if null, default folder as defined in Excalidraw settings
     * @returns
     */
    create(params?: {
        filename?: string;
        foldername?: string;
        templatePath?: string;
        onNewPane?: boolean;
        frontmatterKeys?: {
            "excalidraw-plugin"?: "raw" | "parsed";
            "excalidraw-link-prefix"?: string;
            "excalidraw-link-brackets"?: boolean;
            "excalidraw-url-prefix"?: string;
            "excalidraw-export-transparent"?: boolean;
            "excalidraw-export-dark"?: boolean;
            "excalidraw-export-svgpadding"?: number;
            "excalidraw-export-pngscale"?: number;
            "excalidraw-default-mode"?: "view" | "zen";
        };
    }): Promise<string>;
    /**
     *
     * @param templatePath
     * @param embedFont
     * @param exportSettings use ExcalidrawAutomate.getExportSettings(boolean,boolean)
     * @param loader use ExcalidrawAutomate.getEmbeddedFilesLoader(boolean?)
     * @param theme
     * @returns
     */
    createSVG(templatePath?: string, embedFont?: boolean, exportSettings?: ExportSettings, loader?: EmbeddedFilesLoader, theme?: string, padding?: number): Promise<SVGSVGElement>;
    /**
     *
     * @param templatePath
     * @param scale
     * @param exportSettings use ExcalidrawAutomate.getExportSettings(boolean,boolean)
     * @param loader use ExcalidrawAutomate.getEmbeddedFilesLoader(boolean?)
     * @param theme
     * @returns
     */
    createPNG(templatePath?: string, scale?: number, exportSettings?: ExportSettings, loader?: EmbeddedFilesLoader, theme?: string, padding?: number): Promise<any>;
    /**
     *
     * @param text
     * @param lineLen
     * @returns
     */
    wrapText(text: string, lineLen: number): string;
    private boxedElement;
    /**
     *
     * @param topX
     * @param topY
     * @param width
     * @param height
     * @returns
     */
    addRect(topX: number, topY: number, width: number, height: number): string;
    /**
     *
     * @param topX
     * @param topY
     * @param width
     * @param height
     * @returns
     */
    addDiamond(topX: number, topY: number, width: number, height: number): string;
    /**
     *
     * @param topX
     * @param topY
     * @param width
     * @param height
     * @returns
     */
    addEllipse(topX: number, topY: number, width: number, height: number): string;
    /**
     *
     * @param topX
     * @param topY
     * @param width
     * @param height
     * @returns
     */
    addBlob(topX: number, topY: number, width: number, height: number): string;
    /**
     *
     * @param topX
     * @param topY
     * @param text
     * @param formatting
     *   box: if !null, text will be boxed
     * @param id
     * @returns
     */
    addText(topX: number, topY: number, text: string, formatting?: {
        wrapAt?: number;
        width?: number;
        height?: number;
        textAlign?: string;
        box?: boolean | "box" | "blob" | "ellipse" | "diamond";
        boxPadding?: number;
    }, id?: string): string;
    /**
     *
     * @param points
     * @returns
     */
    addLine(points: [[x: number, y: number]]): string;
    /**
     *
     * @param points
     * @param formatting
     * @returns
     */
    addArrow(points: [x: number, y: number][], formatting?: {
        startArrowHead?: string;
        endArrowHead?: string;
        startObjectId?: string;
        endObjectId?: string;
    }): string;
    /**
     *
     * @param topX
     * @param topY
     * @param imageFile
     * @returns
     */
    addImage(topX: number, topY: number, imageFile: TFile): Promise<string>;
    /**
     *
     * @param topX
     * @param topY
     * @param tex
     * @returns
     */
    addLaTex(topX: number, topY: number, tex: string): Promise<string>;
    /**
     *
     * @param objectA
     * @param connectionA type ConnectionPoint = "top" | "bottom" | "left" | "right" | null
     * @param objectB
     * @param connectionB when passed null, Excalidraw will automatically decide
     * @param formatting
     *   numberOfPoints: points on the line. Default is 0 ie. line will only have a start and end point
     *   startArrowHead: "triangle"|"dot"|"arrow"|"bar"|null
     *   endArrowHead: "triangle"|"dot"|"arrow"|"bar"|null
     *   padding:
     * @returns
     */
    connectObjects(objectA: string, connectionA: ConnectionPoint | null, objectB: string, connectionB: ConnectionPoint | null, formatting?: {
        numberOfPoints?: number;
        startArrowHead?: "triangle" | "dot" | "arrow" | "bar" | null;
        endArrowHead?: "triangle" | "dot" | "arrow" | "bar" | null;
        padding?: number;
    }): string;
    /**
     * Adds a text label to a line or arrow. Currently only works with a straight (2 point - start & end - line)
     * @param lineId id of the line or arrow object in elementsDict
     * @param label the label text
     * @returns undefined (if unsuccessful) or the id of the new text element
     */
    addLabelToLine(lineId: string, label: string): string;
    /**
     * clear elementsDict and imagesDict only
     */
    clear(): void;
    /**
     * clear() + reset all style values to default
     */
    reset(): void;
    /**
     * returns true if MD file is an Excalidraw file
     * @param f
     * @returns
     */
    isExcalidrawFile(f: TFile): boolean;
    /**
     *
     * @param view
     * @returns
     */
    setView(view: ExcalidrawView | "first" | "active"): ExcalidrawView;
    /**
     *
     * @returns https://github.com/excalidraw/excalidraw/tree/master/src/packages/excalidraw#ref
     */
    getExcalidrawAPI(): any;
    /**
     * get elements in View
     * @returns
     */
    getViewElements(): ExcalidrawElement[];
    /**
     *
     * @param elToDelete
     * @returns
     */
    deleteViewElements(elToDelete: ExcalidrawElement[]): boolean;
    /**
     * get the selected element in the view, if more are selected, get the first
     * @returns
     */
    getViewSelectedElement(): any;
    /**
     *
     * @returns
     */
    getViewSelectedElements(): any[];
    /**
     *
     * @param el
     * @returns TFile file handle for the image element
     */
    getViewFileForImageElement(el: ExcalidrawElement): TFile | null;
    /**
     * copies elements from view to elementsDict for editing
     * @param elements
     */
    copyViewElementsToEAforEditing(elements: ExcalidrawElement[]): void;
    /**
     *
     * @param forceViewMode
     * @returns
     */
    viewToggleFullScreen(forceViewMode?: boolean): void;
    /**
     * connect an object to the selected element in the view
     * @param objectA ID of the element
     * @param connectionA
     * @param connectionB
     * @param formatting
     * @returns
     */
    connectObjectWithViewSelectedElement(objectA: string, connectionA: ConnectionPoint | null, connectionB: ConnectionPoint | null, formatting?: {
        numberOfPoints?: number;
        startArrowHead?: "triangle" | "dot" | "arrow" | "bar" | null;
        endArrowHead?: "triangle" | "dot" | "arrow" | "bar" | null;
        padding?: number;
    }): boolean;
    /**
     * Adds elements from elementsDict to the current view
     * @param repositionToCursor default is false
     * @param save default is true
     * @param newElementsOnTop controls whether elements created with ExcalidrawAutomate
     *   are added at the bottom of the stack or the top of the stack of elements already in the view
     *   Note that elements copied to the view with copyViewElementsToEAforEditing retain their
     *   position in the stack of elements in the view even if modified using EA
     *   default is false, i.e. the new elements get to the bottom of the stack
     * @returns
     */
    addElementsToView(repositionToCursor?: boolean, save?: boolean, newElementsOnTop?: boolean): Promise<boolean>;
    /**
     * Register instance of EA to use for hooks with TargetView
     * By default ExcalidrawViews will check window.ExcalidrawAutomate for event hooks.
     * Using this event you can set a different instance of Excalidraw Automate for hooks
     * @returns true if successful
     */
    registerThisAsViewEA(): boolean;
    /**
     * Sets the targetView EA to window.ExcalidrawAutomate
     * @returns true if successful
     */
    deregisterThisAsViewEA(): boolean;
    /**
     * If set, this callback is triggered when the user closes an Excalidraw view.
     */
    onViewUnloadHook: (view: ExcalidrawView) => void;
    /**
     * If set, this callback is triggered, when the user changes the view mode.
     * You can use this callback in case you want to do something additional when the user switches to view mode and back.
     */
    onViewModeChangeHook: (isViewModeEnabled: boolean, view: ExcalidrawView, ea: ExcalidrawAutomate) => void;
    /**
    * If set, this callback is triggered, when the user hovers a link in the scene.
    * You can use this callback in case you want to do something additional when the onLinkHover event occurs.
    * This callback must return a boolean value.
    * In case you want to prevent the excalidraw onLinkHover action you must return true, it will stop the native excalidraw onLinkHover management flow.
    */
    onLinkHoverHook: (element: NonDeletedExcalidrawElement, linkText: string, view: ExcalidrawView, ea: ExcalidrawAutomate) => boolean;
    /**
    * If set, this callback is triggered, when the user clicks a link in the scene.
    * You can use this callback in case you want to do something additional when the onLinkClick event occurs.
    * This callback must return a boolean value.
    * In case you want to prevent the excalidraw onLinkClick action you must return false, it will stop the native excalidraw onLinkClick management flow.
    */
    onLinkClickHook: (element: ExcalidrawElement, linkText: string, event: MouseEvent, view: ExcalidrawView, ea: ExcalidrawAutomate) => boolean;
    /**
     * If set, this callback is triggered, when Excalidraw receives an onDrop event.
     * You can use this callback in case you want to do something additional when the onDrop event occurs.
     * This callback must return a boolean value.
     * In case you want to prevent the excalidraw onDrop action you must return false, it will stop the native excalidraw onDrop management flow.
     */
    onDropHook: (data: {
        ea: ExcalidrawAutomate;
        event: React.DragEvent<HTMLDivElement>;
        draggable: any;
        type: "file" | "text" | "unknown";
        payload: {
            files: TFile[];
            text: string;
        };
        excalidrawFile: TFile;
        view: ExcalidrawView;
        pointerPosition: {
            x: number;
            y: number;
        };
    }) => boolean;
    /**
     * utility function to generate EmbeddedFilesLoader object
     * @param isDark
     * @returns
     */
    getEmbeddedFilesLoader(isDark?: boolean): EmbeddedFilesLoader;
    /**
     * utility function to generate ExportSettings object
     * @param withBackground
     * @param withTheme
     * @returns
     */
    getExportSettings(withBackground: boolean, withTheme: boolean): ExportSettings;
    /**
     * get bounding box of elements
     * bounding box is the box encapsulating all of the elements completely
     * @param elements
     * @returns
     */
    getBoundingBox(elements: ExcalidrawElement[]): {
        topX: number;
        topY: number;
        width: number;
        height: number;
    };
    /**
     * elements grouped by the highest level groups
     * @param elements
     * @returns
     */
    getMaximumGroups(elements: ExcalidrawElement[]): ExcalidrawElement[][];
    /**
     * gets the largest element from a group. useful when a text element is grouped with a box, and you want to connect an arrow to the box
     * @param elements
     * @returns
     */
    getLargestElement(elements: ExcalidrawElement[]): ExcalidrawElement;
    /**
     * Gets the groupId for the group that contains all the elements, or null if such a group does not exist
     * @param elements
     * @returns null or the groupId
     */
    getCommonGroupForElements(elements: ExcalidrawElement[]): string;
    /**
     * Gets all the elements from elements[] that share one or more groupIds with element.
     * @param element
     * @param elements - typically all the non-deleted elements in the scene
     * @returns
     */
    getElementsInTheSameGroupWithElement(element: ExcalidrawElement, elements: ExcalidrawElement[]): ExcalidrawElement[];
    /**
     * @param element
     * @param a
     * @param b
     * @param gap
     * @returns 2 or 0 intersection points between line going through `a` and `b`
     *   and the `element`, in ascending order of distance from `a`.
     */
    intersectElementWithLine(element: ExcalidrawBindableElement, a: readonly [number, number], b: readonly [number, number], gap?: number): Point[];
    /**
     * See OCR plugin for example on how to use scriptSettings
     * Set by the ScriptEngine
     */
    activeScript: string;
    /**
     *
     * @returns script settings. Saves settings in plugin settings, under the activeScript key
     */
    getScriptSettings(): {};
    /**
     * sets script settings.
     * @param settings
     * @returns
     */
    setScriptSettings(settings: any): Promise<void>;
    /**
     * Open a file in a new workspaceleaf or reuse an existing adjacent leaf depending on Excalidraw Plugin Settings
     * @param file
     * @returns
     */
    openFileInNewOrAdjacentLeaf(file: TFile): WorkspaceLeaf;
    /**
     * measure text size based on current style settings
     * @param text
     * @returns
     */
    measureText(text: string): {
        width: number;
        height: number;
    };
    /**
     * verifyMinimumPluginVersion returns true if plugin version is >= than required
     * recommended use:
     * if(!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("1.5.20")) {new Notice("message");return;}
     * @param requiredVersion
     * @returns
     */
    verifyMinimumPluginVersion(requiredVersion: string): boolean;
    /**
     * Check if view is instance of ExcalidrawView
     * @param view
     * @returns
     */
    isExcalidrawView(view: any): boolean;
    /**
     * sets selection in view
     * @param elements
     * @returns
     */
    selectElementsInView(elements: ExcalidrawElement[]): void;
    /**
     * @returns an 8 character long random id
     */
    generateElementId(): string;
    /**
     * @param element
     * @returns a clone of the element with a new id
     */
    cloneElement(element: ExcalidrawElement): ExcalidrawElement;
    /**
     * Moves the element to a specific position in the z-index
     */
    moveViewElementToZIndex(elementId: number, newZIndex: number): void;
    /**
     *
     * @param color
     * @returns
     */
    hexStringToRgb(color: string): number[];
    /**
     *
     * @param color
     * @returns
     */
    rgbToHexString(color: number[]): string;
    /**
     *
     * @param color
     * @returns
     */
    hslToRgb(color: number[]): number[];
    /**
     *
     * @param color
     * @returns
     */
    rgbToHsl(color: number[]): number[];
    /**
     *
     * @param color
     * @returns
     */
    colorNameToHex(color: string): string;
}```

