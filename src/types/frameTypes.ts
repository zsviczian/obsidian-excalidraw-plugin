/** Frame UI data contains no editor or plugin capability. */
export interface DrawingFrameChoice {
  id: string;
  name: string | null;
  marker: boolean;
  reference: string;
}

/** The first applicable rename asks the user to select a durable policy. */
export type ThumbnailRenamePolicy = "unset" | "always" | "ask" | "never";
