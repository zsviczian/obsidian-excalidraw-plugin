import { readFileSync } from "node:fs";
import obsidian from "stylelint-config-obsidianmd";

// Public scanner policy, without the theme package's additional formatting base:
// https://github.com/obsidianmd/obsidian-workflows/blob/main/src/lint.ts
// Browser floors match the mapping published by Obsidian's Stylelint config.
const releases = [
  [25, "1.4.5"], [28, "1.5.8"], [30, "1.6.5"], [31, "1.7.4"],
  [37, "1.9.12"], [39, "1.11.4"], [43, "1.13.4"],
];
const { minAppVersion } = JSON.parse(readFileSync(new URL("./manifest.json", import.meta.url), "utf8"));
const versionNumber = version => version.split(".").reduce((value, part) => value * 1000 + Number.parseInt(part, 10), 0);
const [electron] = releases.findLast(([, version]) => versionNumber(version) <= versionNumber(minAppVersion)) ?? releases[0];

export default {
  plugins: obsidian.plugins,
  ignoreDisables: true,
  rules: {
    ...obsidian.rules,
    "plugin/no-unsupported-browser-features": [true, {
      ...obsidian.rules["plugin/no-unsupported-browser-features"][1],
      browsers: [`electron >= ${electron}`],
    }],
  },
};
