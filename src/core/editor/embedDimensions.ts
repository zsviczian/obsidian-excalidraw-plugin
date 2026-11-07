/** Lossless dimension edits for a single, already-owned Markdown embed token. */
export interface EmbedDimensions {
  width?: string;
  height?: string;
}

/** Existing drawing aliases may combine a caption, dimensions and a CSS suffix. */
export interface EmbedAliasParts extends EmbedDimensions {
  alias?: string;
  style?: string;
}

/** A parsed token retains source offsets; its destination and title are never rewritten. */
export interface DrawingEmbedToken {
  text: string;
  target: string;
  aliasFrom: number;
  aliasTo: number;
  wiki: boolean;
}

/** The renderer's established integer/percentage dimension grammar. */
export function getDimensionsFromAliasString(data: string): EmbedDimensions | null {
  const match = data.match(/^(?<width>\d+%|\d+)(x(?<height>\d+%|\d+))?$/)
    || data.match(/^x(?<height>\d+%|\d+)$/);
  if (!match) return null;
  const { width, height } = match.groups;
  if ((width && width.startsWith("0") && width !== "0") ||
      (height && height.startsWith("0") && height !== "0")) return null;
  return { width: width || undefined, height: height || undefined };
}

/** Preserve the existing renderer's alias/style precedence. */
export function parseEmbedAlias(input: string): EmbedAliasParts {
  const parts = input.replace(/\\\|/g, "|").split("|").map(part => part.trim());
  const first = getDimensionsFromAliasString(parts[0]);
  const second = parts.length > 1 ? getDimensionsFromAliasString(parts[1]) : null;
  let result: EmbedAliasParts;
  switch (parts.length) {
    case 1: return first ?? { style: parts[0] };
    case 2:
      result = second ? { alias: parts[0], ...second }
        : first ? { ...first, style: parts[1] } : { alias: parts[0], style: parts[1] };
      break;
    default:
      result = { alias: parts[0], ...(second ?? {}), style: parts.at(-1) };
  }
  return Object.fromEntries(Object.entries(result).filter(([, value]) => value !== undefined));
}

/** Parse one token at the start of a source range, leaving any following text alone. */
export function readDrawingEmbedToken(source: string): DrawingEmbedToken | null {
  if (source.startsWith("![[")) {
    const end = source.indexOf("]]");
    if (end < 3 || /[\r\n]/.test(source.slice(0, end))) return null;
    const inner = source.slice(3, end);
    const pipe = inner.search(/\\?\|/);
    const targetEnd = pipe < 0 ? end : 3 + pipe;
    const separatorLength = source[targetEnd] === "\\" ? 2 : 1;
    return {
      text: source.slice(0, end + 2), target: source.slice(3, targetEnd),
      aliasFrom: pipe < 0 ? end : targetEnd + separatorLength, aliasTo: end, wiki: true,
    };
  }
  if (!source.startsWith("![")) return null;
  let level = 1, close = -1;
  for (let i = 2; i < source.length; i++) {
    if (source[i] === "\\") { i++; continue; }
    if (source[i] === "[") level++;
    if (source[i] === "]" && --level === 0) { close = i; break; }
  }
  if (close < 0 || source[close + 1] !== "(") return null;
  let depth = 1, quote = "", angle = false, end = -1;
  for (let i = close + 2; i < source.length; i++) {
    const char = source[i];
    if (char === "\\") { i++; continue; }
    if (quote) { if (char === quote) quote = ""; continue; }
    if (angle) { if (char === ">") angle = false; continue; }
    if (char === "<" && depth === 1) { angle = true; continue; }
    if ((char === '"' || char === "'") && /\s/.test(source[i - 1])) { quote = char; continue; }
    if (char === "(") depth++;
    if (char === ")" && --depth === 0) { end = i; break; }
  }
  if (end < 0) return null;
  const destination = source.slice(close + 2, end).trim();
  let target: string;
  if (destination.startsWith("<")) {
    const angleEnd = destination.indexOf(">");
    if (angleEnd < 0) return null;
    target = destination.slice(1, angleEnd);
  } else {
    // Whitespace escaped in a destination belongs to the path, not its title.
    const match = destination.match(/^(?:\\.|[^\s])+/);
    if (!match) return null;
    target = match[0];
  }
  return { text: source.slice(0, end + 1), target, aliasFrom: 2, aliasTo: close, wiki: false };
}

interface AliasSegment {
  from: number;
  to: number;
  separator: number;
  value: string;
}

function aliasSegments(token: DrawingEmbedToken): AliasSegment[] {
  const result: AliasSegment[] = [];
  let from = token.aliasFrom, separator = token.wiki ? token.aliasFrom - 1 : -1;
  const alias = token.text.slice(token.aliasFrom, token.aliasTo);
  const pipes = [...alias.matchAll(/\\?\|/g)];
  for (const pipe of pipes) {
    const to = token.aliasFrom + pipe.index;
    result.push({ from, to, separator, value: token.text.slice(from, to).trim() });
    separator = to;
    from = to + pipe[0].length;
  }
  result.push({ from, to: token.aliasTo, separator, value: token.text.slice(from, token.aliasTo).trim() });
  return result;
}

function dimensionSegment(segments: AliasSegment[]): AliasSegment | undefined {
  if (segments.length > 1 && getDimensionsFromAliasString(segments[1].value)) return segments[1];
  if (segments.length <= 2 && getDimensionsFromAliasString(segments[0].value)) return segments[0];
}

/** Read explicit sizing without altering aliases, table escapes or destination parameters. */
export function getEmbedDimensions(text: string): EmbedDimensions | null {
  const token = readDrawingEmbedToken(text);
  if (!token || token.text !== text) return null;
  const segment = dimensionSegment(aliasSegments(token));
  return segment ? getDimensionsFromAliasString(segment.value) : {};
}

/**
 * Replace only the dimension slot. Reset removes that slot and its separator.
 * Changed percentages become pixels; callers preserve the displayed aspect ratio.
 */
export function rewriteEmbedDimensions(
  text: string,
  dimensions: { width: number; height?: number } | null,
): string | null {
  const token = readDrawingEmbedToken(text);
  if (!token || token.text !== text) return null;
  if (dimensions && [dimensions.width, dimensions.height].some(value =>
    value !== undefined && (!Number.isInteger(value) || value < 1 || value > 100000))) return null;
  const segments = aliasSegments(token), segment = dimensionSegment(segments);
  const size = dimensions ? `${dimensions.width}${dimensions.height === undefined ? "" : `x${dimensions.height}`}` : null;
  if (segment) {
    if (size === segment.value) return text;
    if (size === null) {
      if (!token.wiki && segment.separator < 0) {
        const next = segments[1];
        return text.slice(0, segment.from) + text.slice(next ? next.from : segment.to);
      }
      // A table separator includes its backslash as well as the pipe.
      let start = segment.separator;
      if (start > 0 && text[start - 1] === "\\") start--;
      return text.slice(0, start) + text.slice(segment.to);
    }
    const start = segment.from + text.slice(segment.from, segment.to).search(/\S/);
    return text.slice(0, start) + size + text.slice(start + segment.value.length);
  }
  if (size === null) return text;
  const alias = text.slice(token.aliasFrom, token.aliasTo);
  const escaped = /\\\|/.test(text.slice(0, token.aliasTo));
  const pipe = escaped ? "\\|" : "|";
  if (!alias) {
    return text.slice(0, token.aliasFrom) + (token.wiki && token.aliasFrom === 3 + token.target.length ? pipe : "") + size + text.slice(token.aliasTo);
  }
  // One field is the existing style suffix. With a caption and a suffix, size
  // belongs between them; do not discard unknown additional alias fields.
  const at = segments.length === 1 ? token.aliasFrom : segments[1].from;
  return text.slice(0, at) + size + pipe + text.slice(at);
}
