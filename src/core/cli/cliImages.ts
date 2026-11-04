/** Request-local image inventory and safe, opt-in CLI preview representations (#3004). */
import type { BinaryFileData, BinaryFiles } from "@zsviczian/excalidraw/types/excalidraw/types";
import type { ExcalidrawElement, ExcalidrawImageElement } from "@zsviczian/excalidraw/types/element/src/types";
import type { FileId } from "@zsviczian/excalidraw/types/element/src/types";
import { nanoid } from "src/constants/constants";
import { CLIError, number, object } from "./cliProtocol";
import { getCLIImageMetadata } from "src/utils/elementCustomDataUtils";
import { thumbnailDimensions } from "./cliImageDimensions";

type Mode = "original" | "thumbnail" | "placeholder";
interface Rule { mode: Mode; ids?: string[]; tags?: string[]; mimeTypes?: string[]; maxBytes?: number }
/** Validated, request-local preview representations; omission retains original fidelity. */
export interface ImagePolicy { default: Mode; rules: Rule[]; thumbnailMaxDimension: number; labels: Record<string, string> }
/** Metadata-only decision trace, containing no original image payload. */
export type ImageDecision = { elementId: string; fileId: string | null; mode: Mode; reason: string; label: string; bytes: number | null; mimeType: string | null };

function strings(value: unknown, field: string, max: number, limit: number): string[] {
  if (!Array.isArray(value) || !value.length || value.length > max || value.some(item => typeof item !== "string" || !item.trim() || item.length > limit)) throw new CLIError("INVALID_INPUT", "Expected a bounded list of nonempty strings.", field);
  return value as string[];
}

/** No scripts, regexp, recursive predicates, or implicit lossy defaults. */
export function parseImagePolicy(raw: unknown): ImagePolicy | null {
  if (raw === undefined) return null;
  const policy = object(raw, "imagePolicy");
  for (const key of Object.keys(policy)) if (!["default", "rules", "thumbnailMaxDimension", "labels"].includes(key)) throw new CLIError("INVALID_INPUT", "Unknown image-policy field.", key);
  const mode = (value: unknown, field: string): Mode => {
    if (value !== "original" && value !== "thumbnail" && value !== "placeholder") throw new CLIError("INVALID_INPUT", "Expected original, thumbnail or placeholder.", field);
    return value;
  };
  const rules = policy.rules === undefined ? [] : policy.rules;
  if (!Array.isArray(rules) || rules.length > 32) throw new CLIError("INVALID_INPUT", "Image-policy rules are limited to 32.", "imagePolicy.rules");
  const parsedRules: Rule[] = rules.map((item, index) => {
    const rule = object(item, `imagePolicy.rules[${index}]`);
    for (const key of Object.keys(rule)) if (!["mode", "ids", "tags", "mimeTypes", "maxBytes"].includes(key)) throw new CLIError("INVALID_INPUT", "Unknown image rule field.", key);
    const match = { mode: mode(rule.mode, "imagePolicy.rules.mode") } as Rule;
    if (rule.ids !== undefined) match.ids = strings(rule.ids, "imagePolicy.rules.ids", 100, 100);
    if (rule.tags !== undefined) match.tags = strings(rule.tags, "imagePolicy.rules.tags", 20, 32);
    if (rule.mimeTypes !== undefined) match.mimeTypes = strings(rule.mimeTypes, "imagePolicy.rules.mimeTypes", 20, 80);
    if (rule.maxBytes !== undefined) match.maxBytes = number(rule.maxBytes, "imagePolicy.rules.maxBytes", 0, 0, 1024 * 1024 * 1024);
    if (match.maxBytes !== undefined && !Number.isInteger(match.maxBytes)) throw new CLIError("INVALID_INPUT", "Expected integral bytes.");
    if (!Object.keys(match).some(key => key !== "mode")) throw new CLIError("INVALID_INPUT", "A rule must contain at least one matching condition.");
    return match;
  });
  const rawLabels: Record<string, unknown> = policy.labels === undefined ? {} : object(policy.labels, "imagePolicy.labels");
  if (Object.keys(rawLabels).length > 100) throw new CLIError("INVALID_INPUT", "Too many request-only labels.");
  const labels = Object.create(null) as Record<string, string>;
  for (const [id, label] of Object.entries(rawLabels)) {
    if (!id || id.length > 100 || typeof label !== "string" || label.length > 80 || !label.trim()) throw new CLIError("INVALID_INPUT", "Invalid image label.", "imagePolicy.labels");
    labels[id] = label;
  }
  const dimension = number(policy.thumbnailMaxDimension, "imagePolicy.thumbnailMaxDimension", 512, 64, 2048);
  if (!Number.isInteger(dimension)) throw new CLIError("INVALID_INPUT", "Thumbnail resolution must be an integer.");
  return { default: policy.default === undefined ? "original" : mode(policy.default, "imagePolicy.default"), rules: parsedRules, thumbnailMaxDimension: dimension, labels };
}

/** Constant-work base64 byte estimate; unknown/missing payloads remain unknown. */
export function dataURLBytes(url?: string): number | null {
  if (!url || !url.startsWith("data:")) return null;
  const comma = url.indexOf(",");
  if (comma < 0) return null;
  const prefix = url.slice(0, comma);
  if (prefix.includes(";base64")) {
    const end = url.length;
    return Math.max(0, Math.floor((end - comma - 1) * 3 / 4) - (url.endsWith("==") ? 2 : url.endsWith("=") ? 1 : 0));
  }
  // Percent encoding cannot be inferred from the payload length without scanning it.
  return null;
}

/** Report known placement/load metadata without decoding, fetching, or copying asset bodies. */
export function imageInventory(element: ExcalidrawImageElement, file?: BinaryFileData, originalBytes: number | null = null) {
  const metadata = getCLIImageMetadata(element);
  return {
    elementId: element.id, fileId: element.fileId,
    label: metadata?.label ?? null, tags: metadata?.tags ?? [], mimeType: file?.mimeType ?? null,
    loadedRenditionBytes: dataURLBytes(file?.dataURL), originalBytes, intrinsicDimensions: element.crop ? { width: element.crop.naturalWidth, height: element.crop.naturalHeight } : null,
    placement: { x: element.x, y: element.y, width: element.width, height: element.height, angle: element.angle },
    loaded: !!file?.dataURL && file.dataURL.startsWith("data:"), status: element.status ?? null,
  };
}

/** First-match policy; unknown byte sizes do not satisfy a maxBytes predicate. */
export function decideImage(element: ExcalidrawImageElement, file: BinaryFileData | undefined, policy: ImagePolicy | null): ImageDecision {
  const annotation = getCLIImageMetadata(element);
  const bytes = dataURLBytes(file?.dataURL), mimeType = file?.mimeType ?? null;
  const chosen = policy?.rules.find(rule =>
    (!rule.ids || rule.ids.includes(element.id)) &&
    (!rule.tags || rule.tags.some(tag => annotation?.tags?.includes(tag))) &&
    (!rule.mimeTypes || !!mimeType && rule.mimeTypes.includes(mimeType)) &&
    (rule.maxBytes === undefined || bytes !== null && bytes <= rule.maxBytes));
  return {
    elementId: element.id, fileId: element.fileId, mode: chosen?.mode ?? policy?.default ?? "original",
    reason: chosen ? `rule ${policy.rules.indexOf(chosen) + 1}` : "default",
    label: policy?.labels[element.id] ?? annotation?.label ?? `Image ${element.id.slice(0, 12)}`,
    bytes, mimeType,
  };
}

/** ASCII XML entities prevent label injection and btoa Unicode errors. */
export function placeholderDataURL(label: string, width: number, height: number): string {
  const w = Number.isFinite(width) ? Math.max(1, width) : 1, h = Number.isFinite(height) ? Math.max(1, height) : 1;
  const safe = [...label.slice(0, 80)].map(char => `&#${char.codePointAt(0)};`).join("");
  const fontSize = Math.max(1, Math.min(w / 10, h / 4, 28));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect x="0.5" y="0.5" width="${Math.max(0, w - 1)}" height="${Math.max(0, h - 1)}" fill="#f4f4f4" stroke="#888" stroke-dasharray="5 4"/><text x="${w / 2}" y="${h / 2}" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="${fontSize}" fill="#555" textLength="${Math.min(w * 0.9, label.length * fontSize * 0.55)}" lengthAdjust="spacingAndGlyphs">${safe}</text></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/** Guard decoded pixels and source size; do not allocate a canvas for oversized assets. */
async function thumbnail(file: BinaryFileData, dimension: number, check: () => void): Promise<{ url: string; width: number; height: number; originalWidth: number; originalHeight: number }> {
  const bytes = dataURLBytes(file.dataURL);
  if (bytes === null || bytes > 24 * 1024 * 1024) throw new CLIError("ASSETS_UNAVAILABLE", "Thumbnail source exceeds safe decode bounds; select placeholder instead.");
  const expected = thumbnailDimensions(file.dataURL);
  check();
  const img = createFragment().createEl("img");
  img.src = file.dataURL;
  try {
    try { await img.decode(); }
    catch { throw new CLIError("ASSETS_UNAVAILABLE", "Thumbnail source could not be decoded; choose placeholder."); }
    check();
    const originalWidth = img.naturalWidth, originalHeight = img.naturalHeight;
    const matchesHeader = originalWidth === expected.width && originalHeight === expected.height
      || originalWidth === expected.height && originalHeight === expected.width; // JPEG EXIF orientation can swap axes.
    if (!originalWidth || !originalHeight || originalWidth * originalHeight > 16_000_000 || !matchesHeader) throw new CLIError("ASSETS_UNAVAILABLE", "Image dimensions failed thumbnail preflight; select placeholder.");
    const ratio = Math.min(1, dimension / Math.max(originalWidth, originalHeight));
    const width = Math.max(1, Math.round(originalWidth * ratio)), height = Math.max(1, Math.round(originalHeight * ratio));
    const canvas = createFragment().createEl("canvas");
    try {
      canvas.width = width; canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new CLIError("EXPORT_FAILED", "Thumbnail canvas is unavailable.");
      context.drawImage(img, 0, 0, width, height);
      const url = canvas.toDataURL("image/png");
      if (url.length > 8 * 1024 * 1024) throw new CLIError("EXPORT_FAILED", "Thumbnail exceeds the 6 MiB rendition budget.");
      return { url, width, height, originalWidth, originalHeight };
    } finally { canvas.width = 0; canvas.height = 0; }
  } finally { img.removeAttribute("src"); }
}

/**
 * Assemble a minimal export-only files map; each placeholder has its own file ID
 * so SVG symbol reuse cannot turn another instance into the wrong representation.
 * The caller keeps the original full scene identity for all staleness checks.
 */
export async function prepareImagePreview(elements: readonly ExcalidrawElement[], files: BinaryFiles, policy: ImagePolicy | null, decisions: Map<string, ImageDecision>, check: () => void = () => {}) {
  const resultFiles: BinaryFiles = {};
  const resultElements: ExcalidrawElement[] = [];
  const thumbnails = new Map<string, Awaited<ReturnType<typeof thumbnail>>>();
  for (const element of elements) {
    check();
    if (element.type !== "image") { resultElements.push(element); continue; }
    const original = element.fileId ? files[element.fileId] : undefined;
    const decision = decisions.get(element.id) ?? decideImage(element, original, policy);
    if (decision.mode === "original") {
      if (!original?.dataURL || !original.dataURL.startsWith("data:") || element.status === "error") throw new CLIError("ASSETS_UNAVAILABLE", "A required original image is missing or undecoded; use a placeholder policy for a structural preview.");
      resultFiles[original.id] = original;
      resultElements.push(element);
      continue;
    }
    const fileId = `cli${nanoid()}` as FileId;
    if (decision.mode === "placeholder") {
      resultFiles[fileId] = { id: fileId, mimeType: "image/svg+xml", dataURL: placeholderDataURL(decision.label, element.width, element.height) as BinaryFileData["dataURL"], created: Date.now() };
      resultElements.push({ ...element, fileId, status: "saved", crop: null,
        customData: { ...element.customData, doNotInvertSVGInDarkMode: true, invertBitmapInDarkmode: false } });
    } else {
      if (!original?.dataURL) throw new CLIError("ASSETS_UNAVAILABLE", "A required thumbnail image is missing; select placeholder instead.");
      const key = `${element.fileId}:${policy?.thumbnailMaxDimension ?? 512}`;
      let reduced = thumbnails.get(key);
      if (!reduced) { reduced = await thumbnail(original, policy?.thumbnailMaxDimension ?? 512, check); thumbnails.set(key, reduced); }
      resultFiles[fileId] = { id: fileId, mimeType: "image/png", dataURL: reduced.url as BinaryFileData["dataURL"], created: Date.now() };
      const x = reduced.width / reduced.originalWidth, y = reduced.height / reduced.originalHeight;
      resultElements.push({ ...element, fileId, status: "saved", crop: element.crop ? {
        x: element.crop.x * x, y: element.crop.y * y, width: element.crop.width * x, height: element.crop.height * y,
        naturalWidth: reduced.width, naturalHeight: reduced.height,
      } : null });
    }
  }
  return { elements: resultElements, files: resultFiles };
}
