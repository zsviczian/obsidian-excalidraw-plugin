/**
 * Regression tests for canonical settings serialization and unchanged-write
 * suppression in SerializedSettingsWriter.
 *
 * Run with: npm run test:settings
 * (Node's --experimental-transform-types lets this .mjs test import the
 * TypeScript module directly.)
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SerializedSettingsWriter,
  stringifySettingsCanonically,
} from "../../../src/core/settings/SerializedSettingsWriter.ts";
const trackedWrites = () => {
  const writes = [];
  return { writes, host: { saveData: async (data) => writes.push(data) } };
};

test("key order does not change canonical serialization", () => {
  const a = { z: 1, a: { y: [2, { b: 3, a: 4 }], x: "s" }, m: null };
  const b = { m: null, a: { x: "s", y: [2, { a: 4, b: 3 }] }, z: 1 };
  assert.equal(stringifySettingsCanonically(a), stringifySettingsCanonically(b));
  assert.equal(
    stringifySettingsCanonically({ b: 1, a: { d: 1, c: 2 } }),
    '{"a":{"c":2,"d":1},"b":1}',
  );
});

test("array order is semantically significant and preserved", () => {
  assert.notEqual(
    stringifySettingsCanonically([1, 2]),
    stringifySettingsCanonically([2, 1]),
  );
});

test("toJSON values keep native JSON semantics (Date)", () => {
  const date = new Date(0);
  const canonical = JSON.parse(stringifySettingsCanonically({ a: date, b: 1 }));
  assert.deepEqual(canonical, { a: date.toISOString(), b: 1 });
});

test("an own __proto__ key is data, not prototype pollution", () => {
  const payload = JSON.parse('{"__proto__":{"polluted":true},"ok":1}');
  const out = JSON.parse(stringifySettingsCanonically(payload));
  assert.equal(Object.keys(out).sort().join(","), "__proto__,ok");
  assert.deepEqual(out["__proto__"], { polluted: true });
  assert.equal(({}).polluted, undefined);
});

test("unchanged reordered save is skipped", async () => {
  const { writes, host } = trackedWrites();
  const writer = new SerializedSettingsWriter(host);
  await writer.persist({ theme: "dark", autosave: true, nested: { k: [1, 2] } });
  await writer.persist({ autosave: true, theme: "dark", nested: { k: [1, 2] } });
  assert.equal(writes.length, 1);
  // Whatever does get written is canonically sorted.
  assert.deepEqual(Object.keys(writes[0]), [...Object.keys(writes[0])].sort());
});

test("queued A -> B -> A still persists the final A", async () => {
  const writes = [];
  let releaseFirst;
  const firstWriteGate = new Promise((resolve) => {
    releaseFirst = resolve;
  });
  let first = true;
  const writer = new SerializedSettingsWriter({
    saveData: async (data) => {
      if (first) {
        first = false;
        await firstWriteGate;
      }
      writes.push(data);
    },
  });
  const A = { autosave: true, theme: "dark" };
  const B = { autosave: true, theme: "light" };
  const p1 = writer.persist(A); // in flight, gated
  const p2 = writer.persist(B); // queued behind p1
  const p3 = writer.persist(A); // requested while B is still queued
  await new Promise((resolve) => setTimeout(resolve, 0)); // let p1 reach saveData
  releaseFirst();
  await Promise.all([p1, p2, p3]);
  assert.deepEqual(
    writes.map((payload) => payload.theme),
    ["dark", "light", "dark"],
    "the last requested payload must win",
  );
});

test("failed write is retried on the next save", async () => {
  const writes = [];
  let fail = true;
  const writer = new SerializedSettingsWriter({
    saveData: async (data) => {
      if (fail) {
        throw new Error("disk error");
      }
      writes.push(data);
    },
  });
  await assert.rejects(() => writer.persist({ a: 1 }));
  fail = false;
  await writer.persist({ a: 1 });
  assert.equal(writes.length, 1);
});

test("force bypasses suppression for repair flows", async () => {
  const { writes, host } = trackedWrites();
  const writer = new SerializedSettingsWriter(host);
  await writer.persist({ a: 1 });
  // Disk was replaced externally (e.g. corrupted then detected); the repair
  // payload equals the cache but must still reach disk.
  await writer.persist({ a: 1 }, { force: true });
  assert.equal(writes.length, 2);
});

test("cache seeded from disk suppresses the first unchanged save", async () => {
  const { writes, host } = trackedWrites();
  const writer = new SerializedSettingsWriter(host);
  writer.rememberPersistedSnapshot({ onDisk: true, v: 1 });
  await writer.persist({ v: 1, onDisk: true }); // reordered vs disk payload
  assert.equal(writes.length, 0);
});
