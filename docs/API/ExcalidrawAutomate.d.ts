/// <reference types="react" />
import ExcalidrawPlugin from "src/main";
import { FillStyle, StrokeStyle, ExcalidrawElement, ExcalidrawBindableElement, FileId, NonDeletedExcalidrawElement, ExcalidrawImageElement, StrokeRoundness, RoundnessType } from "@zsviczian/excalidraw/types/excalidraw/element/types";
import { Editor, OpenViewState, TFile, WorkspaceLeaf } from "obsidian";
import * as obsidian_module from "obsidian";
import ExcalidrawView, { ExportSettings } from "src/ExcalidrawView";
import { AppState, BinaryFileData, DataURL, ExcalidrawImperativeAPI, Point } from "@zsviczian/excalidraw/types/excalidraw/types";
import { EmbeddedFilesLoader } from "src/EmbeddedFileLoader";
import { ConnectionPoint, DeviceType } from "src/types";
import { ColorMaster } from "colormaster";
import { TInput } from "colormaster/types";
import { ClipboardData } from "@zsviczian/excalidraw/types/excalidraw/clipboard";
import { PaneTarget } from "src/utils/ModifierkeyHelper";
export declare class ExcalidrawAutomate {
    /**
     * Utility function that returns the Obsidian Module object.
     */
    get obsidian(): typeof obsidian_module;
    get DEVICE(): DeviceType;
    getAttachmentFilepath(filename: string): Promise<string>;
    /**
     * Prompts the user with a dialog to select new file action.
     * - create markdown file
     * - create excalidraw file
     * - cancel action
     * The new file will be relative to this.targetView.file.path, unless parentFile is provided.
     * If shouldOpenNewFile is true, the new file will be opened in a workspace leaf.
     * targetPane control which leaf will be used for the new file.
     * Returns the TFile for the new file or null if the user cancelled the action.
     * @param newFileNameOrPath
     * @param shouldOpenNewFile
     * @param targetPane //type PaneTarget = "active-pane"|"new-pane"|"popout-window"|"new-tab"|"md-properties";
     * @param parentFile
     * @returns
     */
    newFilePrompt(newFileNameOrPath: string, shouldOpenNewFile: boolean, targetPane?: PaneTarget, parentFile?: TFile): Promise<TFile | null>;
    /**
     * Generates a new Obsidian Leaf following Excalidraw plugin settings such as open in Main Workspace or not, open in adjacent pane if available, etc.
     * @param origo // the currently active leaf, the origin of the new leaf
     * @param targetPane //type PaneTarget = "active-pane"|"new-pane"|"popout-window"|"new-tab"|"md-properties";
     * @returns
     */
    getLeaf(origo: WorkspaceLeaf, targetPane?: PaneTarget): WorkspaceLeaf;
    /**
     * Returns the editor or leaf.view of the currently active embedded obsidian file.
     * If view is not provided, ea.targetView is used.
     * If the embedded file is a markdown document the function will return
     * {file:TFile, editor:Editor} otherwise it will return {view:any}. You can check view type with view.getViewType();
     * @param view
     * @returns
     */
    getActiveEmbeddableViewOrEditor(view?: ExcalidrawView): {
        view: any;
    } | {
        file: TFile;
        editor: Editor;
    } | null;
    plugin: ExcalidrawPlugin;
    elementsDict: {
        [key: string]: any;
    };
    imagesDict: {
        [key: FileId]: any;
    };
    mostRecentMarkdownSVG: SVGSVGElement;
    style: {
        strokeColor: string;
        backgroundColor: string;
        angle: number;
        fillStyle: FillStyle;
        strokeWidth: number;
        strokeStyle: StrokeStyle;
        roughness: number;
        opacity: number;
        strokeSharpness?: StrokeRoundness;
        roundness: null | {
            type: RoundnessType;
            value?: number;
        };
        fontFamily: number;
        fontSize: number;
        textAlign: string;
        verticalAlign: string;
        startArrowHead: string;
        endArrowHead: string;
    };
    canvas: {
        theme: string;
        viewBackgroundColor: string;
        gridSize: number;
    };
    colorPalette: {};
    constructor(plugin: ExcalidrawPlugin, view?: ExcalidrawView);
    /**
     *
     * @returns the last recorded pointer position on the Excalidraw canvas
     */
    getViewLastPointerPosition(): {
        x: number;
        y: number;
    };
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
     * @param file: TFile
     * @returns ExcalidrawScene
     */
    getSceneFromFile(file: TFile): Promise<{
        elements: ExcalidrawElement[];
        appState: AppState;
    }>;
    /**
     * get all elements from ExcalidrawAutomate elementsDict
     * @returns elements from elementsDict
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
            "excalidraw-export-padding"?: number;
            "excalidraw-export-pngscale"?: number;
            "excalidraw-default-mode"?: "view" | "zen";
            "excalidraw-onload-script"?: string;
            "excalidraw-linkbutton-opacity"?: number;
            "excalidraw-autoexport"?: boolean;
        };
        plaintext?: string;
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
    addIFrame(topX: number, topY: number, width: number, height: number, url?: string, file?: TFile): string;
    /**
   *
   * @param topX
   * @param topY
   * @param width
   * @param height
   * @returns
   */
    addEmbeddable(topX: number, topY: number, width: number, height: number, url?: string, file?: TFile): string;
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
     * Refresh the size of a text element to fit its contents
     * @param id - the id of the text element
     */
    refreshTextElementSize(id: string): void;
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
        textAlign?: "left" | "center" | "right";
        box?: boolean | "box" | "blob" | "ellipse" | "diamond";
        boxPadding?: number;
        boxStrokeColor?: string;
        textVerticalAlign?: "top" | "middle" | "bottom";
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
    addImage(topX: number, topY: number, imageFile: TFile | string, scale?: boolean, //default is true which will scale the image to MAX_IMAGE_SIZE, false will insert image at 100% of its size
    anchor?: boolean): Promise<string>;
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
    targetView: ExcalidrawView;
    /**
     * sets the target view for EA. All the view operations and the access to Excalidraw API will be performend on this view
     * if view is null or undefined, the function will first try setView("active"), then setView("first").
     * @param view
     * @returns targetView
     */
    setView(view?: ExcalidrawView | "first" | "active"): ExcalidrawView;
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
    setViewModeEnabled(enabled: boolean): void;
    /**
     * This function gives you a more hands on access to Excalidraw.
     * @param scene - The scene you want to load to Excalidraw
     * @param restore - Use this if the scene includes legacy excalidraw file elements that need to be converted to the latest excalidraw data format (not a typical usecase)
     * @returns
     */
    viewUpdateScene(scene: {
        elements?: ExcalidrawElement[];
        appState?: AppState;
        files?: BinaryFileData;
        commitToHistory?: boolean;
    }, restore?: boolean): void;
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
     * zoom tarteView to fit elements provided as input
     * elements === [] will zoom to fit the entire scene
     * selectElements toggles whether the elements should be in a selected state at the end of the operation
     * @param selectElements
     * @param elements
     */
    viewZoomToElements(selectElements: boolean, elements: ExcalidrawElement[]): void;
    /**
     * Adds elements from elementsDict to the current view
     * @param repositionToCursor default is false
     * @param save default is true
     * @param newElementsOnTop controls whether elements created with ExcalidrawAutomate
     *   are added at the bottom of the stack or the top of the stack of elements already in the view
     *   Note that elements copied to the view with copyViewElementsToEAforEditing retain their
     *   position in the stack of elements in the view even if modified using EA
     *   default is false, i.e. the new elements get to the bottom of the stack
     * @param shouldRestoreElements - restore elements - auto-corrects broken, incomplete or old elements included in the update
     * @returns
     */
    addElementsToView(repositionToCursor?: boolean, save?: boolean, newElementsOnTop?: boolean, shouldRestoreElements?: boolean): Promise<boolean>;
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
    * In case you want to prevent the excalidraw onLinkHover action you must return false, it will stop the native excalidraw onLinkHover management flow.
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
     * If set, this callback is triggered, when Excalidraw receives an onPaste event.
     * You can use this callback in case you want to do something additional when the
     * onPaste event occurs.
     * This callback must return a boolean value.
     * In case you want to prevent the excalidraw onPaste action you must return false,
     * it will stop the native excalidraw onPaste management flow.
     */
    onPasteHook: (data: {
        ea: ExcalidrawAutomate;
        payload: ClipboardData;
        event: ClipboardEvent;
        excalidrawFile: TFile;
        view: ExcalidrawView;
        pointerPosition: {
            x: number;
            y: number;
        };
    }) => boolean;
    /**
     * if set, this callback is triggered, when an Excalidraw file is opened
     * You can use this callback in case you want to do something additional when the file is opened.
     * This will run before the file level script defined in the `excalidraw-onload-script` frontmatter.
     */
    onFileOpenHook: (data: {
        ea: ExcalidrawAutomate;
        excalidrawFile: TFile;
        view: ExcalidrawView;
    }) => Promise<void>;
    /**
     * if set, this callback is triggered, when an Excalidraw file is created
     * see also: https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1124
     */
    onFileCreateHook: (data: {
        ea: ExcalidrawAutomate;
        excalidrawFile: TFile;
        view: ExcalidrawView;
    }) => Promise<void>;
    /**
     * If set, this callback is triggered whenever the active canvas color changes
     */
    onCanvasColorChangeHook: (ea: ExcalidrawAutomate, view: ExcalidrawView, //the excalidraw view 
    color: string) => void;
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
     * @param element
     * @param a
     * @param b
     * @param gap
     * @returns 2 or 0 intersection points between line going through `a` and `b`
     *   and the `element`, in ascending order of distance from `a`.
     */
    intersectElementWithLine(element: ExcalidrawBindableElement, a: readonly [number, number], b: readonly [number, number], gap?: number): Point[];
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
     * Gets all the elements from elements[] that are contained in the frame.
     * @param element
     * @param elements - typically all the non-deleted elements in the scene
     * @returns
     */
    getElementsInFrame(frameElement: ExcalidrawElement, elements: ExcalidrawElement[]): ExcalidrawElement[];
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
     * @param openState - if not provided {active: true} will be used
     * @returns
     */
    openFileInNewOrAdjacentLeaf(file: TFile, openState?: OpenViewState): WorkspaceLeaf;
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
     * Returns the size of the image element at 100% (i.e. the original size)
     * @param imageElement an image element from the active scene on targetView
     */
    getOriginalImageSize(imageElement: ExcalidrawImageElement): Promise<{
        width: number;
        height: number;
    }>;
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
    selectElementsInView(elements: ExcalidrawElement[] | string[]): void;
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
     * Deprecated. Use getCM / ColorMaster instead
     * @param color
     * @returns
     */
    hexStringToRgb(color: string): number[];
    /**
     * Deprecated. Use getCM / ColorMaster instead
     * @param color
     * @returns
     */
    rgbToHexString(color: number[]): string;
    /**
     * Deprecated. Use getCM / ColorMaster instead
     * @param color
     * @returns
     */
    hslToRgb(color: number[]): number[];
    /**
     * Deprecated. Use getCM / ColorMaster instead
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
    /**
     * https://github.com/lbragile/ColorMaster
     * @param color
     * @returns
     */
    getCM(color: TInput): ColorMaster;
    importSVG(svgString: string): boolean;
}
export declare function initExcalidrawAutomate(plugin: ExcalidrawPlugin): Promise<ExcalidrawAutomate>;
export declare function destroyExcalidrawAutomate(): void;
export declare function _measureText(newText: string, fontSize: number, fontFamily: number, lineHeight: number): {
    w: number;
    h: number;
    baseline: number;
};
export declare const generatePlaceholderDataURL: (width: number, height: number) => DataURL;
export declare function createPNG(templatePath: string, scale: number, exportSettings: ExportSettings, loader: EmbeddedFilesLoader, forceTheme: string, canvasTheme: string, canvasBackgroundColor: string, automateElements: ExcalidrawElement[], plugin: ExcalidrawPlugin, depth: number, padding?: number, imagesDict?: any): Promise<Blob>;
export declare function createSVG(templatePath: string, embedFont: boolean, exportSettings: ExportSettings, loader: EmbeddedFilesLoader, forceTheme: string, canvasTheme: string, canvasBackgroundColor: string, automateElements: ExcalidrawElement[], plugin: ExcalidrawPlugin, depth: number, padding?: number, imagesDict?: any, convertMarkdownLinksToObsidianURLs?: boolean): Promise<SVGSVGElement>;
export declare function estimateBounds(elements: ExcalidrawElement[]): [number, number, number, number];
export declare function repositionElementsToCursor(elements: ExcalidrawElement[], newPosition: {
    x: number;
    y: number;
}, center: boolean, api: ExcalidrawImperativeAPI): ExcalidrawElement[];
export declare const insertLaTeXToView: (view: ExcalidrawView) => void;
export declare const search: (view: ExcalidrawView) => Promise<void>;
/**
 *
 * @param elements
 * @param query
 * @param exactMatch - when searching for section header exactMatch should be set to true
 * @returns the elements matching the query
 */
export declare const getTextElementsMatchingQuery: (elements: ExcalidrawElement[], query: string[], exactMatch?: boolean) => ExcalidrawElement[];
/**
 *
 * @param elements
 * @param query
 * @param exactMatch - when searching for section header exactMatch should be set to true
 * @returns the elements matching the query
 */
export declare const getFrameElementsMatchingQuery: (elements: ExcalidrawElement[], query: string[], exactMatch?: boolean) => ExcalidrawElement[];
export declare const cloneElement: (el: ExcalidrawElement) => any;
export declare const verifyMinimumPluginVersion: (requiredVersion: string) => boolean;
