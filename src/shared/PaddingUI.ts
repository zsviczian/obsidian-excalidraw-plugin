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

  const wrapper = mainDocument.createElement("div");
  wrapper.className = "excalidraw-padding-wrapper";
  wrapper.setAttribute(
    "data-bare-ref",
    src.replace(/,padding=\d+/, ""),
  );
  wrapper.appendChild(imgDiv);

  const icon = mainDocument.createElement("span");
  icon.className = "excalidraw-padding-zoom-icon";
  icon.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>';

  wrapper.addEventListener("mouseenter", () => {
    icon.style.opacity = "0.8";
  });
  wrapper.addEventListener("mouseleave", () => {
    icon.style.opacity = "0";
  });

  let hideTimer: number;
  wrapper.addEventListener("click", (e) => {
    if (e.target === icon || icon.contains(e.target as Node)) return;
    window.clearTimeout(hideTimer);
    icon.style.opacity = "0.8";
    hideTimer = window.setTimeout(() => { icon.style.opacity = "0"; }, 3000);
  });

  icon.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();

    const doc = wrapper.ownerDocument;

    const existing = doc.querySelector(".ex-pad-popup");
    if (existing) existing.remove();

    let value = currentPadding;
    let debounceTimer: number;

    const bareRef = src.replace(/,padding=\d+/, "");

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

    const popup = doc.createElement("div");
    popup.className = "ex-pad-popup";

    const label = doc.createElement("span");
    label.className = "ex-pad-popup-label";
    label.textContent = String(value);

    const track = doc.createElement("div");
    track.className = "ex-pad-popup-track";

    const knob = doc.createElement("div");
    knob.className = "ex-pad-popup-knob";

    const updateKnob = (v: number) => {
      const pct = Math.min(1, v / 1000);
      knob.style.top = (160 - 14) * pct + "px";
    };
    updateKnob(value);

    const onValueChange = (v: number) => {
      value = v;
      label.textContent = String(v);
      updateKnob(v);
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(doSave, 400);
    };

    let dragging = false;
    const posToValue = (clientY: number) => {
      const tr = track.getBoundingClientRect();
      const pct = 1 - (clientY - tr.top) / tr.height;
      return Math.round(Math.max(0, pct * 1000) / 10) * 10;
    };

    track.addEventListener("pointerdown", (ev: PointerEvent) => {
      dragging = true;
      track.setPointerCapture(ev.pointerId);
      onValueChange(posToValue(ev.clientY));
    });
    track.addEventListener("pointermove", (ev: PointerEvent) => {
      if (!dragging) return;
      onValueChange(posToValue(ev.clientY));
    });
    track.addEventListener("pointerup", () => { dragging = false; });
    track.addEventListener("pointerleave", () => { dragging = false; });

    track.appendChild(knob);

    popup.addEventListener("wheel", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      onValueChange(Math.max(0, value + (ev.deltaY < 0 ? 50 : -50)));
    }, { passive: false });

    popup.appendChild(label);
    popup.appendChild(track);
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
