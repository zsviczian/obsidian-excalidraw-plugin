/** Bounded text lengths and font fallback; no host CSS or remote font lookup. */
import { length } from "./transform";

export function textLength(
  value: string | null,
  fontSize: number,
  reference = fontSize,
): number {
  const match = value
    ?.trim()
    .match(/^([-+]?(?:\d*\.?\d+)(?:e[-+]?\d+)?)\s*(em|rem|ex)$/i);
  return match
    ? length(
        String(
          Number(match[1]) *
            (match[2].toLowerCase() === "rem" ? 16 : fontSize) *
            (match[2].toLowerCase() === "ex" ? 0.5 : 1),
        ),
      )
    : length(value, 0, reference);
}

export function fontSize(value: string, parentSize: number): number {
  const keywords: Record<string, number> = {
    "xx-small": 9,
    "x-small": 10,
    small: 13,
    medium: 16,
    large: 18,
    "x-large": 24,
    "xx-large": 32,
    smaller: parentSize / 1.2,
    larger: parentSize * 1.2,
  };
  const result = keywords[value] ?? textLength(value, parentSize, parentSize);
  if (result < 0 || result > 10000) throw Error("SVG font size limit exceeded");
  return result;
}

export function textLineHeight(value: string, size: number): number {
  if (!value || value === "normal") return 1.25;
  const ratio = /^\d*\.?\d+$/.test(value)
    ? Number(value)
    : textLength(value, size, size) / size;
  if (!Number.isFinite(ratio) || ratio <= 0 || ratio > 100)
    throw Error("Invalid SVG text line height");
  return ratio;
}
