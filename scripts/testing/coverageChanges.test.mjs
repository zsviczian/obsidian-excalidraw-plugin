import test from "node:test";
import assert from "node:assert/strict";
import { coverageChanges } from "./coverageChanges.mjs";
test("new/reused accounting separates plugin CLI commands, host tasks and mobile emulation without inferring passes", () => {
  const r = coverageChanges(
    [
      {
        suiteId: "native-obsidian",
        tests: [
          { testId: "native-cli-authoring", status: "passed" },
          { testId: "native:behavior:main:settings-01", status: "failed" },
        ],
      },
      {
        suiteId: "native-devices",
        tests: [
          {
            testId: "native:behavior:phone:markdown-reading",
            status: "passed",
          },
        ],
      },
    ],
    ["native-cli-authoring", "removed-old-case"],
  );
  assert.deepEqual(
    r.lanes.map((l) => [l.reused, l.new, l.passed]),
    [
      [1, 1, 1],
      [0, 1, 1],
    ],
  );
  assert.deepEqual(r.removedOrReplaced, ["removed-old-case"]);
  assert.equal(r.native.pluginCommandCases, 1);
  assert.equal(r.native.hostEAAndTrustedInputCases, 2);
  assert.equal(r.native.emulatedContextCases, 1);
  assert.equal(r.native.physicalDeviceCases, 0);
  const portable = coverageChanges(
    [
      {
        suiteId: "plugin-fast",
        tests: [{ testId: "source", status: "passed" }],
      },
    ],
    ["source", "native-cli-authoring", "replaced-source"],
    { notRunInProfile: ["native-cli-authoring"] },
  );
  assert.deepEqual(portable.removedOrReplaced, ["replaced-source"]);
  assert.deepEqual(portable.notRunInProfile, ["native-cli-authoring"]);
});
