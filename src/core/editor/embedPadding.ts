import { readDrawingEmbedToken } from "./embedDimensions";
import { getEmbeddedFilenameParts } from "src/utils/embeddedFilenameParts";

const PADDING_SUFFIX = /(?:,|%2c)padding(?:=|%3d)(?:\d+(?:(?:\.|%2e)\d+)?|(?:\.|%2e)\d+)$/i;

/** Rewrite only an area reference's padding, preserving raw paths and encoding. */
export function withAreaPadding(target: string, padding: number | null): string | null {
  const hash = target.includes("#") ? target.indexOf("#") : target.search(/%23/i);
  if (hash < 0) return null;
  let decoded: string;
  // A canonical vault filename may contain a literal %. Only the reference
  // needs URI decoding; destination paths must retain their exact spelling.
  try { decoded = target.slice(0, hash) + decodeURIComponent(target.slice(hash)); } catch { return null; }
  const parts = getEmbeddedFilenameParts(decoded);
  if (!parts.hasArearef || !(parts.blockref || parts.sectionref) ||
      padding !== null && (!Number.isFinite(padding) || padding < 0 || padding > 2000)) return null;
  const bare = target.replace(PADDING_SUFFIX, "");
  // Malformed/duplicate parameters must never be mistaken for the area id.
  if (/,padding=/i.test(decodeURIComponent(bare.slice(hash)))) return null;
  return bare + (padding === null ? "" : `,padding=${padding}`);
}

/** Edit the destination parameter of one owned wiki/Markdown/table embed token. */
export function rewriteEmbedPadding(text: string, padding: number | null): string | null {
  const token = readDrawingEmbedToken(text);
  if (!token || token.text !== text) return null;
  const target = withAreaPadding(token.target, padding);
  if (target === null) return null;
  const from = token.wiki ? 3 : text.indexOf(token.target, token.aliasTo + 2);
  if (from < 0) return null;
  return text.slice(0, from) + target + text.slice(from + token.target.length);
}
