/** Editable text layout using the host's font metrics, with diagnosed font/layout approximations. */
import type {
  SVGContext,
  SVGConversionState,
} from "src/types/svgConversionTypes";
import type { Radians } from "@zsviczian/excalidraw/types/math/src/types";
import {
  createExText,
  type ExcalidrawText,
} from "./elements/ExcalidrawElement";
import { paint } from "./paint";
import { transformPoint } from "./transform";
import { textLineHeight } from "./textStyle";

/** Appends one independently editable run and returns its untransformed advance. */
export function appendText(
  text: string,
  context: SVGContext,
  state: SVGConversionState,
  x: number,
  y: number,
  html = false,
): number {
  if (!text) return 0;
  state.textCharacters += text.length;
  if (state.textCharacters > 100000 || text.split("\n").length > 1000)
    throw Error("SVG text limit exceeded");
  const { style, matrix } = context;
  const size = Number(style["font-size"] ?? 16);
  if (!size) return 0;
  const family = /monospace|cascadia/i.test(style["font-family"])
    ? 3
    : /excalifont/i.test(style["font-family"])
      ? 5
      : 2;
  const lineHeight = textLineHeight(style["line-height"], size);
  const metrics = state.measureText?.(text, size, family, lineHeight) ?? {
    width:
      text
        .split("\n")
        .reduce((max, line) => Math.max(max, Array.from(line).length), 0) *
      size *
      0.6,
    height: text.split("\n").length * size * lineHeight,
  };
  if (
    [metrics.width, metrics.height].some(
      (value) => !Number.isFinite(value) || value < 0 || value > 1e7,
    )
  )
    throw Error("Invalid SVG text metrics");
  // Native text has available font families rather than arbitrary SVG fonts,
  // rich HTML/CSS, exact glyph baselines, skew or independent axis stretching.
  state.warnings.add("text");
  const align = html ? style["text-align"] : style["text-anchor"];
  const factor = ["middle", "center"].includes(align)
    ? 0.5
    : ["end", "right"].includes(align)
      ? 1
      : 0;
  const baseline = html
    ? "text-before-edge"
    : style["dominant-baseline"] !== "auto"
      ? style["dominant-baseline"]
      : style["alignment-baseline"];
  const top = ["middle", "central"].includes(baseline)
    ? y - metrics.height / 2
    : ["hanging", "text-before-edge", "before-edge", "top"].includes(baseline)
      ? y
      : ["text-after-edge", "after-edge", "bottom", "ideographic"].includes(
            baseline,
          )
        ? y - metrics.height
        : y - size * 0.8;
  const sx = Math.hypot(matrix[0], matrix[1]),
    sy = Math.hypot(matrix[2], matrix[3]);
  if (!sx || !sy) return metrics.width;
  const center = transformPoint(
    [x + metrics.width * (0.5 - factor), top + metrics.height / 2],
    matrix,
  );
  const element = createExText(text);
  Object.assign(element, {
    x: center[0] - (metrics.width * sy) / 2,
    y: center[1] - (metrics.height * sy) / 2,
    width: metrics.width * sy,
    height: metrics.height * sy,
    fontSize: size * sy,
    fontFamily: family,
    lineHeight: lineHeight as ExcalidrawText["lineHeight"],
    angle: Math.atan2(matrix[1], matrix[0]) as Radians,
    textAlign: factor === 0.5 ? "center" : factor === 1 ? "right" : "left",
    strokeColor: html
      ? paint(style.color, "1", style.color, state)
      : paint(
          style.fill === "none" && style.stroke !== "none"
            ? style.stroke
            : style.fill,
          style["fill-opacity"],
          style.color,
          state,
        ),
    opacity: context.opacity * 100,
    groupIds: [...context.groups],
  } satisfies Partial<ExcalidrawText>);
  if (
    [
      element.x,
      element.y,
      element.width,
      element.height,
      element.fontSize,
    ].some((value) => !Number.isFinite(value) || Math.abs(value) > 1e7)
  )
    throw Error("SVG text geometry limit exceeded");
  if (++state.nodes > 20000) throw Error("SVG element limit exceeded");
  state.elements.push(element);
  return metrics.width;
}
