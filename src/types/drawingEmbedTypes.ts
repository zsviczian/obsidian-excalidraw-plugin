/** Narrow renderer, dialog and editor capabilities for drawing embed controls. */
import type { App } from "obsidian";

export interface LocatedDrawingEmbed {
  from: number;
  text: string;
  target: string;
}

export interface DrawingEmbedPreview {
  create: (isCurrent: () => boolean) => Promise<HTMLElement>;
  discard: (element: HTMLElement) => void;
}

export interface DrawingEmbedActions extends DrawingEmbedPreview {
  app: App;
  target: string;
  openDrawing: (event: MouseEvent) => void;
  getOpenTooltip: () => string;
  isCurrent: () => boolean;
}

export interface EmbedSourceBinding {
  readonly text: string;
  isCurrent(): boolean;
  replace(text: string): boolean;
  select(): boolean;
}
