declare const deliberateCreateElement: (
  document: Document,
  tagName: string,
) => HTMLElement;

export interface RasterCropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Crops a PNG blob without converting it through a base64 data URL. */
export async function cropPNGBlob(
  blob: Blob,
  crop: RasterCropRegion,
  // could theoretically be replaced with activeDocument, however that would not resolve the
  // deliberateCreateElement issue to create a canvas element for image operations.
  ownerDocument: Document,
): Promise<Blob> {
  const ownerWindow = ownerDocument.defaultView ?? window;
  const urlApi = ownerWindow.URL;
  const objectUrl = urlApi.createObjectURL(blob);
  const image = deliberateCreateElement(
    ownerDocument,
    "img",
  ) as HTMLImageElement;
  try {
    image.src = objectUrl;
    await image.decode();
    const canvas = deliberateCreateElement(
      ownerDocument,
      "canvas",
    ) as HTMLCanvasElement;
    canvas.width = Math.max(1, Math.round(crop.width));
    canvas.height = Math.max(1, Math.round(crop.height));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not create a 2D export canvas.");
    context.drawImage(
      image,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) resolve(result);
        else reject(new Error("Could not encode the cropped PNG."));
      }, "image/png");
    });
  } finally {
    urlApi.revokeObjectURL(objectUrl);
  }
}
