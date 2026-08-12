export type PathCommand = {
  type: string;
  parameters: number[];
  isRelative: boolean;
};

export type RawElement = {
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  points: number[][];
  backgroundColor: string;
  strokeColor: string;
};

export type ElementBoundaries = {
  x: number;
  y: number;
  height: number;
  width: number;
};
