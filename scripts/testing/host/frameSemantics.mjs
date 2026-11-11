/** Focused #3042 metadata, thumbnail rendering, source controls and navigation. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInAppTask } from "./inAppTask.mjs";
import { behaviorEnvironment } from "./behaviorEnvironment.mjs";
import { behaviorInputDriver, collectBehaviorCases } from "./behaviorMatrix.mjs";
import { completeConsoleErrors } from "./debuggerSession.mjs";
import { settleBrowserDiagnostics, splitWindowErrors } from "./browserDiagnostics.mjs";

const kinds = ["metadata", "navigation", "previews", "controls"];
export const frameSemanticsCaseIds = ["main", "popout"].flatMap(context => kinds.map(kind => `native:frames:${context}:${kind}`)).concat("native:frames:settings-reload");
export const frameSemanticsDeviceCaseIds = ["phone", "tablet"].flatMap(context => kinds.map(kind => `native:frames:${context}:${kind}`));

export async function runFrameSemanticsScenario({ cli, drawingPath, contexts = ["main", "popout"], inputMode = "mouse", viewportScale = 1 }) {
  let template = readFileSync(new URL("../../../tests/vault/Drawings/Uncompressed.excalidraw.md", import.meta.url), "utf8");
  const scene = JSON.parse(template.match(/```json\n([\s\S]*?)\n```/)[1]), base = scene.elements[0];
  scene.elements = [
    { ...base, id: "frame-main", type: "frame", name: "Main, α", width: 200, height: 120, index: "a0", customData: undefined },
    { ...base, id: "inside", x: 20, y: 20, width: 60, height: 40, frameId: "frame-main", index: "a1", backgroundColor: "#00ff00" },
    { ...base, id: "frame-marker", type: "frame", frameRole: "marker", name: "Marker,padding=50", x: 300, width: 100, height: 160, index: "a2" },
    { ...base, id: "frame-unnamed", type: "frame", name: null, x: 500, index: "a3" },
    { ...base, id: "frame-literal", type: "frame", name: "Frame", x: 650, index: "a4" },
    { ...base, id: "outside", x: 900, y: 300, index: "a5" },
  ];
  template = template.replace(/```json\n[\s\S]*?\n```/, "```json\n" + JSON.stringify(scene, null, 2) + "\n```");
  const tests = [], consoleErrors = [], windowErrors = [], browserIdle = [];
  for (const id of contexts) {
    const execute = new Function(`return async function(c,path,context,template,modifier){
      const env=await (${behaviorEnvironment.toString()})(c,path,context,template,${completeConsoleErrors.toString()},${settleBrowserDiagnostics.toString()});
      c.diagnostics=env.diagnostics;
      (${collectBehaviorCases.toString()})(c);
      await (${exercise.toString()})(c,env,template,modifier,context.id);
      return {tests:c.tests,consoleErrors:c.externalConsoleErrors||[],windowErrors:env.windowErrors,browserIdle:env.browserIdle};
    }`)();
    const result = await runInAppTask({ cli, execute, args: [drawingPath, { id, input: inputMode }, template, process.platform === "darwin" ? 4 : 2],
      timeoutMs: 240000, cleanupMs: 60000, onRequest: behaviorInputDriver(cli, viewportScale),
      onProgress: phase => { if (phase) process.stdout.write("Frames: " + phase + "\n"); },
    });
    tests.push(...result.tests); consoleErrors.push(...result.consoleErrors); windowErrors.push(...result.windowErrors); browserIdle.push(...result.browserIdle);
  }
  if (contexts.includes("main")) {
    const result = await runInAppTask({ cli, execute: reloadSettings, args: [], timeoutMs: 90000, cleanupMs: 60000 });
    tests.push(...result.tests);
  }
  assert.equal(consoleErrors.length, 0); assert.equal(splitWindowErrors(windowErrors).unexpected.length, 0);
  assert.ok(browserIdle.every(item => item.status === "passed"));
  if (tests.some(test => test.status !== "passed")) {
    const error = Error("Focused frame cases failed: " + tests.filter(test => test.status !== "passed").map(test => test.testId).join(", "));
    error.evidence = tests; throw error;
  }
  return { id: "frame-semantics", status: "passed", tests, consoleErrors, windowErrors, browserIdle };
}

async function reloadSettings(c) {
  await c.case("native:frames:settings-reload", ["P01", "P02"], async () => {
    const id = "obsidian-excalidraw-plugin", old = app.plugins.plugins[id], key = "__framePolicyFutureSetting";
    const original = old.settings.thumbnailRenamePolicy;
    const settingsPath = app.vault.configDir + "/plugins/" + id + "/data.json";
    c.defer(async () => {
      if (!app.plugins.plugins[id]) await app.plugins.enablePlugin(id);
      await c.waitForCleanup(() => app.plugins.plugins[id]?.isReady, "restored plugin readiness");
      const live = app.plugins.plugins[id]; live.settings.thumbnailRenamePolicy = original; delete live.settings[key]; await live.saveSettings();
    });
    old.settings.thumbnailRenamePolicy = "ask"; old.settings[key] = { zero: 0, enabled: false };
    await old.saveSettings();
    const before = JSON.parse(await app.vault.adapter.read(settingsPath));
    if (before.thumbnailRenamePolicy !== "ask" || before[key]?.enabled !== false) throw Error("policy not persisted before unload");
    await app.plugins.disablePlugin(id); await app.plugins.enablePlugin(id);
    await c.waitFor(() => app.plugins.plugins[id]?.isReady, "replacement plugin readiness");
    const live = app.plugins.plugins[id], after = JSON.parse(await app.vault.adapter.read(settingsPath));
    if (live === old || live.settings.thumbnailRenamePolicy !== "ask" || live.settings[key]?.zero !== 0 || live.settings[key]?.enabled !== false || after.thumbnailRenamePolicy !== "ask") throw Error("reload lost non-default policy or unknown settings");
    return { assertions: ["non-default rename policy saved on disk", "actual unload/startup creates new plugin instance", "new policy and unknown zero/false settings survive on disk and in memory"] };
  });
  return { tests: c.tests };
}

async function exercise(c, env, template, modifier, context) {
  const { p, leaf, doc, win, check, click, key } = env;
  const nativeWindow = win.require("@electron/remote").getCurrentWindow();
  const minimized = nativeWindow.isMinimized(); nativeWindow.restore(); nativeWindow.show(); nativeWindow.focus();
  if (minimized) c.defer(() => { if (!nativeWindow.isDestroyed()) nativeWindow.minimize(); });
  let view = await env.openDrawing("Frames", { "excalidraw-thumbnail": "Main, α", "retained-property": "untouched" });
  const drawing = view.file;
  const customData = () => JSON.stringify(view.getViewElements().filter(element => element.type === "frame").map(element => [element.id, element.customData]).sort((a, b) => a[0].localeCompare(b[0])));
  const yaml = async () => p.ea.obsidian.parseYaml((await app.vault.read(drawing)).match(/^---\n([\s\S]*?)\n---/)[1]);
  const thumbnailIs = async name => {
    const property = (await yaml())["excalidraw-thumbnail"];
    c.caseTrace = { ...c.caseTrace, thumbnail: { property, tracked: view.frameThumbnail.tracked, patch: !!view.frameThumbnail.patch, running: view.frameThumbnail.running, scene: view.getViewElements().filter(element => element.type === "frame").map(element => [element.id, element.name]) } };
    return property === name;
  };
  const rename = name => {
    const api = view.excalidrawAPI;
    api.updateScene({ elements: api.getSceneElements().map(element => element.id === "frame-main" ? { ...element, name, version: element.version + 1, versionNonce: element.versionNonce + 1 } : element), captureUpdate: "IMMEDIATELY" });
  };
  await c.case(`native:frames:${context}:metadata`, ["P02", "P05"], async () => {
    view.setDirty(); await view.forceSave(true, true);
    const originalCustomData = customData();
    check(JSON.stringify((await yaml())["excalidraw-anchors"]) === JSON.stringify(["Main, α", "Marker,padding=50", "Frame"]), "actual frame names not saved as ordered YAML list");
    check((await yaml())["retained-property"] === "untouched", "unrelated YAML changed");
    check(await view.frameThumbnail.setThumbnail("Marker,padding=50"), "marker thumbnail write failed");
    check((await yaml())["excalidraw-thumbnail"] === "Marker,padding=50", "thumbnail name parsed as padding");
    await view.zoomToElementId("frame-main", false);
    const state = view.excalidrawAPI.getAppState(), x = (100 + state.scrollX) * state.zoom.value + state.offsetLeft, y = state.scrollY * state.zoom.value + state.offsetTop + 1;
    await env.input("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "right", buttons: 2, clickCount: 1 });
    await env.input("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "right", buttons: 0, clickCount: 1 });
    await c.waitFor(() => doc.querySelector('[data-testid="drawingThumbnail"] button'), "selected frame thumbnail context action");
    const action = doc.querySelector('[data-testid="drawingThumbnail"] button');
    check(action.title.includes("excalidraw-thumbnail"), "thumbnail context help absent"); await click(action);
    await c.waitFor(async () => (await yaml())["excalidraw-thumbnail"] === "Main, α", "context action saves exact frame name");
    p.settings.thumbnailRenamePolicy = "always"; await p.saveSettings();
    rename("Renamed, β");
    await c.waitFor(() => thumbnailIs("Renamed, β"), "rename policy saves YAML");
    rename("Main, α");
    await c.waitFor(() => thumbnailIs("Main, α"), "reverted frame name saves YAML");
    check(customData() === originalCustomData, "thumbnail changed scene metadata: " + originalCustomData + " -> " + customData());
    view = await env.saveReopen(view);
    check((await yaml())["excalidraw-thumbnail"] === "Main, α", "thumbnail lost after reopen");
    p.settings.autoexportSVG = true; p.settings.autoexportPNG = true; p.settings.displayExportedImageIfAvailable = true;
    view.setDirty(); await view.forceSave(true, true);
    const exportBase = drawing.path.slice(0, -3);
    await c.waitFor(() => app.vault.getFileByPath(exportBase + ".svg") && app.vault.getFileByPath(exportBase + ".png"), "full-scene autoexports created");
    const svg = new win.DOMParser().parseFromString(await app.vault.read(app.vault.getFileByPath(exportBase + ".svg")), "image/svg+xml").documentElement;
    check(svg.viewBox.baseVal.width > 900, "SVG autoexport inherited thumbnail crop");
    const png = new win.Blob([await app.vault.readBinary(app.vault.getFileByPath(exportBase + ".png"))], { type: "image/png" }), url = win.URL.createObjectURL(png);
    try { const image = new win.Image(); image.src = url; await image.decode(); check(image.naturalWidth / image.naturalHeight > 2, "PNG autoexport inherited thumbnail crop"); } finally { win.URL.revokeObjectURL(url); }
    p.settings.autoexportSVG = false; p.settings.autoexportPNG = false;
    return { assertions: ["regular, marker and literal Frame names form an ordered YAML list; unnamed excluded", "unrelated YAML survives", "exact marker name with padding-looking suffix round trips", "always policy follows rename and revert", "no thumbnail customData", "save/reopen retains metadata"] };
  });
  await c.case(`native:frames:${context}:navigation`, ["P02"], async () => {
    const api = view.excalidrawAPI, mode = api.getAppState().viewModeEnabled;
    api.toggleSidebar({ name: "default", tab: "search", force: true });
    await c.waitFor(() => view.contentEl.querySelector('.layer-ui__search-inputWrapper input'), "Search input opens");
    const search = view.contentEl.querySelector('.layer-ui__search-inputWrapper input'); await click(search);
    await key("a", "KeyA", 65, modifier);
    await env.input("Input.insertText", { text: "retained needle" });
    await c.waitFor(() => search.value === "retained needle", "Search sentinel entered");
    const before = search.value, scene = JSON.stringify(api.getSceneElements());
    app.commands.executeCommandById("obsidian-excalidraw-plugin:navigate-to-frame");
    await c.waitFor(() => doc.querySelector(".prompt .suggestion-item"), "frame fuzzy picker opens in owner window");
    const items = [...doc.querySelectorAll(".prompt .suggestion-item")];
    check(items.length === 4 && items.some(item => item.textContent.includes("frame-unnamed")), "navigator omitted unnamed frame");
    await click(items.find(item => item.textContent.includes("Marker,padding=50")));
    await c.waitFor(() => !doc.querySelector(".prompt"), "frame picker closes");
    check(api.getAppState().viewModeEnabled === mode, "navigation changed drawing mode");
    check(JSON.stringify(api.getSceneElements()) === scene, "navigation mutated scene");
    check(search.value === before, "navigation changed Search text");
    check(api.getAppState().selectedElementIds["frame-marker"], "existing navigation did not select target frame");
    api.toggleSidebar({ name: "default", tab: "search", force: false });
    return { assertions: ["owner-window fuzzy picker contains regular, marker and unnamed frames", "native selection navigates to marker ID", "editing mode, scene and Search text unchanged"] };
  });
  const note = await env.create("Embeds.md", `![[${drawing.path}|240]]\n\n![[${drawing.path}#^frame=|240]]\n\n![[${drawing.path}#^frame=frame-marker,padding=0|240]]\n\nEnd`);
  const readingNote = await env.create("Reading.md", `![[${drawing.path}|240]]\n\nEnd`);
  const root = () => [...leaf.view.contentEl.querySelectorAll(leaf.view.getMode?.() === "preview" ? ".markdown-preview-view" : ".markdown-source-view")].find(element => element.getBoundingClientRect().height > 0 && !element.closest(".internal-embed"));
  const images = () => [...root()?.querySelectorAll(".excalidraw-embedded-img") || []];
  const decoded = image => image.getBoundingClientRect().height > 0 && (image.tagName !== "IMG" || image.complete && image.naturalWidth > 0);
  const open = async mode => {
    if (leaf.view === view) view.exitFullscreen();
    await leaf.setViewState({ type: "empty", state: {} });
    await leaf.setViewState({ type: "markdown", state: { file: mode === "preview" ? readingNote.path : note.path, mode, source: false } });
    app.workspace.setActiveLeaf(leaf, { focus: true }); win.focus();
    if (mode === "source") leaf.view.editor.setCursor({ line: leaf.view.editor.lastLine(), ch: 0 });
    await c.waitFor(() => {
      if (mode === "preview" && root()) root().scrollTop = 0;
      c.caseTrace = { ...c.caseTrace, format: p.settings.previewImageType, mode, images: images().map(image => ({ tag: image.tagName, bounds: image.getBoundingClientRect().toJSON(), html: image.outerHTML.slice(0, 300) })) };
      return images().length === (mode === "preview" ? 1 : 3) && images().every(decoded);
    }, mode + " thumbnail images decoded");
  };
  const ratio = image => {
    if (image.tagName === "IMG") return image.naturalWidth / image.naturalHeight;
    const svg = image.tagName.toLowerCase() === "svg" ? image : image.querySelector("svg");
    return svg.viewBox.baseVal.width / svg.viewBox.baseVal.height;
  };
  await c.case(`native:frames:${context}:previews`, ["P05"], async () => {
    for (const type of ["SVG", "SVGIMG", "PNG"]) {
      p.settings.previewImageType = type;
      await open("source");
      check(Math.abs(ratio(images()[0]) - 200 / 120) < .01, type + " implicit thumbnail crop differs from frame rectangle");
      check(ratio(images()[1]) > 2, type + " explicit whole scene retained thumbnail crop");
      check(ratio(images()[2]) < 1, type + " explicit marker reference ignored");
      await open("preview");
      check(Math.abs(ratio(images()[0]) - 200 / 120) < .01, type + " Reading preview ignored thumbnail");
    }
    await app.fileManager.processFrontMatter(drawing, fm => { fm["excalidraw-thumbnail"] = "Missing frame"; });
    await open("source");
    check(ratio(images()[0]) > 2, "manual stale YAML did not fall back to full scene");
    await app.fileManager.processFrontMatter(drawing, fm => { fm["excalidraw-thumbnail"] = "Main, α"; });
    await open("source");
    check(Math.abs(ratio(images()[0]) - 200 / 120) < .01, "manual YAML edit did not invalidate cached preview");
    const { Component, MarkdownRenderer } = p.ea.obsidian, component = new Component(); component.load();
    const hover = doc.body.createDiv({ cls: "hover-popover markdown-preview-view" });
    try {
      await MarkdownRenderer.render(app, `![[${drawing.path}]]`, hover, note.path, component);
      await c.waitFor(() => hover.querySelector(".excalidraw-embedded-img") && decoded(hover.querySelector(".excalidraw-embedded-img")), "hover thumbnail decodes");
      check(Math.abs(ratio(hover.querySelector(".excalidraw-embedded-img")) - 200 / 120) < .01, "hover ignored thumbnail");
    } finally { component.unload(); hover.remove(); }
    const ea = p.ea.getAPI();
    try {
      const id = await ea.addImage(0, 0, drawing, false, false), element = ea.getElement(id);
      check(Math.abs(element.width / element.height - 200 / 120) < .01, "nested drawing ignored thumbnail");
      ea.reset();
      const svg = await ea.createSVG(drawing.path);
      check(svg.viewBox.baseVal.width > 900, "ordinary full-scene export inherited thumbnail crop");
    } finally { ea.destroy(); }
    return { assertions: ["PNG, SVG image and native SVG use strict implicit frame bounds in Live Preview and Reading", "empty frame means whole scene and explicit marker overrides default", "hover and nested drawing use thumbnail", "ordinary SVG export remains whole scene"] };
  });
  await c.case(`native:frames:${context}:controls`, ["P02", "P05"], async () => {
    p.settings.previewImageType = "SVG"; await open("source");
    const drawingBytes = await app.vault.read(drawing);
    const frames = () => [...root().querySelectorAll(".excalidraw-embed-controls-frame")];
    await c.waitFor(() => frames().length === 3, "frame toolbars bound");
    const source = leaf.view.editor.getValue();
    const picker = frames()[1].querySelector('[data-excalidraw-embed-action="frame"]');
    check(picker?.querySelector(".lucide-scan-eye"), "frame picker does not use scan-eye");
    picker.focus(); await click(picker);
    await c.waitFor(() => doc.querySelector(".menu .menu-item"), "frame dropdown opens");
    const items = [...doc.querySelectorAll(".menu .menu-item")];
    check(items.length === 6 && items.some(item => item.textContent.includes("frame-unnamed")), "frame menu omitted defaults or unnamed");
    await click(items.find(item => item.textContent.includes("Marker,padding=50")));
    const changed = source.replace("#^frame=|240", "#^frame=frame-marker|240");
    await c.waitFor(() => leaf.view.editor.getValue() === changed, "frame picker writes exact source occurrence using ID");
    leaf.view.editor.cm.focus(); await key("z", "KeyZ", 90, modifier);
    await c.waitFor(() => leaf.view.editor.getValue() === source, "frame picker single undo");
    await c.waitFor(() => frames()[2]?.querySelector('[data-excalidraw-embed-action="padding"]'), "frame padding control");
    frames()[2].querySelector('[data-excalidraw-embed-action="padding"]').focus();
    await click(frames()[2].querySelector('[data-excalidraw-embed-action="padding"]'));
    await c.waitFor(() => doc.querySelector(".excalidraw-embed-padding-popover input"), "frame padding slider opens");
    await key("Home", "Home", 36); await key("ArrowUp", "ArrowUp", 38);
    await c.waitFor(() => frames()[2].querySelector(".excalidraw-embed-padding-preview svg"), "frame padding export preview");
    await key("Escape", "Escape", 27);
    check(leaf.view.editor.getValue() === source, "canceling frame padding changed source");
    await leaf.view.save();
    check(await app.vault.read(drawing) === drawingBytes, "embed controls mutated destination drawing");
    check((await yaml())["excalidraw-thumbnail"] === "Main, α", "embed frame picker changed drawing thumbnail");
    return { assertions: ["scan-eye dropdown has defaults and all frames including unnamed", "marker name generates unambiguous ID reference", "only owning occurrence changes with one Undo", "frame padding preview and cancel leave source unchanged", "destination thumbnail unchanged"] };
  });
}
