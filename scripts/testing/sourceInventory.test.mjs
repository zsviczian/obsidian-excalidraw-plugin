import assert from "node:assert/strict";
import test from "node:test";
import { isTypeOnlySource } from "./sourceInventory.mjs";
test("the source denominator excludes erased declarations but retains runtime effects", () => {
  assert.equal(isTypeOnlySource("export interface I { value: string }; export type T = I", "types.ts"), true);
  assert.equal(isTypeOnlySource('import type { T } from "./types"; export type U = T;', "api.ts"), true);
  assert.equal(isTypeOnlySource('import "./effects"; export interface I {}', "effects.ts"), false);
  assert.equal(isTypeOnlySource('export const value = 1;', "runtime.ts"), false);
  assert.equal(isTypeOnlySource('export enum Direction { left, right }', "enum.ts"), false);
});
