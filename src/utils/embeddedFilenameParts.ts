import type { FILENAMEPARTS } from "src/types/utilTypes";

const EMBEDDED_FILENAME_PARTS_REGEX =
  /([^#^]*)((#\^)(group=|area=|frame=|clippedframe=|taskbone)?([^|]*)|(#)(group=|area=|frame=|clippedframe=|taskbone)?([^^|]*))(.*)/;
const IMAGE_REFERENCE_PREFIXES = new Set([
  "group=",
  "area=",
  "frame=",
  "clippedframe=",
]);
const PADDING_PARAMETER_REGEX = /,padding=(\d+(?:\.\d+)?|\.\d+)$/;

/**
 * Splits an embedded-file link into its path, reference, alias, and image-reference metadata.
 *
 * Image references may end in a non-negative `,padding=N` parameter. The parameter is
 * removed from the resolved block or section reference while the original link text is
 * retained in `linkpartReference` so nested export paths can be parsed again.
 */
export function getEmbeddedFilenameParts(fname: string): FILENAMEPARTS {
  //                        0 1        23    4                               5         6  7                             8          9
  const parts = fname?.match(EMBEDDED_FILENAME_PARTS_REGEX);
  if (!parts) {
    return {
      filepath: fname,
      hasBlockref: false,
      hasGroupref: false,
      hasTaskbone: false,
      hasArearef: false,
      hasFrameref: false,
      hasClippedFrameref: false,
      blockref: "",
      hasSectionref: false,
      sectionref: "",
      linkpartReference: "",
      linkpartAlias: "",
    };
  }

  const hasBlockref = Boolean(parts[3]);
  const hasSectionref = Boolean(parts[6]);
  const prefix = parts[4] ?? parts[7];
  const rawReference = hasBlockref ? parts[5] : parts[8];
  const paddingMatch = IMAGE_REFERENCE_PREFIXES.has(prefix)
    ? rawReference?.match(PADDING_PARAMETER_REGEX)
    : null;
  const parsedPadding = paddingMatch ? Number(paddingMatch[1]) : undefined;
  const padding = Number.isFinite(parsedPadding) ? parsedPadding : undefined;
  const reference =
    padding === undefined || !paddingMatch
      ? rawReference
      : rawReference.slice(0, -paddingMatch[0].length);

  return {
    filepath: parts[1],
    hasBlockref,
    hasGroupref: prefix === "group=",
    hasTaskbone: prefix === "taskbone",
    hasArearef: prefix === "area=",
    hasFrameref: prefix === "frame=",
    hasClippedFrameref: prefix === "clippedframe=",
    blockref: hasBlockref ? reference : parts[5],
    hasSectionref,
    sectionref: hasSectionref ? reference : parts[8],
    linkpartReference: parts[2],
    linkpartAlias: parts[9],
    padding,
  };
}

/** Returns whether parsed filename parts select an image-reference region. */
export function isImagePartRef(parts: FILENAMEPARTS): boolean {
  return (
    parts.hasGroupref ||
    parts.hasArearef ||
    parts.hasFrameref ||
    parts.hasClippedFrameref
  );
}
