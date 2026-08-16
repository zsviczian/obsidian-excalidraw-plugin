import type { DataURL } from "@zsviczian/excalidraw/types/excalidraw/types";

/**
 * Converts an in-memory browser Blob to a data URL without reading from disk.
 *
 * @param blob - Browser Blob to encode.
 * @returns The Blob contents encoded as a data URL.
 * @remarks Uses the Web FileReader API and is safe in Obsidian's desktop and
 * mobile WebViews. Vault file access must still use Obsidian's Vault API.
 */
export async function blobToDataURL(blob: Blob): Promise<DataURL> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as DataURL);
    reader.onerror = () =>
      reject(reader.error ?? new Error("Failed to read Blob as DataURL."));
    reader.readAsDataURL(blob);
  });
}

export async function getDataURL(
  file: ArrayBuffer,
  mimeType: string,
): Promise<DataURL> {
  return blobToDataURL(new Blob([new Uint8Array(file)], { type: mimeType }));
}

export function errorlog(data: object) {
  console.error({ plugin: "Excalidraw", ...data });
}
