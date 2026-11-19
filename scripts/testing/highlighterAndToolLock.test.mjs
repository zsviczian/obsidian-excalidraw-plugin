import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

test("Highlighter and Tool Lock: default settings and types are defined", () => {
  const defaults = read("src/core/settingsDefaults.ts");
  assert.ok(defaults.includes("showHighlighterInToolbar: boolean;"));
  assert.ok(defaults.includes("keepDrawingToolsSelected: boolean;"));
  assert.ok(defaults.includes("showHighlighterInToolbar: true,"));
  assert.ok(defaults.includes("keepDrawingToolsSelected: false,"));
});

test("Highlighter and Tool Lock: settings tab UI controls exist", () => {
  const settings = read("src/core/settings.ts");
  assert.ok(settings.includes('key: "showHighlighterInToolbar"'));
  assert.ok(settings.includes('key: "keepDrawingToolsSelected"'));
});

test("Highlighter and Tool Lock: en and tr locale keys exist", () => {
  const en = read("src/lang/locale/en.ts");
  assert.ok(en.includes("SHOW_HIGHLIGHTER_TOOLBAR_NAME:"));
  assert.ok(en.includes("SHOW_HIGHLIGHTER_TOOLBAR_DESC:"));
  assert.ok(en.includes("KEEP_DRAWING_TOOLS_NAME:"));
  assert.ok(en.includes("KEEP_DRAWING_TOOLS_DESC:"));
  assert.ok(en.includes("HIGHLIGHTER_TOOL_NAME:"));
  assert.ok(en.includes("TOGGLE_HIGHLIGHTER_COMMAND:"));
  assert.ok(en.includes("TOGGLE_KEEP_DRAWING_TOOLS_COMMAND:"));

  const tr = read("src/lang/locale/tr.ts");
  assert.ok(tr.includes("SHOW_HIGHLIGHTER_TOOLBAR_NAME:"));
  assert.ok(tr.includes("SHOW_HIGHLIGHTER_TOOLBAR_DESC:"));
  assert.ok(tr.includes("KEEP_DRAWING_TOOLS_NAME:"));
  assert.ok(tr.includes("KEEP_DRAWING_TOOLS_DESC:"));
  assert.ok(tr.includes("HIGHLIGHTER_TOOL_NAME:"));
  assert.ok(tr.includes("TOGGLE_HIGHLIGHTER_COMMAND:"));
  assert.ok(tr.includes("TOGGLE_KEEP_DRAWING_TOOLS_COMMAND:"));
});

test("Highlighter: ObsidianMenu renders dedicated highlighter button and handles click", () => {
  const menu = read("src/view/components/menu/ObsidianMenu.tsx");
  assert.ok(menu.includes("public renderHighlighterButton"));
  assert.ok(menu.includes("public actionHighlighterClick"));
  assert.ok(menu.includes("{this.renderHighlighterButton(isMobile, appState)}"));
});

test("Tool Lock: ExcalidrawView auto-locks drawing tools when keepDrawingToolsSelected is enabled", () => {
  const view = read("src/view/ExcalidrawView.ts");
  assert.ok(view.includes("if (this.plugin.settings.keepDrawingToolsSelected)"));
  assert.ok(view.includes('"line"'));
  assert.ok(view.includes("st.activeTool.locked = true;"));
});

test("Commands: CommandManager registers toggle-highlighter and toggle-keep-drawing-tools-selected", () => {
  const cmd = read("src/core/managers/CommandManager.ts");
  assert.ok(cmd.includes('id: "toggle-highlighter"'));
  assert.ok(cmd.includes('id: "toggle-keep-drawing-tools-selected"'));
});
