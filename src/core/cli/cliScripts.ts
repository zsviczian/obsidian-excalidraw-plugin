/** Explicit trust and source identity for one-shot existing local scripts. */
import type { ExcalidrawCLI } from "src/core/managers/ExcalidrawCLI";
import type { ExcalidrawAutomate } from "src/shared/ExcalidrawAutomate";
import type { ExcalidrawCLIResult } from "src/types/excalidrawCliTypes";
import { CLIError, boolean, jsonValue, vaultPath } from "./cliProtocol";
import { drawingFile, drawingView, liveIdentity } from "./cliTarget";

/** Source content participates in the effective request identity, including cached scripts. */
export async function prepareScript(cli: ExcalidrawCLI, request: Record<string, unknown>) {
  if (!boolean(request.trusted, "trusted")) throw new CLIError("TRUST_REQUIRED", "Local script execution requires trusted=true.", "trusted");
  const plugin = cli.plugin, path = vaultPath(request.script, "script"), file = plugin.app.vault.getFileByPath(path);
  if (!file || (file.extension !== "md" && !(file.extension === "js" && plugin.settings.allowJavaScriptFiles))) throw new CLIError("INVALID_INPUT", "Choose an existing Markdown script or enable JavaScript scripts.", "script");
  if (file.stat.size > 1024 * 1024) throw new CLIError("INVALID_INPUT", "Script source exceeds 1 MiB.", "script");
  const source = await plugin.app.vault.read(file);
  if (!cli.isCurrent()) throw new CLIError("NOT_READY", "Plugin session ended.");
  return { file, source, stat: JSON.stringify(file.stat) };
}
export type PreparedCLIScript = Awaited<ReturnType<typeof prepareScript>>;

/** Completion only acknowledges script execution; arbitrary writes require script-owned await/save discipline. */
export async function executeScript(cli: ExcalidrawCLI, request: Record<string, unknown>, prepared: PreparedCLIScript, ea: ExcalidrawAutomate): Promise<Partial<ExcalidrawCLIResult>> {
  const plugin = cli.plugin;
  if (request.path === undefined && request.view !== undefined) throw new CLIError("INVALID_INPUT", "A view requires an explicit drawing path.", "view");
  const drawing = request.path === undefined ? null : drawingFile(plugin, request.path);
  const view = drawing ? drawingView(plugin, drawing, request.view) : null;
  if (drawing && !view) throw new CLIError("NOT_READY", "Targeted scripts require an open live drawing.");
  const api = view?.excalidrawAPI, identity = view ? liveIdentity(view) : null;
  const check = () => {
    if (!cli.isCurrent() || plugin.app.vault.getFileByPath(prepared.file.path) !== prepared.file || JSON.stringify(prepared.file.stat) !== prepared.stat) throw new CLIError("STALE_REVISION", "Script or plugin identity changed before execution.");
    if (view && (view.file !== drawing || view.excalidrawAPI !== api || liveIdentity(view) !== identity)) throw new CLIError("STALE_REVISION", "Drawing changed before script execution.");
    if (view && (view.isSameFileEditingActive() || view.isPersistenceBusy())) throw new CLIError("BUSY", "Drawing is being edited as Markdown or synchronized.");
  };
  check(); if (view) ea.setView(view);
  const outcome: Partial<ExcalidrawCLIResult> = { mutation: "unknown", persistence: "unknown", ...(view ? { target: { vault: plugin.app.vault.getName(), path: drawing.path, viewId: view.id } } : {}) };
  let started = false;
  try {
    const value = await plugin.scriptEngine.executeScriptFileForCLI(prepared.file, view ?? undefined, ea, request.args ?? null, plugin.getCLIRuntime(), prepared.source, () => { check(); started = true; });
    return { ...outcome, data: jsonValue(value === undefined ? null : value), warnings: ["Script completion does not verify drawing persistence. Trusted scripts must await their writes and saves."] };
  } catch (error) {
    if (!started && error instanceof CLIError) throw error;
    const interaction = error instanceof Error && error.message.startsWith("INTERACTION_REQUIRED:");
    throw new CLIError(interaction ? "INTERACTION_REQUIRED" : started ? "OUTCOME_UNKNOWN" : "SCRIPT_FAILED", interaction ? error.message : "Script execution or result serialization failed.", undefined, "Inspect drawing/output before retrying; script side effects cannot be rolled back.", started ? outcome : {});
  }
}
