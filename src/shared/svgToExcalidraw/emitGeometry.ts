/** Native editable geometry emission; fills and original stroke contours stay ordered. */
import type {
  SVGContext,
  SVGConversionState,
  SVGContour,
} from "src/types/svgConversionTypes";
import {
  createExEllipse,
  createExLine,
  createExRect,
  type ExcalidrawGenericElement,
  type ExcalidrawElementBase,
  type Point,
} from "./elements/ExcalidrawElement";
import { paint } from "./paint";
import { length, numbers, transformPoint } from "./transform";
import { pathContours } from "./pathGeometry";
import { filledPolygons } from "./fillTopology";
import { randomId } from "./utils";

/** Constructs a native line without implicitly closing its visible stroke. */
export function nativeLine(
  points: Point[],
  closed: boolean,
): ReturnType<typeof createExLine> {
  const first = points[0],
    relative = points.map(([x, y]): Point => [x - first[0], y - first[1]]);
  const result = createExLine(relative);
  result.polygon = closed;
  result.x = first[0];
  result.y = first[1];
  let minX = 0,
    minY = 0,
    maxX = 0,
    maxY = 0;
  for (const [x, y] of relative) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  result.width = maxX - minX;
  result.height = maxY - minY;
  return result;
}

/** Emits an SVG shape into native elements with one local group if decomposition is needed. */
export function emitGeometry(
  el: Element,
  context: SVGContext,
  state: SVGConversionState,
): void {
  const { style, matrix: m, viewport } = context;
  const order = [
    ...new Set([
      ...(style["paint-order"] ?? "")
        .split(/\s+/)
        .filter((p) => p === "fill" || p === "stroke"),
      "fill",
      "stroke",
    ]),
  ];
  const strokeFirst = order[0] === "stroke";
  const fill = paint(style.fill, style["fill-opacity"], style.color, state),
    stroke = paint(style.stroke, style["stroke-opacity"], style.color, state);
  const sx = Math.hypot(m[0], m[1]),
    sy = Math.hypot(m[2], m[3]);
  const uniform =
    Math.abs(sx - sy) < 1e-8 * Math.max(1, sx, sy) &&
    Math.abs(m[0] * m[2] + m[1] * m[3]) < 1e-8 * Math.max(1, sx * sy);
  const strokeWidth =
    Math.max(
      0,
      length(
        style["stroke-width"],
        1,
        Math.hypot(viewport.width, viewport.height) / Math.SQRT2,
      ),
    ) * (style["vector-effect"] === "non-scaling-stroke" ? 1 : (sx + sy) / 2);
  const props: Partial<ExcalidrawElementBase> = {
    backgroundColor: fill,
    strokeColor: stroke,
    strokeWidth,
    opacity: context.opacity * 100,
    groupIds: context.groups,
  };
  if (stroke !== "transparent" && strokeWidth > 0) {
    if (
      (!uniform && style["vector-effect"] !== "non-scaling-stroke") ||
      style["stroke-linecap"] !== "round" ||
      style["stroke-linejoin"] !== "round"
    )
      state.warnings.add("stroke");
    if (style["stroke-dasharray"] && style["stroke-dasharray"] !== "none") {
      props.strokeStyle = "dashed";
      state.warnings.add("stroke");
    }
  }
  if (
    context.opacity < 1 &&
    fill !== "transparent" &&
    stroke !== "transparent" &&
    strokeWidth > 0
  )
    state.warnings.add("compositing");
  const created: ExcalidrawGenericElement[] = [];
  const add = (element: ExcalidrawGenericElement, paintProps = props) => {
    Object.assign(element, paintProps);
    created.push(element);
  };
  const coordinate = (name: string, fallback = 0, axis = "x") =>
    length(
      el.getAttribute(name),
      fallback,
      axis === "x" ? viewport.width : viewport.height,
    );
  const tag = el.localName;
  let contours: SVGContour[] | null = null;
  if (tag === "rect") {
    const x = coordinate("x"),
      y = coordinate("y", 0, "y"),
      w = coordinate("width"),
      h = coordinate("height", 0, "y");
    if (w < 0 || h < 0) throw Error("Negative SVG rectangle size");
    if (!w || !h) return;
    const rx = Math.min(
        w / 2,
        Math.max(0, coordinate("rx", coordinate("ry", 0, "y"))),
      ),
      ry = Math.min(h / 2, Math.max(0, coordinate("ry", rx, "y")));
    const origin = transformPoint([x, y], m),
      u: Point = [m[0] * w, m[1] * w],
      v: Point = [m[2] * h, m[3] * h];
    if (rx && ry) {
      contours = pathContours(
        `M${x + rx} ${y}H${x + w - rx}A${rx} ${ry} 0 0 1 ${x + w} ${y + ry}V${y + h - ry}A${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h}H${x + rx}A${rx} ${ry} 0 0 1 ${x} ${y + h - ry}V${y + ry}A${rx} ${ry} 0 0 1 ${x + rx} ${y}Z`,
        m,
        state,
      );
    } else if (
      Math.abs(u[0] * v[0] + u[1] * v[1]) <
      1e-8 * Math.max(1, Math.hypot(...u) * Math.hypot(...v))
    ) {
      const rect = createExRect();
      rect.width = Math.hypot(...u);
      rect.height = Math.hypot(...v);
      rect.x = origin[0] + (u[0] + v[0] - rect.width) / 2;
      rect.y = origin[1] + (u[1] + v[1] - rect.height) / 2;
      rect.angle = Math.atan2(u[1], u[0]) as typeof rect.angle;
      add(rect);
    } else
      contours = [
        {
          points: [
            [x, y],
            [x + w, y],
            [x + w, y + h],
            [x, y + h],
            [x, y],
          ].map((p) => transformPoint(p as Point, m)),
          closed: true,
        },
      ];
  } else if (tag === "ellipse" || tag === "circle") {
    const cx = coordinate("cx"),
      cy = coordinate("cy", 0, "y");
    const radius = length(
      el.getAttribute("r"),
      0,
      Math.hypot(viewport.width, viewport.height) / Math.SQRT2,
    );
    const rx = tag === "circle" ? radius : coordinate("rx"),
      ry = tag === "circle" ? radius : coordinate("ry", 0, "y");
    if (rx < 0 || ry < 0) throw Error("Negative SVG radius");
    if (!rx || !ry) return;
    const center = transformPoint([cx, cy], m),
      u: Point = [m[0] * rx, m[1] * rx],
      v: Point = [m[2] * ry, m[3] * ry];
    const xx = u[0] * u[0] + v[0] * v[0],
      yy = u[1] * u[1] + v[1] * v[1],
      xy = u[0] * u[1] + v[0] * v[1],
      delta = Math.hypot(xx - yy, 2 * xy);
    const ellipse = createExEllipse();
    ellipse.width = 2 * Math.sqrt(Math.max(0, (xx + yy + delta) / 2));
    ellipse.height = 2 * Math.sqrt(Math.max(0, (xx + yy - delta) / 2));
    ellipse.x = center[0] - ellipse.width / 2;
    ellipse.y = center[1] - ellipse.height / 2;
    ellipse.angle = (Math.atan2(2 * xy, xx - yy) / 2) as typeof ellipse.angle;
    add(ellipse);
  } else if (tag === "line") {
    contours = [
      {
        points: [
          transformPoint([coordinate("x1"), coordinate("y1", 0, "y")], m),
          transformPoint([coordinate("x2"), coordinate("y2", 0, "y")], m),
        ],
        closed: false,
      },
    ];
  } else if (tag === "polyline" || tag === "polygon") {
    const list = numbers(el.getAttribute("points") ?? "");
    if (list.length % 2) throw Error("Odd SVG point coordinate count");
    const points: Point[] = [];
    for (let i = 0; i < list.length; i += 2)
      points.push(transformPoint([list[i], list[i + 1]], m));
    if (tag === "polygon" && points.length) points.push(points[0]);
    contours = [{ points, closed: tag === "polygon" }];
  } else if (tag === "path")
    contours = pathContours(el.getAttribute("d") ?? "", m, state);
  if (contours) {
    const fills: ExcalidrawGenericElement[] = [],
      strokes: ExcalidrawGenericElement[] = [];
    if (tag !== "line" && fill !== "transparent")
      for (const polygon of filledPolygons(
        contours.map((c) => c.points),
        style["fill-rule"],
        state,
      )) {
        const element = nativeLine(polygon, true);
        Object.assign(element, props, {
          strokeColor: "transparent",
          strokeWidth: 0,
        });
        fills.push(element);
      }
    if (stroke !== "transparent" && strokeWidth > 0)
      for (const contour of contours) {
        const points = contour.points;
        if (!points.length) continue;
        if (
          points.every((p) => p[0] === points[0][0] && p[1] === points[0][1])
        ) {
          if (style["stroke-linecap"] === "round") {
            const dot = createExEllipse();
            Object.assign(dot, props, {
              x: points[0][0] - strokeWidth / 2,
              y: points[0][1] - strokeWidth / 2,
              width: strokeWidth,
              height: strokeWidth,
              backgroundColor: stroke,
              strokeColor: "transparent",
              strokeWidth: 0,
            });
            strokes.push(dot);
          }
        } else {
          const element = nativeLine(points, contour.closed);
          Object.assign(element, props, { backgroundColor: "transparent" });
          strokes.push(element);
        }
      }
    created.push(
      ...(strokeFirst ? [...strokes, ...fills] : [...fills, ...strokes]),
    );
    if (context.opacity < 1 && strokes.length > 1)
      state.warnings.add("compositing");
  } else if (
    strokeFirst &&
    fill !== "transparent" &&
    stroke !== "transparent" &&
    strokeWidth > 0
  ) {
    const primitives = created.splice(0);
    for (const element of primitives)
      created.push(
        { ...element, id: randomId(), backgroundColor: "transparent" },
        { ...element, strokeColor: "transparent", strokeWidth: 0 },
      );
  }
  if (created.length > 1) {
    const group = randomId();
    created.forEach(
      (element) => (element.groupIds = [group, ...context.groups]),
    );
  }
  for (const element of created) {
    if (
      [
        element.x,
        element.y,
        element.width,
        element.height,
        element.angle,
        element.strokeWidth,
      ].some((n) => !Number.isFinite(n) || Math.abs(n) > 1e7)
    )
      throw Error("Invalid native SVG geometry");
    if (++state.nodes > 20000) throw Error("SVG element limit exceeded");
    state.points += element.type === "line" ? element.points.length : 0;
    if (state.points > 100000) throw Error("SVG point limit exceeded");
    state.elements.push(element);
  }
}
