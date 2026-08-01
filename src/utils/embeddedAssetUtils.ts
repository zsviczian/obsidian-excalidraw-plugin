import type { TFile, App } from "obsidian";
import { FRONTMATTER_KEYS } from "src/constants/constants";
import type ExcalidrawPlugin from "src/core/main";
import Pool from "es6-promise-pool";
import { getDataURL } from "./coreUtils";

export { getEmbeddedFilenameParts } from "./embeddedFilenameParts";

export async function getFontDataURL(
  app: App,
  fontFileName: string,
  sourcePath: string,
  name?: string,
): Promise<{ fontDef: string; fontName: string; dataURL: string }> {
  let fontDef = "";
  let fontName = "";
  let dataURL = "";
  const f = app.metadataCache.getFirstLinkpathDest(fontFileName, sourcePath);
  if (f) {
    const ab = await app.vault.readBinary(f);
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
    dataURL = await getDataURL(ab, mimeType);
    const split = dataURL.split(";base64,", 2);
    dataURL = `${split[0]};charset=utf-8;base64,${split[1]}`;
    fontDef = ` @font-face {font-family: "${fontName}";src: url("${dataURL}") format("${format}")}`;
  }
  return { fontDef, fontName, dataURL };
}

export function svgToBase64(svg: string): string {
  const cleanSvg = svg.replaceAll("&nbsp;", " ");
  const encodedData = encodeURIComponent(cleanSvg).replace(
    /%([0-9A-F]{2})/g,
    (_match, p1) => String.fromCharCode(parseInt(p1, 16)),
  );
  return `data:image/svg+xml;base64,${btoa(encodedData)}`;
}

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
