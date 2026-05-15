/**
 * Checks if a given target is an HTMLElement.
 *
 * This function is necessary because `instanceof HTMLElement` can fail
 * in environments with multiple execution contexts (e.g., popout windows),
 * where `HTMLElement` comes from different global objects.
 * Instead, we use feature detection by checking for key properties
 * common to all HTML elements (nodeType and tagName).
 *
 * @param target - The target to check.
 * @returns True if the target is an HTMLElement, false otherwise.
 */
export function isHTMLElement(
  target: EventTarget | null,
): target is HTMLElement {
  return (
    target !== null &&
    typeof target === "object" &&
    "nodeType" in target &&
    target.nodeType === 1 && // nodeType 1 means it's an element
    "tagName" in target &&
    typeof target.tagName === "string"
  ); // tagName exists on HTML elements
}
