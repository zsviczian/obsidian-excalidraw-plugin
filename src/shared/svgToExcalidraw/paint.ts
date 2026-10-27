/** Bounded, document-local SVG presentation cascade; never consult the host theme. */
import chroma from "chroma-js";
import type {
  SVGConversionState,
  SVGStyle,
} from "src/types/svgConversionTypes";

export const initialStyle: SVGStyle = {
  fill: "black",
  stroke: "none",
  color: "black",
  "fill-rule": "nonzero",
  "fill-opacity": "1",
  "stroke-opacity": "1",
  "stroke-width": "1",
  "stroke-linecap": "butt",
  "stroke-linejoin": "miter",
  "stroke-dasharray": "none",
  "stroke-dashoffset": "0",
  visibility: "visible",
  "paint-order": "normal",
};
const properties = new Set([
  ...Object.keys(initialStyle),
  "opacity",
  "display",
  "vector-effect",
  "clip-path",
  "mask",
  "filter",
  "mix-blend-mode",
  "transform",
  "overflow",
  "marker-start",
  "marker-mid",
  "marker-end",
]);
const nonInherited = new Set([
  "opacity",
  "display",
  "vector-effect",
  "clip-path",
  "mask",
  "filter",
  "mix-blend-mode",
  "transform",
  "overflow",
]);

function declarations(text: string, state: SVGConversionState): SVGStyle {
  const result: SVGStyle = {};
  for (const part of text.split(";")) {
    const colon = part.indexOf(":");
    if (colon < 0) continue;
    const key = part.slice(0, colon).trim().toLowerCase();
    if (
      [
        "x",
        "y",
        "width",
        "height",
        "cx",
        "cy",
        "rx",
        "ry",
        "r",
        "d",
        "transform-origin",
      ].includes(key)
    )
      state.warnings.add("css");
    if (properties.has(key)) {
      const value = part.slice(colon + 1).trim();
      if (/!important|var\(/i.test(value)) state.warnings.add("css");
      if (/var\(/i.test(value)) continue;
      result[key] = value.replace(/\s*!important\s*$/i, "");
    }
  }
  return result;
}

/** Reads simple local stylesheet rules; advanced selectors/at-rules are diagnosed. */
export function readStyleRules(root: Element, state: SVGConversionState): void {
  for (const node of Array.from(root.getElementsByTagName("style"))) {
    const css = (node.textContent ?? "").replace(/\/\*[\s\S]*?\*\//g, "");
    if (css.length > 65536) throw Error("SVG stylesheet limit exceeded");
    if (/@|url\(/i.test(css)) state.warnings.add("css");
    for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      for (const selector of match[1].trim().split(/\s*,\s*/)) {
        if (
          selector.length > 1024 ||
          selector.split(/\s+/).length > 16 ||
          !selector
            .split(/\s+/)
            .every(
              (part) => /^(?:[\w-]+|\*)?(?:[.#][\w-]+)*$/.test(part) && part,
            )
        ) {
          state.warnings.add("css");
          continue;
        }
        if (state.rules.length >= 1000)
          throw Error("SVG stylesheet rule limit exceeded");
        state.rules.push({
          selector,
          declarations: declarations(match[2], state),
          specificity:
            (selector.match(/#/g)?.length ?? 0) * 100 +
            (selector.match(/\./g)?.length ?? 0) * 10 +
            (selector.match(/(?:^|\s)[a-z]/gi)?.length ?? 0),
          order: state.rules.length,
        });
      }
    }
  }
  state.rules.sort(
    (a, b) => a.specificity - b.specificity || a.order - b.order,
  );
}

function simpleMatch(el: Element, selector: string): boolean {
  const tag = selector.match(/^[\w-]+/)?.[0];
  if (tag && tag !== el.localName) return false;
  for (const match of selector.matchAll(/([.#])([\w-]+)/g)) {
    if (
      match[1] === "#"
        ? el.getAttribute("id") !== match[2]
        : !(el.getAttribute("class") ?? "").split(/\s+/).includes(match[2])
    )
      return false;
  }
  return true;
}
function matches(el: Element, selector: string): boolean {
  const parts = selector.split(/\s+/);
  if (!simpleMatch(el, parts.pop())) return false;
  let parent = el.parentNode;
  while (parts.length) {
    const part = parts.pop();
    while (parent?.nodeType === 1 && !simpleMatch(parent as Element, part))
      parent = parent.parentNode;
    if (parent?.nodeType !== 1) return false;
    parent = parent.parentNode;
  }
  return true;
}

/** Resolves inherited presentation attributes, stylesheet rules, then inline style. */
export function resolveStyle(
  el: Element,
  parent: SVGStyle,
  state: SVGConversionState,
): SVGStyle {
  const style: SVGStyle = {};
  for (const key of properties)
    if (!nonInherited.has(key) && parent[key] !== undefined)
      style[key] = parent[key];
  const own: SVGStyle = {};
  for (const key of properties)
    if (el.hasAttribute(key)) own[key] = el.getAttribute(key);
  for (const rule of state.rules) {
    if (++state.operations > 8000000)
      throw Error("SVG stylesheet work limit exceeded");
    if (matches(el, rule.selector)) Object.assign(own, rule.declarations);
  }
  Object.assign(own, declarations(el.getAttribute("style") ?? "", state));
  for (const [key, value] of Object.entries(own)) {
    style[key] =
      value === "inherit" || (value === "unset" && !nonInherited.has(key))
        ? (parent[key] ?? initialStyle[key])
        : value === "initial" || value === "unset"
          ? initialStyle[key]
          : value;
  }
  for (const key of [
    "clip-path",
    "mask",
    "filter",
    "mix-blend-mode",
    "marker-start",
    "marker-mid",
    "marker-end",
  ])
    if (style[key] && !["none", "normal"].includes(style[key]))
      state.warnings.add("unsupported");
  if (
    style["vector-effect"] &&
    !["none", "non-scaling-stroke"].includes(style["vector-effect"])
  )
    state.warnings.add("unsupported");
  return style;
}

/** SVG opacity is a 0–1 value (or percentage), independent of native percent units. */
export function alpha(value: string | undefined): number {
  if (value === undefined) return 1;
  const number = Number(value.endsWith("%") ? value.slice(0, -1) : value);
  if (!Number.isFinite(number)) throw Error("Invalid SVG opacity");
  return Math.max(0, Math.min(1, number / (value.endsWith("%") ? 100 : 1)));
}

/** Resolves paint alpha independently of object opacity and without theme CSS. */
export function paint(
  value: string,
  opacity: string,
  color: string,
  state: SVGConversionState,
): string {
  if (value.trim().toLowerCase() === "none") return "transparent";
  const resolved =
    value.trim().toLowerCase() === "currentcolor"
      ? color.trim().toLowerCase() === "currentcolor"
        ? "black"
        : color
      : value;
  if (/url\(/i.test(resolved)) {
    state.warnings.add("unsupported");
    return "transparent";
  }
  if (!chroma.valid(resolved))
    throw Error(`Unsupported SVG paint: ${resolved}`);
  const parsed = chroma(resolved),
    a = parsed.alpha() * alpha(opacity);
  return a === 0
    ? "transparent"
    : parsed.alpha(a).hex(a === 1 ? "rgb" : "rgba");
}
