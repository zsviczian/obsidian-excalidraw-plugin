/** Rendering-tree traversal: source paint order, isolated use instances and bounded work. */
import type {
  SVGContext,
  SVGConversionState,
  SVGMatrix,
} from "src/types/svgConversionTypes";
import { initialStyle, resolveStyle, alpha, readStyleRules } from "./paint";
import {
  identity,
  multiply,
  parseTransform,
  length,
  numbers,
  viewportMatrix,
} from "./transform";
import { emitGeometry } from "./emitGeometry";
import { emitSVGText } from "./text";
import { emitForeignText } from "./foreignText";
import { randomId } from "./utils";
import { exceedsViewport } from "./viewportBounds";

const shapes = new Set([
  "path",
  "line",
  "polyline",
  "polygon",
  "rect",
  "circle",
  "ellipse",
]);
const definitions = new Set([
  "defs",
  "symbol",
  "clipPath",
  "mask",
  "pattern",
  "marker",
  "linearGradient",
  "radialGradient",
]);
const omitted = new Set([
  "image",
  "script",
  "animate",
  "animateTransform",
  "set",
]);
const metadata = new Set(["title", "desc", "metadata", "style"]);
const children = (el: Element) =>
  Array.from(el.childNodes).filter(
    (node): node is Element => node.nodeType === 1,
  );

function collect(el: Element, state: SVGConversionState, depth = 0): void {
  if (depth > 128 || ++state.nodes > 20000)
    throw Error("SVG document complexity limit exceeded");
  const id = el.getAttribute("id");
  if (id && !state.ids.has(id)) state.ids.set(id, el);
  for (const child of children(el)) collect(child, state, depth + 1);
}

function visit(
  el: Element,
  parent: SVGContext,
  state: SVGConversionState,
  depth: number,
  referenced = false,
  instanceSize?: { width: number; height: number },
): void {
  if (depth > 128 || ++state.nodes > 20000)
    throw Error("SVG expansion limit exceeded");
  const tag = el.localName;
  if (metadata.has(tag) || (definitions.has(tag) && !referenced)) return;
  if (omitted.has(tag)) {
    state.warnings.add("unsupported");
    return;
  }
  const style = resolveStyle(el, parent.style, state);
  if (style.display === "none") return;
  const ownOpacity = alpha(style.opacity);
  const context: SVGContext = {
    ...parent,
    style,
    opacity: parent.opacity * ownOpacity,
    matrix: multiply(parent.matrix, parseTransform(style.transform ?? "")),
  };
  if (tag === "svg" || tag === "symbol") {
    const box = el.hasAttribute("viewBox")
      ? numbers(el.getAttribute("viewBox"))
      : null;
    if (box && (box.length !== 4 || box[2] <= 0 || box[3] <= 0))
      throw Error("Invalid SVG viewBox");
    const isRoot = depth === 0;
    const width =
      instanceSize?.width ??
      length(
        el.getAttribute("width"),
        box?.[2] ?? (isRoot ? 300 : parent.viewport.width),
        parent.viewport.width,
      );
    const height =
      instanceSize?.height ??
      length(
        el.getAttribute("height"),
        box?.[3] ?? (isRoot ? 150 : parent.viewport.height),
        parent.viewport.height,
      );
    if (width < 0 || height < 0) throw Error("Negative SVG viewport size");
    if (!width || !height) return;
    const x = isRoot
        ? 0
        : length(el.getAttribute("x"), 0, parent.viewport.width),
      y = isRoot ? 0 : length(el.getAttribute("y"), 0, parent.viewport.height);
    context.matrix = multiply(context.matrix, [1, 0, 0, 1, x, y]);
    if (box)
      context.matrix = multiply(
        context.matrix,
        viewportMatrix(
          box,
          width,
          height,
          el.getAttribute("preserveAspectRatio") ?? "xMidYMid meet",
        ),
      );
    context.viewport = { width: box?.[2] ?? width, height: box?.[3] ?? height };
    if (
      (!isRoot && style.overflow !== "visible") ||
      (el.getAttribute("preserveAspectRatio") ?? "").includes("slice")
    )
      state.warnings.add("viewport");
  }
  if (tag === "use") {
    const href = el.getAttribute("href") ?? el.getAttribute("xlink:href");
    if (!href || !href.startsWith("#") || href.length < 2)
      throw Error("Only document-local SVG use references are supported");
    const target = state.ids.get(decodeURIComponent(href.slice(1)));
    if (!target) throw Error("Missing SVG use reference");
    if (state.references.has(target)) throw Error("Cyclic SVG use reference");
    context.matrix = multiply(context.matrix, [
      1,
      0,
      0,
      1,
      length(el.getAttribute("x"), 0, parent.viewport.width),
      length(el.getAttribute("y"), 0, parent.viewport.height),
    ]);
    context.groups = [randomId(), ...context.groups];
    const size = ["symbol", "svg"].includes(target.localName)
      ? {
          width: length(
            el.getAttribute("width"),
            length(
              target.getAttribute("width"),
              parent.viewport.width,
              parent.viewport.width,
            ),
            parent.viewport.width,
          ),
          height: length(
            el.getAttribute("height"),
            length(
              target.getAttribute("height"),
              parent.viewport.height,
              parent.viewport.height,
            ),
            parent.viewport.height,
          ),
        }
      : undefined;
    state.references.add(target);
    const start = state.elements.length;
    try {
      visit(target, context, state, depth + 1, true, size);
    } finally {
      state.references.delete(target);
    }
    if (ownOpacity < 1 && state.elements.length - start > 1)
      state.warnings.add("compositing");
    return;
  }
  if (tag === "text" || tag === "foreignObject") {
    (tag === "text" ? emitSVGText : emitForeignText)(el, context, state);
    return;
  }
  if (shapes.has(tag)) {
    if (style.visibility !== "hidden" && style.visibility !== "collapse")
      emitGeometry(el, context, state);
    return;
  }
  if (!["svg", "symbol", "g", "a", "switch"].includes(tag))
    state.warnings.add("unsupported");
  if (tag !== "svg") context.groups = [randomId(), ...context.groups];
  const start = state.elements.length;
  let descendants = children(el);
  if (tag === "switch") {
    descendants = descendants
      .filter(
        (child) =>
          !child.hasAttribute("requiredExtensions") &&
          !child.hasAttribute("requiredFeatures") &&
          !child.hasAttribute("systemLanguage"),
      )
      .slice(0, 1);
    state.warnings.add("unsupported");
  }
  for (const child of descendants) visit(child, context, state, depth + 1);
  if (ownOpacity < 1 && state.elements.length - start > 1)
    state.warnings.add("compositing");
}

/** Converts one parsed SVG document without publishing anything to EA or the scene. */
export function walkSVG(
  root: Element,
  state: SVGConversionState,
  transform: SVGMatrix = identity,
  boundsViewport?: { width: number; height: number },
): void {
  collect(root, state);
  readStyleRules(root, state);
  visit(
    root,
    {
      matrix: transform,
      style: initialStyle,
      opacity: 1,
      groups: [],
      viewport: { width: 300, height: 150 },
    },
    state,
    0,
  );
  const box = root.hasAttribute("viewBox")
    ? numbers(root.getAttribute("viewBox"))
    : null;
  const width = length(root.getAttribute("width"), box?.[2] ?? 300, 300),
    height = length(root.getAttribute("height"), box?.[3] ?? 150, 150);
  if (
    exceedsViewport(
      state.elements,
      boundsViewport?.width ?? width,
      boundsViewport?.height ?? height,
    )
  )
    state.warnings.add("viewport");
}
