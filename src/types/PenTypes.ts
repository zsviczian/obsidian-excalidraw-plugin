export interface StrokeOptions {
  thinning: number;
  smoothing: number;
  streamline: number;
  easing: string;
  simulatePressure?: boolean;
  start: {
      cap: boolean;
      taper: number | boolean;
      easing: string;
  };
  end: {
      cap: boolean;
      taper: number | boolean;
      easing: string;
  };
}

export interface PenOptions {
  highlighter: boolean;
  constantPressure: boolean;
  hasOutline: boolean;
  outlineWidth: number;
  options: StrokeOptions;
}

export declare type ExtendedFillStyle = "dots"|"zigzag"|"zigzag-line"|"dashed"|"hachure"|"cross-hatch"|"solid"|"";
export declare type PenType = "default" | "highlighter" | "finetip" | "fountain" | "marker" | "thick-thin" | "thin-thick-thin";

export interface PenStyle {
  type: PenType;
  freedrawOnly: boolean; 
  strokeColor?: string;
  backgroundColor?: string;
  fillStyle: ExtendedFillStyle;
  strokeWidth: number;
  roughness: number;
  penOptions: PenOptions;
}
