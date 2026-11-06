import { readDrawingEmbedToken } from "./embedDimensions";
import type { LocatedDrawingEmbed } from "src/types/drawingEmbedTypes";

interface CellRange { from: number; to: number }

/** Table delimiters are unescaped pipes, including inside inline code. */
function cells(line: string): CellRange[] {
  const result: CellRange[] = [];
  let from = 0, slashes = 0, pipes = 0;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === "|" && slashes % 2 === 0) {
      result.push({ from, to: i }); from = i + 1; pipes++;
    }
    slashes = char === "\\" ? slashes + 1 : 0;
  }
  if (!pipes) return [];
  result.push({ from, to: line.length });
  if (!line.slice(result[0].from, result[0].to).trim()) result.shift();
  const last = result.at(-1);
  if (last && !line.slice(last.from, last.to).trim()) result.pop();
  return result;
}

/**
 * Locate one complete token in a physical cell of a publicly mapped native
 * table widget. Validate the entire rectangular table/DOM shape first; never
 * infer the cell from a filename or a document-wide occurrence number.
 */
export function readTableEmbedToken(
  source: string, tableFrom: number, row: number, column: number,
  rowCount: number, columnCount: number,
): LocatedDrawingEmbed | null {
  if (![tableFrom, row, column, rowCount, columnCount].every(Number.isInteger) ||
      tableFrom < 0 || row < 0 || row >= rowCount || column < 0 || column >= columnCount ||
      rowCount < 1 || columnCount < 1 || source.length > 16384) return null;
  const lines = source.split("\n");
  while (lines.length && !lines.at(-1).trim()) lines.pop();
  if (lines.length !== rowCount + 1) return null;
  const rows = lines.map(cells);
  if (rows.some(cells => cells.length !== columnCount) ||
      !rows[1].every(cell => /^:?-+:?$/.test(lines[1].slice(cell.from, cell.to).trim()))) return null;
  const lineIndex = row === 0 ? 0 : row + 1, cell = rows[lineIndex][column];
  const raw = lines[lineIndex].slice(cell.from, cell.to), text = raw.trim();
  const token = readDrawingEmbedToken(text);
  if (!token || token.text !== text) return null;
  const offset = lines.slice(0, lineIndex).reduce((length, line) => length + line.length + 1, 0);
  return { from: tableFrom + offset + cell.from + raw.search(/\S/), text, target: token.target };
}
