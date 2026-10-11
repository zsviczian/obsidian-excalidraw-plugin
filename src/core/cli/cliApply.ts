/** Finite request-local edits followed by one guarded view publication. */
import type { ExcalidrawCLIResult } from "src/types/excalidrawCliTypes";
import type { ExcalidrawAutomate } from "src/shared/ExcalidrawAutomate";
import type { ExcalidrawCLI } from "src/core/managers/ExcalidrawCLI";
import type { ConnectionPoint } from "src/types/types";
import { CLIError, boolean, number, object, string, vaultPath } from "./cliProtocol";
import { CLI_STYLE_FIELDS, constructBatch, fields, validateBatch, validateStyle } from "./cliElements";
import { drawingFile, drawingView, liveIdentity } from "./cliTarget";

export const CLI_OPERATION_FIELDS: Record<string, string[]> = {
  add: ["elements"], update: ["id", "set"], delete: ["ids", "children"],
  connect: ["id", "from", "to", "fromSide", "toSide"], group: ["ids"], ungroup: ["ids", "groupId"],
  image: ["id", "asset", "x", "y", "scale"], latex: ["id", "text", "x", "y", "scaleX", "scaleY"],
};

function ids(value: unknown): string[] {
  if (!Array.isArray(value) || !value.length || value.length > 500) throw new CLIError("INVALID_INPUT", "Expected 1–500 element IDs.", "ids");
  return value.map(id => string(id, "ids"));
}
function side(value: unknown): ConnectionPoint {
  if (value === undefined || value === null) return null;
  if (!["top", "bottom", "left", "right"].includes(string(value, "side"))) throw new CLIError("INVALID_INPUT", "Unknown connection side.");
  return value as ConnectionPoint;
}

/** Validate every operation before any asset/text preparation begins. */
export function validateOperations(input: unknown): Record<string, unknown>[] {
  if (!Array.isArray(input) || !input.length || input.length > 100) throw new CLIError("INVALID_INPUT", "Expected 1–100 operations.", "operations");
  return input.map(value => {
    const operation = object(value), op = string(operation.op, "op");
    if (!Object.hasOwn(CLI_OPERATION_FIELDS, op)) throw new CLIError("INVALID_INPUT", "Unsupported operation.", "op");
    fields(operation, ["op", ...CLI_OPERATION_FIELDS[op]]);
    if (op === "add") validateBatch(operation.elements);
    if (op === "update") { string(operation.id, "id"); const set = object(operation.set, "set"); fields(set, CLI_STYLE_FIELDS); validateStyle(set); }
    if (["delete", "group", "ungroup"].includes(op)) ids(operation.ids);
    if (op === "delete" && operation.children !== undefined && !["delete", "detach"].includes(string(operation.children, "children"))) throw new CLIError("INVALID_INPUT", "Expected delete or detach.", "children");
    if (op === "ungroup") string(operation.groupId, "groupId");
    if (op === "connect") { string(operation.from, "from"); string(operation.to, "to"); side(operation.fromSide); side(operation.toSide); }
    if (["image", "latex"].includes(op)) {
      number(operation.x, "x", 0, -1000000, 1000000); number(operation.y, "y", 0, -1000000, 1000000);
      if (op === "image") { vaultPath(operation.asset, "asset"); boolean(operation.scale, "scale", true); }
      else { string(operation.text, "text"); number(operation.scaleX, "scaleX", 1, 0.1, 4); number(operation.scaleY, "scaleY", 1, 0.1, 4); }
    }
    if (operation.id !== undefined) string(operation.id, "id");
    return operation;
  });
}

/** No scene or document metadata changes until the guard inside addElements succeeds. */
export async function applyDrawing(cli: ExcalidrawCLI, request: Record<string, unknown>, ea: ExcalidrawAutomate): Promise<Partial<ExcalidrawCLIResult>> {
  const plugin = cli.plugin, file = drawingFile(plugin, request.path), view = drawingView(plugin, file, request.view);
  if (!view) throw new CLIError("NOT_READY", "Apply requires a live drawing.", "path", "Open the drawing, then read a fresh live revision.");
  const operations = validateOperations(request.operations), api = view.excalidrawAPI, model = view.excalidrawData;
  const identity = liveIdentity(view), revision = cli.targets.revision(view, identity);
  if (string(request.expectedRevision, "expectedRevision") !== revision) throw new CLIError("STALE_REVISION", "Drawing changed since the live read.", "expectedRevision", "Read the drawing again and prepare a new request.");
  const check = () => {
    if (!cli.isCurrent() || view.file !== file || view.excalidrawAPI !== api || view.excalidrawData !== model || plugin.app.vault.getFileByPath(file.path) !== file) throw new CLIError("STALE_REVISION", "Target identity changed during preparation.");
    if (view.isSameFileEditingActive() || view.isPersistenceBusy()) throw new CLIError("BUSY", "Drawing is being edited as Markdown or synchronized.");
    if (liveIdentity(view) !== identity) throw new CLIError("STALE_REVISION", "Drawing changed during preparation.", "expectedRevision", "Read the new scene before retrying.");
  };
  check(); ea.setView(view);
  const originalElements = new Map(structuredClone(api.getSceneElements()).map(element => [element.id, element]));
  ea.copyViewElementsToEAforEditing([...originalElements.values()]);
  if (ea.getElements().length > 5000) throw new CLIError("INVALID_INPUT", "Structured edits are limited to 5000 scene elements.");
  const lib = plugin.getCLIRuntime(), elementsMap = new Map(ea.getElements().map(element => [element.id, element])), idMap: Record<string, string> = {}, groupIds: string[] = [];
  const resolve = (value: unknown) => {
    const id = string(value, "id"), actual = Object.hasOwn(idMap, id) ? idMap[id] : id;
    const element = Object.hasOwn(ea.elementsDict, actual) ? ea.elementsDict[actual] : null;
    if (!element || element.isDeleted) throw new CLIError("NOT_FOUND", "Operation references a missing or deleted element.", "id");
    return element;
  };
  const recordId = (local: unknown, actual: string) => {
    if (!actual) throw new CLIError("DEPENDENCY_UNAVAILABLE", "EA could not construct this element.");
    if (local !== undefined) {
      const key = string(local, "id");
      if (["__proto__", "constructor", "prototype"].includes(key)) throw new CLIError("INVALID_INPUT", "Reserved local ID.", "id");
      if (Object.hasOwn(idMap, key) || (Object.hasOwn(ea.elementsDict, key) && key !== actual)) throw new CLIError("INVALID_INPUT", "Local ID conflicts with another ID.", "id");
      idMap[key] = actual;
    }
  };
  for (const operation of operations) {
    check();
    const op = operation.op;
    if (op === "add") {
      const batch = constructBatch(operation.elements, lib, Object.keys(ea.elementsDict));
      for (const [local, actual] of Object.entries(batch.idMap)) recordId(local, actual);
      ea.copyViewElementsToEAforEditing(batch.elements);
      for (const element of batch.elements) elementsMap.set(element.id, element);
    } else if (op === "update") {
      const element = resolve(operation.id), set = { ...object(operation.set) };
      if (element.type !== "text" && ["text", "fontSize", "fontFamily", "textAlign", "verticalAlign"].some(key => key in set)) throw new CLIError("INVALID_INPUT", "Text fields require a text element; edit its bound label ID.", "set");
      if (["arrow", "line", "freedraw"].includes(element.type) && ["width", "height"].some(key => key in set)) throw new CLIError("INVALID_INPUT", "Linear resizing requires a trusted EA script.", "set");
      if ("text" in set) { set.rawText = set.text; set.originalText = set.text; }
      lib.mutateElement(element, elementsMap, set);
    } else if (op === "delete") {
      const removed = new Set(ids(operation.ids).map(id => resolve(id).id));
      for (const id of [...removed]) {
        const element = ea.elementsDict[id];
        for (const bound of element.boundElements ?? []) if (bound.type === "text") removed.add(bound.id);
        if (element.type === "frame") {
          const children = ea.getElements().filter(child => child.frameId === id && !child.isDeleted);
          if (children.length && operation.children === undefined) throw new CLIError("INVALID_INPUT", "Nonempty frame deletion requires children=delete or detach.", "children");
          for (const child of children) {
            if (operation.children === "delete") removed.add(child.id);
            else lib.mutateElement(child, elementsMap, { frameId: null });
          }
        }
      }
      for (const element of ea.getElements()) {
        if (removed.has(element.id)) {
          if (element.type === "image" && model.markdownImages.has(element.fileId)) throw new CLIError("INTERACTION_REQUIRED", "Markdown-image deletion requires a trusted EA script.");
          lib.mutateElement(element, elementsMap, { isDeleted: true });
        } else {
          if (element.boundElements?.some(bound => removed.has(bound.id))) lib.mutateElement(element, elementsMap, { boundElements: element.boundElements.filter(bound => !removed.has(bound.id)) });
          if (element.type === "arrow") {
            if (removed.has(element.startBinding?.elementId)) lib.mutateElement(element, elementsMap, { startBinding: null });
            if (removed.has(element.endBinding?.elementId)) lib.mutateElement(element, elementsMap, { endBinding: null });
          }
        }
      }
    } else if (op === "connect") {
      const from = resolve(operation.from), to = resolve(operation.to);
      if (![from.type, to.type].every(type => ["rectangle", "ellipse", "diamond", "text", "stickynote"].includes(type))) throw new CLIError("INVALID_INPUT", "Connect requires two bindable shapes.");
      recordId(operation.id, ea.connectObjects(from.id, side(operation.fromSide), to.id, side(operation.toSide)));
    } else if (op === "group") {
      const members = ids(operation.ids).map(id => resolve(id)), previous = members.map(element => [...element.groupIds]);
      const groupId = ea.addToGroup(members.map(element => element.id)); groupIds.push(groupId);
      members.forEach((element, index) => {
        element.groupIds = previous[index];
        lib.mutateElement(element, elementsMap, { groupIds: [...previous[index], groupId] });
      });
    }
    else if (op === "ungroup") {
      for (const id of ids(operation.ids)) {
        const element = resolve(id);
        lib.mutateElement(element, elementsMap, { groupIds: element.groupIds.filter(group => group !== operation.groupId) });
      }
    } else if (op === "image") {
      const path = vaultPath(operation.asset, "asset"), asset = plugin.app.vault.getFileByPath(path);
      if (!asset || !["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(asset.extension.toLowerCase())) throw new CLIError("INVALID_INPUT", "Image requires an existing vault raster image or SVG.", "asset");
      if (asset.stat.size > 16 * 1024 * 1024) throw new CLIError("INVALID_INPUT", "Image exceeds 16 MiB.", "asset");
      const stat = JSON.stringify(asset.stat);
      const actual = await ea.addImage(number(operation.x, "x", 0, -1000000, 1000000), number(operation.y, "y", 0, -1000000, 1000000), asset, boolean(operation.scale, "scale", true));
      if (plugin.app.vault.getFileByPath(path) !== asset || JSON.stringify(asset.stat) !== stat) throw new CLIError("STALE_REVISION", "Image changed during preparation.", "asset");
      recordId(operation.id, actual);
    } else if (op === "latex") {
      const extras = plugin.extrasGateway.getAPI();
      if (!extras?.features.isActive("mathjax") || !plugin.extrasGateway.checkVersion("mathjax", extras).valid) throw new CLIError("DEPENDENCY_UNAVAILABLE", "Enable a compatible Excalidraw Extras MathJax feature before using latex.");
      recordId(operation.id, await ea.addLaTex(number(operation.x, "x", 0, -1000000, 1000000), number(operation.y, "y", 0, -1000000, 1000000), string(operation.text, "text"), number(operation.scaleX, "scaleX", 1, 0.1, 4), number(operation.scaleY, "scaleY", 1, 0.1, 4), { throwOnError: true }));
    }
  }
  check();
  if (ea.getElements().length > 5000) throw new CLIError("INVALID_INPUT", "Result exceeds 5000 scene elements.");
  for (const element of ea.getElements()) {
    const original = originalElements.get(element.id);
    // EA grouping/connection helpers also edit relationships directly. Ensure
    // every changed existing element participates in versioned scene updates.
    if (original && element.version <= original.version && JSON.stringify(element) !== JSON.stringify(original)) lib.mutateElement(element, elementsMap, { groupIds: [...element.groupIds] });
  }
  const outcome: Partial<ExcalidrawCLIResult> = { target: { vault: plugin.app.vault.getName(), path: file.path, viewId: view.id }, mutation: "not-applied", persistence: "not-applicable" };
  try {
    if (!await view.addElements({ newElements: ea.getElements(), images: ea.imagesDict, newElementsOnTop: true, save: false, validateBeforePublish: () => { check(); outcome.mutation = "unknown"; outcome.persistence = "unknown"; } })) throw new CLIError("NOT_READY", "View could not publish the edit.");
    outcome.mutation = "applied"; outcome.persistence = "unsaved";
    const acceptedRevision = cli.targets.revision(view);
    const saved = await view.saveWithOutcome();
    const sameTarget = cli.isCurrent() && view.file === file && view.excalidrawAPI === api && !view.isClosingOrMigrating();
    const durable = sameTarget && saved.acknowledgedRevision !== null && saved.acknowledgedRevision >= saved.requestedRevision;
    outcome.persistence = durable ? "saved" : ["failed", "skipped"].includes(saved.status) ? "unsaved" : "unknown";
    if (!durable) throw new CLIError("SAVE_FAILED", "Edit was published but its save was not acknowledged.", undefined, "Keep the drawing open and save/read back before further edits.", outcome);
    return { ...outcome, revision: sameTarget ? cli.targets.revision(view) : acceptedRevision, data: { idMap, groupIds, acceptedRevision, saveStatus: saved.status }, warnings: saved.currentRevision > saved.acknowledgedRevision ? ["A later edit is still unsaved; this receipt acknowledges the applied edit only. Read a fresh revision before continuing."] : [] };
  } catch (error) {
    if (error instanceof CLIError && outcome.mutation === "not-applied") throw error;
    throw new CLIError(error instanceof CLIError ? error.code : "SAVE_FAILED", error instanceof CLIError ? error.message : "Edit may have been published before an interrupted save.", undefined, "Read back the drawing; preserve unsaved work before retrying.", outcome);
  }
}
