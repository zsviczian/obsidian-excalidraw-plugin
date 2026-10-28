/** Compact machine schemas generated from the command and operation registries. */
import type { CLICommand } from "src/types/excalidrawCliTypes";
import { CLI_COMMANDS } from "./cliCommands";
import { CLI_OPERATION_FIELDS } from "./cliApply";
import { CLI_SHAPES, CLI_STYLE_FIELDS } from "./cliElements";
import { CLI_ICON_FIELDS } from "./cliIcons";

const required: Partial<Record<CLICommand, string[]>> = {
  schema: ["action"], read: ["path"], open: ["path"], create: ["requestId", "path"],
  apply: ["requestId", "path", "expectedRevision", "operations"], export: ["requestId", "path", "out"],
  script: ["requestId", "script", "trusted"], result: ["requestId"],
};
const operationRequired: Record<string, string[]> = {
  lucide: ["id", "icon"],
  add: ["elements"], update: ["id", "set"], delete: ["ids"], connect: ["from", "to"],
  group: ["ids"], ungroup: ["ids", "groupId"], image: ["asset"], imageMetadata: ["id"], latex: ["text"],
};
function property(name: string): Record<string, unknown> {
  if (["x", "y", "size", "width", "height", "angle", "fontSize", "fontFamily", "opacity", "strokeWidth", "roughness", "offset", "limit", "padding", "scale", "scaleX", "scaleY", "maxWidth", "maxHeight", "maxPixels", "maxArtifactBytes"].includes(name)) return { type: "number" };
  if (name === "icons") return { type: "array", maxItems: 100, items: { type: "object", required: ["id", "icon"], additionalProperties: false, properties: Object.fromEntries(CLI_ICON_FIELDS.map(field => [field, property(field)])) } };
  if (["overwrite", "trusted", "selectedOnly", "locked"].includes(name)) return { type: "boolean" };
  if (name === "ids" || name === "children") return { type: "array", items: { type: "string" } };
  if (name === "elements") return { type: "array", maxItems: 500, items: { $ref: "#/$defs/skeleton" } };
  if (name === "operations") return { type: "array", minItems: 1, maxItems: 100, items: { $ref: "#/$defs/operation" } };
  if (name === "set") return { type: "object", additionalProperties: false, properties: Object.fromEntries(CLI_STYLE_FIELDS.map(key => [key, property(key)])) };
  if (name === "args") return {};
  if (name === "imagePolicy") return {
    type: "object", additionalProperties: false,
    properties: {
      default: { enum: ["original", "thumbnail", "placeholder"] },
      thumbnailMaxDimension: { type: "integer", minimum: 64, maximum: 2048 },
      labels: { type: "object", maxProperties: 100, additionalProperties: { type: "string", maxLength: 80, minLength: 1 } },
      rules: { type: "array", maxItems: 32, items: {
        type: "object", additionalProperties: false, required: ["mode"],
        properties: {
          mode: { enum: ["original", "thumbnail", "placeholder"] },
          ids: { type: "array", minItems: 1, maxItems: 100, items: { type: "string", maxLength: 100 } },
          tags: { type: "array", minItems: 1, maxItems: 20, items: { type: "string", maxLength: 32 } },
          mimeTypes: { type: "array", minItems: 1, maxItems: 20, items: { type: "string", maxLength: 80 } },
          maxBytes: { type: "integer", minimum: 0, maximum: 1073741824 },
        },
        anyOf: [{ required: ["ids"] }, { required: ["tags"] }, { required: ["mimeTypes"] }, { required: ["maxBytes"] }],
      } },
    },
  };
  if (name === "tags") return { anyOf: [{ type: "null" }, { type: "array", maxItems: 12, uniqueItems: true, items: { type: "string", maxLength: 32 } }] };
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
      operation: { oneOf: Object.entries(CLI_OPERATION_FIELDS).map(([op, fields]) => ({ type: "object", required: ["op", ...operationRequired[op]], additionalProperties: false, properties: { op: { const: op }, ...Object.fromEntries(fields.map(name => [name, name === "children" ? { enum: ["delete", "detach"] } : op === "image" && name === "scale" ? { type: "boolean" } : op === "imageMetadata" && name === "label" ? { type: ["string", "null"], maxLength: 80 } : property(name)])) }, ...(op === "imageMetadata" ? { anyOf: [{ required: ["label"] }, { required: ["tags"] }] } : {}) })) },
    } } : {}),
  };
}
