/** Named frame metadata is Markdown-owned; scene IDs are used only for live navigation. */
import type { ExcalidrawElement, ExcalidrawFrameElement } from "@zsviczian/excalidraw/types/element/src/types";
import { parseYaml } from "obsidian";

export const FRAME_ANCHORS_PROPERTY = "excalidraw-anchors";
export const FRAME_THUMBNAIL_PROPERTY = "excalidraw-thumbnail";

/** Return both regular and marker frames in scene order, excluding deleted elements. */
export function getSceneFrames(elements: readonly ExcalidrawElement[]): ExcalidrawFrameElement[] {
  return elements.filter((element): element is ExcalidrawFrameElement => element.type === "frame" && !element.isDeleted);
}

/** Preserve actual names verbatim; the editor's unnamed-frame fallback is not metadata. */
export function getFrameAnchors(elements: readonly ExcalidrawElement[]): string[] {
  return [...new Set(getSceneFrames(elements).map(frame => frame.name).filter(name => typeof name === "string" && name.trim().length > 0))];
}

/** Resolve a YAML name exactly, with no arbitrary choice between duplicates. */
export function resolveThumbnailFrame(elements: readonly ExcalidrawElement[], name: unknown): ExcalidrawFrameElement | null {
  if (typeof name !== "string" || !name.trim()) return null;
  const frames = getSceneFrames(elements).filter(frame => frame.name === name);
  const frame = frames.length === 1 ? frames[0] : null;
  return frame && [frame.x, frame.y, frame.width, frame.height].every(Number.isFinite) && frame.width > 0 && frame.height > 0 ? frame : null;
}

function frontmatter(text: string): { from: number; to: number; content: string; values: Record<string, unknown>; newline: string } | null {
  const open = text.match(/^(?:\uFEFF)?---(\r?\n)/);
  if (!open) return null;
  const closing = /^---(?:\r?\n|$)/gm; closing.lastIndex = open[0].length;
  const end = closing.exec(text);
  if (!end) return null;
  const content = text.slice(open[0].length, end.index).replace(/\r?\n$/, "");
  try {
    const values: unknown = parseYaml(content) ?? {};
    if (typeof values !== "object" || Array.isArray(values)) return null;
    return { from: open[0].length, to: end.index, content, values: values as Record<string, unknown>, newline: open[1] };
  } catch { return null; }
}

/** Read saved YAML directly when a cache entry may still describe an earlier write. */
export function readFrameProperty(text: string, key = FRAME_THUMBNAIL_PROPERTY): unknown {
  return frontmatter(text)?.values[key];
}

/**
 * Change only one frame property block, preserving all other YAML bytes and order.
 * Existing keys stay in place. New keys follow the current writer's prepend rule;
 * the optional placement argument also supports callers with an append policy.
 */
export function writeFrameProperty(text: string, key: string, value: string | readonly string[] | undefined, prepend = true): string {
  if (key !== FRAME_ANCHORS_PROPERTY && key !== FRAME_THUMBNAIL_PROPERTY) return text;
  const fm = frontmatter(text);
  if (!fm || JSON.stringify(fm.values[key]) === JSON.stringify(value)) return text;
  const lines = fm.content ? fm.content.split(fm.newline) : [];
  const start = lines.findIndex(line => new RegExp(`^(?:${key}|"${key}"|'${key}')\\s*:`).test(line));
  const serialized = value === undefined ? [] : Array.isArray(value)
    ? [key + ":", ...value.map(name => "  - " + JSON.stringify(name))]
    : [key + ": " + JSON.stringify(value)];
  if (start >= 0) {
    let end = start + 1;
    while (end < lines.length && (/^\s+\S/.test(lines[end]) || /^-\s/.test(lines[end]) || !lines[end].trim())) end++;
    lines.splice(start, end - start, ...serialized);
  } else {
    if (value === undefined || Object.hasOwn(fm.values, key)) return text;
    if (prepend) lines.unshift(...serialized); else lines.push(...serialized);
  }
  const content = lines.join(fm.newline);
  return text.slice(0, fm.from) + content + (content ? fm.newline : "") + text.slice(fm.to);
}

/** Synchronize the captured save scene without introducing empty properties on plain drawings. */
export function syncFrameAnchors(text: string, elements: readonly ExcalidrawElement[], prepend = true): string {
  const names = getFrameAnchors(elements);
  return writeFrameProperty(text, FRAME_ANCHORS_PROPERTY, names.length ? names : undefined, prepend);
}
