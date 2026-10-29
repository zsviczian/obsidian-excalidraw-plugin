/** Exact browser notifications are evidence, never a waiver for failed behavior or unsettled work. */
import { randomUUID } from "node:crypto";
import { parseCLIJSON } from "./inAppTask.mjs";

export const resizeNotification =
  "ResizeObserver loop completed with undelivered notifications.";

export function splitWindowErrors(events) {
  const diagnostics = [],
    unexpected = [];
  for (const event of events) {
    (event.message === resizeNotification &&
    event.hasError === false &&
    event.isTrusted === true &&
    !event.stack
      ? diagnostics
      : unexpected
    ).push(event);
  }
  return { diagnostics, unexpected };
}

/** CLI records use an exact timestamp prefix; exception text or partial matches remain failures. */
export function classifyCLIErrorText(raw) {
  if (!raw.trim() || /^No errors captured\.?$/i.test(raw.trim()))
    return { raw, diagnostics: [], unexpected: [] };
  const diagnostics = [],
    unexpected = [];
  for (const line of raw.split(/\r?\n/).filter((line) => line.trim())) {
    (/^\d{2}:\d{2}:\d{2} ResizeObserver loop completed with undelivered notifications\.$/.test(
      line,
    )
      ? diagnostics
      : unexpected
    ).push(line);
  }
  return { raw, diagnostics, unexpected };
}

/** Runs in the actual owning realm. Observes events and geometry without altering layout or observers. */
export async function settleBrowserDiagnostics(
  win,
  events,
  label,
  options = {},
) {
  const timeoutMs = options.timeoutMs ?? 5000,
    quietMs = options.quietMs ?? 1000;
  const started = Date.now(),
    samples = [];
  let previous,
    stableSince = started;
  const sample = () => {
    const geometry = [
      ...win.document.querySelectorAll(".workspace-leaf,.excalidraw-wrapper"),
    ]
      .filter((el) => el.isConnected && el.getClientRects().length)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return [
          el.className,
          ...[r.x, r.y, r.width, r.height].map((v) => Math.round(v * 2) / 2),
        ];
      });
    return { at: Date.now(), geometry, eventCount: events.length };
  };
  while (!win.closed) {
    const current = sample(),
      signature = JSON.stringify([current.geometry, current.eventCount]);
    if (signature !== previous) {
      previous = signature;
      stableSince = current.at;
    }
    samples.push(current);
    if (current.at - stableSince >= quietMs)
      return {
        status: "passed",
        label,
        started,
        completed: current.at,
        timeoutMs,
        quietMs,
        samples,
      };
    if (current.at - started >= timeoutMs)
      return {
        status: "failed",
        label,
        reason:
          "Browser did not reach stable geometry and notification-free idle",
        started,
        completed: current.at,
        timeoutMs,
        quietMs,
        samples,
      };
    await new Promise((resolve) => win.setTimeout(resolve, 100));
  }
  return {
    status: "failed",
    label,
    reason: "Owning window closed before idle validation",
    samples,
  };
}

/** Main-realm lifetime is scoped to one coordinator/device profile; raw events are retained. */
export function acquireBrowserDiagnostics(cli, label) {
  const evaluate = (code) => parseCLIJSON(cli("eval", "code=" + code));
  const key =
    "__excalidrawBrowserDiagnostics_" + randomUUID().replaceAll("-", "");
  evaluate(
    `(()=>{const c={events:[],label:${JSON.stringify(label)}};c.listener=event=>c.events.push({at:Date.now(),message:event.message,isTrusted:event.isTrusted,hasError:event.error!=null,stack:event.error?.stack,source:event.filename,line:event.lineno,column:event.colno,label:c.label,cases:Object.keys(globalThis).filter(k=>k.startsWith('__excalidrawTestTask_')).map(k=>({phase:globalThis[k].activeCase||globalThis[k].phase}))});window.addEventListener('error',c.listener);globalThis[${JSON.stringify(key)}]=c;return JSON.stringify(true)})()`,
  );
  let disposed = false;
  return {
    setLabel: (label) =>
      evaluate(
        `(()=>{globalThis[${JSON.stringify(key)}].label=${JSON.stringify(label)};return JSON.stringify(true)})()`,
      ),
    read: () =>
      evaluate(`JSON.stringify(globalThis[${JSON.stringify(key)}].events)`),
    settle: () =>
      evaluate(
        `(${settleBrowserDiagnostics.toString()})(window,globalThis[${JSON.stringify(key)}].events,${JSON.stringify(label)}).then(JSON.stringify)`,
      ),
    dispose() {
      if (disposed) return;
      evaluate(
        `(()=>{const c=globalThis[${JSON.stringify(key)}];window.removeEventListener('error',c.listener);delete globalThis[${JSON.stringify(key)}];return JSON.stringify(true)})()`,
      );
      disposed = true;
    },
  };
}
