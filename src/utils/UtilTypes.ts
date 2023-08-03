export type FILENAMEPARTS = {
  filepath: string,
  hasBlockref: boolean,
  hasGroupref: boolean,
  hasTaskbone: boolean,
  hasArearef: boolean,
  hasFrameref: boolean,
  blockref: string,
  hasSectionref: boolean,
  sectionref: string,
  linkpartReference: string,
  linkpartAlias: string
};

export enum PreviewImageType {
  PNG = "PNG",
  SVGIMG = "SVGIMG",
  SVG = "SVG"
}