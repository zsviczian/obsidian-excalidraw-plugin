# Excalidraw Automate library (not only) file for LLM training

[Gemini](https://aistudio.google.com/) because of its very large context window (without subscription) is effective at developing ExcalidrawAutomate scripts. To achieve the best result I recommend attaching 3 files for these LLMs to use as reference.
1) The [Obsidian API library file](https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts).
2) One or more ready made ExcalidrawAutomate scripts that do something remotely similar to what you want. You'll find a very extensive list of scripts [here](https://github.com/zsviczian/obsidian-excalidraw-plugin/tree/master/ea-scripts).
3) This library file for ExcalidrawAutomate that includes a more detailed description of each function, plus includes some general explanation about the logic of Excalidraw Automate intended for both hobby hackers and LLMs.

For more information about Excalidraw scripting visit my playlist on [YouTube](https://youtube.com/playlist?list=PL6mqgtMZ4NP3up3qjrWW69UwlPow0ZvzU&si=iWIF9pkQPdXYXOYc)

```js
/* ********************************** */
/* lib/shared/ExcalidrawAutomate.d.ts */
/* ********************************** */
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
     * This is a modified version of the Obsidian.Modal class
     * that allows the modal to be dragged around the screen
     * and that does not dim the background.
     */
    get FloatingModal(): typeof FloatingModal;
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
     * @param filepath - The file path to split into folder and filename.
     * @returns object containing folderpath, filename, basename, and extension.
     */
    splitFolderAndFilename(filepath: string): {
        folderpath: string;
        filename: string;
        basename: string;
        extension: string;
    };
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
    } | {
        node: ObsidianCanvasNode;
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
     * Returns the center position of the current view in Excalidraw coordinates.
     * @returns {{x:number, y:number}} The center position of the view.
     */
    getViewCenterPosition(): {
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
     * Returns the dimensions of a standard page size in pixels.
     *
     * @param {PageSize} pageSize - The standard page size. Possible values are "A0", "A1", "A2", "A3", "A4", "A5", "Letter", "Legal", "Tabloid".
     * @param {PageOrientation} orientation - The orientation of the page. Possible values are "portrait" and "landscape".
     * @returns {PageDimensions} - An object containing the width and height of the page in pixels.
     *
     * @typedef {Object} PageDimensions
     * @property {number} width - The width of the page in pixels.
     * @property {number} height - The height of the page in pixels.
     *
     * @example
     * const dimensions = getPageDimensions("A4", "portrait");
     * console.log(dimensions); // { width: 794.56, height: 1122.56 }
    */
    getPagePDFDimensions(pageSize: PageSize, orientation: PageOrientation): PageDimensions;
    /**
     * Creates a PDF from the provided SVG elements with specified scaling and page properties.
     *
     * @param {Object} params - The parameters for creating the PDF.
     * @param {SVGSVGElement[]} params.SVG - An array of SVG elements to be included in the PDF.
     * @param {PDFExportScale} [params.scale={ fitToPage: 1, zoom: 1 }] - The scaling options for the SVG elements.
     * @param {PDFPageProperties} [params.pageProps] - The properties for the PDF pages.
     * @returns {Promise<ArrayBuffer>} - A promise that resolves to an ArrayBuffer containing the PDF data.
     *
     * @example
     * const pdfData = await createToPDF({
     *   SVG: [svgElement1, svgElement2],
     *   scale: { fitToPage: 1 },
     *   pageProps: {
     *     dimensions: { width: 794.56, height: 1122.56 },
     *     backgroundColor: "#ffffff",
     *     margin: { left: 20, right: 20, top: 20, bottom: 20 },
     *     alignment: "center",
     *   }
     *   filename: "example.pdf",
     * });
    */
    createPDF({ SVG, scale, pageProps, filename, }: {
        SVG: SVGSVGElement[];
        scale?: PDFExportScale;
        pageProps?: PDFPageProperties;
        filename: string;
    }): Promise<void>;
    /**
     * Creates an SVG representation of the current view.
     *
     * @param {Object} options - The options for creating the SVG.
     * @param {boolean} [options.withBackground=true] - Whether to include the background in the SVG.
     * @param {"light" | "dark"} [options.theme] - The theme to use for the SVG.
     * @param {FrameRenderingOptions} [options.frameRendering={enabled: true, name: true, outline: true, clip: true}] - The frame rendering options.
     * @param {number} [options.padding] - The padding to apply around the SVG.
     * @param {boolean} [options.selectedOnly=false] - Whether to include only the selected elements in the SVG.
     * @param {boolean} [options.skipInliningFonts=false] - Whether to skip inlining fonts in the SVG.
     * @param {boolean} [options.embedScene=false] - Whether to embed the scene in the SVG.
     * @param {ExcalidrawElement[]} [options.elementsOverride] - Optional override for the elements to include in the SVG. Primary to support the Printable Layout Wizard script
     * @returns {Promise<SVGSVGElement>} A promise that resolves to the SVG element.
    */
    createViewSVG({ withBackground, theme, frameRendering, padding, selectedOnly, skipInliningFonts, embedScene, elementsOverride, }: {
        withBackground?: boolean;
        theme?: "light" | "dark";
        frameRendering?: FrameRenderingOptions;
        padding?: number;
        selectedOnly?: boolean;
        skipInliningFonts?: boolean;
        embedScene?: boolean;
        elementsOverride?: ExcalidrawElement[];
    }): Promise<SVGSVGElement>;
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
     * Sets the target view for EA. All the view operations and the access to Excalidraw API will be performed on this view.
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
     * @param {boolean} [scene.commitToHistory] - Whether to commit the scene to history. @deprecated Use scene.storageOption instead
     * @param {"capture" | "none" | "update"} [scene.storeAction] - The store action for the scene. @deprecated Use scene.storageOption instead
     * @param {"IMMEDIATELY" | "NEVER" | "EVENTUALLY"} [scene.captureUpdate] - The capture update action for the scene.
     * @param {boolean} [restore=false] - Whether to restore legacy elements in the scene.
     */
    viewUpdateScene(scene: {
        elements?: ExcalidrawElement[];
        appState?: AppState | {};
        files?: BinaryFileData;
        commitToHistory?: boolean;
        storeAction?: "capture" | "none" | "update";
        captureUpdate?: SceneData["captureUpdate"];
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
     * If set, this callback is triggered when a image is being saved in Excalidraw.
     * You can use this callback to customize the naming and path of pasted images to avoid
     * default names like "Pasted image 123147170.png" being saved in the attachments folder,
     * and instead use more meaningful names based on the Excalidraw file or other criteria,
     * plus save the image in a different folder.
     *
     * If the function returns null or undefined, the normal Excalidraw operation will continue
     * with the excalidraw generated name and default path.
     * If a filepath is returned, that will be used. Include the full Vault filepath and filename
     * with the file extension.
     * The currentImageName is the name of the image generated by excalidraw or provided during paste.
     *
     * @param data - An object containing the following properties:
     *   @property {string} [currentImageName] - Default name for the image.
     *   @property {string} drawingFilePath - The file path of the Excalidraw file where the image is being used.
     *
     * @returns {string} - The new filepath for the image including full vault path and extension.
     *
     * Example usage:
     * ```
     * onImageFilePathHook: (data) => {
     *   const { currentImageName, drawingFilePath } = data;
     *   // Generate a new filepath based on the drawing file name and other criteria
     *   const ext = currentImageName.split('.').pop();
     *   return `${drawingFileName} - ${currentImageName || 'image'}.${ext}`;
     * }
     * ```
     */
    onImageFilePathHook: (data: {
        currentImageName: string;
        drawingFilePath: string;
    }) => string | null;
    /**
     * If set, this callback is triggered when the Excalidraw image is being exported to
     * .svg, .png, or .excalidraw.
     * You can use this callback to customize the naming and path of the images. This allows
     * you to place images into an assets folder.
     *
     * If the function returns null or undefined, the normal Excalidraw operation will continue
     * with the currentImageName and in the same folder as the Excalidraw file
     * If a filepath is returned, that will be used. Include the full Vault filepath and filename
     * with the file extension.
     * If the new folder path does not exist, excalidraw will create it - you don't need to worry about that.
     * ⚠️⚠️If an image already exists on the path, that will be overwritten. When returning
     * your own image path, you must take care of unique filenames (if that is a requirement) ⚠️⚠️
     * The current image name is the name generated by Excalidraw:
     * - my-drawing.png
     * - my-drawing.svg
     * - my-drawing.excalidraw
     * - my-drawing.dark.svg
     * - my-drawing.light.svg
     * - my-drawing.dark.png
     * - my-drawing.light.png
     *
     * @param data - An object containing the following properties:
     *   @property {string} exportFilepath - Default export filepath for the image.
     *   @property {string} exportExtension - The file extension of the export (e.g., .dark.svg, .png, .excalidraw).
     *   @property {string} excalidrawFile - TFile: The Excalidraw file being exported.
     *   @property {string} oldExcalidrawPath - If action === "move" The old path of the Excalidraw file, else undefined
     *   @property {string} action - The action being performed: "export", "move", or "delete". move and delete reference the change to the Excalidraw file.
     *
     * @returns {string} - The new filepath for the image including full vault path and extension.
     *
     * Example usage:
     * ```
     * onImageFilePathHook: (data) => {
     *   const { currentImageName, drawingFilePath, frontmatter } = data;
     *   // Generate a new filepath based on the drawing file name and other criteria
     *   const ext = currentImageName.split('.').pop();
     *   if(frontmatter && frontmatter["my-custom-field"]) {
     *   }
     *   return `${drawingFileName} - ${currentImageName || 'image'}.${ext}`;
     * }
     * ```
     */
    onImageExportPathHook: (data: {
        exportFilepath: string;
        exportExtension: string;
        excalidrawFile: TFile;
        oldExcalidrawPath?: string;
        action: "export" | "move" | "delete";
    }) => string | null;
    /**
     * Excalidraw supports auto-export of Excalidraw files to .png, .svg, and .excalidraw formats.
     *
     * Auto-export of Excalidraw files can be controlled at multiple levels.
     * 1) In plugin settings where you can set up default auto-export applicable to all your Excalidraw files.
     * 2) However, if you do not want to auto-export every file, you can also control auto-export
     *    at the file level using the 'excalidraw-autoexport' frontmatter property.
     * 3) This hook gives you an additional layer of control over the auto-export process.
     *
     * This hook is triggered when an Excalidraw file is being saved.
     *
     * interface AutoexportConfig {
     *   png: boolean; // Whether to auto-export to PNG
     *   svg: boolean; // Whether to auto-export to SVG
     *   excalidraw: boolean; // Whether to auto-export to Excalidraw format
     *   theme: "light" | "dark" | "both"; // The theme to use for the export
     * }
     *
     * @param {Object} data - The data for the hook.
     * @param {AutoexportConfig} data.autoexportConfig - The current autoexport configuration.
     * @param {TFile} data.excalidrawFile - The Excalidraw file being auto-exported.
     * @returns {AutoexportConfig | null} - Return a modified AutoexportConfig to override the export behavior, or null to use the default.
     */
    onTriggerAutoexportHook: (data: {
        autoexportConfig: AutoexportConfig;
        excalidrawFile: TFile;
    }) => AutoexportConfig | null;
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
     * Gets the elements within a specific area.
     * @param elements - The elements to check.
     * @param param1 - The area to check against.
     * @returns The elements within the area.
     */
    getElementsInArea(elements: NonDeletedExcalidrawElement[], element: NonDeletedExcalidrawElement): ExcalidrawElement[];
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

/* ************************************** */
/* lib/types/excalidrawAutomateTypes.d.ts */
/* ************************************** */
export type SVGColorInfo = Map<string, {
  mappedTo: string;
  fill: boolean;
  stroke: boolean;
}>;

export type ImageInfo = {
  mimeType: MimeType,
  id: FileId,
  dataURL: DataURL,
  created: number,
  isHyperLink?: boolean,
  hyperlink?: string,
  file?:string | TFile,
  hasSVGwithBitmap: boolean,
  latex?: string,
  size?: Size,
  colorMap?: ColorMap,
  pdfPageViewProps?: PDFPageViewProps,
}

export interface AddImageOptions {
  topX: number;
  topY: number;
  imageFile: TFile | string;
  scale?: boolean; 
  anchor?: boolean;
  colorMap?: ColorMap;
}

/* *********************** */
/* lib/types/penTypes.d.ts */
/* *********************** */
export interface StrokeOptions {
  thinning: number;
  smoothing: number;
  streamline: number;
  easing: string;
  simulatePressure?: boolean;
  start: {
      cap: boolean;
      taper: number | boolean;
      easing: string;
  };
  end: {
      cap: boolean;
      taper: number | boolean;
      easing: string;
  };
}

export interface PenOptions {
  highlighter: boolean;
  constantPressure: boolean;
  hasOutline: boolean;
  outlineWidth: number;
  options: StrokeOptions;
}

export declare type ExtendedFillStyle = "dots"|"zigzag"|"zigzag-line"|"dashed"|"hachure"|"cross-hatch"|"solid"|"";
export declare type PenType = "default" | "highlighter" | "finetip" | "fountain" | "marker" | "thick-thin" | "thin-thick-thin";

export interface PenStyle {
  type: PenType;
  freedrawOnly: boolean; 
  strokeColor?: string;
  backgroundColor?: string;
  fillStyle: ExtendedFillStyle;
  strokeWidth: number;
  roughness: number;
  penOptions: PenOptions;
}

/* ************************ */
/* lib/types/utilTypes.d.ts */
/* ************************ */
export type FILENAMEPARTS = {
  filepath: string,
  hasBlockref: boolean,
  hasGroupref: boolean,
  hasTaskbone: boolean,
  hasArearef: boolean,
  hasFrameref: boolean,
  hasClippedFrameref: boolean,
  hasSectionref: boolean,
  blockref: string,
  sectionref: string,
  linkpartReference: string,
  linkpartAlias: string
};

export enum PreviewImageType {
  PNG = "PNG",
  SVGIMG = "SVGIMG",
  SVG = "SVG"
}

export interface FrameRenderingOptions {
  enabled: boolean;
  name: boolean;
  outline: boolean;
  clip: boolean;
}

/* ****************************** */
/* lib/types/exportUtilTypes.d.ts */
/* ****************************** */
export type PDFPageAlignment = 
  | "center" 
  | "top-left" 
  | "top-center" 
  | "top-right" 
  | "bottom-left" 
  | "bottom-center" 
  | "bottom-right"
  | "center-left"
  | "center-right";
export type PDFPageMarginString = "none" | "tiny" | "normal";

export interface PDFExportScale {
  fitToPage: number; // 0 means use zoom, >1 means fit to that many pages exactly
  zoom?: number;
}

export interface PDFMargin {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface PDFPageProperties {
  dimensions?: {width: number; height: number};
  backgroundColor?: string;
  margin: PDFMargin;
  alignment: PDFPageAlignment;
}

export interface PageDimensions {
  width: number;
  height: number;
}

export type PageOrientation = "portrait" | "landscape";

// All dimensions in pixels (pt)
export const STANDARD_PAGE_SIZES = {
  A0: { width: 3179.52, height: 4494.96 }, // 33.11 × 46.81 inches
  A1: { width: 2245.76, height: 3179.52 }, // 23.39 × 33.11 inches
  A2: { width: 1587.76, height: 2245.76 }, // 16.54 × 23.39 inches
  A3: { width: 1122.56, height: 1587.76 }, // 11.69 × 16.54 inches
  A4: { width: 794.56, height: 1122.56 },  // 8.27 × 11.69 inches
  A5: { width: 559.37, height: 794.56 },   // 5.83 × 8.27 inches
  A6: { width: 397.28, height: 559.37 },   // 4.13 × 5.83 inches
  Legal: { width: 816, height: 1344 },     // 8.5 × 14 inches
  Letter: { width: 816, height: 1056 },    // 8.5 × 11 inches
  Tabloid: { width: 1056, height: 1632 },  // 11 × 17 inches
  Ledger: { width: 1632, height: 1056 },   // 17 × 11 inches
  "HD Screen": { width: 1920, height: 1080 },// 16:9 aspect ratio
  "MATCH IMAGE": { width: 0, height: 0 },    // 0 means use the current screen size
} as const;

export type PageSize = keyof typeof STANDARD_PAGE_SIZES;

export interface ExportSettings {
  withBackground: boolean;
  withTheme: boolean;
  isMask: boolean;
  frameRendering?: FrameRenderingOptions; //optional, overrides relevant appState settings for rendering the frame
  skipInliningFonts?: boolean;
}

/* ************************************** */
/* lib/types/embeddedFileLoaderTypes.d.ts */
/* ************************************** */
export const IMAGE_MIME_TYPES = {
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  ico: "image/x-icon",
  avif: "image/avif",
  jfif: "image/jfif",
} as const;

export type ImgData = {
  mimeType: MimeType;
  fileId: FileId;
  dataURL: DataURL;
  created: number;
  hasSVGwithBitmap: boolean;
  size: Size;
  pdfPageViewProps?: PDFPageViewProps;
};

export declare type MimeType = ValueOf<typeof IMAGE_MIME_TYPES> | "application/octet-stream";

export type FileData = BinaryFileData & {
  size: Size;
  hasSVGwithBitmap: boolean;
  shouldScale: boolean; //true if image should maintain its area, false if image should display at 100% its size
  pdfPageViewProps?: PDFPageViewProps;
};

export type PDFPageViewProps = {
  left: number;
  bottom: number;
  right: number;
  top: number;
  rotate?: number; //may be undefined in legacy files
}

export type Size = {
  height: number;
  width: number;
};

export interface ColorMap {
  [color: string]: string;
};

/* ************************** */
/* lib/types/AIUtilTypes.d.ts */
/* ************************** */

type MessageContent =
  | string
  | (string | { type: "image_url"; image_url: string })[];

export type GPTCompletionRequest = {
  model: string;
  messages?: {
    role?: "system" | "user" | "assistant" | "function";
    content?: MessageContent;
    name?: string | undefined;
  }[];
  functions?: any[] | undefined;
  function_call?: any | undefined;
  stream?: boolean | undefined;
  temperature?: number | undefined;
  top_p?: number | undefined;
  max_tokens?: number | undefined;
  n?: number | undefined;
  best_of?: number | undefined;
  frequency_penalty?: number | undefined;
  presence_penalty?: number | undefined;
  logit_bias?:
    | {
        [x: string]: number;
      }
    | undefined;
  stop?: (string[] | string) | undefined;
  size?: string;
  quality?: "standard" | "hd";
  prompt?: string;
  image?: string;
  mask?: string;
};

export type AIRequest = {
  image?: string;
  text?: string;
  instruction?: string;
  systemPrompt?: string;
  imageGenerationProperties?: {
    size?: string; //depends on model
    quality?: "standard" | "hd"; //depends on model
    n?: number; //dall-e-3 only accepts 1
    mask?: string; //dall-e-2 only (image editing)
  };
};

/* *************************************************************** */
/* node_modules/@zsviczian/excalidraw/types/element/src/types.d.ts */
/* *************************************************************** */
export type ChartType = "bar" | "line";
export type FillStyle = "hachure" | "cross-hatch" | "solid" | "zigzag";
export type FontFamilyKeys = keyof typeof FONT_FAMILY;
export type FontFamilyValues = typeof FONT_FAMILY[FontFamilyKeys];
export type Theme = typeof THEME[keyof typeof THEME];
export type FontString = string & {
    _brand: "fontString";
};
export type GroupId = string;
export type PointerType = "mouse" | "pen" | "touch";
export type StrokeRoundness = "round" | "sharp";
export type RoundnessType = ValueOf<typeof ROUNDNESS>;
export type StrokeStyle = "solid" | "dashed" | "dotted";
export type TextAlign = typeof TEXT_ALIGN[keyof typeof TEXT_ALIGN];
type VerticalAlignKeys = keyof typeof VERTICAL_ALIGN;
export type VerticalAlign = typeof VERTICAL_ALIGN[VerticalAlignKeys];
export type FractionalIndex = string & {
    _brand: "franctionalIndex";
};
export type BoundElement = Readonly<{
    id: ExcalidrawLinearElement["id"];
    type: "arrow" | "text";
}>;
type _ExcalidrawElementBase = Readonly<{
    id: string;
    x: number;
    y: number;
    strokeColor: string;
    backgroundColor: string;
    fillStyle: FillStyle;
    strokeWidth: number;
    strokeStyle: StrokeStyle;
    roundness: null | {
        type: RoundnessType;
        value?: number;
    };
    roughness: number;
    opacity: number;
    width: number;
    height: number;
    angle: Radians;
    /** Random integer used to seed shape generation so that the roughjs shape
        doesn't differ across renders. */
    seed: number;
    /** Integer that is sequentially incremented on each change. Used to reconcile
        elements during collaboration or when saving to server. */
    version: number;
    /** Random integer that is regenerated on each change.
        Used for deterministic reconciliation of updates during collaboration,
        in case the versions (see above) are identical. */
    versionNonce: number;
    /** String in a fractional form defined by https://github.com/rocicorp/fractional-indexing.
        Used for ordering in multiplayer scenarios, such as during reconciliation or undo / redo.
        Always kept in sync with the array order by `syncMovedIndices` and `syncInvalidIndices`.
        Could be null, i.e. for new elements which were not yet assigned to the scene. */
    index: FractionalIndex | null;
    isDeleted: boolean;
    /** List of groups the element belongs to.
        Ordered from deepest to shallowest. */
    groupIds: readonly GroupId[];
    frameId: string | null;
    /** other elements that are bound to this element */
    boundElements: readonly BoundElement[] | null;
    /** epoch (ms) timestamp of last element update */
    updated: number;
    link: string | null;
    locked: boolean;
    customData?: Record<string, any>;
}>;
export type ExcalidrawSelectionElement = _ExcalidrawElementBase & {
    type: "selection";
};
export type ExcalidrawRectangleElement = _ExcalidrawElementBase & {
    type: "rectangle";
};
export type ExcalidrawDiamondElement = _ExcalidrawElementBase & {
    type: "diamond";
};
export type ExcalidrawEllipseElement = _ExcalidrawElementBase & {
    type: "ellipse";
};
export type ExcalidrawEmbeddableElement = _ExcalidrawElementBase & Readonly<{
    type: "embeddable";
    scale: [number, number];
}>;
export type MagicGenerationData = {
    status: "pending";
} | {
    status: "done";
    html: string;
} | {
    status: "error";
    message?: string;
    code: "ERR_GENERATION_INTERRUPTED" | string;
};
export type ExcalidrawIframeElement = _ExcalidrawElementBase & Readonly<{
    type: "iframe";
    customData?: {
        generationData?: MagicGenerationData;
    };
    scale: [number, number];
}>;
export type ExcalidrawIframeLikeElement = ExcalidrawIframeElement | ExcalidrawEmbeddableElement;
export type IframeData = ({
    intrinsicSize: {
        w: number;
        h: number;
    };
    error?: Error;
    sandbox?: {
        allowSameOrigin?: boolean;
    };
} & ({
    type: "video" | "generic";
    link: string;
} | {
    type: "document";
    srcdoc: (theme: Theme) => string;
}));
export type ImageCrop = {
    x: number;
    y: number;
    width: number;
    height: number;
    naturalWidth: number;
    naturalHeight: number;
};
export type ExcalidrawImageElement = _ExcalidrawElementBase & Readonly<{
    type: "image";
    fileId: FileId | null;
    /** whether respective file is persisted */
    status: "pending" | "saved" | "error";
    /** X and Y scale factors <-1, 1>, used for image axis flipping */
    scale: [number, number];
    /** whether an element is cropped */
    crop: ImageCrop | null;
}>;
export type InitializedExcalidrawImageElement = MarkNonNullable<ExcalidrawImageElement, "fileId">;
type FrameRole = null | "marker";
export type ExcalidrawFrameElement = _ExcalidrawElementBase & {
    type: "frame";
    name: string | null;
    frameRole?: FrameRole;
    customData?: {
        frameColor?: {
            fill: string;
            stroke: string;
            nameColor: string;
        };
    };
};
export type ExcalidrawMagicFrameElement = _ExcalidrawElementBase & {
    type: "magicframe";
    name: string | null;
    frameRole?: FrameRole;
};
export type ExcalidrawFrameLikeElement = ExcalidrawFrameElement | ExcalidrawMagicFrameElement;
/**
 * These are elements that don't have any additional properties.
 */
export type ExcalidrawGenericElement = ExcalidrawSelectionElement | ExcalidrawRectangleElement | ExcalidrawDiamondElement | ExcalidrawEllipseElement;
export type ExcalidrawFlowchartNodeElement = ExcalidrawRectangleElement | ExcalidrawDiamondElement | ExcalidrawEllipseElement;
export type ExcalidrawRectanguloidElement = ExcalidrawRectangleElement | ExcalidrawImageElement | ExcalidrawTextElement | ExcalidrawFreeDrawElement | ExcalidrawIframeLikeElement | ExcalidrawFrameLikeElement | ExcalidrawEmbeddableElement | ExcalidrawSelectionElement;
/**
 * ExcalidrawElement should be JSON serializable and (eventually) contain
 * no computed data. The list of all ExcalidrawElements should be shareable
 * between peers and contain no state local to the peer.
 */
export type ExcalidrawElement = ExcalidrawGenericElement | ExcalidrawTextElement | ExcalidrawLinearElement | ExcalidrawArrowElement | ExcalidrawFreeDrawElement | ExcalidrawImageElement | ExcalidrawFrameElement | ExcalidrawMagicFrameElement | ExcalidrawIframeElement | ExcalidrawEmbeddableElement;
export type ExcalidrawNonSelectionElement = Exclude<ExcalidrawElement, ExcalidrawSelectionElement>;
export type Ordered<TElement extends ExcalidrawElement> = TElement & {
    index: FractionalIndex;
};
export type OrderedExcalidrawElement = Ordered<ExcalidrawElement>;
export type NonDeleted<TElement extends ExcalidrawElement> = TElement & {
    isDeleted: boolean;
};
export type NonDeletedExcalidrawElement = NonDeleted<ExcalidrawElement>;
export type ExcalidrawTextElement = _ExcalidrawElementBase & Readonly<{
    type: "text";
    fontSize: number;
    fontFamily: FontFamilyValues;
    text: string;
    rawText: string;
    textAlign: TextAlign;
    verticalAlign: VerticalAlign;
    containerId: ExcalidrawGenericElement["id"] | null;
    originalText: string;
    /**
     * If `true` the width will fit the text. If `false`, the text will
     * wrap to fit the width.
     *
     * @default true
     */
    autoResize: boolean;
    /**
     * Unitless line height (aligned to W3C). To get line height in px, multiply
     *  with font size (using `getLineHeightInPx` helper).
     */
    lineHeight: number & {
        _brand: "unitlessLineHeight";
    };
}>;
export type ExcalidrawBindableElement = ExcalidrawRectangleElement | ExcalidrawDiamondElement | ExcalidrawEllipseElement | ExcalidrawTextElement | ExcalidrawImageElement | ExcalidrawIframeElement | ExcalidrawEmbeddableElement | ExcalidrawFrameElement | ExcalidrawMagicFrameElement;
export type ExcalidrawTextContainer = ExcalidrawRectangleElement | ExcalidrawDiamondElement | ExcalidrawEllipseElement | ExcalidrawArrowElement;
export type ExcalidrawTextElementWithContainer = {
    containerId: ExcalidrawTextContainer["id"];
} & ExcalidrawTextElement;
export type FixedPoint = [number, number];
export type PointBinding = {
    elementId: ExcalidrawBindableElement["id"];
    focus: number;
    gap: number;
};
export type FixedPointBinding = Merge<PointBinding, {
    fixedPoint: FixedPoint;
}>;
type Index = number;
export type PointsPositionUpdates = Map<Index, {
    point: LocalPoint;
    isDragging?: boolean;
}>;
export type Arrowhead = "arrow" | "bar" | "dot" | "circle" | "circle_outline" | "triangle" | "triangle_outline" | "diamond" | "diamond_outline" | "crowfoot_one" | "crowfoot_many" | "crowfoot_one_or_many";
export type ExcalidrawLinearElement = _ExcalidrawElementBase & Readonly<{
    type: "line" | "arrow";
    points: readonly LocalPoint[];
    lastCommittedPoint: LocalPoint | null;
    startBinding: PointBinding | null;
    endBinding: PointBinding | null;
    startArrowhead: Arrowhead | null;
    endArrowhead: Arrowhead | null;
}>;
export type ExcalidrawLineElement = ExcalidrawLinearElement & Readonly<{
    type: "line";
    polygon: boolean;
}>;
export type FixedSegment = {
    start: LocalPoint;
    end: LocalPoint;
    index: Index;
};
export type ExcalidrawArrowElement = ExcalidrawLinearElement & Readonly<{
    type: "arrow";
    elbowed: boolean;
}>;
export type ExcalidrawElbowArrowElement = Merge<ExcalidrawArrowElement, {
    elbowed: true;
    startBinding: FixedPointBinding | null;
    endBinding: FixedPointBinding | null;
    fixedSegments: readonly FixedSegment[] | null;
    /**
     * Marks that the 3rd point should be used as the 2nd point of the arrow in
     * order to temporarily hide the first segment of the arrow without losing
     * the data from the points array. It allows creating the expected arrow
     * path when the arrow with fixed segments is bound on a horizontal side and
     * moved to a vertical and vica versa.
     */
    startIsSpecial: boolean | null;
    /**
     * Marks that the 3rd point backwards from the end should be used as the 2nd
     * point of the arrow in order to temporarily hide the last segment of the
     * arrow without losing the data from the points array. It allows creating
     * the expected arrow path when the arrow with fixed segments is bound on a
     * horizontal side and moved to a vertical and vica versa.
     */
    endIsSpecial: boolean | null;
}>;
export type ExcalidrawFreeDrawElement = _ExcalidrawElementBase & Readonly<{
    type: "freedraw";
    points: readonly LocalPoint[];
    pressures: readonly number[];
    simulatePressure: boolean;
    lastCommittedPoint: LocalPoint | null;
}>;
export type FileId = string & {
    _brand: "FileId";
};
export type ExcalidrawElementType = ExcalidrawElement["type"];
/**
 * Map of excalidraw elements.
 * Unspecified whether deleted or non-deleted.
 * Can be a subset of Scene elements.
 */
export type ElementsMap = Map<ExcalidrawElement["id"], ExcalidrawElement>;
/**
 * Map of non-deleted elements.
 * Can be a subset of Scene elements.
 */
export type NonDeletedElementsMap = Map<ExcalidrawElement["id"], NonDeletedExcalidrawElement> & MakeBrand<"NonDeletedElementsMap">;
/**
 * Map of all excalidraw Scene elements, including deleted.
 * Not a subset. Use this type when you need access to current Scene elements.
 */
export type SceneElementsMap = Map<ExcalidrawElement["id"], Ordered<ExcalidrawElement>> & MakeBrand<"SceneElementsMap">;
/**
 * Map of all non-deleted Scene elements.
 * Not a subset. Use this type when you need access to current Scene elements.
 */
export type NonDeletedSceneElementsMap = Map<ExcalidrawElement["id"], Ordered<NonDeletedExcalidrawElement>> & MakeBrand<"NonDeletedSceneElementsMap">;
export type ElementsMapOrArray = readonly ExcalidrawElement[] | Readonly<ElementsMap>;
export type ExcalidrawLinearElementSubType = "line" | "sharpArrow" | "curvedArrow" | "elbowArrow";
export type ConvertibleGenericTypes = "rectangle" | "diamond" | "ellipse";
export type ConvertibleLinearTypes = ExcalidrawLinearElementSubType;
export type ConvertibleTypes = ConvertibleGenericTypes | ConvertibleLinearTypes;
export {};

/* ************************************************************** */
/* node_modules/@zsviczian/excalidraw/types/excalidraw/types.d.ts */
/* ************************************************************** */
export type SocketId = string & {
    _brand: "SocketId";
};
export type Collaborator = Readonly<{
    pointer?: CollaboratorPointer;
    button?: "up" | "down";
    selectedElementIds?: AppState["selectedElementIds"];
    username?: string | null;
    userState?: UserIdleState;
    color?: {
        background: string;
        stroke: string;
    };
    avatarUrl?: string;
    id?: string;
    socketId?: SocketId;
    isCurrentUser?: boolean;
    isInCall?: boolean;
    isSpeaking?: boolean;
    isMuted?: boolean;
}>;
export type CollaboratorPointer = {
    x: number;
    y: number;
    tool: "pointer" | "laser";
    /**
     * Whether to render cursor + username. Useful when you only want to render
     * laser trail.
     *
     * @default true
     */
    renderCursor?: boolean;
    /**
     * Explicit laser color.
     *
     * @default string collaborator's cursor color
     */
    laserColor?: string;
};
export type DataURL = string & {
    _brand: "DataURL";
};
export type BinaryFileData = {
    mimeType: ValueOf<typeof IMAGE_MIME_TYPES> | typeof MIME_TYPES.binary;
    id: FileId;
    dataURL: DataURL;
    /**
     * Epoch timestamp in milliseconds
     */
    created: number;
    /**
     * Indicates when the file was last retrieved from storage to be loaded
     * onto the scene. We use this flag to determine whether to delete unused
     * files from storage.
     *
     * Epoch timestamp in milliseconds.
     */
    lastRetrieved?: number;
    /**
     * indicates the version of the file. This can be used to determine whether
     * the file dataURL has changed e.g. as part of restore due to schema update.
     */
    version?: number;
};
export type BinaryFileMetadata = Omit<BinaryFileData, "dataURL">;
export type BinaryFiles = Record<ExcalidrawElement["id"], BinaryFileData>;
export type ToolType = "selection" | "lasso" | "rectangle" | "diamond" | "ellipse" | "arrow" | "line" | "freedraw" | "text" | "image" | "eraser" | "hand" | "frame" | "magicframe" | "embeddable" | "laser" | "mermaid";
export type ElementOrToolType = ExcalidrawElementType | ToolType | "custom";
export type ActiveTool = {
    type: ToolType;
    customType: null;
} | {
    type: "custom";
    customType: string;
};
export type SidebarName = string;
export type SidebarTabName = string;
export type UserToFollow = {
    socketId: SocketId;
    username: string;
};
type _CommonCanvasAppState = {
    zoom: AppState["zoom"];
    scrollX: AppState["scrollX"];
    scrollY: AppState["scrollY"];
    width: AppState["width"];
    height: AppState["height"];
    viewModeEnabled: AppState["viewModeEnabled"];
    openDialog: AppState["openDialog"];
    editingGroupId: AppState["editingGroupId"];
    selectedElementIds: AppState["selectedElementIds"];
    frameToHighlight: AppState["frameToHighlight"];
    offsetLeft: AppState["offsetLeft"];
    offsetTop: AppState["offsetTop"];
    theme: AppState["theme"];
};
export type StaticCanvasAppState = Readonly<_CommonCanvasAppState & {
    shouldCacheIgnoreZoom: AppState["shouldCacheIgnoreZoom"];
    /** null indicates transparent bg */
    viewBackgroundColor: AppState["viewBackgroundColor"] | null;
    exportScale: AppState["exportScale"];
    selectedElementsAreBeingDragged: AppState["selectedElementsAreBeingDragged"];
    gridSize: AppState["gridSize"];
    gridStep: AppState["gridStep"];
    frameRendering: AppState["frameRendering"];
    linkOpacity: AppState["linkOpacity"];
    gridColor: AppState["gridColor"];
    gridDirection: AppState["gridDirection"];
    frameColor: AppState["frameColor"];
    currentHoveredFontFamily: AppState["currentHoveredFontFamily"];
    hoveredElementIds: AppState["hoveredElementIds"];
    croppingElementId: AppState["croppingElementId"];
}>;
export type InteractiveCanvasAppState = Readonly<_CommonCanvasAppState & {
    activeEmbeddable: AppState["activeEmbeddable"];
    selectionElement: AppState["selectionElement"];
    selectedGroupIds: AppState["selectedGroupIds"];
    selectedLinearElement: AppState["selectedLinearElement"];
    multiElement: AppState["multiElement"];
    isBindingEnabled: AppState["isBindingEnabled"];
    suggestedBindings: AppState["suggestedBindings"];
    isRotating: AppState["isRotating"];
    elementsToHighlight: AppState["elementsToHighlight"];
    collaborators: AppState["collaborators"];
    snapLines: AppState["snapLines"];
    zenModeEnabled: AppState["zenModeEnabled"];
    editingTextElement: AppState["editingTextElement"];
    gridColor: AppState["gridColor"];
    gridDirection: AppState["gridDirection"];
    highlightSearchResult: AppState["highlightSearchResult"];
    isCropping: AppState["isCropping"];
    croppingElementId: AppState["croppingElementId"];
    searchMatches: AppState["searchMatches"];
    activeLockedId: AppState["activeLockedId"];
}>;
export type ObservedAppState = ObservedStandaloneAppState & ObservedElementsAppState;
export type ObservedStandaloneAppState = {
    name: AppState["name"];
    viewBackgroundColor: AppState["viewBackgroundColor"];
};
export type ObservedElementsAppState = {
    editingGroupId: AppState["editingGroupId"];
    selectedElementIds: AppState["selectedElementIds"];
    selectedGroupIds: AppState["selectedGroupIds"];
    selectedLinearElement: {
        elementId: LinearElementEditor["elementId"];
        isEditing: boolean;
    } | null;
    croppingElementId: AppState["croppingElementId"];
    lockedMultiSelections: AppState["lockedMultiSelections"];
    activeLockedId: AppState["activeLockedId"];
};
export interface AppState {
    contextMenu: {
        items: ContextMenuItems;
        top: number;
        left: number;
    } | null;
    showWelcomeScreen: boolean;
    isLoading: boolean;
    errorMessage: React.ReactNode;
    activeEmbeddable: {
        element: NonDeletedExcalidrawElement;
        state: "hover" | "active";
    } | null;
    /**
     * for a newly created element
     * - set on pointer down, updated during pointer move, used on pointer up
     */
    newElement: NonDeleted<ExcalidrawNonSelectionElement> | null;
    /**
     * for a single element that's being resized
     * - set on pointer down when it's selected and the active tool is selection
     */
    resizingElement: NonDeletedExcalidrawElement | null;
    /**
     * multiElement is for multi-point linear element that's created by clicking as opposed to dragging
     * - when set and present, the editor will handle linear element creation logic accordingly
     */
    multiElement: NonDeleted<ExcalidrawLinearElement> | null;
    /**
     * decoupled from newElement, dragging selection only creates selectionElement
     * - set on pointer down, updated during pointer move
     */
    selectionElement: NonDeletedExcalidrawElement | null;
    isBindingEnabled: boolean;
    startBoundElement: NonDeleted<ExcalidrawBindableElement> | null;
    suggestedBindings: SuggestedBinding[];
    frameToHighlight: NonDeleted<ExcalidrawFrameLikeElement> | null;
    frameRendering: {
        enabled: boolean;
        name: boolean;
        outline: boolean;
        clip: boolean;
        markerName: boolean;
        markerEnabled: boolean;
    };
    editingFrame: string | null;
    elementsToHighlight: NonDeleted<ExcalidrawElement>[] | null;
    /**
     * set when a new text is created or when an existing text is being edited
     */
    editingTextElement: NonDeletedExcalidrawElement | null;
    activeTool: {
        /**
         * indicates a previous tool we should revert back to if we deselect the
         * currently active tool. At the moment applies to `eraser` and `hand` tool.
         */
        lastActiveTool: ActiveTool | null;
        locked: boolean;
        fromSelection: boolean;
    } & ActiveTool;
    preferredSelectionTool: {
        type: "selection" | "lasso";
        initialized: boolean;
    };
    penMode: boolean;
    penDetected: boolean;
    exportBackground: boolean;
    exportEmbedScene: boolean;
    exportWithDarkMode: boolean;
    exportScale: number;
    currentItemStrokeColor: string;
    currentItemBackgroundColor: string;
    currentItemFillStyle: ExcalidrawElement["fillStyle"];
    currentItemStrokeWidth: number;
    currentItemStrokeStyle: ExcalidrawElement["strokeStyle"];
    currentItemRoughness: number;
    currentItemOpacity: number;
    currentItemFontFamily: FontFamilyValues;
    currentItemFontSize: number;
    currentItemTextAlign: TextAlign;
    currentItemStartArrowhead: Arrowhead | null;
    currentItemEndArrowhead: Arrowhead | null;
    currentHoveredFontFamily: FontFamilyValues | null;
    currentItemRoundness: StrokeRoundness;
    currentItemArrowType: "sharp" | "round" | "elbow";
    currentItemFrameRole: ExcalidrawFrameLikeElement["frameRole"] | null;
    viewBackgroundColor: string;
    scrollX: number;
    scrollY: number;
    cursorButton: "up" | "down";
    scrolledOutside: boolean;
    name: string | null;
    isResizing: boolean;
    isRotating: boolean;
    zoom: Zoom;
    openMenu: "canvas" | "shape" | null;
    openPopup: "canvasBackground" | "elementBackground" | "elementStroke" | "fontFamily" | "compactTextProperties" | "compactStrokeStyles" | "compactOtherProperties" | "compactArrowProperties" | null;
    openSidebar: {
        name: SidebarName;
        tab?: SidebarTabName;
    } | null;
    openDialog: null | {
        name: "imageExport" | "help" | "jsonExport";
    } | {
        name: "ttd";
        tab: "text-to-diagram" | "mermaid";
    } | {
        name: "commandPalette";
    } | {
        name: "elementLinkSelector";
        sourceElementId: ExcalidrawElement["id"];
    };
    /**
     * Reflects user preference for whether the default sidebar should be docked.
     *
     * NOTE this is only a user preference and does not reflect the actual docked
     * state of the sidebar, because the host apps can override this through
     * a DefaultSidebar prop, which is not reflected back to the appState.
     */
    defaultSidebarDockedPreference: boolean;
    lastPointerDownWith: PointerType;
    selectedElementIds: Readonly<{
        [id: string]: true;
    }>;
    hoveredElementIds: Readonly<{
        [id: string]: true;
    }>;
    previousSelectedElementIds: {
        [id: string]: true;
    };
    selectedElementsAreBeingDragged: boolean;
    shouldCacheIgnoreZoom: boolean;
    toast: {
        message: string;
        closable?: boolean;
        duration?: number;
    } | null;
    zenModeEnabled: boolean;
    theme: Theme;
    /** grid cell px size */
    gridSize: number;
    gridStep: number;
    gridModeEnabled: boolean;
    viewModeEnabled: boolean;
    /** top-most selected groups (i.e. does not include nested groups) */
    selectedGroupIds: {
        [groupId: string]: boolean;
    };
    /** group being edited when you drill down to its constituent element
      (e.g. when you double-click on a group's element) */
    editingGroupId: GroupId | null;
    width: number;
    height: number;
    offsetTop: number;
    offsetLeft: number;
    fileHandle: FileSystemHandle | null;
    collaborators: Map<SocketId, Collaborator>;
    stats: {
        open: boolean;
        /** bitmap. Use `STATS_PANELS` bit values */
        panels: number;
    };
    currentChartType: ChartType;
    pasteDialog: {
        shown: false;
        data: null;
    } | {
        shown: true;
        data: Spreadsheet;
    };
    showHyperlinkPopup: false | "info" | "editor";
    linkOpacity: number;
    trayModeEnabled: boolean;
    colorPalette?: {
        canvasBackground: ColorPaletteCustom;
        elementBackground: ColorPaletteCustom;
        elementStroke: ColorPaletteCustom;
        topPicks: {
            canvasBackground: [string, string, string, string, string];
            elementStroke: [string, string, string, string, string];
            elementBackground: [string, string, string, string, string];
        };
    };
    allowWheelZoom?: boolean;
    allowPinchZoom?: boolean;
    pinnedScripts?: string[];
    customPens?: any[];
    currentStrokeOptions?: any;
    resetCustomPen?: any;
    gridColor: {
        Bold: string;
        Regular: string;
    };
    gridDirection: {
        horizontal: boolean;
        vertical: boolean;
    };
    highlightSearchResult: boolean;
    dynamicStyle: {
        [x: string]: string;
    };
    frameColor: {
        stroke: string;
        fill: string;
        nameColor: string;
    };
    invertBindingBehaviour: boolean;
    selectedLinearElement: LinearElementEditor | null;
    snapLines: readonly SnapLine[];
    originSnapOffset: {
        x: number;
        y: number;
    } | null;
    objectsSnapModeEnabled: boolean;
    /** the user's socket id & username who is being followed on the canvas */
    userToFollow: UserToFollow | null;
    /** the socket ids of the users following the current user */
    followedBy: Set<SocketId>;
    /** image cropping */
    isCropping: boolean;
    croppingElementId: ExcalidrawElement["id"] | null;
    /** null if no search matches found / search closed */
    searchMatches: Readonly<{
        focusedId: ExcalidrawElement["id"] | null;
        matches: readonly SearchMatch[];
    }> | null;
    /** the locked element/group that's active and shows unlock popup */
    activeLockedId: string | null;
    lockedMultiSelections: {
        [groupId: string]: true;
    };
    /** properties sidebar mode - determines whether to show compact or complete sidebar */
    stylesPanelMode: "compact" | "full" | "mobile" | "tray";
}
export type SearchMatch = {
    id: string;
    focus: boolean;
    matchedLines: {
        offsetX: number;
        offsetY: number;
        width: number;
        height: number;
        showOnCanvas: boolean;
    }[];
};
export type UIAppState = Omit<AppState, "suggestedBindings" | "startBoundElement" | "cursorButton" | "scrollX" | "scrollY">;
export type NormalizedZoomValue = number & {
    _brand: "normalizedZoom";
};
export type Zoom = Readonly<{
    value: NormalizedZoomValue;
}>;
export type PointerCoords = Readonly<{
    x: number;
    y: number;
}>;
export type Gesture = {
    pointers: Map<number, PointerCoords>;
    lastCenter: {
        x: number;
        y: number;
    } | null;
    initialDistance: number | null;
    initialScale: number | null;
};
export declare class GestureEvent extends UIEvent {
    readonly rotation: number;
    readonly scale: number;
}
/** @deprecated legacy: do not use outside of migration paths */
export type LibraryItem_v1 = readonly NonDeleted<ExcalidrawElement>[];
/** @deprecated legacy: do not use outside of migration paths */
type LibraryItems_v1 = readonly LibraryItem_v1[];
/** v2 library item */
export type LibraryItem = {
    id: string;
    status: "published" | "unpublished";
    elements: readonly NonDeleted<ExcalidrawElement>[];
    /** timestamp in epoch (ms) */
    created: number;
    name?: string;
    error?: string;
};
export type LibraryItems = readonly LibraryItem[];
export type LibraryItems_anyVersion = LibraryItems | LibraryItems_v1;
export type LibraryItemsSource = ((currentLibraryItems: LibraryItems) => MaybePromise<LibraryItems_anyVersion | Blob>) | MaybePromise<LibraryItems_anyVersion | Blob>;
export type ExcalidrawInitialDataState = Merge<ImportedDataState, {
    libraryItems?: MaybePromise<Required<ImportedDataState>["libraryItems"]>;
}>;
export type OnUserFollowedPayload = {
    userToFollow: UserToFollow;
    action: "FOLLOW" | "UNFOLLOW";
};
export interface ExcalidrawProps {
    onChange?: (elements: readonly OrderedExcalidrawElement[], appState: AppState, files: BinaryFiles) => void;
    onIncrement?: (event: DurableIncrement | EphemeralIncrement) => void;
    initialData?: (() => MaybePromise<ExcalidrawInitialDataState | null>) | MaybePromise<ExcalidrawInitialDataState | null>;
    excalidrawAPI?: (api: ExcalidrawImperativeAPI) => void;
    isCollaborating?: boolean;
    onPointerUpdate?: (payload: {
        pointer: {
            x: number;
            y: number;
            tool: "pointer" | "laser";
        };
        button: "down" | "up";
        pointersMap: Gesture["pointers"];
    }) => void;
    onPaste?: (data: ClipboardData, event: ClipboardEvent | null) => Promise<boolean> | boolean;
    onDrop?: (event: React.DragEvent<HTMLDivElement>) => Promise<boolean> | boolean;
    /**
     * Called when element(s) are duplicated so you can listen or modify as
     * needed.
     *
     * Called when duplicating via mouse-drag, keyboard, paste, library insert
     * etc.
     *
     * Returned elements will be used in place of the next elements
     * (you should return all elements, including deleted, and not mutate
     * the element if changes are made)
     */
    onDuplicate?: (nextElements: readonly ExcalidrawElement[], 
    /** excludes the duplicated elements */
    prevElements: readonly ExcalidrawElement[]) => ExcalidrawElement[] | void;
    renderTopLeftUI?: (isMobile: boolean, appState: UIAppState) => JSX.Element | null;
    renderTopRightUI?: (isMobile: boolean, appState: UIAppState) => JSX.Element | null;
    langCode?: Language["code"];
    viewModeEnabled?: boolean;
    zenModeEnabled?: boolean;
    gridModeEnabled?: boolean;
    objectsSnapModeEnabled?: boolean;
    libraryReturnUrl?: string;
    initState?: AppState;
    theme?: Theme;
    name?: string;
    renderCustomStats?: (elements: readonly NonDeletedExcalidrawElement[], appState: UIAppState) => JSX.Element;
    UIOptions?: Partial<UIOptions>;
    detectScroll?: boolean;
    handleKeyboardGlobally?: boolean;
    onLibraryChange?: (libraryItems: LibraryItems) => void | Promise<any>;
    autoFocus?: boolean;
    onBeforeTextEdit?: (textElement: ExcalidrawTextElement, isExistingElement: boolean) => string;
    onBeforeTextSubmit?: (textElement: ExcalidrawTextElement, nextText: string, //wrapped
    nextOriginalText: string, isDeleted: boolean) => {
        updatedNextOriginalText: string;
        nextLink: string;
    };
    generateIdForFile?: (file: File) => string | Promise<string>;
    onThemeChange?: (newTheme: string) => void;
    onViewModeChange?: (isViewModeEnabled: boolean) => void;
    generateLinkForSelection?: (id: string, type: "element" | "group") => string;
    onLinkOpen?: (element: NonDeletedExcalidrawElement, event: CustomEvent<{
        nativeEvent: MouseEvent | React.PointerEvent<HTMLCanvasElement>;
    }>) => void;
    onLinkHover?: (element: NonDeletedExcalidrawElement, event: React.PointerEvent<HTMLCanvasElement>) => void;
    onPointerDown?: (activeTool: AppState["activeTool"], pointerDownState: PointerDownState) => void;
    onPointerUp?: (activeTool: AppState["activeTool"], pointerDownState: PointerDownState) => void;
    onScrollChange?: (scrollX: number, scrollY: number, zoom: Zoom) => void;
    onUserFollow?: (payload: OnUserFollowedPayload) => void;
    children?: React.ReactNode;
    validateEmbeddable?: boolean | string[] | RegExp | RegExp[] | ((link: string) => boolean | undefined);
    renderEmbeddable?: (element: NonDeleted<ExcalidrawEmbeddableElement>, appState: AppState) => JSX.Element | null;
    renderWebview?: boolean;
    renderEmbeddableMenu?: (appState: AppState) => JSX.Element | null;
    renderMermaid?: boolean;
    onContextMenu?: (element: readonly NonDeletedExcalidrawElement[], appState: AppState, onClose: (callback?: () => void) => void) => JSX.Element | null;
    aiEnabled?: boolean;
    showDeprecatedFonts?: boolean;
    insertLinkAction?: (linkVal: string) => void;
    renderScrollbars?: boolean;
}
export type SceneData = {
    elements?: ImportedDataState["elements"];
    appState?: ImportedDataState["appState"];
    collaborators?: Map<SocketId, Collaborator>;
    captureUpdate?: CaptureUpdateActionType;
};
export type ExportOpts = {
    saveFileToDisk?: boolean;
    onExportToBackend?: (exportedElements: readonly NonDeletedExcalidrawElement[], appState: UIAppState, files: BinaryFiles) => void;
    renderCustomUI?: (exportedElements: readonly NonDeletedExcalidrawElement[], appState: UIAppState, files: BinaryFiles, canvas: HTMLCanvasElement) => JSX.Element;
};
export type CanvasActions = Partial<{
    changeViewBackgroundColor: boolean;
    clearCanvas: boolean;
    export: false | ExportOpts;
    loadScene: boolean;
    saveToActiveFile: boolean;
    toggleTheme: boolean | null;
    saveAsImage: boolean;
}>;
export type UIOptions = Partial<{
    dockedSidebarBreakpoint: number;
    canvasActions: CanvasActions;
    tools: {
        image: boolean;
    };
    /** @deprecated does nothing. Will be removed in 0.15 */
    welcomeScreen?: boolean;
}>;
export type AppProps = Merge<ExcalidrawProps, {
    UIOptions: Merge<UIOptions, {
        canvasActions: Required<CanvasActions> & {
            export: ExportOpts;
        };
    }>;
    detectScroll: boolean;
    handleKeyboardGlobally: boolean;
    isCollaborating: boolean;
    children?: React.ReactNode;
    aiEnabled: boolean;
}>;
/** A subset of App class properties that we need to use elsewhere
 * in the app, eg Manager. Factored out into a separate type to keep DRY. */
export type AppClassProperties = {
    props: AppProps;
    state: AppState;
    interactiveCanvas: HTMLCanvasElement | null;
    /** static canvas */
    canvas: HTMLCanvasElement;
    focusContainer(): void;
    library: Library;
    imageCache: Map<FileId, {
        image: HTMLImageElement | Promise<HTMLImageElement>;
        mimeType: ValueOf<typeof IMAGE_MIME_TYPES>;
    }>;
    files: BinaryFiles;
    device: App["device"];
    scene: App["scene"];
    syncActionResult: App["syncActionResult"];
    fonts: App["fonts"];
    pasteFromClipboard: App["pasteFromClipboard"];
    id: App["id"];
    onInsertElements: App["onInsertElements"];
    onExportImage: App["onExportImage"];
    lastViewportPosition: App["lastViewportPosition"];
    scrollToContent: App["scrollToContent"];
    addFiles: App["addFiles"];
    addElementsFromPasteOrLibrary: App["addElementsFromPasteOrLibrary"];
    setSelection: App["setSelection"];
    togglePenMode: App["togglePenMode"];
    toggleLock: App["toggleLock"];
    setActiveTool: App["setActiveTool"];
    setOpenDialog: App["setOpenDialog"];
    insertEmbeddableElement: App["insertEmbeddableElement"];
    onMagicframeToolSelect: App["onMagicframeToolSelect"];
    getName: App["getName"];
    dismissLinearEditor: App["dismissLinearEditor"];
    flowChartCreator: App["flowChartCreator"];
    getEffectiveGridSize: App["getEffectiveGridSize"];
    setPlugins: App["setPlugins"];
    plugins: App["plugins"];
    getEditorUIOffsets: App["getEditorUIOffsets"];
    visibleElements: App["visibleElements"];
    excalidrawContainerValue: App["excalidrawContainerValue"];
    onPointerUpEmitter: App["onPointerUpEmitter"];
    updateEditorAtom: App["updateEditorAtom"];
    onPointerDownEmitter: App["onPointerDownEmitter"];
};
export type PointerDownState = Readonly<{
    origin: Readonly<{
        x: number;
        y: number;
    }>;
    originInGrid: Readonly<{
        x: number;
        y: number;
    }>;
    scrollbars: ReturnType<typeof isOverScrollBars>;
    lastCoords: {
        x: number;
        y: number;
    };
    originalElements: Map<string, NonDeleted<ExcalidrawElement>>;
    resize: {
        handleType: MaybeTransformHandleType;
        isResizing: boolean;
        offset: {
            x: number;
            y: number;
        };
        arrowDirection: "origin" | "end";
        center: {
            x: number;
            y: number;
        };
    };
    hit: {
        element: NonDeleted<ExcalidrawElement> | null;
        allHitElements: NonDeleted<ExcalidrawElement>[];
        wasAddedToSelection: boolean;
        hasBeenDuplicated: boolean;
        hasHitCommonBoundingBoxOfSelectedElements: boolean;
    };
    withCmdOrCtrl: boolean;
    drag: {
        hasOccurred: boolean;
        offset: {
            x: number;
            y: number;
        } | null;
        origin: {
            x: number;
            y: number;
        };
        blockDragging: boolean;
    };
    eventListeners: {
        onMove: null | ReturnType<typeof throttleRAF>;
        onUp: null | ((event: PointerEvent) => void);
        onKeyDown: null | ((event: KeyboardEvent) => void);
        onKeyUp: null | ((event: KeyboardEvent) => void);
    };
    boxSelection: {
        hasOccurred: boolean;
    };
}>;
export type UnsubscribeCallback = () => void;
export interface ExcalidrawImperativeAPI {
    updateScene: InstanceType<typeof App>["updateScene"];
    applyDeltas: InstanceType<typeof App>["applyDeltas"];
    mutateElement: InstanceType<typeof App>["mutateElement"];
    updateLibrary: InstanceType<typeof Library>["updateLibrary"];
    resetScene: InstanceType<typeof App>["resetScene"];
    getSceneElementsIncludingDeleted: InstanceType<typeof App>["getSceneElementsIncludingDeleted"];
    getSceneElementsMapIncludingDeleted: InstanceType<typeof App>["getSceneElementsMapIncludingDeleted"];
    history: {
        clear: InstanceType<typeof App>["resetHistory"];
    };
    setForceRenderAllEmbeddables: InstanceType<typeof App>["setForceRenderAllEmbeddables"];
    zoomToFit: InstanceType<typeof App>["zoomToFit"];
    refreshEditorBreakpoints: InstanceType<typeof App>["refreshEditorBreakpoints"];
    getColorAtScenePoint: InstanceType<typeof App>["getColorAtScenePoint"];
    startLineEditor: InstanceType<typeof App>["startLineEditor"];
    getSceneElements: InstanceType<typeof App>["getSceneElements"];
    getAppState: () => InstanceType<typeof App>["state"];
    getFiles: () => InstanceType<typeof App>["files"];
    getName: InstanceType<typeof App>["getName"];
    scrollToContent: InstanceType<typeof App>["scrollToContent"];
    registerAction: (action: Action) => void;
    refresh: InstanceType<typeof App>["refresh"];
    setToast: InstanceType<typeof App>["setToast"];
    addFiles: (data: BinaryFileData[]) => void;
    updateContainerSize: InstanceType<typeof App>["updateContainerSize"];
    id: string;
    selectElements: (elements: readonly ExcalidrawElement[], highlightSearchResult?: boolean) => void;
    sendBackward: (elements: readonly ExcalidrawElement[]) => void;
    bringForward: (elements: readonly ExcalidrawElement[]) => void;
    sendToBack: (elements: readonly ExcalidrawElement[]) => void;
    bringToFront: (elements: readonly ExcalidrawElement[]) => void;
    setMobileModeAllowed: (allow: boolean) => void;
    setActiveTool: InstanceType<typeof App>["setActiveTool"];
    setCursor: InstanceType<typeof App>["setCursor"];
    resetCursor: InstanceType<typeof App>["resetCursor"];
    toggleSidebar: InstanceType<typeof App>["toggleSidebar"];
    getHTMLIFrameElement: InstanceType<typeof App>["getHTMLIFrameElement"];
    /**
     * Disables rendering of frames (including element clipping), but currently
     * the frames are still interactive in edit mode. As such, this API should be
     * used in conjunction with view mode (props.viewModeEnabled).
     */
    updateFrameRendering: InstanceType<typeof App>["updateFrameRendering"];
    onChange: (callback: (elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) => void) => UnsubscribeCallback;
    onIncrement: (callback: (event: DurableIncrement | EphemeralIncrement) => void) => UnsubscribeCallback;
    onPointerDown: (callback: (activeTool: AppState["activeTool"], pointerDownState: PointerDownState, event: React.PointerEvent<HTMLElement>) => void) => UnsubscribeCallback;
    onPointerUp: (callback: (activeTool: AppState["activeTool"], pointerDownState: PointerDownState, event: PointerEvent) => void) => UnsubscribeCallback;
    onScrollChange: (callback: (scrollX: number, scrollY: number, zoom: Zoom) => void) => UnsubscribeCallback;
    onUserFollow: (callback: (payload: OnUserFollowedPayload) => void) => UnsubscribeCallback;
}
export type Device = Readonly<{
    viewport: {
        isMobile: boolean;
        isLandscape: boolean;
    };
    editor: {
        isMobile: boolean;
        canFitSidebar: boolean;
    };
    isTouchScreen: boolean;
}>;
export type FrameNameBounds = {
    x: number;
    y: number;
    width: number;
    height: number;
    angle: number;
};
export type FrameNameBoundsCache = {
    get: (frameElement: ExcalidrawFrameLikeElement | ExcalidrawMagicFrameElement) => FrameNameBounds | null;
    _cache: Map<string, FrameNameBounds & {
        zoom: AppState["zoom"]["value"];
        versionNonce: ExcalidrawFrameLikeElement["versionNonce"];
    }>;
};
export type KeyboardModifiersObject = {
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    metaKey: boolean;
};
export type Primitive = number | string | boolean | bigint | symbol | null | undefined;
export type JSONValue = string | number | boolean | null | object;
export type EmbedsValidationStatus = Map<ExcalidrawIframeLikeElement["id"], boolean>;
export type ElementsPendingErasure = Set<ExcalidrawElement["id"]>;
export type PendingExcalidrawElements = ExcalidrawElement[];
/** Runtime gridSize value. Null indicates disabled grid. */
export type NullableGridSize = (AppState["gridSize"] & MakeBrand<"NullableGridSize">) | null;
export type GenerateDiagramToCode = (props: {
    frame: ExcalidrawMagicFrameElement;
    children: readonly ExcalidrawElement[];
}) => MaybePromise<{
    html: string;
}>;
export type Offsets = Partial<{
    top: number;
    right: number;
    bottom: number;
    left: number;
}>;
export {};

```