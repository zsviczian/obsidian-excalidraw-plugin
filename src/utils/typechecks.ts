/**
 * Cross-window-safe type guards
 * Uses the element's own window (defaultView) to get the correct HTMLElement constructor.
 */

export function isInstanceOfHTMLElement(
  value: unknown,
): value is HTMLElement {
  if (value == null || typeof value !== "object") {
    return false;
  }

  const win = (
    value as { ownerDocument?: Document }
  ).ownerDocument?.defaultView;

  return win?.HTMLElement
    ? value instanceof win.HTMLElement
    : value instanceof HTMLElement;
}

export function isInstanceOfHTMLDivElement(
  value: unknown,
): value is HTMLDivElement {
  if (value == null || typeof value !== "object") {
    return false;
  }

  const win = (
    value as { ownerDocument?: Document }
  ).ownerDocument?.defaultView;

  return win?.HTMLDivElement
    ? value instanceof win.HTMLDivElement
    : value instanceof HTMLDivElement;
}

export function isInstanceOfHTMLBodyElement(
  value: unknown,
): value is HTMLBodyElement {
  if (value == null || typeof value !== "object") {
    return false;
  }

  const win = (
    value as { ownerDocument?: Document }
  ).ownerDocument?.defaultView;

  return win?.HTMLBodyElement
    ? value instanceof win.HTMLBodyElement
    : value instanceof HTMLBodyElement;
}

export function isInstanceOfHTMLImageElement(
  value: unknown,
): value is HTMLImageElement {
  if (value == null || typeof value !== "object") {
    return false;
  }

  const win = (
    value as { ownerDocument?: Document }
  ).ownerDocument?.defaultView;

  return win?.HTMLImageElement
    ? value instanceof win.HTMLImageElement
    : value instanceof HTMLImageElement;
}

export function isInstanceOfElement(
  value: unknown,
): value is Element {
  if (value == null || typeof value !== "object") {
    return false;
  }

  const win = (
    value as { ownerDocument?: Document }
  ).ownerDocument?.defaultView;

  return win?.Element
    ? value instanceof win.Element
    : value instanceof Element;
}

export function isInstanceOfDocumentFragment(
  value: unknown,
): value is DocumentFragment {
  if (value == null || typeof value !== "object") {
    return false;
  }

  const win = (
    value as { ownerDocument?: Document }
  ).ownerDocument?.defaultView;

  return win?.DocumentFragment
    ? value instanceof win.DocumentFragment
    : value instanceof DocumentFragment;
}

export function isInstanceOfSVGSVGElement(
  value: unknown,
): value is SVGSVGElement {
  if (value == null || typeof value !== "object") {
    return false;
  }

  const win = (
    value as { ownerDocument?: Document }
  ).ownerDocument?.defaultView;

  return win?.SVGSVGElement
    ? value instanceof win.SVGSVGElement
    : value instanceof SVGSVGElement;
}

export function isInstanceOfSVGElement(
  value: unknown,
): value is SVGElement {
  if (value == null || typeof value !== "object") {
    return false;
  }

  const win = (
    value as { ownerDocument?: Document }
  ).ownerDocument?.defaultView;

  return win?.SVGElement
    ? value instanceof win.SVGElement
    : value instanceof SVGElement;
}

export function isInstanceOfHTMLStyleElement(
  value: unknown,
): value is HTMLStyleElement {
  if (value == null || typeof value !== "object") {
    return false;
  }

  const win = (
    value as { ownerDocument?: Document }
  ).ownerDocument?.defaultView;

  return win?.HTMLStyleElement
    ? value instanceof win.HTMLStyleElement
    : value instanceof HTMLStyleElement;
}

export function isInstanceOfHTMLInputElement(
  value: unknown,
): value is HTMLInputElement {
  if (value == null || typeof value !== "object") {
    return false;
  }

  const win = (
    value as { ownerDocument?: Document }
  ).ownerDocument?.defaultView;

  return win?.HTMLInputElement
    ? value instanceof win.HTMLInputElement
    : value instanceof HTMLInputElement;
}

export function isInstanceOfHTMLTextAreaElement(
  value: unknown,
): value is HTMLTextAreaElement {
  if (value == null || typeof value !== "object") {
    return false;
  }

  const win = (
    value as { ownerDocument?: Document }
  ).ownerDocument?.defaultView;

  return win?.HTMLTextAreaElement
    ? value instanceof win.HTMLTextAreaElement
    : value instanceof HTMLTextAreaElement;
}

export function isInstanceOfHTMLSelectElement(
  value: unknown,
): value is HTMLSelectElement {
  if (value == null || typeof value !== "object") {
    return false;
  }

  const win = (
    value as { ownerDocument?: Document }
  ).ownerDocument?.defaultView;

  return win?.HTMLSelectElement
    ? value instanceof win.HTMLSelectElement
    : value instanceof HTMLSelectElement;
}

export function isInstanceOfHTMLButtonElement(
  value: unknown,
): value is HTMLButtonElement {
  if (value == null || typeof value !== "object") {
    return false;
  }

  const win = (
    value as { ownerDocument?: Document }
  ).ownerDocument?.defaultView;

  return win?.HTMLButtonElement
    ? value instanceof win.HTMLButtonElement
    : value instanceof HTMLButtonElement;
}
