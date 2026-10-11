/** Plugin-owned native CLI registration, JSON dispatcher and bounded session receipts. */
import { Platform, requireApiVersion } from "obsidian";
import type ExcalidrawPlugin from "src/core/main";
import type { CLICommand, ExcalidrawCLIRequest, ExcalidrawCLIResult } from "src/types/excalidrawCliTypes";
import type { CliData, ObsidianCliRuntime } from "src/types/obsidianCli";
import { EXCALIDRAW_AUTOMATE_INFO } from "src/shared/Dialogs/SuggesterInfo";
import { CLI_COMMANDS, CLI_LIB_HELP, CLI_SKILL, commandFlags } from "src/core/cli/cliCommands";
import { CLIError, CLI_INPUT_LIMIT, boolean, canonical, fingerprint, jsonValue, number, object, string, vaultPath } from "src/core/cli/cliProtocol";
import { CLITargets, diskSnapshot, drawingFile, drawingView, drawingViews, liveIdentity } from "src/core/cli/cliTarget";
import { t } from "src/lang/helpers";
import { CLIWriteCommands } from "src/core/cli/CLIWriteCommands";
import { prepareScript } from "src/core/cli/cliScripts";
import { commandSchema } from "src/core/cli/cliSchema";
import { nanoid } from "src/constants/constants";

type Receipt = { fingerprint: string; result: ExcalidrawCLIResult; finishedAt?: number };

/** Optional CLI; all registrations use Plugin's own unload cleanup. */
export class ExcalidrawCLI {
  public readonly session = `${nanoid()}${nanoid()}${nanoid()}${nanoid()}`;
  public readonly targets = new CLITargets(this.session);
  private alive = true;
  private receipts = new Map<string, Receipt>();
  private operationCleanups = new Set<() => void>();
  private writes = new CLIWriteCommands(this);
  public constructor(public readonly plugin: ExcalidrawPlugin) {}

  /** Skips both older APIs and runtimes without the optional registration method. */
  public initialize(): void {
    const runtime = this.plugin as ExcalidrawPlugin & Partial<ObsidianCliRuntime>;
    if (!Platform.isDesktop || !requireApiVersion("1.12.2") || typeof runtime.registerCliHandler !== "function") return;
    runtime.registerCliHandler(this.plugin.manifest.id, t("CLI_DESCRIPTION"), commandFlags("help"), params => this.native("help", params));
    for (const action of Object.keys(CLI_COMMANDS) as CLICommand[]) {
      runtime.registerCliHandler(`${this.plugin.manifest.id}:${action}`, `${t("CLI_DESCRIPTION")} — ${action}`, commandFlags(action), params => this.native(action, params));
    }
  }

  /** Invalidates awaited continuations before plugin/view teardown begins. */
  public destroy(): void {
    this.alive = false;
    for (const cleanup of this.operationCleanups) cleanup();
    this.operationCleanups.clear(); this.writes.destroy(); this.receipts.clear();
  }

  /** Stops request-owned loaders at unload without retaining completed operations. */
  public registerOperationCleanup(cleanup: () => void): () => void {
    if (!this.alive) cleanup();
    else this.operationCleanups.add(cleanup);
    return () => this.operationCleanups.delete(cleanup);
  }

  /** Whether a continuation still belongs to this plugin session. */
  public isCurrent = (): boolean => this.alive;

  private async native(command: CLICommand, flags: CliData): Promise<string> {
    try {
      const params: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(flags)) {
        if (key === "vault") continue; // Native transport selects the vault before dispatch.
        if (["overwrite", "selectedOnly", "trusted"].includes(key)) {
          if (!["true", "false"].includes(value)) throw new CLIError("INVALID_INPUT", "Expected true or false.", key);
          params[key] = value === "true";
        } else if (["offset", "limit", "scale", "padding"].includes(key)) params[key] = Number(value);
        else if (["ids", "args", "area", "elements", "operations"].includes(key)) params[key] = JSON.parse(value);
        else params[key] = value;
      }
      if (params.input !== undefined && params.json !== undefined) throw new CLIError("INVALID_INPUT", "Choose input or json, not both.");
      let payload: Record<string, unknown> = {};
      if (params.input !== undefined || params.json !== undefined) {
        let content: string;
        if (params.input !== undefined) {
          const path = vaultPath(params.input, "input");
          const file = this.plugin.app.vault.getFileByPath(path);
          if (!file) throw new CLIError("NOT_FOUND", "Input file does not exist.", "input");
          if (file.stat.size > CLI_INPUT_LIMIT) throw new CLIError("INVALID_INPUT", "Input exceeds 2 MiB.", "input");
          content = await this.plugin.app.vault.read(file);
        } else content = string(params.json, "json");
        if (new TextEncoder().encode(content).length > CLI_INPUT_LIMIT) throw new CLIError("INVALID_INPUT", "Input exceeds 2 MiB.");
        payload = object(JSON.parse(content));
        if (payload.apiVersion !== 1) throw new CLIError("INVALID_INPUT", "JSON requests require apiVersion 1.", "apiVersion");
      }
      for (const [key, value] of Object.entries(params)) {
        if (key === "input" || key === "json") continue;
        if (key in payload && canonical(payload[key]) !== canonical(value)) throw new CLIError("INVALID_INPUT", "Flag and JSON values disagree.", key);
        payload[key] = value;
      }
      if (payload.command !== undefined && payload.command !== command) throw new CLIError("INVALID_INPUT", "JSON command disagrees with native action.", "command");
      if (params.input !== undefined && payload.out === params.input) throw new CLIError("INVALID_INPUT", "Output cannot replace the request file.", "out");
      const result = await this.execute({ ...payload, apiVersion: 1, command });
      return result.ok && command === "skill" && payload.format === "markdown" ? CLI_SKILL : JSON.stringify(result);
    } catch (error) { return JSON.stringify(this.failure(command, undefined, error)); }
  }

  private base(command: string, requestId?: string): ExcalidrawCLIResult {
    return { apiVersion: 1, session: this.session, command, ...(requestId ? { requestId } : {}), status: "completed", ok: true, persistence: "not-applicable", mutation: "not-applied", warnings: [] };
  }

  private failure(command: string, requestId: string | undefined, error: unknown): ExcalidrawCLIResult {
    const failure = error instanceof CLIError ? error : new CLIError("INVALID_INPUT", "Request could not be completed.");
    return { ...this.base(command, requestId), ...failure.outcome, status: "failed", ok: false,
      error: { code: failure.code, message: failure.message, ...(failure.field ? { field: failure.field } : {}), recovery: failure.recovery } };
  }

  /** Shared native/in-process protocol; does not inspect the caller's EA workbench or target. */
  public async execute(input: ExcalidrawCLIRequest): Promise<ExcalidrawCLIResult> {
    let command = "unknown", requestId: string | undefined;
    try {
      const request = object(jsonValue(input, CLI_INPUT_LIMIT));
      command = string(request.command, "command");
      requestId = request.requestId === undefined ? undefined : string(request.requestId, "requestId");
      if (!this.alive) throw new CLIError("NOT_READY", "Plugin session ended.");
      if (request.apiVersion !== 1) throw new CLIError("INVALID_INPUT", "Expected apiVersion 1.", "apiVersion");
      if (!Object.hasOwn(CLI_COMMANDS, command)) throw new CLIError("UNSUPPORTED_COMMAND", "Unknown CLI command.", "command");
      const action = command as CLICommand;
      const descriptor = CLI_COMMANDS[action];
      for (const key of Object.keys(request)) {
        if (!["apiVersion", "command", "requestId"].includes(key) && !Object.hasOwn(descriptor.fields, key)) throw new CLIError("INVALID_INPUT", "Unknown command field.", key);
      }
      this.purgeReceipts();
      if (action === "result") {
        const receipt = this.receipts.get(string(request.requestId, "requestId"));
        if (!receipt) throw new CLIError("OUTCOME_UNKNOWN", "Receipt expired, is unknown, or belongs to an earlier session.", "requestId", "Read back drawing/output before sending a new write.");
        return structuredClone(receipt.result);
      }
      const preparedScript = action === "script" ? await prepareScript(this, request) : undefined;
      if (descriptor.writes) {
        requestId = string(request.requestId, "requestId");
        if (!/^[\w.-]{1,80}$/.test(requestId)) throw new CLIError("INVALID_INPUT", "Use 1–80 letters, digits, underscores, dots or hyphens.", "requestId");
        const signature = canonical(preparedScript ? { request, source: preparedScript.source } : request);
        const existing = this.receipts.get(requestId);
        if (existing) {
          if (existing.fingerprint !== signature) throw new CLIError("INVALID_INPUT", "requestId was already used for different content.", "requestId");
          return structuredClone(existing.result);
        }
        if (this.receipts.size >= 128) throw new CLIError("BUSY", "Session receipt capacity is exhausted.", "requestId", "Wait for completed receipts to expire; do not retry writes with a new ID blindly.");
        this.receipts.set(requestId, { fingerprint: signature, result: { ...this.base(action, requestId), status: "pending", ok: null, persistence: "unknown" } });
      }
      let result: ExcalidrawCLIResult;
      try {
        const output = descriptor.writes ? await this.writes.execute(action, request, preparedScript) : { data: await this.dispatch(action, request) };
        try { result = { ...this.base(action, requestId), ...output, data: jsonValue(output.data ?? null) }; }
        catch { throw new CLIError("OUTCOME_UNKNOWN", "Result could not be serialized after execution.", undefined, "Read back the target before another write.", { ...output, data: null }); }
      }
      catch (error) { result = this.failure(action, requestId, error); }
      if (descriptor.writes && this.alive) {
        const receipt = this.receipts.get(requestId);
        receipt.result = result; receipt.finishedAt = Date.now();
      }
      return result;
    } catch (error) { return this.failure(command, requestId, error); }
  }

  private purgeReceipts(): void {
    for (const [id, receipt] of this.receipts) if (receipt.finishedAt && Date.now() - receipt.finishedAt > 15 * 60 * 1000) this.receipts.delete(id);
  }

  private async dispatch(command: CLICommand, request: Record<string, unknown>): Promise<unknown> {
    const plugin = this.plugin;
    if (command === "help") return { commands: CLI_COMMANDS, input: "input=<vault-relative JSON file> or json=<small JSON>", next: `obsidian vault="${plugin.app.vault.getName()}" ${plugin.manifest.id}:schema action=create` };
    if (command === "skill") {
      if (request.format !== undefined && !["json", "markdown"].includes(string(request.format, "format"))) throw new CLIError("INVALID_INPUT", "Expected json or markdown.", "format");
      return { markdown: CLI_SKILL };
    }
    if (command === "status") return { apiVersion: 1, nativeCLI: Platform.isDesktop && requireApiVersion("1.12.2") && typeof (plugin as ExcalidrawPlugin & Partial<ObsidianCliRuntime>).registerCliHandler === "function", ready: plugin.isReady, vault: plugin.app.vault.getName(), version: plugin.manifest.version, converter: plugin.isReady && typeof plugin.getCLIRuntime().convertToExcalidrawElements === "function", receiptTTLSeconds: 900, receiptCapacity: 128 };
    if (command === "schema") {
      const action = string(request.action, "action");
      if (!Object.hasOwn(CLI_COMMANDS, action)) throw new CLIError("UNSUPPORTED_COMMAND", "Unknown action.", "action");
      return { apiVersion: 1, command: action, ...CLI_COMMANDS[action as CLICommand], jsonSchema: commandSchema(action as CLICommand), inputLimitBytes: CLI_INPUT_LIMIT, example: { apiVersion: 1, command: action, ...CLI_COMMANDS[action as CLICommand].example } };
    }
    if (command === "api") {
      const surface = request.surface === undefined ? "ea" : string(request.surface, "surface");
      if (!["ea", "lib"].includes(surface)) throw new CLIError("INVALID_INPUT", "Expected ea or lib.", "surface");
      const query = (request.name === undefined && request.query === undefined ? "" : string(request.name ?? request.query, "query")).toLowerCase();
      const entries = surface === "ea" ? EXCALIDRAW_AUTOMATE_INFO.map(entry => ({ name: entry.field, signature: entry.code ?? "", description: (entry.desc ?? "").replace(/<br\s*\/?\s*>/gi, "\n").replace(/<[^>]*>/g, "") })) : CLI_LIB_HELP;
      return { surface, subset: surface === "lib", entries: entries.filter(entry => request.name ? entry.name.toLowerCase() === query : `${entry.name} ${entry.description}`.toLowerCase().includes(query)).slice(0, 20) };
    }
    if (!plugin.isReady) throw new CLIError("NOT_READY", "Excalidraw is still initializing.", undefined, "Retry status after startup.");
    if (command === "list") {
      const folder = request.folder === undefined ? null : vaultPath(request.folder, "folder");
      const paths = plugin.app.vault.getFiles().filter(file => plugin.isExcalidrawFile(file) && (!folder || file.path.startsWith(`${folder}/`))).map(file => file.path).sort();
      return this.page(paths, request, `list:${this.session}:${fingerprint(canonical(paths))}`, "paths");
    }
    if (command !== "read" && command !== "open") throw new CLIError("DEPENDENCY_UNAVAILABLE", "This command is not implemented yet.");
    const file = drawingFile(plugin, request.path);
    const view = request.source === "disk" ? null : drawingView(plugin, file, request.view);
    if (command === "open") {
      if (view) { liveIdentity(view); return { path: file.path, viewId: view.id, revision: this.targets.revision(view) }; }
      const leaf = plugin.app.workspace.getLeaf("tab");
      await leaf.setViewState({ type: "excalidraw", state: { file: file.path }, active: true });
      await plugin.app.workspace.revealLeaf(leaf);
      for (let i = 0; i < 200; i++) {
        if (!this.alive) throw new CLIError("NOT_READY", "Plugin session ended.");
        const opened = drawingViews(plugin, file).find(candidate => candidate.leaf === leaf);
        if (opened?.isLoaded && opened.excalidrawAPI && !opened.isClosingOrMigrating()) return { path: file.path, viewId: opened.id, revision: this.targets.revision(opened) };
        await new Promise(resolve => window.setTimeout(resolve, 50));
      }
      throw new CLIError("NOT_READY", "Drawing did not become ready within 10 seconds.", "path");
    }
    const source = request.source === undefined ? "auto" : string(request.source, "source");
    if (!["auto", "live", "disk"].includes(source)) throw new CLIError("INVALID_INPUT", "Expected auto, live or disk.", "source");
    const useLive = source !== "disk" && view !== null;
    if (source === "live" && !view) throw new CLIError("NOT_READY", "Drawing has no live view.", "path", "Use open first.");
    if (source === "disk" && request.view !== undefined) throw new CLIError("INVALID_INPUT", "A disk read cannot select a view.", "view");
    if (!useLive && boolean(request.selectedOnly, "selectedOnly")) throw new CLIError("INVALID_INPUT", "Selection requires a live source.", "selectedOnly");
    const snapshot = useLive ? { scene: structuredClone(view.getScene()), revision: this.targets.revision(view) } : await diskSnapshot(plugin, file, this.isCurrent);
    let elements = snapshot.scene.elements.filter(element => !element.isDeleted);
    if (request.ids !== undefined) {
      if (!Array.isArray(request.ids) || request.ids.some(id => typeof id !== "string")) throw new CLIError("INVALID_INPUT", "Expected an ID array.", "ids");
      const ids = new Set(request.ids); elements = elements.filter(element => ids.has(element.id));
    }
    if (useLive && boolean(request.selectedOnly, "selectedOnly")) {
      const selected = view.excalidrawAPI.getAppState().selectedElementIds;
      elements = elements.filter(element => selected[element.id]);
    }
    if (request.detail !== undefined && !["summary", "elements"].includes(string(request.detail, "detail"))) throw new CLIError("INVALID_INPUT", "Expected summary or elements.", "detail");
    const data = { path: file.path, source: useLive ? "live" : "disk", ...(useLive ? { viewId: view.id, dirty: view.isDirty() } : {}), revision: snapshot.revision, total: elements.length, assetIds: Object.keys(snapshot.scene.files ?? {}), types: Object.fromEntries([...new Set(elements.map(element => element.type))].map(type => [type, elements.filter(element => element.type === type).length])) };
    return request.detail === "elements" ? { ...data, ...this.page(JSON.parse(JSON.stringify(elements)) as unknown[], request, snapshot.revision, "elements") } : data;
  }

  private page(values: unknown[], request: Record<string, unknown>, revision: string, field: string) {
    const offset = number(request.offset, "offset", 0, 0, values.length), limit = number(request.limit, "limit", 50, 1, 200);
    if (!Number.isInteger(offset) || !Number.isInteger(limit)) throw new CLIError("INVALID_INPUT", "Pagination requires integers.");
    if ((offset > 0 || request.revision !== undefined) && request.revision !== revision) throw new CLIError("STALE_REVISION", "Pagination snapshot changed.", "revision", "Read the first page again.");
    return { [field]: values.slice(offset, offset + limit), total: values.length, revision, nextOffset: offset + limit < values.length ? offset + limit : null };
  }
}
