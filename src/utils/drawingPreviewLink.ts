import { getEmbeddedFilenameParts } from "./embeddedFilenameParts";

/** Persisted preview overrides live in the embedded-file link, including |100%. */
export interface DrawingPreviewChanges {
  frame?: string | null;
  padding?: number | null;
  anchored?: boolean;
}

const PADDING_SUFFIX = /(?:,|%2c)padding(?:=|%3d)(?:\d+(?:(?:\.|%2e)\d+)?|(?:\.|%2e)\d+)$/i;

/** Read the reference without decoding a vault filename that may contain a literal %. */
export function getDrawingPreviewParts(link: string) {
  const target = link.split("|")[0], hash = target.includes("#") ? target.indexOf("#") : target.search(/%23/i);
  try { return getEmbeddedFilenameParts(hash < 0 ? target : target.slice(0, hash) + decodeURIComponent(target.slice(hash))); }
  catch { return getEmbeddedFilenameParts(target); }
}

/** Apply only changed fields while retaining raw paths, aliases and unrelated overrides. */
export function rewriteDrawingPreviewLink(link: string, changes: DrawingPreviewChanges): string | null {
  const pipe = link.indexOf("|"), target = pipe < 0 ? link : link.slice(0, pipe);
  let alias = pipe < 0 ? "" : link.slice(pipe);
  const parts = getDrawingPreviewParts(target);
  if (!parts) return null;
  const hash = target.includes("#") ? target.indexOf("#") : target.search(/%23/i);
  const path = hash < 0 ? target : target.slice(0, hash), raw = hash < 0 ? "" : target.slice(hash);
  const marker = raw.startsWith("%23") ? "%23" : "#", caret = raw.match(/^(?:#|%23)(%5e)/i)?.[1] ?? "^";
  let reference = raw;
  if (changes.frame !== undefined) {
    const frame = changes.frame;
    if (frame !== null && frame !== "" && !/^[A-Za-z0-9_-]+$/.test(frame)) return null;
    const padding = parts.padding === undefined ? "" : raw.match(PADDING_SUFFIX)?.[0] ?? "";
    const kind = frame && parts.hasClippedFrameref ? "clippedframe" : "frame";
    const equals = raw.match(/(?:clippedframe|frame)(%3d|=)/i)?.[1] ?? "=";
    reference = frame === null ? (padding ? marker + caret + "as-image" + padding : "") : marker + caret + kind + equals + frame + padding;
  }
  if (changes.padding !== undefined) {
    const padding = changes.padding, ref = parts.blockref ?? parts.sectionref;
    if (padding !== null && (!Number.isFinite(padding) || padding < 0 || padding > Number.MAX_SAFE_INTEGER)) return null;
    if (changes.frame === undefined && !(
      !raw || ref === "as-image" || parts.hasFrameref || (parts.hasArearef || parts.hasGroupref || parts.hasClippedFrameref) && !!ref
    )) return null;
    let bare = raw.replace(PADDING_SUFFIX, "");
    try { bare = decodeURIComponent(bare); } catch { /* Literal percent signs remain valid names. */ }
    if (parts.hasArearef && /,padding=/i.test(bare)) return null;
    reference = reference.replace(PADDING_SUFFIX, "");
    if (padding !== null) reference = (reference || marker + caret + "as-image") + `,padding=${padding}`;
  }
  if (changes.anchored !== undefined) alias = alias.replace(/\|100%$/, "") + (changes.anchored ? "|100%" : "");
  return path + reference + alias;
}
