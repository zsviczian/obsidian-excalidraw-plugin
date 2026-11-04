import { normalizePath } from "obsidian";

/** Validate a new-note destination without normalizing away parent traversal or filename separators. */
export function newFileDestination(folder: string, filename: string): string | null {
  const name = filename.trim();
  const directory = folder.trim().replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
  const segments = [...directory.split("/").filter(Boolean), name];
  if (!name || /[\\/]/.test(name) || segments.some(segment => segment === "." || segment === ".."
    || [...segment].some(character => (character.codePointAt(0) ?? 0) < 32 || '<>:"|?*'.includes(character)))) return null;
  return normalizePath(`${directory ? `${directory}/` : ""}${name.endsWith(".md") ? name : `${name}.md`}`);
}
