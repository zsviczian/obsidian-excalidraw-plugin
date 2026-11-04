import assert from "node:assert/strict";
import test from "node:test";
import { renderJUnit } from "./reportFiles.mjs";
import { verifyCoverageRatchets } from "./coverageGate.mjs";
test("JUnit escapes evidence and represents blocked or cleanup-only failures as failures", () => {
  const report = { suiteId: 'test<&"', status: "failed", cleanup: "failed", tests: [{ testId: "missing", status: "blocked", reason: 'Absent <host> & "permission"' }] };
  const xml = renderJUnit(report);
  assert.ok(xml.includes('failures="1"')); assert.ok(xml.includes("&lt;host&gt; &amp; &quot;permission&quot;")); assert.ok(!xml.includes("<skipped"));
  assert.ok(renderJUnit({ ...report, tests: [{ testId: "pass", status: "passed" }] }).includes('name="suite-gate"'));
  const optional={suiteId:'optional-platform',status:'passed',cleanup:'passed',tests:[{testId:'optional',status:'notApplicable',reason:'Documented platform exclusion'}]};
  assert.ok(renderJUnit(optional).includes('<skipped'));assert.ok(renderJUnit(optional).includes('failures="0"'));
  assert.ok(renderJUnit({...optional,status:'failed',requiredTestIds:['optional']}).includes('<failure'));assert.ok(!renderJUnit({...optional,requiredTestIds:['optional']}).includes('<skipped'));
  const combined=renderJUnit({...report,failedSuites:[{suiteId:'native',reason:'Unexpected teardown exception'}]});
  assert.ok(combined.includes('suite-gate:native'));assert.ok(combined.includes('failures="2"'),'A failing assertion must not hide a second suite error gate');
  assert.ok(renderJUnit({...report,failedSuites:[{suiteId:'native',reason:'Teardown error'},{suiteId:'coverage',reason:'Coverage regression'}]}).includes('failures="3"'));
});
test("source coverage ratchets fail on lost modules, missing branch evidence or regressions", () => {
  const baseline = [{ path: "src/critical.ts", lines: 90, branches: 80, functions: 75 }];
  const file = { path: "src/critical.ts", coveredLinePercent: 90, coveredBranchPercent: 80, coveredFunctionPercent: 75 };
  assert.doesNotThrow(() => verifyCoverageRatchets({ files: [file] }, baseline));
  assert.throws(() => verifyCoverageRatchets({ files: [{ ...file, path: "src/other.ts" }] }, baseline), /did not execute/);
  assert.throws(() => verifyCoverageRatchets({ files: [{ ...file, coveredBranchPercent: 79 }] }, baseline), /regressed/);
  assert.throws(() => verifyCoverageRatchets({ files: [{ ...file, coveredFunctionPercent: undefined }] }, baseline), /regressed/);
});
