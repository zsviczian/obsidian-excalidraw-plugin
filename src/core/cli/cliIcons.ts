/** Native icon requests stage through EA with deterministic, view-independent defaults. */
import type { ExcalidrawElement } from "@zsviczian/excalidraw/types/element/src/types";
import type { ExcalidrawAutomate } from "src/shared/ExcalidrawAutomate";
import type { LucideIconOptions, LucideIconResult } from "src/types/lucideTypes";
import { CLIError, number, object, string } from "./cliProtocol";
import { fields } from "./cliElements";

export const CLI_ICON_FIELDS = ["id", "icon", "x", "y", "size", "strokeColor", "strokeWidth", "roughness", "opacity"];

/** Strict finite options; logical IDs are separate from group and element identities. */
export function validateCLIIcon(input: unknown): { id: string; options: LucideIconOptions } {
  const value = object(input, "icon");
  fields(value, CLI_ICON_FIELDS);
  const id = string(value.id, "id");
  if (id.length > 100 || ["__proto__", "constructor", "prototype"].includes(id))
    throw new CLIError("INVALID_INPUT", "Invalid logical icon ID.", "id");
  return { id, options: {
    icon: string(value.icon, "icon"),
    x: number(value.x, "x", 0, -1_000_000, 1_000_000),
    y: number(value.y, "y", 0, -1_000_000, 1_000_000),
    size: number(value.size, "size", 96, 1, 10_000),
    strokeColor: value.strokeColor === undefined ? "#1e1e1e" : string(value.strokeColor, "strokeColor"),
    roughness: number(value.roughness, "roughness", 1, 0, 3),
    opacity: number(value.opacity, "opacity", 100, 0, 100),
    ...(value.strokeWidth === undefined ? {} : { strokeWidth: number(value.strokeWidth, "strokeWidth", 1, 0.01, 100) }),
  } };
}

/** Expanded members/points, including existing/template content, bound the whole request. */
export function checkIconBudget(elements: readonly ExcalidrawElement[]): void {
  if (elements.length > 5000 || elements.reduce((total, element) => total +
    ("points" in element ? element.points.length : 0), 0) > 100_000)
    throw new CLIError("INVALID_INPUT", "Icon request exceeds 5000 scene elements or 100000 points.", "icons");
}

/** Appends only to request-owned EA; callers publish once after every operation succeeds. */
export function stageCLIIcon(ea: ExcalidrawAutomate, input: unknown,
  idMap: Record<string, string>, groupMap: Record<string, LucideIconResult>, occupied: readonly string[] = []): LucideIconResult {
  const { id, options } = validateCLIIcon(input);
  if (Object.hasOwn(idMap, id) || Object.hasOwn(groupMap, id) || occupied.includes(id))
    throw new CLIError("INVALID_INPUT", "Icon ID conflicts with another alias or element.", "id");
  try {
    const result = ea.addLucideIcon(options);
    groupMap[id] = result;
    checkIconBudget(ea.getElements());
    return result;
  } catch (error) {
    if (error instanceof CLIError) throw error;
    throw new CLIError("INVALID_INPUT", error instanceof Error ? error.message : "Cannot construct installed Lucide icon.", "icon");
  }
}
