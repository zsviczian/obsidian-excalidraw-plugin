import { readDrawingEmbedToken } from "./embedDimensions";
import { rewriteDrawingPreviewLink } from "src/utils/drawingPreviewLink";

/** Rewrite a drawing preview's padding; retained name supports existing callers. */
export function withAreaPadding(target: string, padding: number | null): string | null {
  return rewriteDrawingPreviewLink(target, { padding });
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
