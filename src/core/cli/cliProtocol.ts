/** Small, dependency-free guards for the finite CLI protocol. */
import type { CLIJSON, ExcalidrawCLIResult } from "src/types/excalidrawCliTypes";

export const CLI_INPUT_LIMIT = 2 * 1024 * 1024;
export const CLI_OUTPUT_LIMIT = 512 * 1024;

/** A protocol failure with actionable recovery, without a private stack trace. */
export class CLIError extends Error {
  public constructor(public readonly code: string, message: string, public readonly field?: string,
    public readonly recovery = "Read the command schema and correct the request.",
    public readonly outcome: Partial<ExcalidrawCLIResult> = {}) {
    super(message);
  }
}

/** Rejects arrays and primitives where an object is required. */
export function object(value: unknown, field = "request"): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CLIError("INVALID_INPUT", "Expected an object.", field);
  return value as Record<string, unknown>;
}

/** Validates and copies plain JSON, excluding prototypes, nonfinite values and oversized output. */
export function jsonValue(value: unknown, limit = CLI_OUTPUT_LIMIT): CLIJSON {
  const visit = (item: unknown, depth: number): void => {
    if (depth > 30) throw new CLIError("INVALID_INPUT", "JSON nesting exceeds 30 levels.");
    if (item === null || typeof item === "string" || typeof item === "boolean") return;
    if (typeof item === "number" && Number.isFinite(item)) return;
    if (Array.isArray(item)) { item.forEach(entry => visit(entry, depth + 1)); return; }
    if (item && typeof item === "object") {
      const prototype: unknown = Object.getPrototypeOf(item);
      const constructor: unknown = prototype && Object.getOwnPropertyDescriptor(prototype, "constructor")?.value;
      if (prototype !== null && (typeof constructor !== "function" || constructor.name !== "Object")) throw new CLIError("INVALID_INPUT", "Expected a plain JSON object.");
      for (const [key, entry] of Object.entries(item)) {
        if (["__proto__", "prototype", "constructor"].includes(key)) throw new CLIError("INVALID_INPUT", "Unsafe JSON key.", key);
        visit(entry, depth + 1);
      }
      return;
    }
    throw new CLIError("INVALID_INPUT", "Expected plain, finite JSON values.");
  };
  try { visit(value, 0); } catch (error) {
    if (error instanceof CLIError) throw error;
    throw new CLIError("INVALID_INPUT", "Cannot serialize the supplied value.");
  }
  const encoded = JSON.stringify(value);
  if (new TextEncoder().encode(encoded).length > limit) throw new CLIError("INVALID_INPUT", "JSON exceeds the size limit.");
  return JSON.parse(encoded) as CLIJSON;
}

/** Exact vault paths; normalization must never silently reinterpret a target. */
export function vaultPath(value: unknown, field = "path"): string {
  if (typeof value !== "string" || !value || value.length > 1024 || /[\\:#|?*<>]/.test(value) || [...value].some(char => char.charCodeAt(0) < 32) ||
    value.startsWith("/") || value.split("/").some(part => !part || part === "." || part === ".." || part.startsWith("."))) {
    throw new CLIError("INVALID_INPUT", "Expected an exact, visible vault-relative path.", field);
  }
  return value;
}

/** Requires a string without truthy/falsy coercion. */
export function string(value: unknown, field: string): string {
  if (typeof value !== "string" || !value || value.length > 10000) throw new CLIError("INVALID_INPUT", "Expected a nonempty string.", field);
  return value;
}

/** Bounded numeric option, preserving deliberate zero values. */
export function number(value: unknown, field: string, fallback: number, min: number, max: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) throw new CLIError("INVALID_INPUT", "Number is outside the permitted range.", field);
  return value;
}

/** Strict boolean option; native bare flags normalize before this guard. */
export function boolean(value: unknown, field: string, fallback = false): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") throw new CLIError("INVALID_INPUT", "Expected a boolean.", field);
  return value;
}

/** Stable key ordering for retries; compare complete values rather than a weak hash. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(object(value)).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`).join(",")}}`;
  return JSON.stringify(value);
}

/** Compact content revision, using two independent 32-bit streams and length. */
export function fingerprint(text: string): string {
  let a = 2166136261, b = 5381;
  for (let i = 0; i < text.length; i++) { const c = text.charCodeAt(i); a = Math.imul(a ^ c, 16777619); b = Math.imul(b, 33) ^ c; }
  return `${text.length.toString(36)}-${(a >>> 0).toString(36)}-${(b >>> 0).toString(36)}`;
}
