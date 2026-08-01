import type ExcalidrawPlugin from "../core/main";

declare const mainDocument: Document;

let plugin: ExcalidrawPlugin;

export const initPaddingUI = (_plugin: ExcalidrawPlugin) => {
  plugin = _plugin;
};

export const wrapWithPaddingPopup = (
  imgDiv: HTMLDivElement,
  src: string,
  fnameParts: { hasArearef: boolean; padding?: number; blockref: string },
): HTMLDivElement => {
  const currentPadding =
    fnameParts.padding ?? plugin.settings.exportPaddingSVG;
  const bareRef = src.replace(/,padding=\d+/, "");

  const wrapper = mainDocument.createElement("div");
  wrapper.className = "excalidraw-padding-wrapper";
  wrapper.setAttribute("data-bare-ref", bareRef);
  wrapper.style.position = "relative";
  wrapper.style.display = "inline-block";
  wrapper.appendChild(imgDiv);

  const icon = mainDocument.createElement("span");
  icon.className = "excalidraw-padding-zoom-icon";
  icon.innerHTML =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>';
  icon.style.cssText =
    "position:absolute;top:4px;right:4px;cursor:pointer;opacity:0;transition:opacity 0.15s;" +
    "background:var(--background-secondary);border-radius:4px;padding:2px;" +
    "display:flex;align-items:center;justify-content:center;z-index:10;";

  wrapper.addEventListener("mouseenter", () => {
    icon.style.opacity = "0.8";
  });
  wrapper.addEventListener("mouseleave", () => {
    icon.style.opacity = "0";
  });

  icon.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();

    const doc = wrapper.ownerDocument;

    let value = currentPadding;
    let debounceTimer: number;

    const allWrappers = doc.querySelectorAll(
      '.excalidraw-padding-wrapper[data-bare-ref="' +
        bareRef.replace(/"/g, "\\\"") +
        '"]',
    );
    let instanceIdx = 0;
    allWrappers.forEach((w, i) => {
      if (w === wrapper) instanceIdx = i + 1;
    });

    const doSave = async () => {
      if (!instanceIdx) return;
      const file = plugin.app.workspace.getActiveFile();
      if (!file || !("extension" in file)) return;
      const defaultPad = plugin.settings.exportPaddingSVG;
      await plugin.app.vault.process(file, (data: string) => {
        const esc = bareRef.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&",
        );
        const re = new RegExp(esc + "(,padding=\\d+)?", "g");
        let count = 0;
        return data.replace(re, (match: string) => {
          count++;
          if (count !== instanceIdx) return match;
          if (value === defaultPad) return bareRef;
          return bareRef + ",padding=" + value;
        });
      });
    };

    const onValueChange = (v: number) => {
      value = v;
      slider.value = String(v);
      label.textContent = String(v);
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(doSave, 400);
    };

    const popup = doc.createElement("div");
    popup.className = "ex-pad-popup";
    popup.style.cssText =
      "position:fixed;z-index:999;background:var(--background-primary);" +
      "border:1px solid var(--background-modifier-border);border-radius:6px;" +
      "padding:8px 12px;display:flex;align-items:center;gap:10px;" +
      "box-shadow:0 4px 12px rgba(0,0,0,0.15);";

    const slider = doc.createElement("input");
    slider.type = "range";
    slider.min = "0";
    slider.max = "500";
    slider.step = "10";
    slider.value = String(value);
    slider.style.width = "140px";

    const label = doc.createElement("span");
    label.textContent = String(value);
    label.style.cssText =
      "min-width:32px;text-align:right;font-weight:600;font-size:13px;";

    slider.addEventListener("input", () =>
      onValueChange(parseInt(slider.value)),
    );

    popup.addEventListener("wheel", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      onValueChange(
        Math.max(0, Math.min(500, value + (ev.deltaY < 0 ? 50 : -50))),
      );
    }, { passive: false });

    popup.appendChild(slider);
    popup.appendChild(label);
    doc.body.appendChild(popup);

    const rect = icon.getBoundingClientRect();
    const pr = popup.getBoundingClientRect();
    popup.style.left =
      Math.min(rect.left, window.innerWidth - pr.width - 8) + "px";
    popup.style.top =
      Math.min(rect.bottom + 4, window.innerHeight - pr.height - 8) + "px";

    const close = (ev: MouseEvent) => {
      if (!popup.contains(ev.target as Node)) {
        popup.remove();
        doc.removeEventListener("click", close);
        window.clearTimeout(debounceTimer);
        doSave();
      }
    };
    setTimeout(() => doc.addEventListener("click", close), 0);
  });

  wrapper.appendChild(icon);
  return wrapper;
};
