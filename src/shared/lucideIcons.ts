/** Installed Obsidian SVGs share one atomic native preparation path for UI, EA and CLI. */
import { getIcon, getIconIds } from "obsidian";
import chroma from "chroma-js";
import { nanoid } from "src/constants/constants";
import type { LucideIconEntry, LucideIconOptions, LucideIconResult } from "src/types/lucideTypes";
import { svgToExcalidraw } from "./svgToExcalidraw/parser";

/** Returns only installed Lucide-prefixed entries; no alias guesses or remote catalog. */
export function getLucideIcons(query = ""): LucideIconEntry[] {
  const search = query.toLowerCase().trim().replace(/\s+/g, "-");
  return [...new Set(getIconIds())]
    .filter(icon => icon.startsWith("lucide-") && icon.toLowerCase().includes(search))
    .sort()
    .map(icon => ({ icon, name: icon.slice(7).replace(/-/g, " ") }));
}

function finite(value: number | undefined, fallback: number, min: number, max: number): number {
  const result = value === undefined ? fallback : value;
  if (typeof result !== "number" || !Number.isFinite(result) || result < min || result > max)
    throw new Error("Invalid Lucide icon numeric option");
  return result;
}

/**
 * Prepares a complete independent icon without touching a workbench, view, or asset store.
 * Unsupported/omitted geometry and clipping are fatal; native stroke/compositing
 * approximations are returned as warning codes. Samples curves at the final scale.
 */
export function prepareLucideIcon(options: LucideIconOptions, defaults = {
  strokeColor: "#1e1e1e", roughness: 1, opacity: 100,
}) {
  if (!options || typeof options.icon !== "string" || !/^(?:lucide-)?[a-z0-9]+(?:-[a-z0-9]+)*$/.test(options.icon))
    throw new Error("Invalid Lucide icon name");
  const icon = options.icon.startsWith("lucide-") ? options.icon : `lucide-${options.icon}`;
  if (!getIconIds().includes(icon)) throw new Error("Unknown installed Lucide icon");
  const x = finite(options.x, 0, -1_000_000, 1_000_000);
  const y = finite(options.y, 0, -1_000_000, 1_000_000);
  const size = finite(options.size, 96, 1, 10_000);
  const roughness = finite(options.roughness, defaults.roughness, 0, 3);
  const opacity = finite(options.opacity, defaults.opacity, 0, 100);
  const color = options.strokeColor ?? defaults.strokeColor;
  if (typeof color !== "string" || color.length > 128 || !chroma.valid(color))
    throw new Error("Invalid Lucide stroke color");
  const source = getIcon(icon);
  if (!source) throw new Error("Installed Lucide icon has no SVG");
  const svg = source.cloneNode(true) as SVGSVGElement;
  const box = (svg.getAttribute("viewBox") ?? "").trim().split(/[\s,]+/).map(Number);
  if (box.length !== 4 || box.some(value => !Number.isFinite(value)) || box[2] <= 0 || box[3] <= 0)
    throw new Error("Lucide icon requires a finite positive viewBox");
  const scale = size / Math.max(box[2], box[3]);
  const width = box[2] * scale, height = box[3] * scale;
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.setAttribute("color", color);
  if (options.strokeWidth !== undefined) {
    const strokeWidth = finite(options.strokeWidth, 0, 0.01, 100) / scale;
    svg.setAttribute("stroke-width", String(strokeWidth));
    for (const node of Array.from(svg.querySelectorAll("[stroke-width]")))
      node.setAttribute("stroke-width", String(strokeWidth));
  }
  const converted = svgToExcalidraw(svg.outerHTML);
  if (converted.hasErrors || !converted.content.length || converted.warnings.some(warning =>
    warning === "unsupported" || warning === "css" || warning === "viewport"))
    throw new Error(`Lucide icon ${icon} could not be converted completely: ${
      converted.hasErrors ? converted.errors : !converted.content.length ? "empty geometry" : converted.warnings.join(", ")
    }`);
  const groupId = nanoid();
  for (const element of converted.content) {
    // Match the version-1 creation contract of other EA constructors.
    element.version = 1;
    element.x += x;
    element.y += y;
    element.roughness = roughness;
    element.opacity *= opacity / 100;
    element.groupIds = [...element.groupIds, groupId];
  }
  const result: LucideIconResult = {
    icon, groupId, elementIds: converted.content.map(element => element.id),
    warnings: converted.warnings, viewport: { x, y, width, height },
  };
  return { elements: converted.content, result };
}
