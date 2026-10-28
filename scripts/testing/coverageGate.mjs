import assert from "node:assert/strict";
export function verifyCoverageRatchets(coverage, ratchets) {
  assert.ok(coverage?.files?.length, "Missing actual source coverage");
  const files = new Map(coverage.files.map(file => [file.path.replaceAll("\\", "/"), file]));
  for (const ratchet of ratchets) {
    const file = files.get(ratchet.path);
    assert.ok(file, `Required source module did not execute: ${ratchet.path}`);
    for (const [key, property] of [["lines", "coveredLinePercent"], ["branches", "coveredBranchPercent"], ["functions", "coveredFunctionPercent"]]) {
      assert.ok(Number.isFinite(file[property]) && file[property] >= ratchet[key], `${ratchet.path} ${key} regressed: ${file[property]} < ${ratchet[key]}`);
    }
  }
}
