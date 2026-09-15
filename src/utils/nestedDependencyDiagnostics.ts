import { log } from "./debugHelper";

/**
 * Temporary aggregate timing diagnostics for issue #2932. Each event is one
 * copyable string and deliberately excludes vault paths and file contents.
 * Remove this module and its call sites before merging a production fix.
 */
export const NESTED_DEPENDENCY_DIAGNOSTIC_PREFIX = "EXCALIDRAW_NESTED_2932";

let diagnosticSequence = 0;

type NestedTreeDiagnostic = {
  callSite: string;
  includeImages: boolean;
  uniqueFiles: number;
  parsedDrawings: number;
  dependencyEdges: number;
  generatedPaths: number;
  maximumDepth: number;
  parseMs: number;
  pathsMs: number;
  totalMs: number;
};

type TreeSummary = {
  calls: number;
  totalMs: number;
  maximumMs: number;
  totalGeneratedPaths: number;
  maximumGeneratedPaths: number;
  maximumDepth: number;
  lastLoggedAt: number;
};

const treeSummaries = new Map<string, TreeSummary>();

export function logNestedDependencyDiagnostic(details: string): void {
  log(
    `${NESTED_DEPENDENCY_DIAGNOSTIC_PREFIX} seq=${++diagnosticSequence} ${details}`,
  );
}

export function nestedDependencyElapsedMs(startedAt: number): number {
  return Math.round((performance.now() - startedAt) * 10) / 10;
}

/** Log first/slow traversals and bounded cumulative summaries of quick ones. */
export function recordNestedTreeDiagnostic(event: NestedTreeDiagnostic): void {
  const now = performance.now();
  const summary = treeSummaries.get(event.callSite) ?? {
    calls: 0,
    totalMs: 0,
    maximumMs: 0,
    totalGeneratedPaths: 0,
    maximumGeneratedPaths: 0,
    maximumDepth: 0,
    lastLoggedAt: now,
  };
  summary.calls++;
  summary.totalMs += event.totalMs;
  summary.maximumMs = Math.max(summary.maximumMs, event.totalMs);
  summary.totalGeneratedPaths += event.generatedPaths;
  summary.maximumGeneratedPaths = Math.max(
    summary.maximumGeneratedPaths,
    event.generatedPaths,
  );
  summary.maximumDepth = Math.max(summary.maximumDepth, event.maximumDepth);
  treeSummaries.set(event.callSite, summary);

  if (summary.calls === 1 || event.totalMs >= 100) {
    logNestedDependencyDiagnostic(
      `phase=tree callSite=${event.callSite} includeImages=${Number(event.includeImages)} ` +
        `uniqueFiles=${event.uniqueFiles} parsedDrawings=${event.parsedDrawings} ` +
        `dependencyEdges=${event.dependencyEdges} generatedPaths=${event.generatedPaths} ` +
        `maximumDepth=${event.maximumDepth} parseMs=${event.parseMs} ` +
        `pathsMs=${event.pathsMs} totalMs=${event.totalMs}`,
    );
  }

  if (summary.calls % 25 === 0 || (summary.calls > 1 && now - summary.lastLoggedAt >= 2000)) {
    logNestedDependencyDiagnostic(
      `phase=tree-summary callSite=${event.callSite} calls=${summary.calls} ` +
        `cumulativeMs=${Math.round(summary.totalMs * 10) / 10} ` +
        `maximumMs=${summary.maximumMs} ` +
        `cumulativePaths=${summary.totalGeneratedPaths} ` +
        `maximumPaths=${summary.maximumGeneratedPaths} ` +
        `maximumDepth=${summary.maximumDepth}`,
    );
    summary.lastLoggedAt = now;
  }
}
