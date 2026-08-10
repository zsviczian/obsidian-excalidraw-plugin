/**
 * Reads only the SFNT metadata required to register a local Excalidraw font.
 *
 * @packageDocumentation
 */

const SFNT_HEADER_SIZE = 12;
const TABLE_RECORD_SIZE = 16;
const TABLE_TAG_SIZE = 4;
const TABLE_OFFSET_POSITION = 8;
const TABLE_LENGTH_POSITION = 12;

const HEAD_UNITS_PER_EM_POSITION = 18;
const HEAD_REQUIRED_LENGTH = HEAD_UNITS_PER_EM_POSITION + 2;
const HHEA_ASCENDER_POSITION = 4;
const HHEA_DESCENDER_POSITION = 6;
const HHEA_REQUIRED_LENGTH = HHEA_DESCENDER_POSITION + 2;

const SUPPORTED_SFNT_SIGNATURES = new Set([
  0x00010000, // TrueType outlines
  0x4f54544f, // OTTO: OpenType with CFF/CFF2 outlines
  0x74727565, // true: legacy Apple TrueType
  0x74797031, // typ1: legacy OpenType wrapper
]);

/** Font metrics registered for Excalidraw's local font family. */
export interface FontMetrics {
  /** Raw `head.unitsPerEm` value. The narrow cast preserves uncommon values. */
  unitsPerEm: 1000 | 1024 | 2048;
  /** Raw `hhea.ascender` value. */
  ascender: number;
  /** Raw `hhea.descender` value. */
  descender: number;
  /** Unitless line height derived using the plugin's established formula. */
  lineHeight: number;
}

type SfntTable = {
  offset: number;
  length: number;
};

const readTableTag = (view: DataView, offset: number): string => {
  let tag = "";
  for (let index = 0; index < TABLE_TAG_SIZE; index++) {
    tag += String.fromCharCode(view.getUint8(offset + index));
  }
  return tag;
};

const isRangeAvailable = (
  byteLength: number,
  offset: number,
  length: number,
): boolean =>
  Number.isSafeInteger(offset) &&
  Number.isSafeInteger(length) &&
  offset >= 0 &&
  length >= 0 &&
  offset <= byteLength - length;

const findRequiredTables = (
  view: DataView,
): { head: SfntTable; hhea: SfntTable } | null => {
  if (view.byteLength < SFNT_HEADER_SIZE) {
    return null;
  }
  if (!SUPPORTED_SFNT_SIGNATURES.has(view.getUint32(0))) {
    return null;
  }

  const tableCount = view.getUint16(4);
  const directoryLength = tableCount * TABLE_RECORD_SIZE;
  if (!isRangeAvailable(view.byteLength, SFNT_HEADER_SIZE, directoryLength)) {
    return null;
  }

  let head: SfntTable | null = null;
  let hhea: SfntTable | null = null;
  for (let index = 0; index < tableCount && (!head || !hhea); index++) {
    const recordOffset = SFNT_HEADER_SIZE + index * TABLE_RECORD_SIZE;
    const tag = readTableTag(view, recordOffset);
    if (tag !== "head" && tag !== "hhea") {
      continue;
    }
    const table = {
      offset: view.getUint32(recordOffset + TABLE_OFFSET_POSITION),
      length: view.getUint32(recordOffset + TABLE_LENGTH_POSITION),
    };
    if (!isRangeAvailable(view.byteLength, table.offset, table.length)) {
      return null;
    }
    if (tag === "head") {
      head = table;
    } else {
      hhea = table;
    }
  }
  return head && hhea ? { head, hhea } : null;
};

/**
 * Reads the vertical metrics needed by Excalidraw from a TTF or OTF buffer.
 *
 * @param fontData - Complete SFNT font data from a `.ttf` or `.otf` file.
 * @returns Parsed metrics, or `null` when the font is unsupported or malformed.
 * @remarks
 * Only the SFNT table directory plus `head.unitsPerEm`, `hhea.ascender`, and
 * `hhea.descender` are read. Glyph outlines, names, and layout tables are left
 * to the browser and Excalidraw, as they were never consumed by the plugin.
 */
export function getFontMetrics(fontData: ArrayBuffer): FontMetrics | null {
  const view = new DataView(fontData);
  const tables = findRequiredTables(view);
  if (
    !tables ||
    tables.head.length < HEAD_REQUIRED_LENGTH ||
    tables.hhea.length < HHEA_REQUIRED_LENGTH
  ) {
    return null;
  }

  const unitsPerEm = view.getUint16(
    tables.head.offset + HEAD_UNITS_PER_EM_POSITION,
  );
  const ascender = view.getInt16(
    tables.hhea.offset + HHEA_ASCENDER_POSITION,
  );
  const descender = view.getInt16(
    tables.hhea.offset + HHEA_DESCENDER_POSITION,
  );
  if (unitsPerEm === 0) {
    return null;
  }

  return {
    // Excalidraw's type lists common values only; retain the font's exact value.
    unitsPerEm: unitsPerEm as FontMetrics["unitsPerEm"],
    ascender,
    descender,
    lineHeight: (ascender - descender) / unitsPerEm,
  };
}
