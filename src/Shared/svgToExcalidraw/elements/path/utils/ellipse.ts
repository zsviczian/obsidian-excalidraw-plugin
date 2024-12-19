const degreeToRadian = (degree: number): number => (degree * Math.PI) / 180;

/**
 * Get each possible ellipses center points given two points and ellipse radius
 * @see https://math.stackexchange.com/questions/2240031/solving-an-equation-for-an-ellipse
 */
export const getEllipsesCenter = (
  curX: number,
  curY: number,
  destX: number,
  destY: number,
  radiusX: number,
  radiusY: number,
): number[][] => [
  [
    (curX + destX) / 2 +
      ((radiusX * (curY - destY)) / (2 * radiusY)) *
        Math.sqrt(
          4 /
            ((curX - destX) ** 2 / radiusX ** 2 +
              (curY - destY) ** 2 / radiusY ** 2) -
            1,
        ),
    (curY + destY) / 2 -
      ((radiusY * (curX - destX)) / (2 * radiusX)) *
        Math.sqrt(
          4 /
            ((curX - destX) ** 2 / radiusX ** 2 +
              (curY - destY) ** 2 / radiusY ** 2) -
            1,
        ),
  ],
  [
    (curX + destX) / 2 -
      ((radiusX * (curY - destY)) / (2 * radiusY)) *
        Math.sqrt(
          4 /
            ((curX - destX) ** 2 / radiusX ** 2 +
              (curY - destY) ** 2 / radiusY ** 2) -
            1,
        ),
    (curY + destY) / 2 +
      ((radiusY * (curX - destX)) / (2 * radiusX)) *
        Math.sqrt(
          4 /
            ((curX - destX) ** 2 / radiusX ** 2 +
              (curY - destY) ** 2 / radiusY ** 2) -
            1,
        ),
  ],
];

/**
 * Get point of ellipse at given degree
 */
const getPointAtDegree = (
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
  degree: number,
): number[] => [
  Math.round(radiusX * Math.cos(degreeToRadian(degree)) + centerX),
  Math.round(radiusY * Math.sin(degreeToRadian(degree)) + centerY),
];

/**
 * Get all points of a given ellipse
 */
export const getEllipsePoints = (
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
): number[][] => {
  const points: number[][] = [];

  for (let i = 0; i < 360; i += 1) {
    const pointAtDegree = getPointAtDegree(
      centerX,
      centerY,
      radiusX,
      radiusY,
      i,
    );
    const existingPoint = points.find(
      ([x, y]) => x === pointAtDegree[0] && y === pointAtDegree[1],
    );

    if (!existingPoint) {
      points.push(pointAtDegree);
    }
  }

  return points;
};

/**
 * Find ellipse arc given sweep parameter
 */
export const findArc = (
  points: number[][],
  sweep: boolean,
  curX: number,
  curY: number,
  destX: number,
  destY: number,
): number[][] => {
  const indexCur = points.findIndex(
    ([x, y]) => x === Math.round(curX) && y === Math.round(curY),
  );
  const indexDest = points.findIndex(
    ([x, y]) => x === Math.round(destX) && y === Math.round(destY),
  );
  const arc = [];
  const step = sweep ? -1 : 1;

  for (let i = indexDest; true; i += step) {
    arc.push(points[i]);

    if (i === indexCur) {
      break;
    }

    if (sweep && i === 0) {
      i = points.length;
    } else if (!sweep && i === points.length - 1) {
      i = -1;
    }
  }

  return arc.reverse();
};
