import { PathCommand } from "../../../types";
import { safeNumber } from "../../../utils";
import { curveToPoints } from "./bezier";
import { findArc, getEllipsePoints, getEllipsesCenter } from "./ellipse";

const PATH_COMMANDS_REGEX =
  /(?:([HhVv] *-?\d*(?:\.\d+)?)|([MmLlTt](?: *-?\d*(?:\.\d+)?(?:,| *)?){2})|([Cc](?: *-?\d*(?:\.\d+)?(?:,| *)?){6})|([QqSs](?: *-?\d*(?:\.\d+)?(?:,| *)?){4})|([Aa](?: *-?\d*(?:\.\d+)?(?:,| *)?){7})|(z|Z))/g;
const COMMAND_REGEX = /(?:[MmLlHhVvCcSsQqTtAaZz]|(-?\d+(?:\.\d+)?))/g;

const handleMoveToAndLineTo = (
  currentPosition: number[],
  parameters: number[],
  isRelative: boolean,
): number[] => {
  if (isRelative) {
    return [
      currentPosition[0] + parameters[0],
      currentPosition[1] + parameters[1],
    ];
  }

  return parameters;
};

const handleHorizontalLineTo = (
  currentPosition: number[],
  x: number,
  isRelative: boolean,
): number[] => {
  if (isRelative) {
    return [currentPosition[0] + x, currentPosition[1]];
  }

  return [x, currentPosition[1]];
};

const handleVerticalLineTo = (
  currentPosition: number[],
  y: number,
  isRelative: boolean,
): number[] => {
  if (isRelative) {
    return [currentPosition[0], currentPosition[1] + y];
  }

  return [currentPosition[0], y];
};

const handleCubicCurveTo = (
  currentPosition: number[],
  parameters: number[],
  lastCommand: PathCommand,
  isSimpleForm: boolean,
  isRelative: boolean,
): number[][] => {
  const controlPoints = [currentPosition];
  let inferredControlPoint;

  if (isSimpleForm) {
    inferredControlPoint = ["C", "c"].includes(lastCommand?.type)
      ? [
          currentPosition[0] - (lastCommand.parameters[2] - currentPosition[0]),
          currentPosition[1] - (lastCommand.parameters[3] - currentPosition[1]),
        ]
      : currentPosition;
  }

  if (isRelative) {
    controlPoints.push(
      inferredControlPoint || [
        currentPosition[0] + parameters[0],
        currentPosition[1] + parameters[1],
      ],
      [currentPosition[0] + parameters[2], currentPosition[1] + parameters[3]],
      [currentPosition[0] + parameters[4], currentPosition[1] + parameters[5]],
    );
  } else {
    controlPoints.push(
      inferredControlPoint || [parameters[0], parameters[1]],
      [parameters[2], parameters[3]],
      [parameters[4], parameters[5]],
    );
  }

  return curveToPoints("cubic", controlPoints);
};

const handleQuadraticCurveTo = (
  currentPosition: number[],
  parameters: number[],
  lastCommand: PathCommand,
  isSimpleForm: boolean,
  isRelative: boolean,
): number[][] => {
  const controlPoints = [currentPosition];
  let inferredControlPoint;

  if (isSimpleForm) {
    inferredControlPoint = ["Q", "q"].includes(lastCommand?.type)
      ? [
          currentPosition[0] - (lastCommand.parameters[0] - currentPosition[0]),
          currentPosition[1] - (lastCommand.parameters[1] - currentPosition[1]),
        ]
      : currentPosition;
  }

  if (isRelative) {
    controlPoints.push(
      inferredControlPoint || [
        currentPosition[0] + parameters[0],
        currentPosition[1] + parameters[1],
      ],
      [currentPosition[0] + parameters[2], currentPosition[1] + parameters[3]],
    );
  } else {
    controlPoints.push(inferredControlPoint || [parameters[0], parameters[1]], [
      parameters[2],
      parameters[3],
    ]);
  }

  return curveToPoints("quadratic", controlPoints);
};

/**
 * @todo handle arcs rotation
 * @todo handle specific cases where only one ellipse can exist
 */
const handleArcTo = (
  currentPosition: number[],
  [radiusX, radiusY, , large, sweep, destX, destY]: number[],
  isRelative: boolean,
): number[][] => {
  destX = isRelative ? currentPosition[0] + destX : destX;
  destY = isRelative ? currentPosition[1] + destY : destY;

  const ellipsesCenter = getEllipsesCenter(
    currentPosition[0],
    currentPosition[1],
    destX,
    destY,
    radiusX,
    radiusY,
  );

  const ellipsesPoints = [
    getEllipsePoints(
      ellipsesCenter[0][0],
      ellipsesCenter[0][1],
      radiusX,
      radiusY,
    ),
    getEllipsePoints(
      ellipsesCenter[1][0],
      ellipsesCenter[1][1],
      radiusX,
      radiusY,
    ),
  ];

  const arcs = [
    findArc(
      ellipsesPoints[0],
      !!sweep,
      currentPosition[0],
      currentPosition[1],
      destX,
      destY,
    ),
    findArc(
      ellipsesPoints[1],
      !!sweep,
      currentPosition[0],
      currentPosition[1],
      destX,
      destY,
    ),
  ];

  const finalArc = arcs.reduce(
    (arc, curArc) =>
      (large && curArc.length > arc.length) ||
      (!large && (!arc.length || curArc.length < arc.length))
        ? curArc
        : arc,
    [],
  );

  return finalArc;
};

/**
 * Convert a SVG path data to list of points
 */
const pathToPoints = (path: string): number[][][] => {
  const commands = path.match(PATH_COMMANDS_REGEX);
  const elements = [];
  const commandsHistory = [];
  let currentPosition = [0, 0];
  let points = [];

  if (!commands?.length) {
    throw new Error("No commands found in given path");
  }

  for (const command of commands) {
    const lastCommand = commandsHistory[commandsHistory.length - 2];
    const commandMatch = command.match(COMMAND_REGEX);

    currentPosition = points[points.length - 1] || currentPosition;

    if (commandMatch?.length) {
      const commandType = commandMatch[0];
      const parameters = commandMatch
        .slice(1, commandMatch.length)
        .map((parameter) => safeNumber(Number(parameter)));
      const isRelative = commandType.toLowerCase() === commandType;

      commandsHistory.push({
        type: commandType,
        parameters,
        isRelative,
      });

      switch (commandType) {
        case "M":
        case "m":
        case "L":
        case "l":
          points.push(
            handleMoveToAndLineTo(currentPosition, parameters, isRelative),
          );

          break;
        case "H":
        case "h":
          points.push(
            handleHorizontalLineTo(currentPosition, parameters[0], isRelative),
          );

          break;
        case "V":
        case "v":
          points.push(
            handleVerticalLineTo(currentPosition, parameters[0], isRelative),
          );

          break;
        case "C":
        case "c":
        case "S":
        case "s":
          points.push(
            ...handleCubicCurveTo(
              currentPosition,
              parameters,
              lastCommand,
              ["S", "s"].includes(commandType),
              isRelative,
            ),
          );

          break;
        case "Q":
        case "q":
        case "T":
        case "t":
          points.push(
            ...handleQuadraticCurveTo(
              currentPosition,
              parameters,
              lastCommand,
              ["T", "t"].includes(commandType),
              isRelative,
            ),
          );

          break;
        case "A":
        case "a":
          points.push(...handleArcTo(currentPosition, parameters, isRelative));

          break;
        case "Z":
        case "z":
          if (points.length) {
            if (
              currentPosition[0] !== points[0][0] ||
              currentPosition[1] !== points[0][1]
            ) {
              points.push(points[0]);
            }

            elements.push(points);
          }

          points = [];

          break;
      }
    } else {
      // console.error("Unsupported command provided will be ignored:", command);
    }
  }

  if (elements.length === 0 && points.length) {
    elements.push(points);
  }

  return elements;
};

export default pathToPoints;
