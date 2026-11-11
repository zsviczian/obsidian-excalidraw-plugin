import { readDrawingEmbedToken } from "./embedDimensions";
import { rewriteDrawingPreviewLink } from "src/utils/drawingPreviewLink";

/** Rewrite only one embed's region override; paths, aliases, titles and table escapes stay byte-identical. */
export function rewriteEmbedFrame(text: string, reference: string | null): string | null {
  const token = readDrawingEmbedToken(text);
  if (!token || token.text !== text || reference !== null && reference !== "" && !/^[A-Za-z0-9_-]+$/.test(reference)) return null;
  const target = token.target, next = rewriteDrawingPreviewLink(target, { frame: reference });
  if (next === null) return null;
  const from = token.wiki ? 3 : text.indexOf(target, token.aliasTo + 2);
  return from < 0 ? null : text.slice(0, from) + next + text.slice(from + target.length);
}
