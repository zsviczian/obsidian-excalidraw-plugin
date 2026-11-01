/** Inert SVG-image decoding and viewport preparation; no resource fetching or active markup. */
import type { ExcalidrawImageElement } from "@zsviczian/excalidraw/types/element/src/types";
import { length, numbers } from "src/shared/svgToExcalidraw/transform";
import type { SVGMatrix } from "src/types/svgConversionTypes";

export function decodeSVGDataURL(dataURL: string): string {
  if (typeof dataURL !== "string" || dataURL.length > 3_000_000)
    throw Error("Invalid SVG image data");
  const match = /^data:image\/svg\+xml((?:;[^,]*)?),(.*)$/is.exec(dataURL);
  if (!match) throw Error("Not an embedded SVG image");
  const source = /;base64(?:;|$)/i.test(match[1])
    ? new TextDecoder("utf-8", { fatal: true }).decode(
        Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0)),
      )
    : decodeURIComponent(match[2]);
  if (source.length > 2_000_000 || /<!DOCTYPE|<!ENTITY/i.test(source))
    throw Error("Unsafe/excessive SVG image");
  return source;
}

/** Retain the source viewport/padding while scaling/flipping into the image's displayed size. */
export function getSVGImageTransform(
  source: string,
  image: ExcalidrawImageElement,
): { transform: SVGMatrix; boundsViewport: { width: number; height: number } } {
  if (source.length > 2_000_000 || /<!DOCTYPE|<!ENTITY/i.test(source))
    throw Error("Unsafe/excessive SVG image");
  let tags = 0;
  const tagPattern = /<[A-Za-z_]/g;
  while (tagPattern.exec(source)) {
    if (++tags > 20000) throw Error("SVG input element limit exceeded");
  }
  if (
    [image.x, image.y, image.angle, image.opacity].some(
      (v) => !Number.isFinite(v) || Math.abs(v) > 1e7,
    ) ||
    image.opacity < 0 ||
    image.opacity > 100 ||
    image.scale.some((v) => Math.abs(v) !== 1)
  )
    throw Error("Invalid image geometry");
  if (
    [image.width, image.height].some(
      (v) => !Number.isFinite(v) || v <= 0 || v > 1e7,
    )
  )
    throw Error("Invalid image size");
  const doc = new DOMParser().parseFromString(source, "image/svg+xml"),
    root = doc.documentElement;
  if (
    root?.localName !== "svg" ||
    (root.namespaceURI && root.namespaceURI !== "http://www.w3.org/2000/svg") ||
    doc.getElementsByTagName("parsererror").length
  )
    throw Error("Invalid SVG image");
  const box = root.hasAttribute("viewBox")
    ? numbers(root.getAttribute("viewBox"))
    : null;
  const width = length(root.getAttribute("width"), box?.[2] ?? 300, 300);
  const height = length(root.getAttribute("height"), box?.[3] ?? 150, 150);
  if (width <= 0 || height <= 0) throw Error("Invalid source viewport");
  const flipX = image.scale[0] < 0 ? -1 : 1,
    flipY = image.scale[1] < 0 ? -1 : 1;
  return {
    transform: [
      (flipX * image.width) / width,
      0,
      0,
      (flipY * image.height) / height,
      flipX < 0 ? image.width : 0,
      flipY < 0 ? image.height : 0,
    ],
    boundsViewport: { width: image.width, height: image.height },
  };
}
