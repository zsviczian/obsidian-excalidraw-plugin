/** Validate and construct request-local skeleton batches using the installed fork. */
import type { ExcalidrawElementSkeleton } from "@zsviczian/excalidraw/types/element/src/transform";
import type { Packages } from "src/types/types";
import { nanoid } from "src/constants/constants";
import { CLIError, boolean, number, object, string } from "./cliProtocol";

export const CLI_SHAPES = ["rectangle", "ellipse", "diamond", "text", "arrow", "line", "frame", "stickynote"];
export const CLI_STYLE_FIELDS = ["x", "y", "width", "height", "angle", "strokeColor", "backgroundColor", "fillStyle", "strokeWidth", "strokeStyle", "roughness", "opacity", "locked", "link", "text", "fontSize", "fontFamily", "textAlign", "verticalAlign"];
const skeletonFields = new Set([...CLI_STYLE_FIELDS, "id", "type", "roundness", "label", "points", "start", "end", "startArrowhead", "endArrowhead", "children", "name"]);
const arrowheads = ["arrow", "bar", "circle", "circle_outline", "triangle", "triangle_outline", "diamond", "diamond_outline"];

/** Rejects unsupported keys before staging any work. */
export function fields(value: Record<string, unknown>, allowed: readonly string[]): void {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new CLIError("INVALID_INPUT", "Unsupported field; use a trusted EA script for advanced relationships or metadata.", key);
}

/** Validates the finite assignable style/geometry surface shared by batches and updates. */
export function validateStyle(value: Record<string, unknown>): void {
  for (const key of ["x", "y", "angle"]) if (value[key] !== undefined) number(value[key], key, 0, -1_000_000, 1_000_000);
  for (const key of ["width", "height"]) if (value[key] !== undefined) number(value[key], key, 0, 0, 100_000);
  for (const [key, min, max] of [["opacity", 0, 100], ["strokeWidth", 0, 100], ["roughness", 0, 3], ["fontSize", 1, 1000], ["fontFamily", 1, 10]] as const) {
    if (value[key] !== undefined) number(value[key], key, min, min, max);
  }
  if (value.fontFamily !== undefined && !Number.isInteger(value.fontFamily)) throw new CLIError("INVALID_INPUT", "Font family must be an installed numeric family ID.", "fontFamily");
  for (const [key, options] of Object.entries({ fillStyle: ["hachure", "cross-hatch", "solid", "zigzag"], strokeStyle: ["solid", "dashed", "dotted"], textAlign: ["left", "center", "right"], verticalAlign: ["top", "middle", "bottom"] })) {
    if (value[key] !== undefined && !options.includes(string(value[key], key))) throw new CLIError("INVALID_INPUT", "Unknown option.", key);
  }
  for (const key of ["strokeColor", "backgroundColor"]) if (value[key] !== undefined) string(value[key], key);
  if (value.text !== undefined && (typeof value.text !== "string" || value.text.length > 10000)) throw new CLIError("INVALID_INPUT", "Text must be a string of at most 10000 characters.", "text");
  if (value.link !== undefined && value.link !== null) string(value.link, "link");
  if (value.locked !== undefined) boolean(value.locked, "locked");
}

/** Complete validation precedes conversion; relationship references are batch-local. */
export function validateBatch(input: unknown): Record<string, unknown>[] {
  if (!Array.isArray(input) || input.length > 500) throw new CLIError("INVALID_INPUT", "Expected at most 500 skeletons.", "elements");
  const batch = input.map((entry, index) => {
    const element = object(entry, `elements[${index}]`);
    fields(element, [...skeletonFields]); validateStyle(element);
    if (!CLI_SHAPES.includes(string(element.type, "type"))) throw new CLIError("INVALID_INPUT", "Unsupported skeleton type.", "type");
    if (element.type !== "frame") { number(element.x, "x", 0, -1_000_000, 1_000_000); number(element.y, "y", 0, -1_000_000, 1_000_000); }
    if (element.type === "text" && typeof element.text !== "string") throw new CLIError("INVALID_INPUT", "Text skeleton requires text.", "text");
    if (element.type !== "text" && ["text", "fontSize", "fontFamily", "textAlign", "verticalAlign"].some(key => key in element)) throw new CLIError("INVALID_INPUT", "Use label for container text and its font options.", "label");
    if (element.id !== undefined && ["__proto__", "constructor", "prototype"].includes(string(element.id, "id"))) throw new CLIError("INVALID_INPUT", "Reserved local ID.", "id");
    if (element.name !== undefined) {
      if (element.type !== "frame") throw new CLIError("INVALID_INPUT", "Name requires a frame.", "name");
      if (element.name !== null) string(element.name, "name");
    }
    if (element.label !== undefined) {
      if (!["rectangle", "ellipse", "diamond", "arrow", "stickynote"].includes(string(element.type, "type"))) throw new CLIError("INVALID_INPUT", "This element cannot have a bound label.", "label");
      const label = object(element.label, "label");
      fields(label, ["text", "fontSize", "fontFamily", "textAlign", "verticalAlign"]); validateStyle(label);
      if (typeof label.text !== "string") throw new CLIError("INVALID_INPUT", "Label requires text.", "label.text");
    }
    if (element.roundness !== undefined && element.roundness !== null) {
      const roundness = object(element.roundness, "roundness"); fields(roundness, ["type", "value"]);
      if (typeof roundness.type !== "number" || ![1, 2, 3].includes(roundness.type)) throw new CLIError("INVALID_INPUT", "Unknown roundness type.", "roundness");
      if (roundness.value !== undefined) number(roundness.value, "roundness.value", 0, 0, 1000);
    }
    if (element.points !== undefined) {
      if (!["line", "arrow"].includes(string(element.type, "type")) || !Array.isArray(element.points) || element.points.length < 2 || element.points.length > 100) throw new CLIError("INVALID_INPUT", "Expected 2–100 linear points.", "points");
      for (const point of element.points) {
        if (!Array.isArray(point) || point.length !== 2) throw new CLIError("INVALID_INPUT", "Expected [x,y] point.", "points");
        point.forEach(coordinate => number(coordinate, "points", 0, -100000, 100000));
      }
    }
    for (const key of ["startArrowhead", "endArrowhead"]) if (element[key] !== undefined) {
      if (!["arrow", "line"].includes(string(element.type, "type"))) throw new CLIError("INVALID_INPUT", "Arrowheads require a linear element.", key);
      if (element[key] !== null && !arrowheads.includes(string(element[key], key))) throw new CLIError("INVALID_INPUT", "Unknown arrowhead.", key);
    }
    return element;
  });
  const labels = batch.map((element, index) => element.id === undefined ? `@${index}` : string(element.id, "id"));
  if (new Set(labels).size !== labels.length) throw new CLIError("INVALID_INPUT", "Duplicate skeleton IDs.", "id");
  const parented = new Set<string>();
  for (const element of batch) {
    for (const key of ["start", "end"]) if (element[key] !== undefined) {
      if (element.type !== "arrow") throw new CLIError("INVALID_INPUT", "Bindings require an arrow.", key);
      const endpoint = object(element[key], key); fields(endpoint, ["id"]);
      const id = string(endpoint.id, `${key}.id`), target = batch[labels.indexOf(id)];
      if (!target || !["rectangle", "ellipse", "diamond", "text", "stickynote"].includes(string(target.type, "type"))) throw new CLIError("INVALID_INPUT", "Binding must reference a bindable element in this batch; use connect for existing elements.", key);
    }
    if (element.type === "frame") {
      if (!Array.isArray(element.children)) throw new CLIError("INVALID_INPUT", "Frame requires children IDs.", "children");
      for (const value of element.children) {
        const id = string(value, "children"), target = batch[labels.indexOf(id)];
        if (!target || target.type === "frame" || parented.has(id)) throw new CLIError("INVALID_INPUT", "Frame child is missing, repeated or a nested frame.", "children");
        parented.add(id);
      }
    } else if (element.children !== undefined) throw new CLIError("INVALID_INPUT", "Children require a frame.", "children");
  }
  return batch;
}

/** Maps every requested/generated ID before the installed converter creates labels and bindings. */
export function constructBatch(input: unknown, lib: NonNullable<Packages["excalidrawLib"]>, occupied: Iterable<string> = []) {
  const batch = validateBatch(input), used = new Set(occupied);
  const allocate = () => { let id: string; do { id = nanoid(); } while (used.has(id)); used.add(id); return id; };
  const idMap: Record<string, string> = {};
  const mapped: Record<string, unknown>[] = batch.map((element, index) => {
    const label = element.id === undefined ? `@${index}` : string(element.id, "id");
    const id = allocate(); idMap[label] = id;
    return { ...element, id, ...(element.type !== "frame" ? { x: element.x ?? 0, y: element.y ?? 0 } : {}) };
  });
  for (const element of mapped) {
    if (element.label) element.label = { ...object(element.label), id: allocate() };
    for (const key of ["start", "end"]) if (element[key]) element[key] = { id: idMap[string(object(element[key]).id, "id")] };
    if (element.children) element.children = (element.children as string[]).map(id => idMap[id]);
  }
  // Runtime guards above establish the canonical fork skeleton union. No persisted
  // identity/version/asset fields are accepted at this untrusted boundary.
  const elements = lib.convertToExcalidrawElements(mapped as unknown as ExcalidrawElementSkeleton[], { regenerateIds: false });
  const ids = new Set(elements.map(element => element.id));
  if (ids.size !== elements.length || Object.values(idMap).some(id => !ids.has(id)) || elements.some(element => !CLI_SHAPES.includes(element.type) || element.id.length !== 8)) throw new CLIError("INVALID_INPUT", "Converter did not preserve the requested batch identities.", "elements");
  for (const element of elements) {
    validateStyle(element);
    const references = [...(element.boundElements ?? []).map(bound => bound.id), element.frameId,
      ...(element.type === "text" ? [element.containerId] : []),
      ...(element.type === "arrow" ? [element.startBinding?.elementId, element.endBinding?.elementId] : [])].filter(Boolean);
    if (references.some(id => !ids.has(id))) throw new CLIError("INVALID_INPUT", "Converter returned a dangling relationship.", "elements");
  }
  return { elements, idMap };
}
