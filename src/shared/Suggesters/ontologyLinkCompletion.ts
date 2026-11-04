/** HTML-input insertion policy over a provider-owned exact range. This helper neither matches
 * triggers nor interprets ontology. It preserves suffix text and owns only an adjacent wrapper. */

export type OntologyLinkEdit = Readonly<{value: string; insertion: string; caret: number}>;

/** Locate a matching wrapper closer on the same logical line without consuming any suffix.
 * Nested suffix delimiters retain their own closers; trigger/query characters are being replaced. */
function hasWrapperCloser(text: string, start: number, opener: string, closer: string): boolean {
  let depth = 1;
  for (let index = start; index < text.length; index++) {
    const char = text[index];
    if (/[\n\r\u2028\u2029]/.test(char)) return false;
    if (char === opener) depth++;
    else if (char === closer && --depth === 0) return true;
  }
  return false;
}

/** Construct plain physical-field insertion, reusing a matching closer or adding one before
 * unrelated suffix text. Bare fields have no trailing space; wrappers leave one value-entry space.
 * The collapsed caret follows that space, immediately before an adjacent existing/new closer. */
export function ontologyLinkEdit(
  text: string,
  range: Readonly<{start: number; end: number}>,
  name: string,
): OntologyLinkEdit | null {
  const {start, end} = range;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end > text.length || !name) return null;
  const before = text.slice(0, start), after = text.slice(end), opener = before.charAt(before.length - 1);
  const closer = opener === "(" ? ")" : opener === "[" && !before.endsWith("[[") ? "]" : null;
  const field = name + "::" + (closer ? " " : "");
  const insertion = field + (closer && !hasWrapperCloser(text, end, opener, closer) ? closer : "");
  return {value: before + insertion + after, insertion, caret: start + field.length};
}
