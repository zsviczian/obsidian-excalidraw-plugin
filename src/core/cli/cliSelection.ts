/** Stable selection handoff uses the existing live revision and never changes the scene. */
import type ExcalidrawPlugin from "src/core/main";
import type ExcalidrawView from "src/view/ExcalidrawView";
import type { ExcalidrawCLI } from "src/core/managers/ExcalidrawCLI";
import { CLIError } from "./cliProtocol";

/** Capture selected elements plus their bound labels before focus/selection can change. */
export function selectionPacket(cli: ExcalidrawCLI, view: ExcalidrawView) {
  const revision = cli.targets.revision(view);
  const all = view.excalidrawAPI.getSceneElements().filter(element => !element.isDeleted);
  const byId = new Map(all.map(element => [element.id, element]));
  const selected = view.excalidrawAPI.getAppState().selectedElementIds;
  const included = new Set(all.filter(element => selected[element.id]).map(element => element.id));
  if (!included.size) throw new CLIError("INVALID_INPUT", "Select elements in the requested live drawing first.");
  for (const id of [...included]) {
    for (const bound of byId.get(id).boundElements ?? []) {
      if (bound.type === "text" && byId.get(bound.id)?.type === "text") included.add(bound.id);
    }
  }
  if (included.size > 500) throw new CLIError("INVALID_INPUT", "Select at most 500 elements including bound labels.");
  const lib = cli.plugin.getCLIRuntime();
  const elements = all.filter(element => included.has(element.id)).map(element => {
    const labelId = element.boundElements?.find(bound => bound.type === "text" && included.has(bound.id))?.id ?? null;
    const label = labelId ? byId.get(labelId) : null;
    const text = element.type === "text" ? element.originalText ?? element.text : label?.type === "text" ? label.originalText ?? label.text : null;
    const bounds = lib.getCommonBounds([element]);
    if (!bounds.every(Number.isFinite)) throw new CLIError("INVALID_INPUT", "Selection contains invalid bounds.");
    return { id: element.id, type: element.type, selected: selected[element.id] === true, text,
      frameId: element.frameId ?? null, containerId: element.type === "text" ? element.containerId ?? null : null, labelId, bounds };
  });
  return { packetVersion: 1, vault: cli.plugin.app.vault.getName(), path: view.file.path, view: view.id, revision, elements };
}

/** Copy only the packet captured for the command's original view, using its owning clipboard. */
export async function copySelectionPacket(plugin: ExcalidrawPlugin, view: ExcalidrawView): Promise<void> {
  const clipboard = view.containerEl.ownerDocument.defaultView?.navigator.clipboard;
  if (!clipboard) throw new Error("Clipboard unavailable");
  const result = await plugin.executeCLI({ apiVersion: 1, command: "selection", path: view.file.path, view: view.id });
  if (!result.ok) throw new Error("Selection could not be captured");
  await clipboard.writeText(JSON.stringify(result.data, null, 2));
}
