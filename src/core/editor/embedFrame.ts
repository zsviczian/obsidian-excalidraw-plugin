import { readDrawingEmbedToken } from "./embedDimensions";
import { getEmbeddedFilenameParts } from "src/utils/embeddedFilenameParts";

/** Rewrite only one embed's region override; paths, aliases, titles and table escapes stay byte-identical. */
export function rewriteEmbedFrame(text: string, reference: string | null): string | null {
  const token = readDrawingEmbedToken(text);
  if (!token || token.text !== text || reference !== null && reference !== "" && !/^[A-Za-z0-9_-]+$/.test(reference)) return null;
  const target = token.target, hash = target.includes("#") ? target.indexOf("#") : target.search(/%23/i);
  const path = hash < 0 ? target : target.slice(0, hash);
  const raw = hash < 0 ? "" : target.slice(hash);
  let decoded: string;
  try { decoded = decodeURIComponent(raw); } catch { return null; }
  const parts = getEmbeddedFilenameParts(decoded);
  const suffix = reference && parts.padding !== undefined
    ? raw.match(/(?:,|%2c)padding(?:=|%3d)(?:\d+(?:(?:\.|%2e)\d+)?|(?:\.|%2e)\d+)$/i)?.[0] ?? ""
    : "";
  const marker = raw.startsWith("%23") ? "%23" : "#";
  const caret = raw.match(/^(?:#|%23)(%5e)/i)?.[1] ?? "^";
  const kind = reference && parts.hasClippedFrameref ? "clippedframe" : "frame";
  const equals = raw.match(/(?:clippedframe|frame)(%3d|=)/i)?.[1] ?? "=";
  const next = reference === null ? path : path + marker + caret + kind + equals + reference + suffix;
  const from = token.wiki ? 3 : text.indexOf(target, token.aliasTo + 2);
  return from < 0 ? null : text.slice(0, from) + next + text.slice(from + target.length);
}
