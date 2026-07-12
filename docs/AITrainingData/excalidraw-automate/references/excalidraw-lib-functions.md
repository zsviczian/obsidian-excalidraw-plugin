# ExcalidrawLib module functions

The following functions are exposed via window.ExcalidrawLib. Signatures are extracted from TypeScript declarations.

```ts
/* ************************************** */
/* @excalidraw/element -> node_modules/@zsviczian/excalidraw/types/element/src/index.d.ts */
/* ************************************** */
export declare const getNonDeletedElements: <T extends ExcalidrawElement>(elements: readonly T[]) => readonly NonDeleted<T>[];
export declare const getSceneVersion: (elements: readonly ExcalidrawElement[]) => number;
export declare const hashElementsVersion: (elements: ElementsMapOrArray) => number;
export declare const hashString: (s: string) => number;

/* ************************************** */
/* ./i18n -> node_modules/@zsviczian/excalidraw/types/excalidraw/i18n.d.ts */
/* ************************************** */
export declare const defaultLang: {
    code: string;
    label: string;
};
export declare const languages: Language[];
export declare const setLanguage: (lang: Language) => Promise<void>;
export declare const languages: Language[];
export declare const setLanguage: (lang: Language) => Promise<void>;
export declare const useI18n: () => {
    t: (path: NestedKeyOf<typeof fallbackLangData>, replacement?: {
        [key: string]: string | number;

/* ************************************** */
/* ./data/restore -> node_modules/@zsviczian/excalidraw/types/excalidraw/data/restore.d.ts */
/* ************************************** */
export declare const restoreAppState: (appState: ImportedDataState["appState"], localAppState: Partial<AppState> | null | undefined) => RestoredAppState;
export declare const restoreElement: (
/** element to be restored */
element: Exclude<ExcalidrawElement, ExcalidrawSelectionElement>, 
/** all elements to be restored */
targetElementsMap: Readonly<ElementsMap>, 
/** used for additional context */
existingElementsMap: Readonly<ElementsMap> | null | undefined, opts?: {
    deleteInvisibleElements?: boolean;
}) => typeof element | null;
export declare const restoreElements: <T extends ExcalidrawElement>(targetElements: readonly T[] | undefined | null, 
/** used for additional context (e.g. repairing arrow bindings) */
existingElements: Readonly<ElementsMapOrArray> | null | undefined, opts?: {
    refreshDimensions?: boolean;
    repairBindings?: boolean;
    deleteInvisibleElements?: boolean;
} | undefined) => CombineBrandsIfNeeded<T, OrderedExcalidrawElement>;
export declare const restoreLibraryItems: (libraryItems: ImportedDataState["libraryItems"], defaultStatus: LibraryItem["status"]) => LibraryItem[];

/* ************************************** */
/* ./data/reconcile -> node_modules/@zsviczian/excalidraw/types/excalidraw/data/reconcile.d.ts */
/* ************************************** */
export declare const reconcileElements: (localElements: readonly OrderedExcalidrawElement[], remoteElements: readonly RemoteExcalidrawElement[], localAppState: AppState) => ReconciledExcalidrawElement[];

/* ************************************** */
/* @excalidraw/utils/export -> node_modules/@zsviczian/excalidraw/types/utils/src/export.d.ts */
/* ************************************** */
export declare const exportToBlob: (opts: ExportOpts & {
    mimeType?: string;
    quality?: number;
    exportPadding?: number;
}) => Promise<Blob>;
export declare const exportToCanvas: ({ elements, appState, files, maxWidthOrHeight, getDimensions, exportPadding, exportingFrame, }: ExportOpts & {
    exportPadding?: number;
}) => Promise<HTMLCanvasElement>;
export declare const exportToClipboard: (opts: ExportOpts & {
    mimeType?: string;
    quality?: number;
    type: "png" | "svg" | "json";
}) => Promise<void>;
export declare const exportToSvg: ({ elements, appState, files, exportPadding, renderEmbeddables, exportingFrame, skipInliningFonts, reuseImages, }: Omit<ExportOpts, "getDimensions"> & {
    exportPadding?: number;
    renderEmbeddables?: boolean;
    skipInliningFonts?: true;
    reuseImages?: boolean;
}) => Promise<SVGSVGElement>;

/* ************************************** */
/* @excalidraw/element/bounds -> node_modules/@zsviczian/excalidraw/types/element/src/bounds.d.ts */
/* ************************************** */
export declare const getCommonBoundingBox: (elements: readonly ExcalidrawElement[] | readonly NonDeleted<ExcalidrawElement>[]) => BoundingBox;

/* ************************************** */
/* @excalidraw/element/groups -> node_modules/@zsviczian/excalidraw/types/element/src/groups.d.ts */
/* ************************************** */
export declare const getMaximumGroups: (elements: ExcalidrawElement[], elementsMap: ElementsMap) => ExcalidrawElement[][];

/* ************************************** */
/* @excalidraw/element/textMeasurements -> node_modules/@zsviczian/excalidraw/types/element/src/textMeasurements.d.ts */
/* ************************************** */
export declare const measureText: (text: string, font: FontString, lineHeight: ExcalidrawTextElement["lineHeight"]) => {
    width: number;

/* ************************************** */
/* @excalidraw/element/textWrapping -> node_modules/@zsviczian/excalidraw/types/element/src/textWrapping.d.ts */
/* ************************************** */
export declare const wrapText: (text: string, font: FontString, maxWidth: number) => string;

/* ************************************** */
/* @excalidraw/element/textElement -> node_modules/@zsviczian/excalidraw/types/element/src/textElement.d.ts */
/* ************************************** */
export declare const getBoundTextMaxWidth: (container: ExcalidrawElement, boundTextElement: ExcalidrawTextElement | null) => number;
export declare const getContainerElement: (element: ExcalidrawTextElement | null, elementsMap: ElementsMap) => ExcalidrawTextContainer | null;

/* ************************************** */
/* ./components/TTDDialog/MermaidToExcalidrawLib -> node_modules/@zsviczian/excalidraw/types/excalidraw/components/TTDDialog/MermaidToExcalidrawLib.d.ts */
/* ************************************** */
export declare const mermaidToExcalidraw: (mermaidDefinition: string, opts: MermaidConfig) => Promise<{
    elements?: ExcalidrawElement[];

/* ************************************** */
/* ../excalidraw/obsidianUtils -> node_modules/@zsviczian/excalidraw/types/excalidraw/obsidianUtils.d.ts */
/* ************************************** */
export declare function getCSSFontDefinition(fontFamily: number): Promise<string>;
export declare const getDefaultColorPalette: () => readonly (readonly [string, string, string, string, string])[];
export declare function getFontFamilies(): string[];
export declare function getFontMetrics(fontFamily: ExcalidrawTextElement["fontFamily"], fontSize?: number): {
    unitsPerEm: number;
export declare function getSharedMermaidInstance(): Promise<MermaidToExcalidrawLibProps>;
export declare const intersectElementWithLine: (element: ExcalidrawElement, a: GlobalPoint, b: GlobalPoint, gap: number | undefined, elementsMap: ElementsMap) => GlobalPoint[] | undefined;
export declare function loadMermaid(): Promise<MermaidToExcalidrawLibProps>;
export declare function loadSceneFonts(elements: NonDeletedExcalidrawElement[]): Promise<FontFace[]>;
export declare function registerFontsInCSS(): Promise<void>;
export declare function registerLocalFont(fontMetrics: FontMetadata & {
    name: string;

/* ************************************** */
/* @excalidraw/element/newElement -> node_modules/@zsviczian/excalidraw/types/element/src/newElement.d.ts */
/* ************************************** */
export declare const refreshTextDimensions: (textElement: ExcalidrawTextElement, container: ExcalidrawTextContainer | null, elementsMap: ElementsMap, text?: string) => {
    x: number;

/* ************************************** */
/* ./data/json -> node_modules/@zsviczian/excalidraw/types/excalidraw/data/json.d.ts */
/* ************************************** */
export declare const serializeAsJSON: (elements: readonly ExcalidrawElement[], appState: Partial<AppState>, files: BinaryFiles, type: "local" | "database") => string;
export declare const serializeLibraryAsJSON: (libraryItems: LibraryItems) => string;

/* ************************************** */
/* ./data/blob -> node_modules/@zsviczian/excalidraw/types/excalidraw/data/blob.d.ts */
/* ************************************** */
export declare const getDataURL: (file: Blob | File) => Promise<DataURL>;
export declare const loadFromBlob: (blob: Blob, 
/** @see restore.localAppState */
localAppState: AppState | null, localElements: readonly ExcalidrawElement[] | null, 
/** FileSystemFileHandle. Defaults to `blob.handle` if defined, otherwise null. */
fileHandle?: FileSystemFileHandle | null) => Promise<{
    elements: import("@excalidraw/element/types").OrderedExcalidrawElement[];
export declare const loadLibraryFromBlob: (blob: Blob, defaultStatus?: LibraryItem["status"]) => Promise<LibraryItem[]>;
export declare const loadSceneOrLibraryFromBlob: (blob: Blob | File, 
/** @see restore.localAppState */
localAppState: AppState | null, localElements: readonly ExcalidrawElement[] | null, 
/** FileSystemFileHandle. Defaults to `blob.handle` if defined, otherwise null. */
fileHandle?: FileSystemFileHandle | null) => Promise<{
    type: "application/vnd.excalidraw+json";

/* ************************************** */
/* ./data/library -> node_modules/@zsviczian/excalidraw/types/excalidraw/data/library.d.ts */
/* ************************************** */
export declare const getLibraryItemsHash: (items: LibraryItems) => number;
export declare const mergeLibraryItems: (localItems: LibraryItems, otherItems: LibraryItems) => LibraryItems;
export declare const parseLibraryTokensFromUrl: () => {
    libraryUrl: string;
export declare const useHandleLibrary: (opts: {
    excalidrawAPI: ExcalidrawImperativeAPI | null;
    /**
     * Return `true` if the library install url should be allowed.
     * If not supplied, only the excalidraw.com base domain is allowed.
     */
    validateLibraryUrl?: (libraryUrl: string) => boolean;

/* ************************************** */
/* @excalidraw/element/embeddable -> node_modules/@zsviczian/excalidraw/types/element/src/embeddable.d.ts */
/* ************************************** */
export declare const getEmbedLink: (link: string | null | undefined) => IframeDataWithSandbox | null;

/* ************************************** */
/* ./components/Sidebar/Sidebar -> node_modules/@zsviczian/excalidraw/types/excalidraw/components/Sidebar/Sidebar.d.ts */
/* ************************************** */
export declare const Sidebar: React.ForwardRefExoticComponent<{
    name: import("../../types").SidebarName;
    children: React.ReactNode;
    onStateChange?: (state: import("../../types").AppState["openSidebar"]) => void;

/* ************************************** */
/* ./components/Button -> node_modules/@zsviczian/excalidraw/types/excalidraw/components/Button.d.ts */
/* ************************************** */
export declare const Button: ({ type, onSelect, selected, children, className, ...rest }: ButtonProps) => import("react/jsx-runtime").JSX.Element;

/* ************************************** */
/* ./components/App -> node_modules/@zsviczian/excalidraw/types/excalidraw/components/App.d.ts */
/* ************************************** */
export declare const ExcalidrawAPIContext: React.Context<ExcalidrawImperativeAPI | null>;
export declare const ExcalidrawAPISetContext: React.Context<((api: ExcalidrawImperativeAPI | null) => void) | null>;
export declare const useEditorInterface: () => Readonly<{
    formFactor: "phone" | "tablet" | "desktop";
export declare const useExcalidrawAPI: () => ExcalidrawImperativeAPI | null;
export declare const useStylesPanelMode: () => StylesPanelMode;

/* ************************************** */
/* ./components/DefaultSidebar -> node_modules/@zsviczian/excalidraw/types/excalidraw/components/DefaultSidebar.d.ts */
/* ************************************** */
export declare const DefaultSidebar: import("react").FC<Omit<MarkOptional<Omit<{
    name: import("../types").SidebarName;
    children: React.ReactNode;
    onStateChange?: (state: import("../types").AppState["openSidebar"]) => void;

/* ************************************** */
/* ./components/TTDDialog/TTDDialog -> node_modules/@zsviczian/excalidraw/types/excalidraw/components/TTDDialog/TTDDialog.d.ts */
/* ************************************** */
export declare const TTDDialog: {
    (props: {
        onTextSubmit: TTTDDialog.onTextSubmit;
        renderWelcomeScreen?: TTTDDialog.renderWelcomeScreen;
        renderWarning?: TTTDDialog.renderWarning;
        persistenceAdapter: TTDPersistenceAdapter;
    } | {
        __fallback: true;
    }): import("react/jsx-runtime").JSX.Element | null;
    WelcomeMessage: () => import("react/jsx-runtime").JSX.Element;

/* ************************************** */
/* ./components/TTDDialog/utils/TTDStreamFetch -> node_modules/@zsviczian/excalidraw/types/excalidraw/components/TTDDialog/utils/TTDStreamFetch.d.ts */
/* ************************************** */
export declare function TTDStreamFetch(options: StreamingOptions): Promise<TTTDDialog.OnTextSubmitRetValue>;

/* ************************************** */
/* ./actions/actionCanvas -> node_modules/@zsviczian/excalidraw/types/excalidraw/actions/actionCanvas.d.ts */
/* ************************************** */
export declare const zoomToFitBounds: ({ bounds, appState, canvasOffsets, fitToViewport, viewportZoomFactor, minZoom, maxZoom, }: {
    bounds: SceneBounds;
    canvasOffsets?: Offsets;
    appState: Readonly<AppState>;
    /** whether to fit content to viewport (beyond >100%) */
    fitToViewport: boolean;
    /** zoom content to cover X of the viewport, when fitToViewport=true */
    viewportZoomFactor?: number;
    minZoom?: number;
    maxZoom?: number;
}) => {
    appState: {
        scrollX: number;

/* ************************************** */
/* ./components/DiagramToCodePlugin/DiagramToCodePlugin -> node_modules/@zsviczian/excalidraw/types/excalidraw/components/DiagramToCodePlugin/DiagramToCodePlugin.d.ts */
/* ************************************** */
export declare const DiagramToCodePlugin: (props: {
    generate: GenerateDiagramToCode;
}) => null;

/* ************************************** */
/* ./components/CommandPalette/CommandPalette -> node_modules/@zsviczian/excalidraw/types/excalidraw/components/CommandPalette/CommandPalette.d.ts */
/* ************************************** */
export declare const CommandPalette: ((props: CommandPaletteProps) => import("react/jsx-runtime").JSX.Element | null) & {
    defaultItems: typeof defaultItems;
```
