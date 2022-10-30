import { RawElement } from "../../types";
import { getElementBoundaries } from "../utils";
import pathToPoints from "./utils/path-to-points";

const parse = (node: Element) => {
  const data = node.getAttribute("d");
  const backgroundColor = node.getAttribute("fill");
  const strokeColor = node.getAttribute("stroke");

  return {
    data: data || "",
    backgroundColor:
      (backgroundColor !== "currentColor" && backgroundColor) || "transparent",
    strokeColor: (strokeColor !== "currentColor" && strokeColor) || "#000000",
  };
};

export const convert = (node: Element): RawElement[] => {
  const { data, backgroundColor, strokeColor } = parse(node);
  const elementsPoints = pathToPoints(data);

  return elementsPoints.map((points) => {
    const boundaries = getElementBoundaries(points);

    return {
      type: "line",
      roughness: 0,
      strokeSharpness: "sharp",
      points,
      backgroundColor,
      strokeColor,
      ...boundaries,
    };
  });
};
