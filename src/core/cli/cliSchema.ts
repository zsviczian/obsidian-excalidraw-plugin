/** Compact machine schemas generated from the command and operation registries. */
import type { CLICommand } from "src/types/excalidrawCliTypes";
import { CLI_COMMANDS } from "./cliCommands";
import { CLI_OPERATION_FIELDS } from "./cliApply";
import { CLI_SHAPES, CLI_STYLE_FIELDS } from "./cliElements";

const required: Partial<Record<CLICommand, string[]>> = {
  schema: ["action"], read: ["path"], open: ["path"], create: ["requestId", "path"],
  apply: ["requestId", "path", "expectedRevision", "operations"], export: ["requestId", "path", "out"],
  script: ["requestId", "script", "trusted"], result: ["requestId"],
};
const operationRequired: Record<string, string[]> = {
  add: ["elements"], update: ["id", "set"], delete: ["ids"], connect: ["from", "to"],
  group: ["ids"], ungroup: ["ids", "groupId"], image: ["asset"], latex: ["text"],
};
function property(name: string): Record<string, unknown> {
  if (["x", "y", "width", "height", "angle", "fontSize", "fontFamily", "opacity", "strokeWidth", "roughness", "offset", "limit", "padding", "scale", "scaleX", "scaleY"].includes(name)) return { type: "number" };
  if (["overwrite", "trusted", "selectedOnly", "locked"].includes(name)) return { type: "boolean" };
  if (name === "ids" || name === "children") return { type: "array", items: { type: "string" } };
  if (name === "elements") return { type: "array", maxItems: 500, items: { $ref: "#/$defs/skeleton" } };
  if (name === "operations") return { type: "array", minItems: 1, maxItems: 100, items: { $ref: "#/$defs/operation" } };
  if (name === "set") return { type: "object", additionalProperties: false, properties: Object.fromEntries(CLI_STYLE_FIELDS.map(key => [key, property(key)])) };
  if (name === "args") return {};
  if (["area", "roundness", "label", "start", "end"].includes(name)) return { type: "object" };
  if (name === "points") return { type: "array", minItems: 2, maxItems: 100, items: { type: "array", minItems: 2, maxItems: 2, items: { type: "number" } } };
  if (name === "link") return { type: ["string", "null"] };
  return { type: "string" };
}

/** Runtime guards remain authoritative for geometry, relationship and lifecycle constraints. */
export function commandSchema(command: CLICommand): Record<string, unknown> {
  const skeletonFields = [...CLI_STYLE_FIELDS, "id", "type", "roundness", "label", "points", "start", "end", "startArrowhead", "endArrowhead", "children", "name"];
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema", type: "object", additionalProperties: false,
    required: ["apiVersion", "command", ...(required[command] ?? [])],
    properties: { apiVersion: { const: 1 }, command: { const: command },
      ...Object.fromEntries(Object.entries(CLI_COMMANDS[command].fields).map(([name, description]) => [name, { ...property(name), description }])),
      requestId: { type: "string", pattern: "^[A-Za-z0-9_.-]{1,80}$" },
    },
    ...(command === "create" || command === "apply" ? { $defs: {
      skeleton: { type: "object", required: ["type"], additionalProperties: false, properties: { ...Object.fromEntries(skeletonFields.map(name => [name, property(name)])), type: { enum: CLI_SHAPES }, roundness: { type: ["object", "null"] }, name: { type: ["string", "null"] }, startArrowhead: { type: ["string", "null"] }, endArrowhead: { type: ["string", "null"] } } },
      operation: { oneOf: Object.entries(CLI_OPERATION_FIELDS).map(([op, fields]) => ({ type: "object", required: ["op", ...operationRequired[op]], additionalProperties: false, properties: { op: { const: op }, ...Object.fromEntries(fields.map(name => [name, name === "children" ? { enum: ["delete", "detach"] } : property(name)])) } })) },
    } } : {}),
  };
}
