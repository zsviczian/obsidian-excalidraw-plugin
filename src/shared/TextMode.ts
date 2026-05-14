export enum TextMode {
  parsed = "parsed",
  raw = "raw",
}

export function getTextMode(data: string): TextMode {
  const parsed =
    data.search("excalidraw-plugin: parsed\n") > -1 ||
    data.search("excalidraw-plugin: locked\n") > -1;
  return parsed ? TextMode.parsed : TextMode.raw;
}
