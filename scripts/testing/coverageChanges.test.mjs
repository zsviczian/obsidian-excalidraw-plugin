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
          { testId: "lucide-3019", status: "passed" },
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
          {
            testId: "native:behavior:phone:cli-atomic-targeted-edit",
            evidenceKind: "in-process-ea-cli",
            status: "failed",
          },
        ],
      },
    ],
    ["native-cli-authoring", "removed-old-case"],
  );
  assert.deepEqual(
    r.lanes.map((l) => [l.reused, l.new, l.passed]),
    [
      [1, 2, 2],
      [0, 2, 1],
    ],
  );
  assert.deepEqual(r.removedOrReplaced, ["removed-old-case"]);
  assert.equal(r.native.pluginCommandCases, 2);
  assert.equal(r.native.hostEAAndTrustedInputCases, 3);
  assert.equal(r.native.emulatedContextCases, 2);
  assert.equal(r.native.physicalDeviceCases, 0);
  assert.equal(r.native.mobileProtocolCases, 1);
  assert.equal(
    r.native.commandCaseIds.includes(
      "native:behavior:phone:cli-atomic-targeted-edit",
    ),
    false,
  );
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
