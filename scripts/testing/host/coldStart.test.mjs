import assert from "node:assert/strict";
import test from "node:test";
import { restartIsolatedHost } from "./coldStart.mjs";
test("cold restart cannot touch the CLI before isolation succeeds", async () => {
  let calls = 0;
  await assert.rejects(
    restartIsolatedHost({
      proveIsolation: () => {
        throw Error("Shared personal session");
      },
      cli: () => calls++,
      readMainPID: () => 1,
    }),
    /Shared personal/,
  );
  assert.equal(calls, 0);
});
test("window reload cannot masquerade as a whole-app restart", async () => {
  const commands = [];
  let ticks = 0;
  await assert.rejects(
    restartIsolatedHost({
      proveIsolation: () => {},
      cli: (command) => {
        commands.push(command);
        return "restart";
      },
      readMainPID: () => 100,
      now: () => ticks,
      timeoutMs: 2,
      wait: async () => {
        ticks++;
      },
    }),
    /new ready main process/,
  );
  assert.deepEqual(commands, ["help", "restart"]);
});
test("cold restart revalidates isolation after the main process changes", async () => {
  let proofs = 0,
    reads = 0;
  const result = await restartIsolatedHost({
    proveIsolation: () => proofs++,
    cli: () => "restart",
    readMainPID: () => (++reads === 1 ? 100 : 200),
  });
  assert.equal(proofs, 2);
  assert.equal(result.after, 200);
});
