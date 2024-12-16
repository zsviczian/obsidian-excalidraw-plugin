import { RestoredDataState } from "@zsviczian/excalidraw/types/excalidraw/data/restore";
import { ImportedDataState } from "@zsviczian/excalidraw/types/excalidraw/data/types";
import { BoundingBox } from "@zsviczian/excalidraw/types/excalidraw/element/bounds";
import { ElementsMap, ExcalidrawBindableElement, ExcalidrawElement, ExcalidrawFrameElement, ExcalidrawFrameLikeElement, ExcalidrawTextContainer, ExcalidrawTextElement, FontFamilyValues, FontString, NonDeleted, NonDeletedExcalidrawElement, Theme } from "@zsviczian/excalidraw/types/excalidraw/element/types";
import { FontMetadata } from "@zsviczian/excalidraw/types/excalidraw/fonts/FontMetadata";
import { AppState, BinaryFiles, DataURL, GenerateDiagramToCode, Zoom } from "@zsviczian/excalidraw/types/excalidraw/types";
import { Mutable } from "@zsviczian/excalidraw/types/excalidraw/utility-types";
import { GlobalPoint } from "@zsviczian/excalidraw/types/math/types";

interface MermaidConfig {
  /**
   * Whether to start the diagram automatically when the page loads.
   * @default false
   */
  startOnLoad?: boolean;
  /**
   * The flowchart curve style.
   * @default "linear"
   */
  flowchart?: {
      curve?: "linear" | "basis";
  };
  /**
   * Theme variables
   * @default { fontSize: "25px" }
   */
  themeVariables?: {
      fontSize?: string;
  };
  /**
   * Maximum number of edges to be rendered.
   * @default 1000
   */
  maxEdges?: number;
  /**
   * Maximum number of characters to be rendered.
   * @default 1000
   */
  maxTextSize?: number;
}

type EmbeddedLink =
  | ({
      aspectRatio: { w: number; h: number };
      warning?: string;
    } & (
      | { type: "video" | "generic"; link: string }
      | { type: "document"; srcdoc: (theme: Theme) => string }
    ))
  | null;

declare namespace ExcalidrawLib {
  type ElementUpdate<TElement extends ExcalidrawElement> = Omit<
    Partial<TElement>,
    "id" | "version" | "versionNonce"
  >;

  type ExportOpts = {
    elements: readonly NonDeleted<ExcalidrawElement>[];
    appState?: Partial<Omit<AppState, "offsetTop" | "offsetLeft">>;
    files: BinaryFiles | null;
    maxWidthOrHeight?: number;
    exportingFrame?: ExcalidrawFrameLikeElement | null;
    getDimensions?: (
      width: number,
      height: number,
    ) => { width: number; height: number; scale?: number };
  };

  function restore(
    data: Pick<ImportedDataState, "appState" | "elements" | "files"> | null,
    localAppState: Partial<AppState> | null | undefined,
    localElements: readonly ExcalidrawElement[] | null | undefined,
    elementsConfig?: { refreshDimensions?: boolean; repairBindings?: boolean },
  ): RestoredDataState;

  function exportToSvg(opts: Omit<ExportOpts, "getDimensions"> & {
    elements: ExcalidrawElement[];
    appState?: AppState;
    files?: any;
    exportPadding?: number;
    exportingFrame: ExcalidrawFrameElement | null | undefined;
    renderEmbeddables?: boolean;
    skipInliningFonts?: boolean;
  }): Promise<SVGSVGElement>;

  function sceneCoordsToViewportCoords(
    sceneCoords: { sceneX: number; sceneY: number },
    viewParams: {
      zoom: Zoom;
      offsetLeft: number;
      offsetTop: number;
      scrollX: number;
      scrollY: number;
    },
  ): { x: number; y: number };

  function viewportCoordsToSceneCoords(
    viewportCoords: { clientX: number; clientY: number },
    viewParams: {
      zoom: Zoom;
      offsetLeft: number;
      offsetTop: number;
      scrollX: number;
      scrollY: number;
    },
  ): { x: number; y: number };

  function determineFocusDistance(
    element: ExcalidrawBindableElement,
    a: GlobalPoint,
    b: GlobalPoint,
  ): number;

  function intersectElementWithLine(
    element: ExcalidrawBindableElement,
    a: GlobalPoint,
    b: GlobalPoint,
    gap?: number,
  ): GlobalPoint[];

  function getCommonBoundingBox(
    elements: ExcalidrawElement[] | readonly NonDeleted<ExcalidrawElement>[],
  ): BoundingBox;

  function getContainerElement(
    element: ExcalidrawTextElement | null,
    elementsMap: ElementsMap,
  ): ExcalidrawTextContainer | null;

  function refreshTextDimensions(
    textElement: ExcalidrawTextElement,
    container: ExcalidrawTextContainer | null,
    elementsMap: ElementsMap,
    text: string,
  ): {
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
  };

  function getMaximumGroups(
    elements: ExcalidrawElement[],
    elementsMap: ElementsMap,
  ): ExcalidrawElement[][];

  function measureText(
    text: string,
    font: FontString,
    lineHeight: number,
  ): { width: number; height: number; };

  function getLineHeight (fontFamily: FontFamilyValues):number;
  function wrapText(text: string, font: FontString, maxWidth: number): string;

  function getFontString({
    fontSize,
    fontFamily,
  }: {
    fontSize: number;
    fontFamily: FontFamilyValues;
  }): FontString;


  function getFontFamilyString ({
    fontFamily,
  }: {
    fontFamily: number;
  }): string;

  function getBoundTextMaxWidth(container: ExcalidrawElement): number;

  function exportToBlob(
    opts: ExportOpts & {
      mimeType?: string;
      quality?: number;
      exportPadding?: number;
    },
  ): Promise<Blob>;

  function mutateElement<TElement extends Mutable<ExcalidrawElement>>(
    element: TElement,
    updates: ElementUpdate<TElement>,
    informMutation?: boolean,
  ): TElement;  

  function getEmbedLink (link: string | null | undefined): EmbeddedLink;

  function mermaidToExcalidraw(
    mermaidDefinition: string,
    opts: MermaidConfig,
    forceSVG?: boolean,
  ): Promise<{
    elements?: ExcalidrawElement[];
    files?: any;
    error?: string;
  } | undefined>;

  var getSceneVersion: any;
  var Excalidraw: any;
  var MainMenu: any;
  var WelcomeScreen: any;
  var TTDDialogTrigger: any;
  var TTDDialog: any;
  var DiagramToCodePlugin: (props: {
    generate: GenerateDiagramToCode;
  }) => any;
  
  function getDataURL(file: Blob | File): Promise<DataURL>;
  function destroyObsidianUtils(): void;
  function registerLocalFont(fontMetrics: FontMetadata, uri: string): void;
  function getFontFamilies(): string[];
  function registerFontsInCSS(): Promise<void>;
  function getCSSFontDefinition(fontFamily: number): Promise<string>;
  function getTextFromElements (
    elements: readonly ExcalidrawElement[],
    separator?: string,
  ): string;
  function safelyParseJSON (json: string): Record<string, any> | null;
  function loadSceneFonts(elements: NonDeletedExcalidrawElement[]): Promise<void>;
  function loadMermaid(): Promise<any>;
}

