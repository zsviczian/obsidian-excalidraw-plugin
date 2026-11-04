/** SVG text/tspan traversal. Unsupported rich layout remains editable with a notice. */
import type {
  SVGContext,
  SVGConversionState,
} from "src/types/svgConversionTypes";
import { resolveStyle, alpha } from "./paint";
import { multiply, parseTransform } from "./transform";
import { textLength } from "./textStyle";
import { appendText } from "./textLayout";

export function emitSVGText(
  root: Element,
  context: SVGContext,
  state: SVGConversionState,
): void {
  let x = 0,
    y = 0,
    text = "",
    run = context;
  const position = (
    el: Element,
    name: string,
    fallback: number,
    ctx: SVGContext,
  ) => {
    const value = el.getAttribute(name);
    if (value === null) return fallback;
    const values = value.trim().split(/[\s,]+/);
    if (values.length > 1) state.warnings.add("text");
    return textLength(
      values[0],
      Number(ctx.style["font-size"]),
      name.endsWith("x") ? ctx.viewport.width : ctx.viewport.height,
    );
  };
  const flush = () => {
    const value = /^(pre|pre-wrap|break-spaces)$/.test(run.style["white-space"])
      ? text
      : text.trim();
    x += appendText(value, run, state, x, y);
    text = "";
  };
  const visit = (el: Element, ctx: SVGContext, depth: number) => {
    if (depth > 128 || ++state.operations > 8000000)
      throw Error("SVG text complexity limit exceeded");
    if (el !== root) {
      if (!["tspan", "a", "textPath"].includes(el.localName)) {
        state.warnings.add("unsupported");
        return;
      }
      const style = resolveStyle(el, ctx.style, state);
      ctx = {
        ...ctx,
        style,
        opacity: ctx.opacity * alpha(style.opacity),
        matrix: multiply(ctx.matrix, parseTransform(style.transform ?? "")),
      };
    }
    if (ctx.style.display === "none") return;
    if (
      el === root ||
      ["x", "y", "dx", "dy"].some((name) => el.hasAttribute(name))
    ) {
      flush();
      x = position(el, "x", x, ctx) + position(el, "dx", 0, ctx);
      y = position(el, "y", y, ctx) + position(el, "dy", 0, ctx);
      run = ctx;
    }
    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType === 3 || child.nodeType === 4) {
        if (["hidden", "collapse"].includes(ctx.style.visibility)) continue;
        if (!text) run = ctx;
        const raw = child.nodeValue ?? "";
        text += /^(pre|pre-wrap|break-spaces)$/.test(ctx.style["white-space"])
          ? raw
          : raw.replace(/[\t\r\n ]+/g, " ");
      } else if (child.nodeType === 1) visit(child as Element, ctx, depth + 1);
    }
  };
  visit(root, context, 0);
  flush();
}
