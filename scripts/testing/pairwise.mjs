/** Deterministic greedy covering array; expectations live in reviewed cases, never in this generator. */
import assert from "node:assert/strict";

export function pairKeys(row, names = Object.keys(row)) {
  return names.flatMap((a, i) =>
    names.slice(i + 1).map((b) => JSON.stringify([a, row[a], b, row[b]])),
  );
}

export function pairwise(factors, highRisk = []) {
  const names = Object.keys(factors);
  assert.ok(
    names.length >= 2 && names.every((name) => factors[name].length),
    "Nonempty factor domains required",
  );
  let candidates = [{}];
  for (const name of names) {
    assert.ok(
      candidates.length * factors[name].length <= 100000,
      "Split unrelated factors into smaller behavioral families",
    );
    candidates = candidates.flatMap((row) =>
      factors[name].map((value) => ({ ...row, [name]: value })),
    );
  }
  const uncovered = new Set(candidates.flatMap((row) => pairKeys(row, names)));
  const chosen = [];
  const select = (row) => {
    chosen.push(row);
    for (const key of pairKeys(row, names)) uncovered.delete(key);
  };
  for (const row of highRisk) {
    assert.deepEqual(Object.keys(row).sort(), [...names].sort());
    assert.ok(
      names.every((name) =>
        factors[name].some((value) => Object.is(value, row[name])),
      ),
      "High-risk row is outside its factor domain",
    );
    if (!chosen.some((value) => JSON.stringify(value) === JSON.stringify(row)))
      select(row);
  }
  const scored = candidates.map((row) => ({
    row,
    pairs: pairKeys(row, names),
  }));
  while (uncovered.size) {
    let best,
      score = 0;
    for (const candidate of scored) {
      const count = candidate.pairs.filter((key) => uncovered.has(key)).length;
      if (count > score) {
        score = count;
        best = candidate.row;
      }
    }
    assert.ok(best && score, "Covering array stalled");
    select(best);
  }
  return chosen;
}
