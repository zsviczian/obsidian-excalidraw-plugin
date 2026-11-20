import type ExcalidrawPlugin from "src/core/main";
import type {
  ExcalidrawFontFaceDescriptor,
  Fonts,
} from "@zsviczian/excalidraw/types/excalidraw/fonts/Fonts";
import { PromisePool, promiseTry } from "./utils";
import { blobToBase64 } from "./fileUtils";

/** A locally loaded CJK subset with the descriptors required for font matching. */
export interface CJKFontFaceData {
  dataURL: string;
  descriptors?: FontFaceDescriptors;
}

type CJKRange = [number, number];

const cjkRanges: Record<"c" | "j" | "k", CJKRange[]> = {
  c: [
    [0x4e00, 0x9fff], // Chinese
    [0x3400, 0x4dbf],
    [0xf900, 0xfaff],
  ],
  j: [
    [0x3040, 0x309f], // Japanese
    [0x30a0, 0x30ff],
    [0x31f0, 0x31ff],
  ],
  k: [
    [0x1100, 0x11ff], // Korean
    [0xac00, 0xd7af],
  ],
};

export function matchesCJKRange(
  descriptor: ExcalidrawFontFaceDescriptor,
  rangesToLoad: { c: boolean; j: boolean; k: boolean },
): boolean {
  // Helper to parse unicode range string like "U+f9b8-fa6d"
  const parseRange = (range: string): CJKRange => {
    const [start, end] = range
      .replace("U+", "")
      .split("-")
      .map((hex) => parseInt(hex, 16));
    return [start, end || start];
  };

  // Function to check if ranges overlap
  const rangesOverlap = (range1: CJKRange, range2: CJKRange): boolean =>
    range1[0] <= range2[1] && range1[1] >= range2[0];

  if (!descriptor?.descriptors?.unicodeRange) {
    return false;
  }

  // Parse unicode ranges from descriptor
  const unicodeRanges = descriptor?.descriptors?.unicodeRange
    .split(",")
    .map(parseRange);

  // Check for each CJK type specified in rangesToLoad
  return Object.entries(rangesToLoad).some(([key, shouldLoad]) => {
    if (shouldLoad) {
      const targetRanges = cjkRanges[key as keyof typeof cjkRanges];
      // Check if any descriptor range overlaps with target CJK ranges
      return unicodeRanges.some((range) =>
        targetRanges.some((cjkRange) => rangesOverlap(range, cjkRange)),
      );
    }
    return false;
  });
}

/**
 * Loads the locally configured CJK font subsets selected by plugin settings.
 *
 * Reads subset metadata from the already loaded component, preserving its order
 * while keeping configured range selection and vault file access in the plugin.
 *
 * @param plugin - Plugin instance used to resolve settings and read font files.
 * @param fonts - The package manager's shared, published component font registry.
 * @returns Loaded subsets with their original descriptors, `undefined` when no
 * CJK range is enabled, or `false` when no matching local font could be loaded.
 */
export async function getCJKFontFaceData(
  plugin: ExcalidrawPlugin,
  fonts: typeof Fonts,
): Promise<CJKFontFaceData[] | undefined | false> {
  const rangesToLoad = plugin.getCJKFontSettings();
  if (!(rangesToLoad.c || rangesToLoad.j || rangesToLoad.k)) {
    return;
  }

  // The shared component registry owns the subset filenames and ranges. Read
  // URL properties directly so fonts created in another realm need no instanceof.
  const xiaolai = [...fonts.registered.values()].find(
    ({ fontFaces }) => fontFaces[0]?.fontFace.family === "Xiaolai",
  );
  const fontFaces: ExcalidrawFontFaceDescriptor[] = (xiaolai?.fontFaces ?? [])
    .flatMap(({ urls, fontFace }) => {
      const source = urls[0];
      // Vault loading accepts filenames; data/local fonts have no subset file.
      if (!source || typeof source === "string") return [];
      return [
        {
          uri: decodeURIComponent(
            source.pathname.slice(source.pathname.lastIndexOf("/") + 1),
          ),
          descriptors: { unicodeRange: fontFace.unicodeRange },
        },
      ];
    })
    .filter((face) => matchesCJKRange(face, rangesToLoad));

  const loadedFaces: Array<{
    buffer: ArrayBuffer;
    descriptors?: FontFaceDescriptors;
  }> = [];

  // Generator to load fonts
  function* symbolIterator(): Generator<Promise<void>> {
    for (const fontFace of fontFaces) {
      yield promiseTry(async () => {
        const ab = await plugin.loadFontFromFile(fontFace.uri);
        if (ab) {
          loadedFaces.push({
            buffer: ab,
            descriptors: fontFace.descriptors,
          });
        }
      });
    }
  }

  const concurrency = 5;
  const iterator = symbolIterator();
  await new PromisePool(iterator, concurrency).all();

  // Create an array to hold the Data URLs
  const result: CJKFontFaceData[] = [];

  for (const { buffer, descriptors } of loadedFaces) {
    const blob = new Blob([buffer], { type: "font/woff2" });
    const dataUrl = await blobToBase64(blob);
    result.push({
      dataURL: `data:font/woff2;base64,${dataUrl}`,
      descriptors,
    });
  }

  return result.length > 0 ? result : false;
}
