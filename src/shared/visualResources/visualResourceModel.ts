import type {
  VisualDiscoveryCandidate, VisualDiscoveryRule, VisualResource, VisualResourceFilter, VisualResourceLocator,
} from "src/types/visualResourceTypes";
import type { ExcalidrawElement } from "@zsviczian/excalidraw/types/element/src/types";

const ICON_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "svg", "webp"];
export const MAX_THUMBNAIL_ELEMENTS = 2400;
export const DRAWING_PREVIEW_SOURCE_BYTES = 1024 * 1024;
export const DRAWING_PREVIEW_SCENE_LENGTH = 6 * 1024 * 1024;
export const VISUAL_RESOURCE_FILTERS: readonly VisualResourceFilter[] = ["icon", "lucide", "image", "drawing", "stencil", "framework", "other"];

export const DEFAULT_ICON_RULES: readonly VisualDiscoveryRule[] = ["Icon", "Stickfigure", "Logo"].map(name => ({
  name, pattern: "^" + name.toLowerCase() + " - (.*?)(?: - [^-]+)?$",
}));

export function drawingPreviewGeometryBudget() {
  return { elements: MAX_THUMBNAIL_ELEMENTS, points: 64_000, text: 12_000 };
}

/** Limit the geometry across a thumbnail and the drawings embedded in it. */
export function admitDrawingPreview(elements: readonly ExcalidrawElement[], budget = drawingPreviewGeometryBudget()): boolean {
  if (elements.length > budget.elements) return false;
  let points = 0;
  let textLength = 0;
  for (const element of elements) {
    if (element.isDeleted) continue;
    if ("points" in element) points += element.points.length;
    if (element.type === "text") textLength += element.text.length;
    if (points > budget.points || textLength > budget.text) return false;
  }
  budget.elements -= elements.length;
  budget.points -= points;
  budget.text -= textLength;
  return true;
}

/** Provider-qualified identity. A native stencil ID survives an ownership change. */
export function visualResourceKey(locator: VisualResourceLocator): string {
  switch (locator.provider) {
    case "vault": return JSON.stringify([locator.provider, locator.path, locator.frame ?? null]);
    case "lucide": return JSON.stringify([locator.provider, locator.icon]);
    case "stencil": return JSON.stringify([locator.provider, locator.id]);
    case "framework": return JSON.stringify([locator.provider, locator.path, locator.id]);
  }
}

/** Read the installed script's data without modifying its file or settings. */
export function readIconLibrarySettings(saved: Record<string, unknown> = {}) {
  const rules = Array.isArray(saved.filters) ? saved.filters.flatMap((value: unknown) => {
    if (!value || typeof value !== "object") return [];
    const rule = value as Record<string, unknown>;
    const string = (key: string) => typeof rule[key] === "string" ? String(rule[key]) : "";
    return [{ name: string("name") || "Unnamed", pattern: string("pattern"),
      folderPattern: string("folderPattern"), extensions: string("extensions"),
      // The installed script reads maxSize in its actual discovery loop.
      maxKb: typeof rule.maxSize === "number" || typeof rule.maxSize === "string" ? String(rule.maxSize) : "",
    }];
  }) : [...DEFAULT_ICON_RULES];
  const names = Array.isArray(saved.activeFilterNames) ? saved.activeFilterNames.filter((name): name is string => typeof name === "string") : rules.map(rule => rule.name);
  return {
    rules,
    groups: names.map(name => "icon:" + name),
    exclusion: typeof saved.excludeFolders === "string" ? saved.excludeFolders : "",
    iconWidth: typeof saved.defaultIconWidth === "number" && saved.defaultIconWidth > 0 ? saved.defaultIconWidth : 180,
    thumbnailSize: typeof saved.thumbSize === "number" && saved.thumbSize > 0 ? saved.thumbSize : 100,
    lightBackground: typeof saved.lightBgColor === "string" ? saved.lightBgColor : "#FFFFFF60",
    darkBackground: typeof saved.darkBgColor === "string" ? saved.darkBgColor : "#FFFFFF60",
  };
}

/** Folder exclusions retain the installed Icon Library's prefix semantics. */
export function compileVisualExclusions(exclusion: string): (path: string) => boolean {
  const prefixes = exclusion.split(/[\n,]/).map(path => path.trim()).filter(Boolean);
  return path => prefixes.some(prefix => path.startsWith(prefix));
}

/** Compile once per discovery pass. Rules are AND within a block and OR between blocks. */
export function compileVisualRules(kind: "icon" | "drawing" | "frame", rules: readonly VisualDiscoveryRule[]) {
  const compiled = rules.flatMap(rule => {
    try {
      return [{
        rule,
        keyword: new RegExp(rule.pattern, "i"),
        folder: rule.folderPattern ? new RegExp(rule.folderPattern, "i") : null,
        extensions: rule.extensions?.split(",").map(extension => extension.trim().toLowerCase().replace(/^\./, "")).filter(Boolean) ?? [],
        maxKb: Number.parseFloat(rule.maxKb ?? ""),
      }];
    } catch { return []; }
  });
  return (file: VisualDiscoveryCandidate) => compiled.flatMap(({ rule, keyword, folder, extensions, maxKb }) => {
    if (kind === "drawing" && !file.drawing || kind === "frame" && !file.frame) return [];
    if (kind === "icon" && !extensions.length && !file.drawing && !ICON_EXTENSIONS.includes(file.extension)) return [];
    if (extensions.length && !extensions.includes(file.extension)) return [];
    if (folder && !folder.test(file.folder) || Number.isFinite(maxKb) && file.size / 1024 > maxKb) return [];
    if (rule.frameType && rule.frameType !== file.frame?.type) return [];
    if (rule.property) {
      const property = file.properties?.[rule.property];
      const values = Array.isArray(property) ? property : [property];
      const wanted = rule.property === "tags" ? rule.value?.replace(/^#/, "") : rule.value;
      if (property === undefined || wanted && !values.some(value => String(value).toLowerCase() === wanted.toLowerCase())) return [];
    }
    const match = keyword.exec(file.frame?.name ?? file.basename);
    if (!match) return [];
    return [{ group: kind + ":" + rule.name, keyword: match[1]?.trim() || file.frame?.name || file.basename }];
  });
}

/** Apply independent resource-kind, discovery-group, and text filters. */
export function filterVisualResources(resources: readonly VisualResource[], query: string, filters: readonly VisualResourceFilter[], groups?: readonly string[],
  hasNamedFrames = false): VisualResource[] {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const allowGroup = (resource: VisualResource, prefix: string) => {
    if (groups === undefined) return true;
    const matches = resource.groups?.filter(group => group.startsWith(prefix + ":"));
    return !matches?.length || matches.some(group => groups.includes(group));
  };
  return resources.filter(resource => {
    const kind = resource.locator.provider === "lucide" ? "lucide" :
      resource.kind === "frame" ? "drawing" : resource.kind === "note" ? "image" : resource.kind;
    const drawing = kind === "drawing" && filters.includes("drawing");
    const icon = filters.includes("icon") && (kind === "icon" || resource.groups?.some(group => group.startsWith("icon:"))) &&
      allowGroup(resource, "icon");
    const category = drawing ? resource.kind === "frame" || allowGroup(resource, "drawing") && (!hasNamedFrames || !!resource.frames?.length) :
      kind !== "icon" && kind !== "drawing" && filters.includes(kind);
    if (resource.other ? !filters.includes("other") || drawing && hasNamedFrames && !resource.frames?.length : !category && !icon) return false;
    const text = [resource.title, resource.source, ...resource.keywords,
      ...(drawing ? resource.frames?.flatMap(frame => [frame.title, ...frame.keywords]) ?? [] : [])].join(" ").toLowerCase();
    return terms.every(term => text.includes(term));
  });
}
