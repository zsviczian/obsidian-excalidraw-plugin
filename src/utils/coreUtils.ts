import type { DataURL } from "@zsviczian/excalidraw/types/excalidraw/types";

export async function getDataURL(
  file: ArrayBuffer,
  mimeType: string,
): Promise<DataURL> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataURL = reader.result as DataURL;
      resolve(dataURL);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(new Blob([new Uint8Array(file)], { type: mimeType }));
  });
}

export function errorlog(data: object) {
  console.error({ plugin: "Excalidraw", ...data });
}
