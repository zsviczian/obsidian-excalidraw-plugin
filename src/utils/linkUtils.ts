import type { TFile } from "obsidian";
import { cleanBlockRef, cleanSectionHeading } from "./pathUtils";

/** Parsed components of an Obsidian drawing or embedded-file link. */
export type LinkParts = {
  original: string;
  path: string;
  isBlockRef: boolean;
  ref: string;
  width: number;
  height: number;
  page: number;
};

/**
 * Splits a drawing or embedded-file link into its path, reference, dimensions,
 * and optional PDF page.
 *
 * @param filename - Link text to parse.
 * @param file - Current file, used when the link omits its path.
 * @returns Parsed link components with cleaned heading or block references.
 * @remarks
 * This preserves the existing permissive regular-expression parser. It is not
 * a general-purpose Obsidian link parser and intentionally retains its current
 * handling of malformed or partially specified links.
 */
export function getLinkParts(filename: string, file?: TFile): LinkParts {
  const linkPattern = /(^[^#|]*)#?(\^)?([^|]*)?\|?(\d*)x?(\d*)/;
  const parts = filename.match(linkPattern);
  const isBlockRef = parts[2] === "^";
  let page = parseInt(parts[3]?.match(/page=(\d*)/)?.[1]);
  page = isNaN(page) ? null : page;
  return {
    original: filename,
    path: file && parts[1] === "" ? file.path : parts[1],
    isBlockRef,
    ref: parts[3]?.match(/^page=\d*$/i)
      ? parts[3]
      : isBlockRef
        ? cleanBlockRef(parts[3])
        : cleanSectionHeading(parts[3]),
    width: parts[4] ? parseInt(parts[4]) : undefined,
    height: parts[5] ? parseInt(parts[5]) : undefined,
    page,
  };
}
