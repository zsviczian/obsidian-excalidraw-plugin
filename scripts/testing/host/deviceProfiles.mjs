/** Transport-independent device obligations. Desktop emulation is not physical-device evidence. */
export function deviceProfiles() {
  const profiles = [];
  for (const theme of ["light", "dark"]) {
    for (const [name, width, height] of [["wide", 1200, 900], ["narrow", 900, 875]]) {
      for (const mode of ["full", "tray", "compact"]) profiles.push({ id: `desktop-${name}-${mode}-${theme}`, mobile: false, width, height, mode, theme, formFactor: "desktop", input: "mouse" });
    }
    for (const [orientation, width, height] of [["portrait", 390, 844], ["landscape", 844, 390]]) profiles.push({ id: `phone-${orientation}-${theme}`, mobile: true, width, height, mode: "mobile", theme, formFactor: "phone", input: "touch" });
    for (const [orientation, width, height] of [["portrait", 900, 1100], ["landscape", 1100, 900]]) {
      for (const mode of ["full", "tray", "compact"]) profiles.push({ id: `tablet-${orientation}-${mode}-${theme}`, mobile: true, width, height, mode, theme, formFactor: "tablet", input: "touch" });
    }
  }
  // Give the owned editor the requested viewport without depending on a
  // maintainer's existing sidebar or nested-split widths. Ordinary split and
  // migration behavior has its separate native lifecycle obligations.
  return profiles.map(profile => ({ ...profile, pane: "fullscreen" }));
}

/** Canonical common/editorInterface.ts boundaries; actual editor bounds are recorded. */
export function breakpointProfiles() {
  const cases = [
    ...[598, 599, 600].map(width => ({ id: `mobile-width-${width}`, width, height: 900, formFactor: width <= 599 ? "phone" : "tablet" })),
    ...[799, 800, 801].map(width => ({ id: `sidebar-width-${width}`, width, height: 900, formFactor: "tablet", canFitSidebar: width > 800 })),
    ...[999, 1000, 1001].map(width => ({ id: `landscape-width-${width}`, width, height: 499, formFactor: width < 1000 ? "phone" : "desktop" })),
    ...[499, 500, 501].map(height => ({ id: `landscape-height-${height}`, width: 999, height, formFactor: height < 500 ? "phone" : "desktop" })),
  ];
  return cases.map(profile => ({ ...profile, editorWidth: profile.width, boundary: true, id: "breakpoint-" + profile.id, mobile: true, mode: profile.formFactor === "phone" ? "mobile" : "compact", theme: "light", input: "touch", pane: "fullscreen" }));
}
