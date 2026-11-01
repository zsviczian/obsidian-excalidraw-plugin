/** Bounded SVG-local custom properties. Never read host styles or resolve external resources. */
import type {
  SVGConversionState,
  SVGStyle,
} from "src/types/svgConversionTypes";

// XML cannot contain NUL. Keep invalid declarations distinct from valid empty values.
const invalid = "\0";
const variableName = /^--[\w-]+$/;

function substitute(
  value: string,
  lookup: (name: string) => string | null,
  state: SVGConversionState,
  depth = 0,
): string | null {
  if (depth > 32 || value.length > 8192)
    throw Error("SVG CSS variable limit exceeded");
  let output = "",
    quote = "";
  for (let i = 0; i < value.length; ) {
    if (++state.operations > 8000000)
      throw Error("SVG stylesheet work limit exceeded");
    const ch = value[i];
    if (quote) {
      output += ch;
      i++;
      if (ch === "\\" && i < value.length) output += value[i++];
      else if (ch === quote) quote = "";
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      output += ch;
      i++;
    } else if (
      value.slice(i, i + 4).toLowerCase() === "var(" &&
      (i === 0 || !/[\w-]/.test(value[i - 1]))
    ) {
      let end = i + 4,
        nesting = 1,
        comma = -1,
        innerQuote = "";
      for (; end < value.length; end++) {
        const current = value[end];
        if (innerQuote) {
          if (current === "\\") end++;
          else if (current === innerQuote) innerQuote = "";
        } else if (current === '"' || current === "'") innerQuote = current;
        else if (current === "(") nesting++;
        else if (current === ")" && --nesting === 0) break;
        else if (current === "," && nesting === 1 && comma < 0) comma = end;
      }
      if (nesting !== 0) return null;
      const name = value.slice(i + 4, comma < 0 ? end : comma).trim();
      if (!variableName.test(name)) return null;
      let replacement = lookup(name);
      // CSS dependency cycles include references in unused fallbacks too.
      const fallback =
        comma >= 0
          ? substitute(
              value.slice(comma + 1, end).trim(),
              lookup,
              state,
              depth + 1,
            )
          : null;
      if (replacement === null) replacement = fallback;
      if (replacement === null) return null;
      output += replacement;
      i = end + 1;
    } else {
      output += ch;
      i++;
    }
    if (output.length > 8192) throw Error("SVG CSS variable limit exceeded");
  }
  return output;
}

/** Compute custom properties on their declaring element before inheriting them. */
export function resolveLocalVariables(
  parent: SVGStyle,
  own: SVGStyle,
  state: SVGConversionState,
): SVGStyle {
  // Count inherited-map work as well as substitution, and bound per-element
  // custom-property storage before copying it into every descendant context.
  const names = new Set([...Object.keys(parent), ...Object.keys(own)]);
  state.operations += names.size;
  if (state.operations > 8000000)
    throw Error("SVG stylesheet work limit exceeded");
  if (Array.from(names).filter((name) => name.startsWith("--")).length > 1024)
    throw Error("SVG CSS variable limit exceeded");
  const raw: SVGStyle = {},
    computed: SVGStyle = {},
    visiting: string[] = [],
    cyclic = new Set<string>();
  for (const [key, value] of Object.entries(parent))
    if (key.startsWith("--")) computed[key] = value;
  for (const [key, value] of Object.entries(own)) {
    if (!key.startsWith("--")) continue;
    delete computed[key];
    raw[key] = value;
  }
  const lookup = (name: string): string | null => {
    if (Object.hasOwn(computed, name))
      return computed[name] === invalid ? null : computed[name];
    if (!Object.hasOwn(raw, name)) return null;
    const cycle = visiting.indexOf(name);
    if (cycle >= 0) {
      visiting.slice(cycle).forEach((key) => cyclic.add(key));
      return null;
    }
    if (visiting.length >= 32) throw Error("SVG CSS variable limit exceeded");
    visiting.push(name);
    const value = raw[name];
    const result =
      value === "inherit" || value === "unset"
        ? (parent[name] ?? invalid)
        : value === "initial"
          ? null
          : substitute(value, lookup, state);
    visiting.pop();
    computed[name] = cyclic.has(name) || result === null ? invalid : result;
    return computed[name] === invalid ? null : computed[name];
  };
  for (const name of Object.keys(raw)) lookup(name);
  const result = { ...computed };
  for (const [key, value] of Object.entries(own)) {
    if (key.startsWith("--")) continue;
    const resolved = substitute(value, lookup, state);
    if (resolved === null) state.warnings.add("css");
    result[key] = resolved ?? "unset";
  }
  return result;
}
