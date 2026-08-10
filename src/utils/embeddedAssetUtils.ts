import type { TFile, App } from "obsidian";
import { FRONTMATTER_KEYS } from "src/constants/constants";
import type ExcalidrawPlugin from "src/core/main";
import Pool from "es6-promise-pool";
import { getDataURL } from "./coreUtils";

export { getEmbeddedFilenameParts } from "./embeddedFilenameParts";

/**
 * Loads a vault font and creates its data URL and `@font-face` definition.
 *
 * @param app - Obsidian application used to resolve and read the font file.
 * @param fontFileName - Vault link path or font filename to resolve.
 * @param sourcePath - Vault path from which the font link is resolved.
 * @param name - Optional font-family name overriding the file basename.
 * @returns The font definition, resolved family name, encoded data URL, and
 * original buffer. Empty strings and a null buffer are returned when the font
 * cannot be resolved.
 * @remarks
 * MIME types and CSS format names intentionally preserve the established
 * extension mapping used by plugin startup and embedded SVG font loading.
 */
export async function getFontDataURL(
  app: App,
  fontFileName: string,
  sourcePath: string,
  name?: string,
): Promise<{
  fontDef: string;
  fontName: string;
  dataURL: string;
  arrayBuffer: ArrayBuffer | null;
}> {
  let fontDef = "";
  let fontName = "";
  let dataURL = "";
  let arrayBuffer: ArrayBuffer | null = null;
  const f = app.metadataCache.getFirstLinkpathDest(fontFileName, sourcePath);
  if (f) {
    arrayBuffer = await app.vault.readBinary(f);
    let mimeType = "";
    let format = "";

    switch (f.extension) {
      case "woff":
        mimeType = "application/font-woff";
        format = "woff";
        break;
      case "woff2":
        mimeType = "font/woff2";
        format = "woff2";
        break;
      case "ttf":
        mimeType = "font/ttf";
        format = "truetype";
        break;
      case "otf":
        mimeType = "font/otf";
        format = "opentype";
        break;
      default:
        mimeType = "application/octet-stream";
    }
    fontName = name ?? f.basename;
    dataURL = await getDataURL(arrayBuffer, mimeType);
    const split = dataURL.split(";base64,", 2);
    dataURL = `${split[0]};charset=utf-8;base64,${split[1]}`;
    fontDef = ` @font-face {font-family: "${fontName}";src: url("${dataURL}") format("${format}")}`;
  }
  return { fontDef, fontName, dataURL, arrayBuffer };
}

/**
 * Encodes SVG markup as a base64 data URL.
 *
 * @param svg - Serialized SVG markup.
 * @returns A base64-encoded `data:image/svg+xml` URL.
 * @remarks
 * Literal `&nbsp;` entities are converted to spaces before encoding because
 * they are not valid predefined XML entities. URI encoding is converted to a
 * byte string before `btoa()` so non-Latin text remains UTF-8 safe.
 */
export function svgToBase64(svg: string): string {
  const cleanSvg = svg.replaceAll("&nbsp;", " ");
  const encodedData = encodeURIComponent(cleanSvg).replace(
    /%([0-9A-F]{2})/g,
    (_match: string, hexByte: string) =>
      String.fromCharCode(parseInt(hexByte, 16)),
  );
  return `data:image/svg+xml;base64,${btoa(encodedData)}`;
}

/**
 * Loads an image source and reports its intrinsic dimensions.
 *
 * @param src - Image URL, blob URL, or data URL accepted by `HTMLImageElement`.
 * @returns The image's natural width and height after it loads.
 * @throws Rejects with the browser image error when loading fails.
 * @remarks
 * This intentionally preserves native image loading behavior without adding a
 * timeout, cross-origin mode, or rendered-size fallback.
 */
export async function getImageSize(
  src: string,
): Promise<{ height: number; width: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({ height: img.naturalHeight, width: img.naturalWidth });
    img.onerror = reject;
    img.src = src;
  });
}

export function isMaskFile(plugin: ExcalidrawPlugin, file: TFile): boolean {
  if (file) {
    const fileCache = plugin.app.metadataCache.getFileCache(file);
    if (
      fileCache?.frontmatter &&
      fileCache.frontmatter[FRONTMATTER_KEYS.mask.name] !== null &&
      typeof fileCache.frontmatter[FRONTMATTER_KEYS.mask.name] !== "undefined"
    ) {
      return Boolean(fileCache.frontmatter[FRONTMATTER_KEYS.mask.name]);
    }
  }
  return false;
}

export function hasExportBackground(
  plugin: ExcalidrawPlugin,
  file: TFile,
): boolean {
  if (file) {
    const fileCache = plugin.app.metadataCache.getFileCache(file);
    if (
      fileCache?.frontmatter &&
      fileCache.frontmatter[FRONTMATTER_KEYS["export-transparent"].name] !==
        null &&
      typeof fileCache.frontmatter[
        FRONTMATTER_KEYS["export-transparent"].name
      ] !== "undefined"
    ) {
      return true;
    }
  }
  return false;
}

export function getWithBackground(
  plugin: ExcalidrawPlugin,
  file: TFile,
): boolean {
  if (file) {
    const fileCache = plugin.app.metadataCache.getFileCache(file);
    if (
      fileCache?.frontmatter &&
      fileCache.frontmatter[FRONTMATTER_KEYS["export-transparent"].name] !==
        null &&
      typeof fileCache.frontmatter[
        FRONTMATTER_KEYS["export-transparent"].name
      ] !== "undefined"
    ) {
      return !fileCache.frontmatter[
        FRONTMATTER_KEYS["export-transparent"].name
      ];
    }
  }
  return plugin.settings.exportWithBackground;
}

export function getExportPadding(
  plugin: ExcalidrawPlugin,
  file: TFile,
): number {
  if (file) {
    const fileCache = plugin.app.metadataCache.getFileCache(file);
    if (!fileCache?.frontmatter) {
      return plugin.settings.exportPaddingSVG;
    }

    if (
      fileCache.frontmatter[FRONTMATTER_KEYS["export-padding"].name] !== null &&
      typeof fileCache.frontmatter[FRONTMATTER_KEYS["export-padding"].name] !==
        "undefined"
    ) {
      const val = parseInt(
        fileCache.frontmatter[FRONTMATTER_KEYS["export-padding"].name],
      );
      if (!isNaN(val)) {
        return val;
      }
    }

    if (
      fileCache.frontmatter[FRONTMATTER_KEYS["export-svgpadding"].name] !==
        null &&
      typeof fileCache.frontmatter[
        FRONTMATTER_KEYS["export-svgpadding"].name
      ] !== "undefined"
    ) {
      const val = parseInt(
        fileCache.frontmatter[FRONTMATTER_KEYS["export-svgpadding"].name],
      );
      if (!isNaN(val)) {
        return val;
      }
    }
  }
  return plugin.settings.exportPaddingSVG;
}

/**
 * Copies a rectangular canvas region into a new canvas, optionally scaling it.
 * Based on: https://stackoverflow.com/a/54555834
 * 
 * @param srcCanvas - Source canvas to crop.
 * @param crop - Source rectangle in canvas coordinates.
 * @param output - Destination dimensions; defaults to the crop dimensions.
 * @returns A newly created canvas containing the cropped image.
 * @remarks
 * This preserves the existing `drawImage()` behavior without clamping the
 * source rectangle or changing browser interpolation and transparency rules.
 */
export function cropCanvas(
  srcCanvas: HTMLCanvasElement,
  crop: { left: number; top: number; width: number; height: number },
  output: { width: number; height: number } = {
    width: crop.width,
    height: crop.height,
  },
) {
  const dstCanvas = createEl("canvas");
  dstCanvas.width = output.width;
  dstCanvas.height = output.height;
  dstCanvas
    .getContext("2d")
    .drawImage(
      srcCanvas,
      crop.left,
      crop.top,
      crop.width,
      crop.height,
      0,
      0,
      output.width,
      output.height,
    );
  return dstCanvas;
}

/**
 * Invokes a synchronous or asynchronous function through a promise boundary.
 *
 * @param fn - Function to invoke.
 * @param args - Arguments passed to `fn`.
 * @returns A promise that adopts the function's returned value or thenable.
 * @remarks Synchronous exceptions thrown by `fn` become promise rejections.
 */
export async function promiseTry<TValue, TArgs extends unknown[]>(
  fn: (...args: TArgs) => PromiseLike<TValue> | TValue,
  ...args: TArgs
): Promise<TValue> {
  return new Promise((resolve) => {
    resolve(fn(...args));
  });
}

type TPromisePool<T, Index = number> = import("es6-promise-pool").default<
  [Index, T][]
> & {
  addEventListener: (
    type: "fulfilled",
    listener: (event: { data: { result: [Index, T] } }) => void,
  ) => (event: { data: { result: [Index, T] } }) => void;
  removeEventListener: (
    type: "fulfilled",
    listener: (event: { data: { result: [Index, T] } }) => void,
  ) => void;
};

export class PromisePool<T> {
  private readonly pool: TPromisePool<T>;
  private readonly entries: Record<number, T> = {};

  constructor(
    source: IterableIterator<Promise<void | readonly [number, T]>>,
    concurrency: number,
  ) {
    this.pool = new Pool(
      source as unknown as () => void | PromiseLike<[number, T][]>,
      concurrency,
    ) as TPromisePool<T>;
  }

  public all() {
    try {
      if (!this.pool) {
        return Promise.resolve(Object.values(this.entries));
      }

      const listener = (event: { data: { result: void | [number, T] } }) => {
        if (event.data.result) {
          const [index, value] = event.data.result;
          this.entries[index] = value;
        }
      };

      this.pool.addEventListener("fulfilled", listener);

      return Promise.resolve(this.pool.start()).then(
        () => {
          window.setTimeout(() => {
            this.pool?.removeEventListener("fulfilled", listener);
          });
          return Object.values(this.entries);
        },
        () => {
          this.pool?.removeEventListener("fulfilled", listener);
          return Object.values(this.entries);
        },
      );
    } catch {
      return Promise.resolve(Object.values(this.entries));
    }
  }
}
