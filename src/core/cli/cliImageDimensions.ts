/** Bounded raster-header inspection before a CLI thumbnail can invoke a decoder. */
import { CLIError } from "./cliProtocol";
import { inspectRasterDimensions } from "src/utils/rasterImageDimensions";

/**
 * Accept only formats whose encoded dimensions can be established cheaply.
 * Read at most 256 KiB of encoded headers; SVG/animated/unknown input must use
 * original or placeholder instead. Decoded dimensions are checked again later.
 */
export function thumbnailDimensions(url: string): { width: number; height: number } {
  const comma = url.indexOf(",");
  if (comma < 0 || !url.slice(0, comma).endsWith(";base64")) throw new CLIError("ASSETS_UNAVAILABLE", "Cannot preflight thumbnail dimensions; choose original or placeholder.");
  let header: string;
  try { header = atob(url.slice(comma + 1, comma + 1 + 349524)); }
  catch { throw new CLIError("ASSETS_UNAVAILABLE", "Invalid thumbnail source encoding."); }
  const bytes = Uint8Array.from(header, char => char.charCodeAt(0));
  return rasterDimensions(bytes);
}

/** Check the supported formats before invoking a browser decoder. */
export function rasterDimensions(bytes: Uint8Array): { width: number; height: number } {
  const dimensions = inspectRasterDimensions(bytes);
  if (!dimensions) throw new CLIError("ASSETS_UNAVAILABLE", "Thumbnail dimensions are unknown or exceed 16 million pixels; choose original or placeholder.");
  return dimensions;
}
