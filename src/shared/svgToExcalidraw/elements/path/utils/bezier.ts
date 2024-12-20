import { safeNumber } from "../../../utils";

/**
 * Get a point at a given section of a cubic bezier curve.
 * This function only supports two dimensions curves
 * @see https://en.wikipedia.org/wiki/B%C3%A9zier_curve#Cubic_B%C3%A9zier_curves
 */
const getPointOfCubicCurve = (
  controlPoints: number[][],
  section: number,
): number[] =>
  Array.from({ length: 2 }).map((v, i) => {
    const point =
      controlPoints[0][i] * (1 - section) ** 3 +
      3 * controlPoints[1][i] * section * (1 - section) ** 2 +
      3 * controlPoints[2][i] * section ** 2 * (1 - section) +
      controlPoints[3][i] * section ** 3;

    return safeNumber(point);
  });

/**
 * Get a point at a given section of a quadratic bezier curve.
 * This function only supports two dimensions curves
 * @see https://en.wikipedia.org/wiki/B%C3%A9zier_curve#Quadratic_B%C3%A9zier_curves
 */
const getPointOfQuadraticCurve = (
  controlPoints: number[][],
  section: number,
): number[] =>
  Array.from({ length: 2 }).map((v, i) => {
    const point =
      controlPoints[0][i] * (1 - section) ** 2 +
      2 * controlPoints[1][i] * section * (1 - section) +
      controlPoints[2][i] * section ** 2;

    return safeNumber(point);
  });

/**
 * Get list of points for a cubic bézier curve.
 * Starting point is not returned
 */
export const curveToPoints = (
  type: "cubic" | "quadratic",
  controlPoints: number[][],
  nbPoints = 10,
): number[][] => {
  if (nbPoints <= 0) {
    throw new Error("Requested amount of points must be positive");
  } else if (nbPoints > 100) {
    nbPoints = 100;
  }

  return Array.from({ length: nbPoints }, (value, index) => {
    const section = safeNumber(((100 / nbPoints) * (index + 1)) / 100);

    if (type === "cubic") {
      return getPointOfCubicCurve(controlPoints, section);
    } else if (type === "quadratic") {
      return getPointOfQuadraticCurve(controlPoints, section);
    }

    throw new Error("Invalid bézier curve type requested");
  });
};
