import ExcalidrawPlugin from "src/core/main";
import { FillStyle, StrokeStyle, ExcalidrawElement, ExcalidrawBindableElement, FileId, NonDeletedExcalidrawElement, ExcalidrawImageElement, StrokeRoundness, RoundnessType } from "@zsviczian/excalidraw/types/excalidraw/element/types";
import { ColorMap, MimeType } from "./EmbeddedFileLoader";
import { Editor, OpenViewState, RequestUrlResponse, TFile, TFolder, WorkspaceLeaf } from "obsidian";
import * as obsidian_module from "obsidian";
import ExcalidrawView, { ExportSettings } from "src/view/ExcalidrawView";
import { AppState, BinaryFileData, DataURL } from "@zsviczian/excalidraw/types/excalidraw/types";
import { EmbeddedFilesLoader } from "./EmbeddedFileLoader";
import { ConnectionPoint, DeviceType, Point } from "src/types/types";
import { ColorMaster } from "@zsviczian/colormaster";
import { TInput } from "@zsviczian/colormaster/types";
import { ClipboardData } from "@zsviczian/excalidraw/types/excalidraw/clipboard";
import { PaneTarget } from "src/utils/modifierkeyHelper";
import { Mutable } from "@zsviczian/excalidraw/types/excalidraw/utility-types";
import { EmbeddableMDCustomProps } from "./Dialogs/EmbeddableSettings";
import { AIRequest } from "../utils/AIUtils";
import { AddImageOptions, ImageInfo, SVGColorInfo } from "src/types/excalidrawAutomateTypes";
/**
 * ExcalidrawAutomate is a utility class that provides a simplified API to interact with Excalidraw elements and the Excalidraw canvas.
 * Elements in the Excalidraw Scene are immutable. You should never directly change element properties in the scene object.
 * ExcalidrawAutomate provides a "workbench" where you can create, modify, and delete elements before committing them to the Excalidraw Scene.
 * The basic workflow is to create elements in ExcalidrawAutomate and once ready commit them to the Excalidraw Scene using addElementsToView().
 * To modify elements in the scene, you should first copy them over to EA using copyViewElementsToEAforEditing, make the necessary modifications,
 * then commit them back to the scene using addElementsToView().
 * To delete an element from the view set element.isDeleted = true and commit the changes to the scene using addElementsToView().
 *
 * At a very high level, EA has 3 type of functions:
 * - functions that modify elements in the EA workbench
 * - functions that access elements and properties of the Scene
 *   - these only work if targetView is set using setView()
 *   - Scripts executed by the Excalidraw ScritpEngine will have the targetView set automatically
 *   - These functions include the word view in their name e.g. getViewSelectedElements()
 * - utility functions that do not modify eleeemnts in the EA workbench or access the scene e.g.
 *   - ea.obsidian is a utility function that returns the Obsidian Module object.
 *   - eg.getCM() returns the ColorMaster object for manipulationg colors,
 *   - ea.help() provides information about functions and properties in the ExcalidrawAutomate class intended for use in Developer Console
 *   - checkAndCreateFolder (thought this has been superceeded by app.vault.createFolder in the Obsidian API)
 *   - etc.
 *
 * Note that some actions are asynchronous and require await to complete. e.g.:
 *   - addImage()
 *   - convertStringToDataURL()
 *   - etc.
 *
 * About the Excalidraw Automate Script Engine:
 * --------------------------------------------
 * Excalidraw Scripts utilize ExcalidrawAutomate. When the script is invoked Excalidraw passes an ExcalidrawAutomate instance to the script.
 * you may access this object via the variable `ea`. e.g. ea.addImage(); This ea object is already set to the targetView.
 * Through ea.obsidian all of the Obsidian API is available to the script. Thus you can create modal views, open files, etc.
 * You can access Obsidian type definitions here: https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts
 * In addition to the ea object, the script also receives the `utils` object. utils includes to utility functions: suggester and inputPrompt
 *   - inputPrompt(inputPrompt: (
 *       header: string,
 *       placeholder?: string,
 *       value?: string,
 *       buttons?: ButtonDefinition[],
 *       lines?: number,
 *       displayEditorButtons?: boolean,
 *       customComponents?: (container: HTMLElement) => void,
 *       blockPointerInputOutsideModal?: boolean,
 *     ) => Promise<string>;
 *   -  displayItems: string[],
 *       items: any[],
 *       hint?: string,
 *       instructions?: Instruction[],
 *     ) => Promise<any>;
 */
export declare class ExcalidrawAutomate {
    /**
     * Utility function that returns the Obsidian Module object.
     * @returns {typeof obsidian_module} The Obsidian module object.
     */
    get obsidian(): typeof obsidian_module;
    /**
     * Retrieves the laser pointer settings from the plugin.
     * @returns {Object} The laser pointer settings.
     */
    get LASERPOINTER(): {
        DECAY_TIME: number;
        DECAY_LENGTH: number;
        COLOR: string;
    };
    /**
     * Retrieves the device type information.
     * @returns {DeviceType} The device type.
     */
    get DEVICE(): DeviceType;
    /**
     * Prints a detailed breakdown of the startup time.
     */
    printStartupBreakdown(): void;
    /**
     * Add or modify keys in an element's customData while preserving existing keys.
     * Creates customData={} if it does not exist.
     * @param {string} id - The element ID in elementsDict to modify.
     * @param {Partial<Record<string, unknown>>} newData - Object containing key-value pairs to add/update. Set value to undefined to delete a key.
     * @returns {Mutable<ExcalidrawElement> | undefined} The modified element, or undefined if element does not exist.
     */
    addAppendUpdateCustomData(id: string, newData: Partial<Record<string, unknown>>): ExcalidrawElement;
    /**
     * Displays help information for EA functions and properties intended to be used in Obsidian developer console.
     * @param {Function | string} target - Function reference or property name as string.
     * Usage examples:
     * - ea.help(ea.functionName)
     * - ea.help('propertyName')
     * - ea.help('utils.functionName')
     */
    help(target: Function | string): void;
    /**
     * Posts an AI request to the OpenAI API and returns the response.
     * @param {AIRequest} request - The AI request configuration.
     * @returns {Promise<RequestUrlResponse>} Promise resolving to the API response.
     */
    postOpenAI(request: AIRequest): Promise<RequestUrlResponse>;
    /**
     * Extracts code blocks from markdown text.
     * @param {string} markdown - The markdown string to parse.
     * @returns {Array<{ data: string, type: string }>} Array of objects containing code block contents and types.
     */
    extractCodeBlocks(markdown: string): {
        data: string;
        type: string;
    }[];
    /**
     * Converts a string to a data URL with specified MIME type.
     * @param {string} data - The string to convert.
     * @param {string} [type="text/html"] - MIME type (default: "text/html").
     * @returns {Promise<string>} Promise resolving to the data URL string.
     */
    convertStringToDataURL(data: string, type?: string): Promise<string>;
    /**
     * Creates a folder if it doesn't exist.
     * @param {string} folderpath - Path of folder to create.
     * @returns {Promise<TFolder>} Promise resolving to the created/existing TFolder.
     */
    checkAndCreateFolder(folderpath: string): Promise<TFolder>;
    /**
     * Generates a unique filepath by appending a number if file already exists.
     * @param {string} filename - Base filename.
     * @param {string} folderpath - Target folder path.
     * @returns {string} Unique filepath string.
     */
    getNewUniqueFilepath(filename: string, folderpath: string): string;
    /**
     * Gets list of available Excalidraw template files.
     * @returns {TFile[] | null} Array of template TFiles or null if none found.
     */
    getListOfTemplateFiles(): TFile[] | null;
    /**
     * Gets all embedded images in a drawing recursively.
     * @param {TFile} [excalidrawFile] - Optional file to check, defaults to ea.targetView.file.
     * @returns {TFile[]} Array of embedded image TFiles.
     */
    getEmbeddedImagesFiletree(excalidrawFile?: TFile): TFile[];
    /**
     * Returns a new unique attachment filepath for the filename provided based on Obsidian settings.
     * @param {string} filename - The filename for the attachment.
     * @returns {Promise<string>} Promise resolving to the unique attachment filepath.
     */
    getAttachmentFilepath(filename: string): Promise<string>;
    /**
     * Compresses a string to base64 using LZString.
     * @param {string} str - The string to compress.
     * @returns {string} The compressed base64 string.
     */
    compressToBase64(str: string): string;
    /**
     * Decompresses a string from base64 using LZString.
     * @param {string} data - The base64 string to decompress.
     * @returns {string} The decompressed string.
     */
    decompressFromBase64(data: string): string;
    /**
     * Prompts the user with a dialog to select new file action.
     * - create markdown file
     * - create excalidraw file
     * - cancel action
     * The new file will be relative to this.targetView.file.path, unless parentFile is provided.
     * If shouldOpenNewFile is true, the new file will be opened in a workspace leaf.
     * targetPane control which leaf will be used for the new file.
     * Returns the TFile for the new file or null if the user cancelled the action.
     * @param {string} newFileNameOrPath - The new file name or path.
     * @param {boolean} shouldOpenNewFile - Whether to open the new file.
     * @param {PaneTarget} [targetPane] - The target pane for the new file.
     * @param {TFile} [parentFile] - The parent file for the new file.
     * @returns {Promise<TFile | null>} Promise resolving to the new TFile or null if cancelled.
     */
    newFilePrompt(newFileNameOrPath: string, shouldOpenNewFile: boolean, targetPane?: PaneTarget, parentFile?: TFile): Promise<TFile | null>;
    /**
     * Generates a new Obsidian Leaf following Excalidraw plugin settings such as open in Main Workspace or not, open in adjacent pane if available, etc.
     * @param {WorkspaceLeaf} origo - The currently active leaf, the origin of the new leaf.
     * @param {PaneTarget} [targetPane] - The target pane for the new leaf.
     * @returns {WorkspaceLeaf} The new or adjacent workspace leaf.
     */
    getLeaf(origo: WorkspaceLeaf, targetPane?: PaneTarget): WorkspaceLeaf;
    /**
     * Returns the editor or leaf.view of the currently active embedded obsidian file.
     * If view is not provided, ea.targetView is used.
     * If the embedded file is a markdown document the function will return
     * {file:TFile, editor:Editor} otherwise it will return {view:any}. You can check view type with view.getViewType();
     * @param {ExcalidrawView} [view] - The view to check.
     * @returns {{view:any}|{file:TFile, editor:Editor}|null} The active embeddable view or editor.
     */
    getActiveEmbeddableViewOrEditor(view?: ExcalidrawView): {
        view: any;
    } | {
        file: TFile;
        editor: Editor;
    } | null;
    /**
     * Checks if the Excalidraw File is a mask file.
     * @param {TFile} [file] - The file to check.
     * @returns {boolean} True if the file is a mask file, false otherwise.
     */
    isExcalidrawMaskFile(file?: TFile): boolean;
    plugin: ExcalidrawPlugin;
    elementsDict: {
        [key: string]: any;
    };
    imagesDict: {
        [key: FileId]: ImageInfo;
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
     * Returns the last recorded pointer position on the Excalidraw canvas.
     * @returns {{x:number, y:number}} The last recorded pointer position.
     */
    getViewLastPointerPosition(): {
        x: number;
        y: number;
    };
    /**
     * Returns the Excalidraw API for the current view or the view provided.
     * @param {ExcalidrawView} [view] - The view to get the API for.
     * @returns {ExcalidrawAutomate} The Excalidraw API.
     */
    getAPI(view?: ExcalidrawView): ExcalidrawAutomate;
    /**
     * Sets the fill style for new elements.
     * @param {number} val - The fill style value (0: "hachure", 1: "cross-hatch", 2: "solid").
     * @returns {"hachure"|"cross-hatch"|"solid"} The fill style string.
     */
    setFillStyle(val: number): "hachure" | "cross-hatch" | "solid";
    /**
     * Sets the stroke style for new elements.
     * @param {number} val - The stroke style value (0: "solid", 1: "dashed", 2: "dotted").
     * @returns {"solid"|"dashed"|"dotted"} The stroke style string.
     */
    setStrokeStyle(val: number): "solid" | "dashed" | "dotted";
    /**
     * Sets the stroke sharpness for new elements.
     * @param {number} val - The stroke sharpness value (0: "round", 1: "sharp").
     * @returns {"round"|"sharp"} The stroke sharpness string.
     */
    setStrokeSharpness(val: number): "round" | "sharp";
    /**
     * Sets the font family for new text elements.
     * @param {number} val - The font family value (1: Virgil, 2: Helvetica, 3: Cascadia).
     * @returns {string} The font family string.
     */
    setFontFamily(val: number): string;
    /**
     * Sets the theme for the canvas.
     * @param {number} val - The theme value (0: "light", 1: "dark").
     * @returns {"light"|"dark"} The theme string.
     */
    setTheme(val: number): "light" | "dark";
    /**
     * Generates a groupID and adds the groupId to all the elements in the objectIds array. Essentially grouping the elements in the view.
     * @param {string[]} objectIds - Array of element IDs to group.
     * @returns {string} The generated group ID.
     */
    addToGroup(objectIds: string[]): string;
    /**
     * Copies elements from ExcalidrawAutomate to the clipboard as a valid Excalidraw JSON string.
     * @param {string} [templatePath] - Optional template path to include in the clipboard data.
     */
    toClipboard(templatePath?: string): Promise<void>;
    /**
     * Extracts the Excalidraw Scene from an Excalidraw File.
     * @param {TFile} file - The Excalidraw file to extract the scene from.
     * @returns {Promise<{elements: ExcalidrawElement[]; appState: AppState;}>} Promise resolving to the Excalidraw scene.
     */
    getSceneFromFile(file: TFile): Promise<{
        elements: ExcalidrawElement[];
        appState: AppState;
    }>;
    /**
     * Gets all elements from ExcalidrawAutomate elementsDict.
     * @returns {Mutable<ExcalidrawElement>[]} Array of elements from elementsDict.
     */
    getElements(): Mutable<ExcalidrawElement>[];
    /**
     * Gets a single element from ExcalidrawAutomate elementsDict.
     * @param {string} id - The element ID to retrieve.
     * @returns {Mutable<ExcalidrawElement>} The element with the specified ID.
     */
    getElement(id: string): Mutable<ExcalidrawElement>;
    /**
     * Creates a drawing and saves it to the specified filename.
     * @param {Object} [params] - Parameters for creating the drawing.
     * @param {string} [params.filename] - The filename for the drawing. If null, default filename as defined in Excalidraw settings.
     * @param {string} [params.foldername] - The folder name for the drawing. If null, default folder as defined in Excalidraw settings.
     * @param {string} [params.templatePath] - The template path to use for the drawing.
     * @param {boolean} [params.onNewPane] - Whether to open the drawing in a new pane.
     * @param {boolean} [params.silent] - Whether to create the drawing silently.
     * @param {Object} [params.frontmatterKeys] - Frontmatter keys to include in the drawing.
     * @param {string} [params.plaintext] - Text to insert above the `# Text Elements` section.
     * @returns {Promise<string>} Promise resolving to the path of the created drawing.
     */
    create(params?: {
        filename?: string;
        foldername?: string;
        templatePath?: string;
        onNewPane?: boolean;
        silent?: boolean;
        frontmatterKeys?: {
            "excalidraw-plugin"?: "raw" | "parsed";
            "excalidraw-link-prefix"?: string;
            "excalidraw-link-brackets"?: boolean;
            "excalidraw-url-prefix"?: string;
            "excalidraw-export-transparent"?: boolean;
            "excalidraw-export-dark"?: boolean;
            "excalidraw-export-padding"?: number;
            "excalidraw-export-pngscale"?: number;
            "excalidraw-export-embed-scene"?: boolean;
            "excalidraw-default-mode"?: "view" | "zen";
            "excalidraw-onload-script"?: string;
            "excalidraw-linkbutton-opacity"?: number;
            "excalidraw-autoexport"?: boolean;
            "excalidraw-mask"?: boolean;
            "excalidraw-open-md"?: boolean;
            "cssclasses"?: string;
        };
        plaintext?: string;
    }): Promise<string>;
    /**
     * Creates an SVG image from the ExcalidrawAutomate elements and the template provided.
     * @param {string} [templatePath] - The template path to use for the SVG.
     * @param {boolean} [embedFont=false] - Whether to embed the font in the SVG.
     * @param {ExportSettings} [exportSettings] - Export settings for the SVG.
     * @param {EmbeddedFilesLoader} [loader] - Embedded files loader for the SVG.
     * @param {string} [theme] - The theme to use for the SVG.
     * @param {number} [padding] - The padding to use for the SVG.
     * @returns {Promise<SVGSVGElement>} Promise resolving to the created SVG element.
     */
    createSVG(templatePath?: string, embedFont?: boolean, exportSettings?: ExportSettings, loader?: EmbeddedFilesLoader, theme?: string, padding?: number): Promise<SVGSVGElement>;
    /**
     * Creates a PNG image from the ExcalidrawAutomate elements and the template provided.
     * @param {string} [templatePath] - The template path to use for the PNG.
     * @param {number} [scale=1] - The scale factor for the PNG.
     * @param {ExportSettings} [exportSettings] - Export settings for the PNG.
     * @param {EmbeddedFilesLoader} [loader] - Embedded files loader for the PNG.
     * @param {string} [theme] - The theme to use for the PNG.
     * @param {number} [padding] - The padding to use for the PNG.
     * @returns {Promise<any>} Promise resolving to the created PNG image.
     */
    createPNG(templatePath?: string, scale?: number, exportSettings?: ExportSettings, loader?: EmbeddedFilesLoader, theme?: string, padding?: number): Promise<any>;
    /**
     * Wrapper for createPNG() that returns a base64 encoded string designed to support LLM workflows.
     * @param {string} [templatePath] - The template path to use for the PNG.
     * @param {number} [scale=1] - The scale factor for the PNG.
     * @param {ExportSettings} [exportSettings] - Export settings for the PNG.
     * @param {EmbeddedFilesLoader} [loader] - Embedded files loader for the PNG.
     * @param {string} [theme] - The theme to use for the PNG.
     * @param {number} [padding] - The padding to use for the PNG.
     * @returns {Promise<string>} Promise resolving to the base64 encoded PNG string.
     */
    createPNGBase64(templatePath?: string, scale?: number, exportSettings?: ExportSettings, loader?: EmbeddedFilesLoader, theme?: string, padding?: number): Promise<string>;
    /**
     * Wraps text to a specified line length.
     * @param {string} text - The text to wrap.
     * @param {number} lineLen - The maximum line length.
     * @returns {string} The wrapped text.
     */
    wrapText(text: string, lineLen: number): string;
    /**
     * Utility function. Returns an element object using style settings and provided parameters.
     * @param {string} id - The element ID.
     * @param {string} eltype - The element type.
     * @param {number} x - The x-coordinate of the element.
     * @param {number} y - The y-coordinate of the element.
     * @param {number} w - The width of the element.
     * @param {number} h - The height of the element.
     * @param {string | null} [link=null] - The link associated with the element.
     * @param {[number, number]} [scale] - The scale of the element.
     * @returns {Object} The element object.
     */
    private boxedElement;
    /**
     * Deprecated. Use addEmbeddable() instead.
     * Retained for backward compatibility.
     * @param {number} topX - The x-coordinate of the top-left corner.
     * @param {number} topY - The y-coordinate of the top-left corner.
     * @param {number} width - The width of the iframe.
     * @param {number} height - The height of the iframe.
     * @param {string} [url] - The URL of the iframe.
     * @param {TFile} [file] - The file associated with the iframe.
     * @returns {string} The ID of the added iframe element.
     */
    addIFrame(topX: number, topY: number, width: number, height: number, url?: string, file?: TFile): string;
    /**
     * Adds an embeddable element to the ExcalidrawAutomate instance.
     * @param {number} topX - The x-coordinate of the top-left corner.
     * @param {number} topY - The y-coordinate of the top-left corner.
     * @param {number} width - The width of the embeddable element.
     * @param {number} height - The height of the embeddable element.
     * @param {string} [url] - The URL of the embeddable element.
     * @param {TFile} [file] - The file associated with the embeddable element.
     * @param {EmbeddableMDCustomProps} [embeddableCustomData] - Custom properties for the embeddable element.
     * @returns {string} The ID of the added embeddable element.
     */
    addEmbeddable(topX: number, topY: number, width: number, height: number, url?: string, file?: TFile, embeddableCustomData?: EmbeddableMDCustomProps): string;
    /**
     * Add elements to frame.
     * @param {string} frameId - The ID of the frame element.
     * @param {string[]} elementIDs - Array of element IDs to add to the frame.
     */
    addElementsToFrame(frameId: string, elementIDs: string[]): void;
    /**
     * Adds a frame element to the ExcalidrawAutomate instance.
     * @param {number} topX - The x-coordinate of the top-left corner.
     * @param {number} topY - The y-coordinate of the top-left corner.
     * @param {number} width - The width of the frame.
     * @param {number} height - The height of the frame.
     * @param {string} [name] - The display name of the frame.
     * @returns {string} The ID of the added frame element.
     */
    addFrame(topX: number, topY: number, width: number, height: number, name?: string): string;
    /**
     * Adds a rectangle element to the ExcalidrawAutomate instance.
     * @param {number} topX - The x-coordinate of the top-left corner.
     * @param {number} topY - The y-coordinate of the top-left corner.
     * @param {number} width - The width of the rectangle.
     * @param {number} height - The height of the rectangle.
     * @param {string} [id] - The ID of the rectangle element.
     * @returns {string} The ID of the added rectangle element.
     */
    addRect(topX: number, topY: number, width: number, height: number, id?: string): string;
    /**
     * Adds a diamond element to the ExcalidrawAutomate instance.
     * @param {number} topX - The x-coordinate of the top-left corner.
     * @param {number} topY - The y-coordinate of the top-left corner.
     * @param {number} width - The width of the diamond.
     * @param {number} height - The height of the diamond.
     * @param {string} [id] - The ID of the diamond element.
     * @returns {string} The ID of the added diamond element.
     */
    addDiamond(topX: number, topY: number, width: number, height: number, id?: string): string;
    /**
     * Adds an ellipse element to the ExcalidrawAutomate instance.
     * @param {number} topX - The x-coordinate of the top-left corner.
     * @param {number} topY - The y-coordinate of the top-left corner.
     * @param {number} width - The width of the ellipse.
     * @param {number} height - The height of the ellipse.
     * @param {string} [id] - The ID of the ellipse element.
     * @returns {string} The ID of the added ellipse element.
     */
    addEllipse(topX: number, topY: number, width: number, height: number, id?: string): string;
    /**
     * Adds a blob element to the ExcalidrawAutomate instance.
     * @param {number} topX - The x-coordinate of the top-left corner.
     * @param {number} topY - The y-coordinate of the top-left corner.
     * @param {number} width - The width of the blob.
     * @param {number} height - The height of the blob.
     * @param {string} [id] - The ID of the blob element.
     * @returns {string} The ID of the added blob element.
     */
    addBlob(topX: number, topY: number, width: number, height: number, id?: string): string;
    /**
     * Refreshes the size of a text element to fit its contents.
     * @param {string} id - The ID of the text element.
     */
    refreshTextElementSize(id: string): void;
    /**
     * Adds a text element to the ExcalidrawAutomate instance.
     * @param {number} topX - The x-coordinate of the top-left corner.
     * @param {number} topY - The y-coordinate of the top-left corner.
     * @param {string} text - The text content of the element.
     * @param {Object} [formatting] - Formatting options for the text element.
     * @param {boolean} [formatting.autoResize=true] - Whether to auto-resize the text element.
     * @param {number} [formatting.wrapAt] - The character length to wrap the text at.
     * @param {number} [formatting.width] - The width of the text element.
     * @param {number} [formatting.height] - The height of the text element.
     * @param {"left" | "center" | "right"} [formatting.textAlign] - The text alignment.
     * @param {boolean | "box" | "blob" | "ellipse" | "diamond"} [formatting.box] - Whether to add a box around the text.
     * @param {number} [formatting.boxPadding] - The padding inside the box.
     * @param {string} [formatting.boxStrokeColor] - The stroke color of the box.
     * @param {"top" | "middle" | "bottom"} [formatting.textVerticalAlign] - The vertical alignment of the text.
     * @param {string} [id] - The ID of the text element.
     * @returns {string} The ID of the added text element.
     */
    addText(topX: number, topY: number, text: string, formatting?: {
        autoResize?: boolean;
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
     * Adds a line element to the ExcalidrawAutomate instance.
     * @param {[[x: number, y: number]]} points - Array of points defining the line.
     * @param {string} [id] - The ID of the line element.
     * @returns {string} The ID of the added line element.
     */
    addLine(points: [[x: number, y: number]], id?: string): string;
    /**
     * Adds an arrow element to the ExcalidrawAutomate instance.
     * @param {[x: number, y: number][]} points - Array of points defining the arrow.
     * @param {Object} [formatting] - Formatting options for the arrow element.
     * @param {"arrow"|"bar"|"circle"|"circle_outline"|"triangle"|"triangle_outline"|"diamond"|"diamond_outline"|null} [formatting.startArrowHead] - The start arrowhead type.
     * @param {"arrow"|"bar"|"circle"|"circle_outline"|"triangle"|"triangle_outline"|"diamond"|"diamond_outline"|null} [formatting.endArrowHead] - The end arrowhead type.
     * @param {string} [formatting.startObjectId] - The ID of the start object.
     * @param {string} [formatting.endObjectId] - The ID of the end object.
     * @param {string} [id] - The ID of the arrow element.
     * @returns {string} The ID of the added arrow element.
     */
    addArrow(points: [x: number, y: number][], formatting?: {
        startArrowHead?: "arrow" | "bar" | "circle" | "circle_outline" | "triangle" | "triangle_outline" | "diamond" | "diamond_outline" | null;
        endArrowHead?: "arrow" | "bar" | "circle" | "circle_outline" | "triangle" | "triangle_outline" | "diamond" | "diamond_outline" | null;
        startObjectId?: string;
        endObjectId?: string;
    }, id?: string): string;
    /**
     * Adds a mermaid diagram to ExcalidrawAutomate elements.
     * @param {string} diagram - The mermaid diagram string.
     * @param {boolean} [groupElements=true] - Whether to group the elements.
     * @returns {Promise<string[]|string>} Promise resolving to the IDs of the created elements or an error message.
     */
    addMermaid(diagram: string, groupElements?: boolean): Promise<string[] | string>;
    /**
     * Adds an image element to the ExcalidrawAutomate instance.
     * @param {number | AddImageOptions} topXOrOpts - The x-coordinate of the top-left corner or an options object.
     * @param {number} topY - The y-coordinate of the top-left corner.
     * @param {TFile | string} imageFile - The image file or URL.
     * @param {boolean} [scale=true] - Whether to scale the image to MAX_IMAGE_SIZE.
     * @param {boolean} [anchor=true] - Whether to anchor the image at 100% size.
     * @returns {Promise<string>} Promise resolving to the ID of the added image element.
     */
    addImage(topXOrOpts: number | AddImageOptions, topY: number, imageFile: TFile | string, //string may also be an Obsidian filepath with a reference such as folder/path/my.pdf#page=2
    scale?: boolean, //default is true which will scale the image to MAX_IMAGE_SIZE, false will insert image at 100% of its size
    anchor?: boolean): Promise<string>;
    /**
     * Adds a LaTeX equation as an image element to the ExcalidrawAutomate instance.
     * @param {number} topX - The x-coordinate of the top-left corner.
     * @param {number} topY - The y-coordinate of the top-left corner.
     * @param {string} tex - The LaTeX equation string.
     * @returns {Promise<string>} Promise resolving to the ID of the added LaTeX image element.
     */
    addLaTex(topX: number, topY: number, tex: string): Promise<string>;
    /**
     * Returns the base64 dataURL of the LaTeX equation rendered as an SVG.
     * @param {string} tex - The LaTeX equation string.
     * @param {number} [scale=4] - The scale factor for the image.
     * @returns {Promise<{mimeType: MimeType; fileId: FileId; dataURL: DataURL; created: number; size: { height: number; width: number };}>} Promise resolving to the LaTeX image data.
     */
    tex2dataURL(tex: string, scale?: number): Promise<{
        mimeType: MimeType;
        fileId: FileId;
        dataURL: DataURL;
        created: number;
        size: {
            height: number;
            width: number;
        };
    }>;
    /**
     * Connects two objects with an arrow.
     * @param {string} objectA - The ID of the first object.
     * @param {ConnectionPoint | null} connectionA - The connection point on the first object.
     * @param {string} objectB - The ID of the second object.
     * @param {ConnectionPoint | null} connectionB - The connection point on the second object.
     * @param {Object} [formatting] - Formatting options for the arrow.
     * @param {number} [formatting.numberOfPoints=0] - The number of points on the arrow.
     * @param {"arrow"|"bar"|"circle"|"circle_outline"|"triangle"|"triangle_outline"|"diamond"|"diamond_outline"|null} [formatting.startArrowHead] - The start arrowhead type.
     * @param {"arrow"|"bar"|"circle"|"circle_outline"|"triangle"|"triangle_outline"|"diamond"|"diamond_outline"|null} [formatting.endArrowHead] - The end arrowhead type.
     * @param {number} [formatting.padding=10] - The padding around the arrow.
     * @returns {string} The ID of the added arrow element.
     */
    connectObjects(objectA: string, connectionA: ConnectionPoint | null, objectB: string, connectionB: ConnectionPoint | null, formatting?: {
        numberOfPoints?: number;
        startArrowHead?: "arrow" | "bar" | "circle" | "circle_outline" | "triangle" | "triangle_outline" | "diamond" | "diamond_outline" | null;
        endArrowHead?: "arrow" | "bar" | "circle" | "circle_outline" | "triangle" | "triangle_outline" | "diamond" | "diamond_outline" | null;
        padding?: number;
    }): string;
    /**
     * Adds a text label to a line or arrow. Currently only works with a straight (2 point - start & end - line).
     * @param {string} lineId - The ID of the line or arrow object.
     * @param {string} label - The label text.
     * @returns {string} The ID of the added text element.
     */
    addLabelToLine(lineId: string, label: string): string;
    /**
     * Clears elementsDict and imagesDict only.
     */
    clear(): void;
    /**
     * Clears elementsDict and imagesDict, and resets all style values to default.
     */
    reset(): void;
    /**
     * Returns true if the provided file is an Excalidraw file.
     * @param {TFile} f - The file to check.
     * @returns {boolean} True if the file is an Excalidraw file, false otherwise.
     */
    isExcalidrawFile(f: TFile): boolean;
    targetView: ExcalidrawView;
    /**
     * Sets the target view for EA. All the view operations and the access to Excalidraw API will be performend on this view.
     * If view is null or undefined, the function will first try setView("active"), then setView("first").
     * @param {ExcalidrawView | "first" | "active"} [view] - The view to set as target.
     * @returns {ExcalidrawView} The target view.
     */
    setView(view?: ExcalidrawView | "first" | "active"): ExcalidrawView;
    /**
     * Returns the Excalidraw API for the current view.
     * @returns {any} The Excalidraw API.
     */
    getExcalidrawAPI(): any;
    /**
     * Gets elements in the current view.
     * @returns {ExcalidrawElement[]} Array of elements in the view.
     */
    getViewElements(): ExcalidrawElement[];
    /**
     * Deletes elements in the view by removing them from the scene (not by setting isDeleted to true).
     * @param {ExcalidrawElement[]} elToDelete - Array of elements to delete.
     * @returns {boolean} True if elements were deleted, false otherwise.
     */
    deleteViewElements(elToDelete: ExcalidrawElement[]): boolean;
    /**
     * Adds a back of the note card to the current active view.
     * @param {string} sectionTitle - The title of the section.
     * @param {boolean} [activate=true] - Whether to activate the new Embedded Element after creation.
     * @param {string} [sectionBody] - The body of the section.
     * @param {EmbeddableMDCustomProps} [embeddableCustomData] - Custom properties for the embeddable element.
     * @returns {Promise<string>} Promise resolving to the ID of the embeddable element.
     */
    addBackOfTheCardNoteToView(sectionTitle: string, activate?: boolean, sectionBody?: string, embeddableCustomData?: EmbeddableMDCustomProps): Promise<string>;
    /**
     * Gets the selected element in the view. If more are selected, gets the first.
     * @returns {any} The selected element or null if none selected.
     */
    getViewSelectedElement(): any;
    /**
     * Gets the selected elements in the view.
     * @param {boolean} [includeFrameChildren=true] - Whether to include frame children in the selection.
     * @returns {any[]} Array of selected elements.
     */
    getViewSelectedElements(includeFrameChildren?: boolean): any[];
    /**
     * Gets the file associated with an image element in the view.
     * @param {ExcalidrawElement} el - The image element.
     * @returns {TFile | null} The file associated with the image element or null if not found.
     */
    getViewFileForImageElement(el: ExcalidrawElement): TFile | null;
    /**
     * Gets the color map associated with an image element in the view.
     * @param {ExcalidrawElement} el - The image element.
     * @returns {ColorMap} The color map associated with the image element.
     */
    getColorMapForImageElement(el: ExcalidrawElement): ColorMap;
    /**
     * Updates the color map of SVG images in the view.
     * @param {ExcalidrawImageElement | ExcalidrawImageElement[]} elements - The image elements to update.
     * @param {ColorMap | SVGColorInfo | ColorMap[] | SVGColorInfo[]} colors - The new color map(s) for the images.
     * @returns {Promise<void>} Promise resolving when the update is complete.
     */
    updateViewSVGImageColorMap(elements: ExcalidrawImageElement | ExcalidrawImageElement[], colors: ColorMap | SVGColorInfo | ColorMap[] | SVGColorInfo[]): Promise<void>;
    /**
     * Gets the SVG color information for an image element in the view.
     * @param {ExcalidrawElement} el - The image element.
     * @returns {Promise<SVGColorInfo>} Promise resolving to the SVG color information.
     */
    getSVGColorInfoForImgElement(el: ExcalidrawElement): Promise<SVGColorInfo>;
    /**
     * Gets the color information from an Excalidraw file.
     * @param {TFile} file - The Excalidraw file.
     * @param {ExcalidrawImageElement} img - The image element.
     * @returns {Promise<SVGColorInfo>} Promise resolving to the SVG color information.
     */
    getColosFromExcalidrawFile(file: TFile, img: ExcalidrawImageElement): Promise<SVGColorInfo>;
    /**
     * Extracts color information from an SVG string.
     * @param {string} svgString - The SVG string.
     * @returns {SVGColorInfo} The extracted color information.
     */
    getColorsFromSVGString(svgString: string): SVGColorInfo;
    /**
     * Copies elements from the view to elementsDict for editing.
     * @param {ExcalidrawElement[]} elements - Array of elements to copy.
     * @param {boolean} [copyImages=false] - Whether to copy images as well.
     */
    copyViewElementsToEAforEditing(elements: ExcalidrawElement[], copyImages?: boolean): void;
    /**
     * Toggles full screen mode for the target view.
     * @param {boolean} [forceViewMode=false] - Whether to force view mode.
     */
    viewToggleFullScreen(forceViewMode?: boolean): void;
    /**
     * Sets view mode enabled or disabled for the target view.
     * @param {boolean} enabled - Whether to enable view mode.
     */
    setViewModeEnabled(enabled: boolean): void;
    /**
     * Updates the scene in the target view.
     * @param {Object} scene - The scene to load to Excalidraw.
     * @param {ExcalidrawElement[]} [scene.elements] - Array of elements in the scene.
     * @param {AppState} [scene.appState] - The app state of the scene.
     * @param {BinaryFileData} [scene.files] - The files in the scene.
     * @param {boolean} [scene.commitToHistory] - Whether to commit the scene to history.
     * @param {"capture" | "none" | "update"} [scene.storeAction] - The store action for the scene.
     * @param {boolean} [restore=false] - Whether to restore legacy elements in the scene.
     */
    viewUpdateScene(scene: {
        elements?: ExcalidrawElement[];
        appState?: AppState;
        files?: BinaryFileData;
        commitToHistory?: boolean;
        storeAction?: "capture" | "none" | "update";
    }, restore?: boolean): void;
    /**
     * Connects an object to the selected element in the view.
     * @param {string} objectA - The ID of the first object.
     * @param {ConnectionPoint | null} connectionA - The connection point on the first object.
     * @param {ConnectionPoint | null} connectionB - The connection point on the selected element.
     * @param {Object} [formatting] - Formatting options for the arrow.
     * @param {number} [formatting.numberOfPoints=0] - The number of points on the arrow.
     * @param {"arrow"|"bar"|"circle"|"circle_outline"|"triangle"|"triangle_outline"|"diamond"|"diamond_outline"|null} [formatting.startArrowHead] - The start arrowhead type.
     * @param {"arrow"|"bar"|"circle"|"circle_outline"|"triangle"|"triangle_outline"|"diamond"|"diamond_outline"|null} [formatting.endArrowHead] - The end arrowhead type.
     * @param {number} [formatting.padding=10] - The padding around the arrow.
     * @returns {boolean} True if the connection was successful, false otherwise.
     */
    connectObjectWithViewSelectedElement(objectA: string, connectionA: ConnectionPoint | null, connectionB: ConnectionPoint | null, formatting?: {
        numberOfPoints?: number;
        startArrowHead?: "arrow" | "bar" | "circle" | "circle_outline" | "triangle" | "triangle_outline" | "diamond" | "diamond_outline" | null;
        endArrowHead?: "arrow" | "bar" | "circle" | "circle_outline" | "triangle" | "triangle_outline" | "diamond" | "diamond_outline" | null;
        padding?: number;
    }): boolean;
    /**
     * Zooms the target view to fit the specified elements.
     * @param {boolean} selectElements - Whether to select the elements after zooming.
     * @param {ExcalidrawElement[]} elements - Array of elements to zoom to.
     */
    viewZoomToElements(selectElements: boolean, elements: ExcalidrawElement[]): void;
    /**
     * Adds elements from elementsDict to the current view.
     * @param {boolean} [repositionToCursor=false] - Whether to reposition the elements to the cursor.
     * @param {boolean} [save=true] - Whether to save the changes.
     * @param {boolean} [newElementsOnTop=false] - Whether to add new elements on top of existing elements.
     * @param {boolean} [shouldRestoreElements=false] - Whether to restore legacy elements in the scene.
     * @returns {Promise<boolean>} Promise resolving to true if elements were added, false otherwise.
     */
    addElementsToView(repositionToCursor?: boolean, save?: boolean, newElementsOnTop?: boolean, shouldRestoreElements?: boolean): Promise<boolean>;
    /**
     * Registers this instance of EA to use for hooks with the target view.
     * By default, ExcalidrawViews will check window.ExcalidrawAutomate for event hooks.
     * Using this method, you can set a different instance of Excalidraw Automate for hooks.
     * @returns {boolean} True if successful, false otherwise.
     */
    registerThisAsViewEA(): boolean;
    /**
     * Sets the target view EA to window.ExcalidrawAutomate.
     * @returns {boolean} True if successful, false otherwise.
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
     * If set, this callback is triggered whenever the active canvas color changes.
     * @param {ExcalidrawAutomate} ea - The ExcalidrawAutomate instance.
     * @param {ExcalidrawView} view - The Excalidraw view.
     * @param {string} color - The new canvas color.
     */
    onCanvasColorChangeHook: (ea: ExcalidrawAutomate, view: ExcalidrawView, //the excalidraw view 
    color: string) => void;
    /**
     * If set, this callback is triggered whenever a drawing is exported to SVG.
     * The string returned will replace the link in the exported SVG.
     * The hook is only executed if the link is to a file internal to Obsidian.
     * @param {Object} data - The data for the hook.
     * @param {string} data.originalLink - The original link in the SVG.
     * @param {string} data.obsidianLink - The Obsidian link in the SVG.
     * @param {TFile | null} data.linkedFile - The linked file in Obsidian.
     * @param {TFile} data.hostFile - The host file in Obsidian.
     * @returns {string} The updated link for the SVG.
     */
    onUpdateElementLinkForExportHook: (data: {
        originalLink: string;
        obsidianLink: string;
        linkedFile: TFile | null;
        hostFile: TFile;
    }) => string;
    /**
     * Utility function to generate EmbeddedFilesLoader object.
     * @param {boolean} [isDark] - Whether to use dark mode.
     * @returns {EmbeddedFilesLoader} The EmbeddedFilesLoader object.
     */
    getEmbeddedFilesLoader(isDark?: boolean): EmbeddedFilesLoader;
    /**
     * Utility function to generate ExportSettings object.
     * @param {boolean} withBackground - Whether to include the background in the export.
     * @param {boolean} withTheme - Whether to include the theme in the export.
     * @param {boolean} [isMask=false] - Whether the export is a mask.
     * @returns {ExportSettings} The ExportSettings object.
     */
    getExportSettings(withBackground: boolean, withTheme: boolean, isMask?: boolean): ExportSettings;
    /**
     * Gets the bounding box of the specified elements.
     * The bounding box is the box encapsulating all of the elements completely.
     * @param {ExcalidrawElement[]} elements - Array of elements to get the bounding box for.
     * @returns {{topX: number; topY: number; width: number; height: number}} The bounding box of the elements.
     */
    getBoundingBox(elements: ExcalidrawElement[]): {
        topX: number;
        topY: number;
        width: number;
        height: number;
    };
    /**
     * Gets elements grouped by the highest level groups.
     * @param {ExcalidrawElement[]} elements - Array of elements to group.
     * @returns {ExcalidrawElement[][]} Array of arrays of grouped elements.
     */
    getMaximumGroups(elements: ExcalidrawElement[]): ExcalidrawElement[][];
    /**
     * Gets the largest element from a group.
     * Useful when a text element is grouped with a box, and you want to connect an arrow to the box.
     * @param {ExcalidrawElement[]} elements - Array of elements in the group.
     * @returns {ExcalidrawElement} The largest element in the group.
     */
    getLargestElement(elements: ExcalidrawElement[]): ExcalidrawElement;
    /**
     * Intersects an element with a line.
     * @param {ExcalidrawBindableElement} element - The element to intersect.
     * @param {readonly [number, number]} a - The start point of the line.
     * @param {readonly [number, number]} b - The end point of the line.
     * @param {number} [gap] - The gap between the element and the line.
     * @returns {Point[]} Array of intersection points (2 or 0).
     */
    intersectElementWithLine(element: ExcalidrawBindableElement, a: readonly [number, number], b: readonly [number, number], gap?: number): Point[];
    /**
     * Gets the groupId for the group that contains all the elements, or null if such a group does not exist.
     * @param {ExcalidrawElement[]} elements - Array of elements to check.
     * @returns {string | null} The groupId or null if not found.
     */
    getCommonGroupForElements(elements: ExcalidrawElement[]): string;
    /**
     * Gets all the elements from elements[] that share one or more groupIds with the specified element.
     * @param {ExcalidrawElement} element - The element to check.
     * @param {ExcalidrawElement[]} elements - Array of elements to search.
     * @param {boolean} [includeFrameElements=false] - Whether to include frame elements in the search.
     * @returns {ExcalidrawElement[]} Array of elements in the same group as the specified element.
     */
    getElementsInTheSameGroupWithElement(element: ExcalidrawElement, elements: ExcalidrawElement[], includeFrameElements?: boolean): ExcalidrawElement[];
    /**
     * Gets all the elements from elements[] that are contained in the specified frame.
     * @param {ExcalidrawElement} frameElement - The frame element.
     * @param {ExcalidrawElement[]} elements - Array of elements to search.
     * @param {boolean} [shouldIncludeFrame=false] - Whether to include the frame element in the result.
     * @returns {ExcalidrawElement[]} Array of elements contained in the frame.
     */
    getElementsInFrame(frameElement: ExcalidrawElement, elements: ExcalidrawElement[], shouldIncludeFrame?: boolean): ExcalidrawElement[];
    /**
     * Sets the active script for the ScriptEngine.
     * @param {string} scriptName - The name of the active script.
     */
    activeScript: string;
    /**
     * Gets the script settings for the active script.
     * Saves settings in plugin settings, under the activeScript key.
     * @returns {Object} The script settings.
     */
    getScriptSettings(): {};
    /**
     * Sets the script settings for the active script.
     * @param {Object} settings - The script settings to set.
     * @returns {Promise<void>} Promise resolving when the settings are saved.
     */
    setScriptSettings(settings: any): Promise<void>;
    /**
     * Opens a file in a new workspace leaf or reuses an existing adjacent leaf depending on Excalidraw Plugin Settings.
     * @param {TFile} file - The file to open.
     * @param {OpenViewState} [openState] - The open state for the file.
     * @returns {WorkspaceLeaf} The new or adjacent workspace leaf.
     */
    openFileInNewOrAdjacentLeaf(file: TFile, openState?: OpenViewState): WorkspaceLeaf;
    /**
     * Measures the size of the specified text based on current style settings.
     * @param {string} text - The text to measure.
     * @returns {{width: number; height: number}} The width and height of the text.
     */
    measureText(text: string): {
        width: number;
        height: number;
    };
    /**
     * Returns the size of the image element at 100% (i.e. the original size), or undefined if the data URL is not available.
     * @param {ExcalidrawImageElement} imageElement - The image element from the active scene on targetView.
     * @param {boolean} [shouldWaitForImage=false] - Whether to wait for the image to load before returning the size.
     * @returns {Promise<{width: number; height: number}>} Promise resolving to the original size of the image.
     */
    getOriginalImageSize(imageElement: ExcalidrawImageElement, shouldWaitForImage?: boolean): Promise<{
        width: number;
        height: number;
    }>;
    /**
     * Resets the image to its original aspect ratio.
     * If the image is resized then the function returns true.
     * If the image element is not in EA (only in the view), then if image is resized, the element is copied to EA for Editing using copyViewElementsToEAforEditing([imgEl]).
     * Note you need to run await ea.addElementsToView(false); to add the modified image to the view.
     * @param {ExcalidrawImageElement} imgEl - The EA image element to be resized.
     * @returns {Promise<boolean>} Promise resolving to true if the image was changed, false otherwise.
     */
    resetImageAspectRatio(imgEl: ExcalidrawImageElement): Promise<boolean>;
    /**
     * Verifies if the plugin version is greater than or equal to the required version.
     * Excample usage in a script: if (!ea.verifyMinimumPluginVersion("1.5.20")) { console.error("Please update the Excalidraw Plugin to the latest version."); return; }
     * @param {string} requiredVersion - The required plugin version.
     * @returns {boolean} True if the plugin version is greater than or equal to the required version, false otherwise.
     */
    verifyMinimumPluginVersion(requiredVersion: string): boolean;
    /**
     * Checks if the provided view is an instance of ExcalidrawView.
     * @param {any} view - The view to check.
     * @returns {boolean} True if the view is an instance of ExcalidrawView, false otherwise.
     */
    isExcalidrawView(view: any): boolean;
    /**
     * Sets the selection in the view.
     * @param {ExcalidrawElement[] | string[]} elements - Array of elements or element IDs to select.
     */
    selectElementsInView(elements: ExcalidrawElement[] | string[]): void;
    /**
     * Generates a random 8-character long element ID.
     * @returns {string} The generated element ID.
     */
    generateElementId(): string;
    /**
     * Clones the specified element with a new ID.
     * @param {ExcalidrawElement} element - The element to clone.
     * @returns {ExcalidrawElement} The cloned element with a new ID.
     */
    cloneElement(element: ExcalidrawElement): ExcalidrawElement;
    /**
     * Moves the specified element to a specific position in the z-index.
     * @param {number} elementId - The ID of the element to move.
     * @param {number} newZIndex - The new z-index position for the element.
     */
    moveViewElementToZIndex(elementId: number, newZIndex: number): void;
    /**
     * Converts a hex color string to an RGB array.
     * @deprecated Use getCM / ColorMaster instead.
     * @param {string} color - The hex color string.
     * @returns {number[]} The RGB array.
     */
    hexStringToRgb(color: string): number[];
    /**
     * Converts an RGB array to a hex color string.
     * @deprecated Use getCM / ColorMaster instead.
     * @param {number[]} color - The RGB array.
     * @returns {string} The hex color string.
     */
    rgbToHexString(color: number[]): string;
    /**
     * Converts an HSL array to an RGB array.
     * @deprecated Use getCM / ColorMaster instead.
     * @param {number[]} color - The HSL array.
     * @returns {number[]} The RGB array.
     */
    hslToRgb(color: number[]): number[];
    /**
     * Converts an RGB array to an HSL array.
     * @deprecated Use getCM / ColorMaster instead.
     * @param {number[]} color - The RGB array.
     * @returns {number[]} The HSL array.
     */
    rgbToHsl(color: number[]): number[];
    /**
     * Converts a color name to a hex color string.
     * @param {string} color - The color name.
     * @returns {string} The hex color string.
     */
    colorNameToHex(color: string): string;
    /**
     * Creates a ColorMaster object for manipulating colors.
     * @param {TInput} color - The color input.
     * @returns {ColorMaster} The ColorMaster object.
     */
    getCM(color: TInput): ColorMaster;
    /**
     * Gets the PolyBool class from https://github.com/velipso/polybooljs.
     * @returns {PolyBool} The PolyBool class.
     */
    getPolyBool(): any;
    /**
     * Imports an SVG string into ExcalidrawAutomate elements.
     * @param {string} svgString - The SVG string to import.
     * @returns {boolean} True if the import was successful, false otherwise.
     */
    importSVG(svgString: string): boolean;
    /**
     * Destroys the ExcalidrawAutomate instance, clearing all references and data.
     */
    destroy(): void;
}
