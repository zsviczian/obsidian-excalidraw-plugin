import { ElementBoundaries } from "../types";

export const getElementBoundaries = (points: number[][]): ElementBoundaries => {
  const { x, y } = points.reduce(
    (boundaries, [x, y]) => {
      if (x < boundaries.x.min) {
        boundaries.x.min = x;
      }
      if (x > boundaries.x.max) {
        boundaries.x.max = x;
      }
      if (y < boundaries.y.min) {
        boundaries.y.min = y;
      }
      if (y > boundaries.y.max) {
        boundaries.y.max = y;
      }

      return boundaries;
    },
    {
      x: {
        min: Infinity,
        max: 0,
      },
      y: {
        min: Infinity,
        max: 0,
      },
    },
  );

  return {
    x: x.min,
    y: y.min,
    width: x.max - x.min,
    height: y.max - y.min,
  };
};
