/** Obsidian icon-registry ID for the narrow-to-block action. */
export const BLOCK_REFERENCE_ICON_ID = "excalidraw-narrow-to-block";

/** Path geometry shared by the React action menu and Obsidian settings UI. */
export const BLOCK_REFERENCE_ICON_PATH =
  "M6 4 4 20M12 4l-2 16M2.75 9h11.5M1.75 15h11.5M16 13l3-4 3 4";

/** SVG body scaled from the shared 24-unit path to Obsidian's 100-unit registry viewBox. */
export const BLOCK_REFERENCE_ICON_REGISTRY_SVG =
  `<path d="${BLOCK_REFERENCE_ICON_PATH}" transform="scale(4.1666667)" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>`;
