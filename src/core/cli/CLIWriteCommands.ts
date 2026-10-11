/** Bounded CLI mutations use existing EA, view persistence, and Vault creation. */
import type { ExcalidrawCLIResult } from "src/types/excalidrawCliTypes";
import type { ExcalidrawAutomate } from "src/shared/ExcalidrawAutomate";
import type { ExcalidrawCLI } from "src/core/managers/ExcalidrawCLI";
import { CLIError, vaultPath } from "./cliProtocol";
import { constructBatch } from "./cliElements";
import { diskSnapshot, drawingFile } from "./cliTarget";
import { applyDrawing } from "./cliApply";
import { exportDrawing } from "./cliExport";
import { executeScript, type PreparedCLIScript } from "./cliScripts";

/** Write-specific lifecycle and exclusion, without another save queue or serializer. */
export class CLIWriteCommands {
  private activeEAs = new Set<ExcalidrawAutomate>();
  private inFlight = new Set<string>();
  public constructor(private readonly cli: ExcalidrawCLI) {}

  /** Cancels unpublished work through the manager's session guard and disposes owned EAs. */
  public destroy(): void {
    for (const ea of this.activeEAs) ea.destroy();
    this.activeEAs.clear(); this.inFlight.clear();
  }

  /** Dispatches finite writes; side-effect-aware failures preserve their applied outcome. */
  public async execute(command: string, request: Record<string, unknown>, preparedScript?: PreparedCLIScript): Promise<Partial<ExcalidrawCLIResult>> {
    if (!this.cli.plugin.isReady) throw new CLIError("NOT_READY", "Excalidraw is still initializing.");
    const path = command === "script" && request.path === undefined ? vaultPath(request.script, "script") : vaultPath(request.path);
    const out = command === "export" ? vaultPath(request.out, "out") : undefined;
    const locks = [...new Set([path, ...(out ? [out] : [])])];
    if (locks.some(key => this.inFlight.has(key))) throw new CLIError("BUSY", "Another CLI operation is running for this target.", "path");
    locks.forEach(key => this.inFlight.add(key));
    try {
      if (command === "create") return await this.create(path, request);
      if (command === "export") return await exportDrawing(this.cli, request, out);
      const ea = this.cli.plugin.ea.getAPI(); this.activeEAs.add(ea);
      try { return command === "script" ? await executeScript(this.cli, request, preparedScript, ea) : await applyDrawing(this.cli, request, ea); }
      finally { this.activeEAs.delete(ea); ea.destroy(); }
    }
    finally { locks.forEach(key => this.inFlight.delete(key)); }
  }

  private async create(path: string, request: Record<string, unknown>): Promise<Partial<ExcalidrawCLIResult>> {
    const plugin = this.cli.plugin;
    if (!path.endsWith(".excalidraw.md") && !path.endsWith(".excalidraw")) throw new CLIError("INVALID_INPUT", "New drawings require .excalidraw.md or .excalidraw.", "path");
    const template = request.template === undefined ? null : drawingFile(plugin, request.template);
    const templatePath = template?.path, templateStat = template ? JSON.stringify(template.stat) : null;
    const check = () => {
      if (!this.cli.isCurrent()) throw new CLIError("NOT_READY", "Plugin session ended.");
      if (plugin.app.vault.getAbstractFileByPath(path)) throw new CLIError("ALREADY_EXISTS", "Creation never overwrites an existing target.", "path");
      if (template && (plugin.app.vault.getFileByPath(templatePath) !== template || JSON.stringify(template.stat) !== templateStat)) throw new CLIError("STALE_REVISION", "Template changed during preparation.", "template");
    };
    check();
    const templateSnapshot = template ? await diskSnapshot(plugin, template, this.cli.isCurrent) : null;
    if (path.endsWith(".excalidraw") && templateSnapshot?.scene.elements.some(element => element.type === "image" && !templateSnapshot.scene.files?.[element.fileId]?.dataURL)) throw new CLIError("INVALID_INPUT", "Use .excalidraw.md to preserve this template's linked asset metadata.", "path");
    const occupied = templateSnapshot?.scene.elements.map(element => element.id) ?? [];
    check();
    const { elements, idMap } = constructBatch(request.elements ?? [], plugin.getCLIRuntime(), occupied);
    const createdIds = elements.map(element => element.id);
    const ea = plugin.ea.getAPI(); this.activeEAs.add(ea);
    try {
      ea.copyViewElementsToEAforEditing(elements);
      const created = await ea.create({ exactPath: path, ...(templatePath ? { templatePath } : {}), validateBeforeCreate: check, silent: true });
      return { target: { vault: plugin.app.vault.getName(), path: created }, persistence: "saved", mutation: "applied", data: { path: created, createdIds, idMap }, warnings: this.cli.isCurrent() ? [] : ["Plugin session ended after creation; read the file back before further edits."] };
    } catch (error) {
      if (error instanceof CLIError) throw error;
      if (plugin.app.vault.getAbstractFileByPath(path)) throw new CLIError("OUTCOME_UNKNOWN", "A target exists after an interrupted create.", "path", "Read back this exact path; do not create another drawing blindly.", { target: { vault: plugin.app.vault.getName(), path }, data: { path }, mutation: "unknown", persistence: "unknown" });
      throw new CLIError("SAVE_FAILED", "Drawing could not be created.", "path", "Check folder permissions and retry only after read-back.");
    } finally { this.activeEAs.delete(ea); ea.destroy(); }
  }
}
