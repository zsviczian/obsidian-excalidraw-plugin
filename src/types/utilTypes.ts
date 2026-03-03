export type FILENAMEPARTS = {
  filepath: string,
  hasBlockref: boolean,
  hasGroupref: boolean,
  hasTaskbone: boolean,
  hasArearef: boolean,
  hasFrameref: boolean,
  hasClippedFrameref: boolean,
  hasSectionref: boolean,
  blockref: string,
  sectionref: string,
  linkpartReference: string,
  linkpartAlias: string
};

export enum PreviewImageType {
  PNG = "PNG",
  SVGIMG = "SVGIMG",
  SVG = "SVG"
}

export interface FrameRenderingOptions {
  enabled: boolean;
  name: boolean;
  outline: boolean;
  clip: boolean;
}