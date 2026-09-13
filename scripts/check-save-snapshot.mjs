import assert from "node:assert/strict";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, {
  interopDefault: true,
});

const {
  createPreparedSave,
  createPreparedSaveIdentity,
  createSaveSnapshot,
  getAcknowledgedSaveRevision,
} = await jiti.import("../src/view/managers/saveSnapshot.ts");

const log = (message) => console.log(`SAVE_SNAPSHOT_CHECK ${message}`);

const sourceElement = {
  id: "element-1",
  type: "rectangle",
  isDeleted: false,
  points: [[1, 2]],
  startBinding: { elementId: "bound-1", focus: 0, gap: 1 },
  customData: { nested: { value: 1 } },
  shape: { runtime: true },
};
const sourceDeletedElement = {
  ...sourceElement,
  id: "deleted-1",
  isDeleted: true,
};
const sourceScene = {
  elements: [sourceElement],
  appState: {
    selectedElementIds: { "element-1": true },
    collaborators: new Map([["user-1", { username: "User" }]]),
  },
  files: {
    "file-1": {
      id: "file-1",
      dataURL: "data:image/png;base64,immutable",
      mimeType: "image/png",
      created: 1,
      lastRetrieved: 1,
    },
  },
};

const snapshot = createSaveSnapshot({
  operation: {
    producerId: "view-1",
    targetGeneration: 3,
    operationId: 9,
    requestedRevision: 4,
  },
  filePath: "Drawing.md",
  sourceFileCtime: 10,
  capturedRevision: 6,
  sourceText: "source text",
  scene: sourceScene,
  deletedElements: [sourceDeletedElement],
  selectedElementIds: sourceScene.appState.selectedElementIds,
  exportOptions: {
    theme: "dark",
    embedScene: true,
    padding: 12,
    scale: 2,
    withBackground: false,
    includeInternalLinks: true,
    isMask: false,
  },
});

sourceElement.points[0][0] = 100;
sourceElement.startBinding.focus = 1;
sourceElement.customData.nested.value = 2;
sourceDeletedElement.customData.nested.value = 3;
sourceScene.appState.selectedElementIds["element-1"] = false;
sourceScene.files["file-1"].lastRetrieved = 2;

assert.equal(snapshot.scene.elements[0].points[0][0], 1);
assert.equal(snapshot.scene.elements[0].startBinding.focus, 0);
assert.equal(snapshot.scene.elements[0].customData.nested.value, 1);
assert.equal(snapshot.deletedElements[0].customData.nested.value, 1);
assert.equal(snapshot.selectedElementIds["element-1"], true);
assert.equal(snapshot.scene.files["file-1"].lastRetrieved, 1);
assert.equal(
  snapshot.scene.files["file-1"].dataURL,
  "data:image/png;base64,immutable",
);
assert.equal("shape" in snapshot.scene.elements[0], false);

snapshot.scene.elements[0].customData.nested.value = 7;
snapshot.scene.files = {};
const prepared = createPreparedSave(snapshot, "exact prepared text");
assert.equal(prepared.producerId, "view-1");
assert.equal(prepared.targetGeneration, 3);
assert.equal(prepared.operationId, 9);
assert.equal(prepared.requestedRevision, 4);
assert.equal(prepared.sourceFileCtime, 10);
assert.equal(prepared.capturedRevision, 6);
assert.equal(prepared.text, "exact prepared text");
assert.equal(prepared.hasNonDeletedElements, true);
assert.equal(
  prepared.scene.elements[0].customData.nested.value,
  7,
  "the prepared scene contains save-time normalization",
);
assert.equal(
  prepared.scene.files["file-1"].dataURL,
  "data:image/png;base64,immutable",
  "captured export files survive normalization clearing scene.files",
);
assert.equal(prepared.deletedElements[0].id, "deleted-1");
assert.equal(prepared.selectedElementIds["element-1"], true);
assert.deepEqual(prepared.exportOptions, {
  theme: "dark",
  embedScene: true,
  padding: 12,
  scale: 2,
  withBackground: false,
  includeInternalLinks: true,
  isMask: false,
});

snapshot.scene.elements[0].customData.nested.value = 8;
snapshot.exportFiles["file-1"].lastRetrieved = 9;
snapshot.deletedElements[0].customData.nested.value = 9;
snapshot.selectedElementIds["element-1"] = false;
snapshot.exportOptions.padding = 99;
assert.equal(prepared.scene.elements[0].customData.nested.value, 7);
assert.equal(prepared.scene.files["file-1"].lastRetrieved, 1);
assert.equal(prepared.deletedElements[0].customData.nested.value, 1);
assert.equal(prepared.selectedElementIds["element-1"], true);
assert.equal(prepared.exportOptions.padding, 12);

const preparedIdentity = createPreparedSaveIdentity(prepared);
assert.equal(preparedIdentity.text, "exact prepared text");
assert.equal("scene" in preparedIdentity, false);
assert.equal("deletedElements" in preparedIdentity, false);
assert.equal("selectedElementIds" in preparedIdentity, false);
assert.equal(getAcknowledgedSaveRevision(4, prepared), 6);
assert.equal(getAcknowledgedSaveRevision(4), 4);

log("save snapshot ownership checks passed");
