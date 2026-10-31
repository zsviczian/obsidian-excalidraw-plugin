/** Browser file input uses the owning window's system picker on desktop and mobile. */
import { Component } from "obsidian";
import type ExcalidrawView from "src/view/ExcalidrawView";
import { hideElement } from "./styleUtils";

export function openSVGFilePicker(
  view: ExcalidrawView,
  onFile: (file: File) => Promise<void>,
): void {
  const picker = view.addChild(new Component());
  const input = view.ownerDocument.body.createEl("input", {
    type: "file",
    attr: {
      accept: ".svg,image/svg+xml",
      "data-testid": "svg-system-file-input",
    },
  });
  hideElement(input);
  const close = () => view.removeChild(picker);
  picker.register(() => input.remove());
  picker.registerDomEvent(input, "cancel", close);
  picker.registerDomEvent(input, "change", () => {
    const file = input.files?.[0];
    close();
    if (file) void onFile(file);
  });
  try {
    // Keep this synchronous with the menu's user gesture; no Electron/fs APIs.
    input.click();
  } catch (error) {
    close();
    throw error;
  }
}
