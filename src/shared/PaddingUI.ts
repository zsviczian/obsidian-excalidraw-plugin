import type ExcalidrawPlugin from "../core/main";

declare const mainDocument: Document;

let plugin: ExcalidrawPlugin;

export const initPaddingUI = (_plugin: ExcalidrawPlugin) => {
  plugin = _plugin;
};

export const wrapWithPaddingPopup = (
  imgDiv: HTMLDivElement,
  src: string,
  fnameParts: { hasArearef: boolean; padding?: number; blockref: string; linkpartReference: string },
): HTMLDivElement => {
  const currentPadding =
    fnameParts.padding ?? plugin.settings.exportPaddingSVG;

  const bareRef = src.replace(/,padding=\d+/, "");

  const wrapper = mainDocument.createElement("div");
  wrapper.className = "excalidraw-padding-wrapper";
  wrapper.setAttribute("data-bare-ref", bareRef);
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

    const existing = mainDocument.querySelector(".ex-pad-popup");
    if (existing) existing.remove();

    let value = currentPadding;
    let debounceTimer: number;
    let target = fnameParts.linkpartReference;

    const doSave = async () => {
      const file = plugin.app.workspace.getActiveFile();
      if (!file || !("extension" in file)) return;
      const defaultPad = plugin.settings.exportPaddingSVG;
      const newSuffix = value === defaultPad ? "" : ",padding=" + value;
      const base = fnameParts.linkpartReference.replace(/,padding=\d+$/, "");
      const replacement = base + newSuffix;
      await plugin.app.vault.process(file, (data: string) => {
        const idx = data.indexOf(target);
        if (idx !== -1) {
          const oldLen = target.length;
          target = replacement;
          return data.substring(0, idx) + replacement + data.substring(idx + oldLen);
        }
        const esc = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const re = new RegExp(esc + "(,padding=\\d+)?");
        const result = data.replace(re, replacement);
        target = replacement;
        return result;
      });
    };

    const popup = doc.createElement("div");
    popup.className = "ex-pad-popup";
    popup.style.touchAction = "none";

    const label = doc.createElement("span");
    label.className = "ex-pad-popup-label";
    label.textContent = String(value);

    const track = doc.createElement("div");
    track.className = "ex-pad-popup-track";
    track.style.touchAction = "none";

    const knob = doc.createElement("div");
    knob.className = "ex-pad-popup-knob";

    const STEPS = [0, 10];
    for (let s = 50; s <= 500; s += 50) STEPS.push(s);
    for (let s = 600; s <= 1000; s += 100) STEPS.push(s);
    for (let s = 1200; s <= 2000; s += 200) STEPS.push(s);

    const valueToStep = (v: number) => {
      let best = STEPS[0];
      for (const s of STEPS) {
        if (Math.abs(s - v) < Math.abs(best - v)) best = s;
      }
      return best;
    };

    const stepIndex = (v: number) => STEPS.indexOf(valueToStep(v));

    value = valueToStep(value);
    label.textContent = String(value);

    const updateKnob = (v: number) => {
      const idx = stepIndex(v);
      const pct = idx / (STEPS.length - 1);
      knob.style.top = (160 - 14) * pct + "px";
    };
    updateKnob(value);

    const onValueChange = (v: number) => {
      value = valueToStep(v);
      label.textContent = String(value);
      updateKnob(value);
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(doSave, 400);
    };

    let dragging = false;
    const posToValue = (clientY: number) => {
      const tr = track.getBoundingClientRect();
      const pct = (clientY - tr.top) / tr.height;
      const idx = Math.round(pct * (STEPS.length - 1));
      return STEPS[Math.max(0, Math.min(STEPS.length - 1, idx))];
    };

    const onPointerDown = (ev: PointerEvent) => {
      dragging = true;
      window.clearTimeout(debounceTimer);
      onValueChange(posToValue(ev.clientY));
    };
    const onPointerMove = (ev: PointerEvent) => {
      if (!dragging) return;
      onValueChange(posToValue(ev.clientY));
    };
    const onPointerUp = () => {
      dragging = false;
      doSave();
    };

    track.addEventListener("pointerdown", onPointerDown);
    doc.addEventListener("pointermove", onPointerMove);
    doc.addEventListener("pointerup", onPointerUp);

    track.appendChild(knob);

    popup.addEventListener("wheel", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const idx = stepIndex(value);
      const next = idx + (ev.deltaY < 0 ? -1 : 1);
      if (next >= 0 && next < STEPS.length) onValueChange(STEPS[next]);
    }, { passive: false });

    popup.appendChild(label);
    popup.appendChild(track);
    doc.body.appendChild(popup);

    const rect = icon.getBoundingClientRect();
    const pr = popup.getBoundingClientRect();
    const win = doc.defaultView ?? window;
    popup.style.left =
      Math.min(rect.left, win.innerWidth - pr.width - 8) + "px";
    popup.style.top =
      Math.min(rect.bottom + 4, win.innerHeight - pr.height - 8) + "px";

    const close = (ev: MouseEvent) => {
      if (!popup.contains(ev.target as Node)) {
        popup.remove();
        doc.removeEventListener("click", close);
        doc.removeEventListener("pointermove", onPointerMove);
        doc.removeEventListener("pointerup", onPointerUp);
        window.clearTimeout(debounceTimer);
        doSave();
      }
    };
    setTimeout(() => doc.addEventListener("click", close), 0);
  });

  wrapper.appendChild(icon);
  return wrapper;
};
