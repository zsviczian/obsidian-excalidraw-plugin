/**
 * Wraps text at an approximate character length while preserving line breaks.
 *
 * @param text - Text to wrap.
 * @param lineLen - Target line length. A falsy value disables wrapping.
 * @param forceWrap - Whether to split every input line into fixed-size chunks.
 * @param tolerance - Extra characters allowed for an unbroken word.
 * @returns The wrapped text without an additional trailing newline.
 */
export function wrapTextAtCharLength(
  text: string,
  lineLen: number,
  forceWrap: boolean = false,
  tolerance: number = 0,
): string {
  if (!lineLen) {
    return text;
  }
  let outstring = "";
  if (forceWrap) {
    for (const inputLine of text.split("\n")) {
      const chunks = inputLine.match(new RegExp(`(.){1,${lineLen}}`, "g"));
      outstring += chunks ? `${chunks.join("\n")}\n` : "\n";
    }
    return outstring.replace(/\n$/, "");
  }

  const wrappingPattern = new RegExp(
    `(.{1,${lineLen}})(\\s+|$\\n?)|([^\\s]{1,${lineLen + tolerance}})(\\s+|$\\n?)?`,
    "gm",
  );
  for (const match of text.matchAll(wrappingPattern)) {
    outstring += match[1] ? match[1].trimEnd() : match[3].trimEnd();
    const newLineCount =
      (match[2] ? match[2].split("\n").length - 1 : 0) +
      (match[4] ? match[4].split("\n").length - 1 : 0);
    outstring += "\n".repeat(newLineCount);
    if (newLineCount === 0) {
      outstring += "\n";
    }
  }
  return outstring.replace(/\n$/, "");
}
