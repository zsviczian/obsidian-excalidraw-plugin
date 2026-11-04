import assert from "node:assert/strict";
import test from "node:test";
import { deviceProfiles, breakpointProfiles } from "./deviceProfiles.mjs";
test("device obligations retain desktop, both mobile orientations, both themes and all supported layouts", () => {
  const profiles = deviceProfiles(); assert.equal(profiles.length, 28);
  assert.equal(new Set(profiles.map(profile => profile.id)).size, profiles.length);
  for (const theme of ["light", "dark"]) for (const mode of ["full", "tray", "compact"]) {
    assert.ok(profiles.some(profile => profile.formFactor === "desktop" && profile.theme === theme && profile.mode === mode));
    assert.ok(profiles.some(profile => profile.formFactor === "tablet" && profile.theme === theme && profile.mode === mode));
  }
  assert.ok(profiles.filter(profile => profile.mobile).every(profile => profile.input === "touch"));
  assert.equal(breakpointProfiles().length, 12);
  assert.equal(new Set([...profiles, ...breakpointProfiles()].map(profile => profile.id)).size, 40);
});
