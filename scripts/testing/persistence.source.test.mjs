import assert from "node:assert/strict";
import test from "node:test";
import { ViewPersistenceQueue } from "../../src/core/managers/ViewPersistenceQueue.ts";
import { cloneSceneForSave, createSaveSnapshot, createPreparedSave, getAcknowledgedSaveRevision } from "../../src/view/managers/saveSnapshot.ts";

const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const tick = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
const request = (overrides = {}) => ({ producerId: "view-a", targetGeneration: 1, operationId: 1, requestedRevision: 1, capturedRevision: 1,
  filePath: "owned.excalidraw.md", expectedFileCtime: 1, text: "saved-1", hasNonDeletedElements: true, reason: "view-unload", ...overrides });
function setup(overrides = {}) {
  const writes = [], backups = [], failures = [], timers = new Map(); let timer = 0, time = 0;
  const files = new Map(["owned.excalidraw.md", "other.excalidraw.md"].map(path => [path, { path, stat: { ctime: 1 } }]));
  const queue = new ViewPersistenceQueue({ resolveFile: path => files.get(path) ?? null,
    write: async (file, text) => writes.push([file.path, text]), scheduleBackup: (path, text) => backups.push([path, text]),
    now: () => time, scheduleCleanup: fn => { timers.set(++timer, fn); return timer; }, cancelCleanup: id => timers.delete(id),
    onFailure: result => failures.push(result), ...overrides });
  return { queue, writes, backups, failures, files, timers, setTime: value => { time = value; } };
}
test("same-path snapshots remain ordered and uncoalesced while another drawing proceeds independently", async () => {
  const first = deferred(), observed = [];
  const { queue, backups } = setup({ write: async (file, text) => { observed.push([file.path, text]); if (text === "first") await first.promise; } });
  const a = queue.enqueue(request({ text: "first" })), b = queue.enqueue(request({ producerId: "view-b", text: "second" }));
  await queue.enqueue(request({ filePath: "other.excalidraw.md", text: "independent" }));
  assert.deepEqual(observed, [["owned.excalidraw.md", "first"], ["other.excalidraw.md", "independent"]]);
  first.resolve(); assert.equal((await a).status, "persisted"); assert.equal((await b).status, "persisted");
  assert.deepEqual(observed.at(-1), ["owned.excalidraw.md", "second"]);
  assert.deepEqual(backups.slice(-2), [["owned.excalidraw.md", "first"], ["owned.excalidraw.md", "second"]]);
});
test("failed writes preserve the failure receipt, never schedule a backup and release the path for retry", async () => {
  let fail = true; const { queue, backups, failures } = setup({ write: async () => { if (fail) throw Error("owned disk failure"); } });
  const failed = await queue.enqueue(request()); assert.equal(failed.status, "failed"); assert.equal(backups.length, 0); assert.equal(failures.length, 1);
  fail = false; assert.equal((await queue.enqueue(request({ text: "retry" }))).status, "persisted"); assert.equal(backups[0][1], "retry");
});
test("missing/recreated targets and empty payloads cannot overwrite a different drawing", async () => {
  const { queue, files, writes } = setup();
  assert.equal((await queue.enqueue(request({ text: "" }))).status, "invalid-request");
  files.delete("owned.excalidraw.md"); assert.equal((await queue.enqueue(request())).status, "target-missing");
  files.set("owned.excalidraw.md", { stat: { ctime: 2 } }); assert.equal((await queue.enqueue(request())).status, "target-changed"); assert.deepEqual(writes, []);
});
test("popout migration reserves order without writing until the replacement consumes its exact target", async () => {
  const { queue, writes, backups, timers } = setup();
  queue.registerMigrationHandoff({ leafId: "migrated-leaf", request: request({ reason: "window-migration" }) });
  await tick(); assert.deepEqual(writes, []); assert.equal(timers.size, 1);
  assert.equal(queue.consumeMigrationHandoff("unrelated-leaf", "owned.excalidraw.md"), null);
  const consumed = queue.consumeMigrationHandoff("migrated-leaf", "owned.excalidraw.md");
  assert.equal((await consumed.completion).status, "persisted"); assert.equal(writes.length, 1); assert.deepEqual(backups, writes); assert.equal(timers.size, 0);
  assert.equal(queue.consumeMigrationHandoff("migrated-leaf", "owned.excalidraw.md"), null);
});
test("wrong-target, expired and discarded migration handoffs release reservations without a source write", async () => {
  for (const disposition of ["wrong-target", "expired", "discarded"]) {
    const { queue, writes, failures, setTime } = setup();
    queue.registerMigrationHandoff({ leafId: "leaf", request: request({ reason: "window-migration" }) });
    if (disposition === "wrong-target") assert.equal(queue.consumeMigrationHandoff("leaf", "other.excalidraw.md"), null);
    else if (disposition === "expired") { setTime(20000); assert.equal(queue.consumeMigrationHandoff("leaf", "owned.excalidraw.md"), null); assert.equal(failures[0].status, "handoff-expired"); }
    else { queue.discardMigrationHandoff("leaf"); queue.discardMigrationHandoff("leaf"); }
    assert.deepEqual(writes, []); assert.equal((await queue.enqueue(request({ text: "later" }))).status, "persisted");
  }
});
test("a live write lease blocks detached saves until its idempotent release", async () => {
  const { queue, writes } = setup(), lease = await queue.acquireWriteLease("owned.excalidraw.md");
  const pending = queue.enqueue(request()); await tick(); assert.deepEqual(writes, []);
  lease.release(); lease.release(); assert.equal((await pending).status, "persisted"); assert.equal(writes.length, 1);
});
test("backup and completion diagnostics do not undo a successful physical write", async () => {
  let diagnostic = 0, completed = 0;
  const { queue } = setup({ scheduleBackup: () => { throw Error("backup unavailable"); }, onBackupScheduleFailure: () => { diagnostic++; },
    onPersisted: () => { throw Error("completion callback failed"); }, onPersistedCallbackFailure: () => { completed++; throw Error("secondary diagnostic failed"); } });
  assert.equal((await queue.enqueue(request())).status, "persisted"); assert.equal(diagnostic, 1); assert.equal(completed, 1);
});
test("save snapshots detach mutable scene/custom/image data and exclude rendering caches", () => {
  const scene = { elements: [{ id: "element", type: "rectangle", points: [[1, 2]], groupIds: ["group"], customData: { unknown: { retained: true } }, shape: { runtime: true }, canvas: {} }],
    appState: { selectedElementIds: { element: true } }, files: { image: { id: "image", dataURL: "owned" } } };
  const original = structuredClone(scene), clone = cloneSceneForSave(scene);
  clone.elements[0].customData.unknown.retained = false; clone.elements[0].points[0][0] = 90; clone.appState.selectedElementIds.element = false; clone.files.image.dataURL = "changed";
  assert.deepEqual(scene, original); assert.equal(clone.elements[0].shape, undefined); assert.equal(clone.elements[0].canvas, undefined);
  const snapshot = createSaveSnapshot({ operation: { producerId: "view", targetGeneration: 1, operationId: 2, requestedRevision: 3 }, filePath: "owned", sourceFileCtime: 1,
    capturedRevision: 5, sourceText: "user Markdown", scene, deletedElements: [], selectedElementIds: { element: true }, exportOptions: { scale: 1 }, exportData: null, autoexportConfig: {} });
  scene.elements[0].customData.unknown.retained = false; const prepared = createPreparedSave(snapshot, "exact serialized text");
  assert.equal(prepared.scene.elements[0].customData.unknown.retained, true); assert.equal(prepared.text, "exact serialized text"); assert.equal(getAcknowledgedSaveRevision(3, prepared), 5);
  assert.equal(getAcknowledgedSaveRevision(3, null), 3);
});

test("snapshot export registries retain independent Markdown, equation, image and PDF metadata", () => {
  const exportData = { sourceFilePath: "owned", files: new Map([
    ["complete", { size: { width: 10, height: 20 }, linkParts: { path: "note" }, filenameparts: { name: "image" }, colorMap: { black: "red" }, pdfPageViewProps: { rotate: 90 } }],
    ["minimal", { size: { width: 1, height: 2 } }],
  ]), markdownImages: new Map([["markdown", { markdown: "retained" }]]), equations: new Map([["equation", { latex: "x^2" }]]),
    markdownImageRenderDefaults: { border: { color: "red" }, transclusion: { border: { color: "blue" } } }, pdfScale: 2 };
  const snapshot = createSaveSnapshot({ operation: { producerId: "view", targetGeneration: 1, operationId: 2, requestedRevision: 3 }, filePath: "owned", sourceFileCtime: 1,
    capturedRevision: 3, sourceText: "Markdown", scene: { elements: [], appState: {}, files: {} }, deletedElements: [], selectedElementIds: {}, exportOptions: {}, exportData, autoexportConfig: {} });
  exportData.files.get("complete").size.width = 99; exportData.files.get("complete").pdfPageViewProps.rotate = 180;
  exportData.markdownImages.get("markdown").markdown = "changed"; exportData.equations.get("equation").latex = "changed";
  exportData.markdownImageRenderDefaults.transclusion.border.color = "changed";
  assert.equal(snapshot.exportData.files.get("complete").size.width, 10);
  assert.equal(snapshot.exportData.files.get("complete").pdfPageViewProps.rotate, 90);
  assert.equal(snapshot.exportData.markdownImages.get("markdown").markdown, "retained");
  assert.equal(snapshot.exportData.equations.get("equation").latex, "x^2");
  assert.equal(snapshot.exportData.markdownImageRenderDefaults.transclusion.border.color, "blue");
  assert.equal(snapshot.exportData.files.get("minimal").linkParts, null);
});
