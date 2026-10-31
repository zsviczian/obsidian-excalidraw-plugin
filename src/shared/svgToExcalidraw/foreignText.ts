/** Extract plain Mermaid/HTML labels from inert foreignObject XML, never active HTML. */
import type {
  SVGContext,
  SVGConversionState,
} from "src/types/svgConversionTypes";
import { alpha, resolveStyle } from "./paint";
import { length } from "./transform";
import { appendText } from "./textLayout";

const inline = new Set([
  "span",
  "a",
  "b",
  "strong",
  "i",
  "em",
  "code",
  "small",
  "sup",
  "sub",
]);
const blocks = new Set(["div", "p", "pre", "li"]);

export function emitForeignText(
  root: Element,
  context: SVGContext,
  state: SVGConversionState,
): void {
  const width = length(root.getAttribute("width"), 0, context.viewport.width);
  const height = length(
    root.getAttribute("height"),
    0,
    context.viewport.height,
  );
  if (width < 0 || height < 0) throw Error("Negative SVG foreignObject size");
  if (!width || !height) return;
  let text = "",
    labelContext = context;
  const newline = () => {
    if (text && !text.endsWith("\n")) text = text.trimEnd() + "\n";
  };
  const visit = (el: Element, ctx: SVGContext, depth: number) => {
    if (depth > 128 || ++state.operations > 8000000)
      throw Error("SVG HTML text complexity limit exceeded");
    if (el !== root) {
      const tag = el.localName;
      if (tag === "br") {
        newline();
        return;
      }
      if (!inline.has(tag) && !blocks.has(tag)) {
        state.warnings.add("unsupported");
        return;
      }
      const style = resolveStyle(el, ctx.style, state);
      ctx = { ...ctx, style, opacity: ctx.opacity * alpha(style.opacity) };
      if (style.display === "none") return;
      if (blocks.has(tag)) newline();
    }
    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType === 3 || child.nodeType === 4) {
        if (["hidden", "collapse"].includes(ctx.style.visibility)) continue;
        const value = (child.nodeValue ?? "").replace(/[\t\r\n ]+/g, " ");
        if (!text.trim() && value.trim()) labelContext = ctx;
        text += value;
      } else if (child.nodeType === 1) visit(child as Element, ctx, depth + 1);
    }
    if (el !== root && blocks.has(el.localName)) newline();
  };
  visit(root, context, 0);
  text = text.trim();
  const align = labelContext.style["text-align"];
  const offset = ["center", "middle"].includes(align)
    ? width / 2
    : ["end", "right"].includes(align)
    ? width
    : 0;
  appendText(
    text,
    labelContext,
    state,
    length(root.getAttribute("x"), 0, context.viewport.width) + offset,
    length(root.getAttribute("y"), 0, context.viewport.height),
    true,
  );
}
