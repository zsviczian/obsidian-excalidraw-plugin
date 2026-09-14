import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const semaphoreTypes = await readFile(
  new URL("../src/types/excalidrawViewTypes.ts", import.meta.url),
  "utf8",
);
const viewSource = await readFile(
  new URL("../src/view/ExcalidrawView.ts", import.meta.url),
  "utf8",
);
const coordinatorSource = await readFile(
  new URL("../src/view/managers/ViewSaveCoordinator.ts", import.meta.url),
  "utf8",
);

for (const retiredField of ["saving", "autosaving", "forceSaving", "dirty"]) {
  assert.doesNotMatch(
    semaphoreTypes,
    new RegExp(`\\b${retiredField}\\s*:`),
    `${retiredField} must not remain in ViewSemaphores`,
  );
  assert.doesNotMatch(
    viewSource,
    new RegExp(`semaphores\\??\\.${retiredField}\\b`),
    `${retiredField} must not be read through the view semaphore bag`,
  );
  assert.doesNotMatch(
    coordinatorSource,
    new RegExp(`semaphores\\??\\.${retiredField}\\b`),
    `${retiredField} must be coordinator-owned`,
  );
}

for (const ownedField of [
  "saveInProgress",
  "autosaveInProgress",
  "forceSaveInProgress",
  "dirtyFilePath",
]) {
  assert.match(
    coordinatorSource,
    new RegExp(`private ${ownedField}\\b`),
    `${ownedField} must be explicit coordinator state`,
  );
}

process.stdout.write("save state ownership checks passed\n");
