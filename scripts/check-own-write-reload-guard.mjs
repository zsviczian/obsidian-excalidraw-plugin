import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { OwnWriteReloadGuard } = await jiti.import(
  "../src/view/managers/OwnWriteReloadGuard.ts",
);

const callbacks = new Map();
const cleared = [];
let nextTimer = 1;
const guard = new OwnWriteReloadGuard(
  {
    setTimeout: (callback) => {
      const timer = nextTimer++;
      callbacks.set(timer, () => {
        callbacks.delete(timer);
        callback();
      });
      return timer;
    },
    clearTimeout: (timer) => {
      cleared.push(timer);
      callbacks.delete(timer);
    },
  },
  2000,
);

guard.setForWrite(true);
assert.equal(guard.consume(), true);
assert.equal(guard.consume(), false, "one notification consumes suppression");

guard.armCleanup();
const firstTimer = nextTimer - 1;
const firstCallback = callbacks.get(firstTimer);
guard.armCleanup();
const secondTimer = nextTimer - 1;
assert.deepEqual(cleared, [firstTimer], "re-arm cancels the older timer");
firstCallback();
assert.equal(
  guard.consume(),
  true,
  "an obsolete callback cannot clear a newer suppression arm",
);
assert.equal(callbacks.has(secondTimer), false);

guard.armCleanup();
const expiryTimer = nextTimer - 1;
callbacks.get(expiryTimer)();
assert.equal(guard.consume(), false, "current cleanup expires suppression");

guard.armCleanup();
const consumedTimer = nextTimer - 1;
assert.equal(guard.consume(), true);
assert.equal(
  callbacks.has(consumedTimer),
  false,
  "consumption cancels its cleanup callback",
);

guard.setForWrite(false);
assert.equal(guard.consume(), false);
guard.armCleanup();
const destroyedTimer = nextTimer - 1;
guard.destroy();
assert.equal(callbacks.has(destroyedTimer), false);
assert.equal(guard.consume(), false);

const semaphoreTypes = await readFile(
  new URL("../src/types/excalidrawViewTypes.ts", import.meta.url),
  "utf8",
);
const viewSource = await readFile(
  new URL("../src/view/ExcalidrawView.ts", import.meta.url),
  "utf8",
);

assert.doesNotMatch(
  semaphoreTypes,
  /\bpreventReload\s*:/,
  "reload suppression must not remain in ViewSemaphores",
);
assert.doesNotMatch(
  viewSource,
  /semaphores\??\.preventReload\b/,
  "reload suppression must be owned by OwnWriteReloadGuard",
);
assert.doesNotMatch(
  viewSource,
  /preventReloadResetTimer/,
  "reload cleanup timer must be owned by OwnWriteReloadGuard",
);

process.stdout.write("own-write reload guard checks passed\n");
