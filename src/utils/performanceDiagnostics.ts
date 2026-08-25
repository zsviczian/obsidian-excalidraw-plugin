import { log } from "./debugHelper";

/**
 * Temporary Phase 0 performance diagnostics.
 *
 * Enable before loading the plugin with:
 * localStorage.setItem("excalidraw-performance-diagnostics", "1")
 *
 * Every emitted record is deliberately one flat, copyable string. The module
 * does not log vault contents or file paths and does not change product state.
 * Remove this module and every EXCALIDRAW_PERF_PHASE0 call before committing.
 */
export const PERFORMANCE_DIAGNOSTICS_PREFIX = "EXCALIDRAW_PERF_PHASE0";
export const PERFORMANCE_DIAGNOSTICS_STORAGE_KEY =
  "excalidraw-performance-diagnostics";

const SUMMARY_INTERVAL_MS = 5000;

type DiagnosticValue = string | number | boolean | null | undefined;
type DiagnosticFields = Record<string, DiagnosticValue>;

type BrowserPerformanceMemory = {
  usedJSHeapSize?: number;
  totalJSHeapSize?: number;
  jsHeapSizeLimit?: number;
};

type PerformanceWithMemory = Performance & {
  memory?: BrowserPerformanceMemory;
};

type AggregateMetric = {
  count: number;
  totalMs: number;
  maxMs: number;
};

const metrics = new Map<string, AggregateMetric>();
const counters = new Map<string, number>();
let idCounter = 0;
let lastPeriodicSummaryAt = 0;

const enabled = (() => {
  try {
    return (
      window.localStorage?.getItem(PERFORMANCE_DIAGNOSTICS_STORAGE_KEY) ===
      "1"
    );
  } catch {
    return false;
  }
})();

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return "na";
  }
  return Number.isInteger(value) ? value.toString() : value.toFixed(2);
}

function formatValue(value: DiagnosticValue): string {
  if (value === null || value === undefined) {
    return "na";
  }
  if (typeof value === "number") {
    return formatNumber(value);
  }
  if (typeof value === "boolean") {
    return value ? "1" : "0";
  }
  return String(value).replaceAll(/\s+/g, "_");
}

function getMemoryFields(): DiagnosticFields {
  const memory = (window.performance as PerformanceWithMemory | undefined)
    ?.memory;
  if (!memory) {
    return {};
  }
  return {
    heapUsedMB:
      typeof memory.usedJSHeapSize === "number"
        ? memory.usedJSHeapSize / 1024 / 1024
        : undefined,
    heapTotalMB:
      typeof memory.totalJSHeapSize === "number"
        ? memory.totalJSHeapSize / 1024 / 1024
        : undefined,
    heapLimitMB:
      typeof memory.jsHeapSizeLimit === "number"
        ? memory.jsHeapSizeLimit / 1024 / 1024
        : undefined,
  };
}

function maybeEmitPeriodicSummary(): void {
  if (!enabled) {
    return;
  }
  const now = performanceDiagnosticNow();
  if (lastPeriodicSummaryAt === 0) {
    lastPeriodicSummaryAt = now;
    return;
  }
  if (now - lastPeriodicSummaryAt < SUMMARY_INTERVAL_MS) {
    return;
  }
  lastPeriodicSummaryAt = now;
  performanceDiagnosticSummary("interval");
}

export function performanceDiagnosticsEnabled(): boolean {
  return enabled;
}

export function performanceDiagnosticNow(): number {
  return window.performance?.now?.() ?? Date.now();
}

export function nextPerformanceDiagnosticId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

export function performanceDiagnosticLog(
  event: string,
  fields: DiagnosticFields = {},
): void {
  if (!enabled) {
    return;
  }
  const entries = Object.entries({
    atMs: performanceDiagnosticNow(),
    ...fields,
    ...getMemoryFields(),
  })
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${formatValue(value)}`);
  const suffix = entries.length > 0 ? ` ${entries.join(" ")}` : "";
  log(`${PERFORMANCE_DIAGNOSTICS_PREFIX} event=${event}${suffix}`);
}

export function performanceDiagnosticRecordDuration(
  metric: string,
  durationMs: number,
): void {
  if (!enabled) {
    return;
  }
  const existing = metrics.get(metric) ?? { count: 0, totalMs: 0, maxMs: 0 };
  existing.count += 1;
  existing.totalMs += durationMs;
  existing.maxMs = Math.max(existing.maxMs, durationMs);
  metrics.set(metric, existing);
  maybeEmitPeriodicSummary();
}

export function performanceDiagnosticIncrement(
  counter: string,
  amount: number = 1,
): void {
  if (!enabled) {
    return;
  }
  counters.set(counter, (counters.get(counter) ?? 0) + amount);
  maybeEmitPeriodicSummary();
}

export function performanceDiagnosticSummary(
  reason: string,
  fields: DiagnosticFields = {},
): void {
  if (!enabled) {
    return;
  }
  const summaryFields: DiagnosticFields = { reason, ...fields };
  counters.forEach((value, key) => {
    summaryFields[`${key}.count`] = value;
  });
  metrics.forEach((value, key) => {
    summaryFields[`${key}.count`] = value.count;
    summaryFields[`${key}.totalMs`] = value.totalMs;
    summaryFields[`${key}.avgMs`] =
      value.count > 0 ? value.totalMs / value.count : 0;
    summaryFields[`${key}.maxMs`] = value.maxMs;
  });
  performanceDiagnosticLog("summary", summaryFields);
}

type PerformanceDiagnosticsWindow = Window & {
  EXCALIDRAW_PERF_PHASE0_CHECKPOINT?: (label?: string) => void;
};

// Manual checkpoints are useful around an explicit DevTools "Collect garbage"
// action. Keep this opt-in and text-only like every other Phase 0 record.
if (enabled) {
  (window as PerformanceDiagnosticsWindow).EXCALIDRAW_PERF_PHASE0_CHECKPOINT =
    (label: string = "manual") => {
      performanceDiagnosticSummary(`manual-${label}`);
    };
}
