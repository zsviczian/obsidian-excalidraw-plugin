import test from "node:test";
import assert from "node:assert/strict";
import { pairKeys, pairwise } from "./pairwise.mjs";

test("pairwise cases retain missing, false and zero and cover every factor pair reproducibly", () => {
  const factors = {
    mode: ["normal", "zen", "view"],
    override: ["missing", false, 0],
    background: [false, true],
    padding: [0, 10],
  };
  const required = {
    mode: "view",
    override: false,
    background: false,
    padding: 0,
  };
  const rows = pairwise(factors, [required]);
  assert.deepEqual(rows, pairwise(factors, [required]));
  assert.deepEqual(rows[0], required);
  const covered = new Set(rows.flatMap((row) => pairKeys(row)));
  const names = Object.keys(factors);
  for (const [index, a] of names.entries())
    for (const b of names.slice(index + 1))
      for (const x of factors[a])
        for (const y of factors[b])
          assert.ok(covered.has(JSON.stringify([a, x, b, y])));
  const removed = new Set(rows.slice(1).flatMap((row) => pairKeys(row)));
  assert.ok(
    removed.size < covered.size,
    "Dropping a required row loses a covered pair",
  );
});

test("invalid high-risk rows and unbounded Cartesian spaces fail before generating a partial plan", () => {
  assert.throws(
    () => pairwise({ a: [0], b: [1] }, [{ a: false, b: 1 }]),
    /domain/,
  );
  assert.throws(() => pairwise({ a: [], b: [1] }), /Nonempty/);
  assert.throws(
    () =>
      pairwise({
        a: Array.from({ length: 400 }, (_, i) => i),
        b: Array.from({ length: 400 }, (_, i) => i),
      }),
    /Split/,
  );
});
