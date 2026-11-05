import {runHostFunction} from './legacyTask.mjs';
/** Issue #2953: real Markdown embeds and deliberate detachment in a disposable vault. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const CONTROL = "__excalidrawEmbedRecovery";

function setup(control, drawingPath, paths) {
  if (globalThis[control]) throw Error("embed controller already exists");
  if (paths.some(path => app.vault.getFileByPath(path))) throw Error("fixture path already exists");
  const plugin = app.plugins.plugins["obsidian-excalidraw-plugin"];
  const c = { plugin, drawingPath, paths, owned: [], state: "idle", paused: 0, hold: false,
    originalAwaitInit: plugin.awaitInit, hadOwnAwaitInit: Object.hasOwn(plugin, "awaitInit"),
    previewImageType: plugin.settings.previewImageType };
  globalThis[control] = c;
  plugin.awaitInit = async function (...args) {
    await c.originalAwaitInit.apply(this, args);
    if (c.hold) { c.paused++; await c.gate; }
  };
  return { started: true };
}

function snapshot(control) {
  const c = globalThis[control];
  const root = c.leaf?.view.contentEl;
  const images = root ? Array.from(root.querySelectorAll("[fileSource]"))
    .filter(el => el.getAttribute("fileSource")?.split("#")[0] === c.drawingPath) : [];
  const decoded = el => el.tagName === "IMG" ? el.complete && el.naturalWidth > 0 : !!el.querySelector("svg");
  const visible = el => el.getBoundingClientRect().height > 0 && !el.closest(".excalidraw-display-none");
  const selfImages = root ? Array.from(root.querySelectorAll("[fileSource]"))
    .filter(el => el.getAttribute("fileSource") === `${c.paths[2]}#^as-image`) : [];
  const nativeImages = root ? Array.from(root.querySelectorAll(".internal-embed"))
    .filter(el => el.getAttribute("src") === c.paths[3]).flatMap(el => Array.from(el.querySelectorAll("img"))) : [];
  return { state: c.state, error: c.error, paused: c.paused, connected: !!root?.isConnected,
    popout: !!root && root.ownerDocument !== app.workspace.containerEl.ownerDocument,
    retiredImages: c.retiredEmbeds?.reduce((count, embed) => count + embed.querySelectorAll("[fileSource]").length, 0) ?? 0,
    mode: c.leaf?.view.getMode?.(), images: images.map(el => ({
      type: el.tagName, width: el.getAttribute("w"), ready: !!el.closest("[ready]"),
      decoded: decoded(el), visible: visible(el),
    })), selfImages: selfImages.map(el => ({ decoded: decoded(el), visible: visible(el) })),
    nativeImages: nativeImages.map(el => ({ decoded: decoded(el), visible: visible(el) })), owned: c.owned };
}

async function createHybridFixtures(control) {
  const c = globalThis[control];
  const source = await app.vault.read(app.vault.getFileByPath(c.drawingPath));
  if (!source.startsWith("---") || !source.includes("# Excalidraw Data")) throw Error("hybrid embed regression requires a Markdown drawing");
  const png = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII="), ch => ch.charCodeAt(0));
  await app.vault.createBinary(c.paths[3], png.buffer); c.owned.push(c.paths[3]);
  const embeds = `![[#^as-image]]\n\n![[${c.drawingPath}|180]]\n\n![[${c.paths[3]}|80]]\n\n`;
  const hybrid = source.replace(/^---\r?\n/, "---\nexcalidraw-open-md: true\n").replace("# Excalidraw Data", `${embeds}# Excalidraw Data`);
  await app.vault.create(c.paths[2], hybrid); c.owned.push(c.paths[2]);
  await app.vault.create(c.paths[4], `![[${c.paths[2]}#^as-image]]\n\n![[${c.paths[2]}]]`); c.owned.push(c.paths[4]);
  // A native Markdown fallback cannot resolve Excalidraw frame references. It
  // would parse this entire drawing and recursively encounter the same embed.
  const recursive = source.replace("# Excalidraw Data", `![[${c.paths[5]}#^frame=PDF frame]]\n\n# Excalidraw Data`);
  await app.vault.create(c.paths[5], recursive); c.owned.push(c.paths[5]);
}

async function renderPDFEmbeds(control, imageType) {
  const c = globalThis[control];
  c.plugin.settings.previewImageType = imageType;
  const deadline = Date.now() + 5000;
  while (!c.plugin.isExcalidrawFile(app.vault.getFileByPath(c.paths[5]))) {
    if (Date.now() > deadline) throw Error("PDF fixture metadata did not become ready");
    await new Promise(resolve => window.setTimeout(resolve, 20));
  }
  const { Component, MarkdownRenderer } = c.plugin.ea.obsidian;
  const component = new Component(); component.load();
  const print = c.leaf.view.contentEl.ownerDocument.body.createDiv("print");
  const root = print.createDiv("markdown-preview-view markdown-rendered");
  try {
    const markdown = [1, 2, 3].map(() => `![[${c.paths[5]}#^frame=PDF frame|100%]]`).join("\n\n") + `\n\n![[${c.paths[3]}|80]]`;
    await MarkdownRenderer.render(app, markdown, root, c.paths[1], component);
    const images = Array.from(root.querySelectorAll("[fileSource]"));
    if (images.length !== 3 || images.some(image => image.getAttribute("fileSource") !== `${c.paths[5]}#^frame=PDF frame`)) throw Error("PDF lost drawing frame images");
    for (const image of images) {
      if (image.tagName === "IMG") await image.decode();
      else if (!image.querySelector("svg")?.textContent.includes("Embed recovery")) throw Error("PDF frame lost its drawing text");
    }
    const native = root.querySelector(".internal-embed img");
    if (!native) throw Error("PDF lost its native PNG embed");
    await native.decode();
    if (!native.naturalWidth) throw Error("PDF native PNG did not decode");
    if (component._children?.some(child => child.file?.path === c.paths[5])) throw Error("Native Markdown renderer took ownership of a drawing frame");
    return { images: images.length, nativePNG: true, popout: root.ownerDocument !== app.workspace.containerEl.ownerDocument };
  } finally {
    component.unload(); print.remove();
  }
}

async function openHybrid(control, mode, nested) {
  const c = globalThis[control];
  const path = nested ? c.paths[4] : c.paths[2];
  await c.leaf.setViewState({ type: "markdown", state: { file: path, mode, source: false } });
  if (mode === "source") c.leaf.view.editor.setCursor({ line: 0, ch: 0 });
}

async function createFixtures(control) {
  const c = globalThis[control];
  const view = app.workspace.getLeavesOfType("excalidraw").find(leaf => leaf.view.file?.path === c.drawingPath)?.view;
  const ea = new c.plugin.ea.constructor(c.plugin, view);
  try {
    const text = ea.addText(0, 0, "Embed recovery #2953");
    const frame = ea.addFrame(-20, -20, 500, 150, "PDF frame");
    ea.getElement(text).frameId = frame;
    if (!await ea.addElementsToView(false, true)) throw Error("could not populate drawing fixture");
  } finally { ea.destroy(); }
  // Collapse the long note so all three drawing widgets remain in the viewport.
  const large = "> [!info]- Asynchronously rendered note\n>\n" + Array.from({ length: 30 }, (_, i) =>
    `> Paragraph ${i}: ${"Long embedded Markdown content. ".repeat(24)}\n>\n`).join("");
  await app.vault.create(c.paths[0], large); c.owned.push(c.paths[0]);
  const note = `![[${c.paths[0]}]]\n\n` + [320, 360, 400].map(width => `![[${c.drawingPath}|${width}]]`).join("\n\n");
  await app.vault.create(c.paths[1], note); c.owned.push(c.paths[1]);
  c.leaf = app.workspace.getLeaf("tab");
}

async function openNote(control, mode, imageType, hold) {
  const c = globalThis[control];
  c.plugin.settings.previewImageType = imageType;
  c.paused = 0; c.hold = hold;
  c.gate = new Promise(resolve => { c.release = resolve; });
  await c.leaf.openFile(app.vault.getFileByPath(c.paths[1]), { state: { mode, source: false } });
  if (mode === "source") {
    const editor = c.leaf.view.editor;
    editor.setCursor({ line: editor.lastLine(), ch: 0 });
    editor.scrollIntoView({ from: { line: editor.lastLine(), ch: 0 }, to: { line: editor.lastLine(), ch: 0 } }, true);
  }
}

function detach(control) {
  const c = globalThis[control];
  c.root = c.leaf.view.contentEl; c.parent = c.root.parentElement; c.next = c.root.nextSibling;
  c.root.remove();
  return { detached: !c.root.isConnected };
}

function reattach(control) {
  const c = globalThis[control];
  c.parent.insertBefore(c.root, c.next?.parentElement === c.parent ? c.next : null);
  c.root = null; c.parent = null; c.next = null;
  return { reattached: true };
}

async function closeNote(control) {
  const c = globalThis[control];
  c.retiredEmbeds = Array.from(c.leaf.view.contentEl.querySelectorAll(".internal-embed"));
  await c.leaf.setViewState({ type: "empty", state: {} });
}

function openPopout(control) {
  const c = globalThis[control];
  c.leaf.detach();
  c.leaf = app.workspace.openPopoutLeaf();
  return { started: true };
}

function resize(control) {
  const c = globalThis[control];
  const embed = c.leaf.view.contentEl.querySelector(".internal-embed[ready]");
  if (!embed) throw Error("ready embed missing");
  embed.setAttribute("width", "280");
  return { changed: true };
}

async function cleanup(control, expectedPaths) {
  const c = globalThis[control];
  if (!c) return;
  c.hold = false; c.release?.();
  if (c.hadOwnAwaitInit) c.plugin.awaitInit = c.originalAwaitInit;
  else delete c.plugin.awaitInit;
  c.plugin.settings.previewImageType = c.previewImageType;
  if (c.root && c.parent) c.parent.insertBefore(c.root, c.next?.parentElement === c.parent ? c.next : null);
  if (c.leaf) { await c.leaf.setViewState({ type: "empty", state: {} }); c.leaf.detach(); }
  for (const path of c.owned) {
    if (!expectedPaths.includes(path)) throw Error("refusing to delete an unowned fixture");
    const file = app.vault.getFileByPath(path);
    if (file) await app.vault.delete(file);
  }
  c.state = "clean";
}

export async function runEmbedRecoveryScenario({ cli, drawingPath }) {
  const paths = ["large.md", "note.md", "hybrid.excalidraw.md", "pixel.png", "nested.md", "pdf.excalidraw.md"]
    .map(kind => `__excalidraw_embed_${randomUUID()}_${kind}`);
  // Test-only CLI boundary: fn is always a function defined in this module, and
  // arguments are JSON literals in JavaScript source, never HTML/script markup.
  // JSON.stringify preserves quotes/backslashes; </script> cannot end this eval.
  const evaluate = code => JSON.parse(cli("eval", `code=${code}`).trim().replace(/^=>\s*/, ""));
  const invoke = (fn, ...args) => evaluate(`JSON.stringify((${fn.toString()})(${[CONTROL, ...args].map(value => JSON.stringify(value)).join(",")}))`);
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const read = () => invoke(snapshot);
  async function poll(predicate, label) {
    const deadline = Date.now() + 20_000;
    for (;;) {
      const value = read();
      if (value.error) throw Error(value.error);
      if (predicate(value)) return value;
      if (Date.now() >= deadline) throw Error(`${label}: ${JSON.stringify(value)}`);
      await wait(100);
    }
  }
  let unsettled=false;
  async function act(fn,...args){try{return await runHostFunction({cli,execute:fn,args:[CONTROL,...args]});}catch(error){if(error.cleanupFailed)unsettled=true;throw error;}}
  const checks = [];
  invoke(setup, drawingPath, paths);
  try {
    await act(createFixtures);
    await act(createHybridFixtures);
    for (const imageType of ["SVGIMG", "PNG", "SVG"]) {
      await act(renderPDFEmbeds, imageType);
      checks.push(`${imageType}: native Markdown PDF preparation completes with three frames and a native PNG, without recursive drawing transclusion`);
    }
    for (const imageType of ["SVGIMG", "PNG", "SVG"]) {
      await act(openNote, "source", imageType, true);
      await poll(value => value.paused > 0, "embed did not enter image generation");
      assert.equal(invoke(detach).detached, true);
      // Longer than the loader's cancellation interval, while the context remains live.
      await wait(650);
      evaluate(`(()=>{const c=globalThis.${CONTROL};c.hold=false;c.release();return JSON.stringify({released:true})})()`);
      await poll(value => value.images.length === 3 && value.images.every(image => image.ready), "detached live context did not complete");
      invoke(reattach);
      const ready = await poll(value => value.images.length === 3 && value.images.every(image => image.ready && image.decoded), "reattached images did not decode");
      assert.equal(ready.connected, true); checks.push(`${imageType}: detached Live Preview context completes and reattaches`);
      invoke(resize);
      await poll(value => value.images.length === 3 && value.images.some(image => image.width === "280" && image.ready && image.decoded), "attribute refresh did not finish");
      checks.push(`${imageType}: width attribute refresh preserves all three embeds`);
      await act(closeNote);
      await act(openNote, "preview", imageType, false);
      await poll(value => value.images.length === 3 && value.images.every(image => image.decoded), "Reading mode images missing");
      checks.push(`${imageType}: Reading mode after Live Preview`);
      await act(closeNote);
      await act(openNote, "source", imageType, false);
      await poll(value => value.images.length === 3 && value.images.every(image => image.decoded), "warm reopen images missing");
      checks.push(`${imageType}: warm Live Preview reopen`);
      await act(closeNote);
    }
    await act(openNote, "source", "SVGIMG", true);
    await poll(value => value.paused > 0, "unload fixture did not start");
    await act(closeNote);
    evaluate(`(()=>{const c=globalThis.${CONTROL};c.hold=false;c.release();return JSON.stringify({released:true})})()`);
    await wait(650);
    assert.equal(read().images.length, 0); assert.equal(read().retiredImages, 0);
    checks.push("permanent context unload rejects insertion into the retired embed containers");
    invoke(openPopout);
    await act(openNote, "source", "SVGIMG", true);
    await poll(value => value.paused > 0 && value.popout, "popout embeds did not start");
    invoke(detach); await wait(650);
    evaluate(`(()=>{const c=globalThis.${CONTROL};c.hold=false;c.release();return JSON.stringify({released:true})})()`);
    await poll(value => value.images.length === 3 && value.images.every(image => image.ready), "detached popout context did not complete");
    invoke(reattach);
    await poll(value => value.connected && value.popout && value.images.every(image => image.decoded), "popout images did not decode");
    invoke(resize);
    await poll(value => value.images.some(image => image.width === "280" && image.ready && image.decoded), "popout attribute refresh did not finish");
    checks.push("popout: detached context, reattachment and width refresh in the owning document");
    await act(closeNote);
    for (const imageType of ["SVGIMG", "PNG", "SVG"]) {
      const result = await act(renderPDFEmbeds, imageType);
      if (!result.popout) throw Error("PDF preparation did not use the popout document");
      checks.push(`${imageType}: popout Markdown PDF preparation preserves drawing frames and the native PNG`);
    }
    for (const mode of ["source", "preview"]) {
      for (const nested of [false, true]) {
        await act(openHybrid, mode, nested);
        await poll(value => value.selfImages.length === (nested ? 2 : 1) &&
          value.selfImages.every(image => image.decoded && image.visible) &&
          value.images.length === 1 && value.images.every(image => image.decoded && image.visible) &&
          value.nativeImages.filter(image => image.visible).length === 1 &&
          value.nativeImages.filter(image => image.visible).every(image => image.decoded),
        `hybrid ${mode}, nested=${nested}: self-image, nested drawing or PNG missing`);
        checks.push(`hybrid ${mode}, nested=${nested}: self-image, drawing and native PNG visible in popout`);
        await act(closeNote);
      }
    }
  } finally {
    if(unsettled)throw Object.assign(Error("Unsettled embed task; preserve owned fixtures"),{cleanupFailed:true});
    await act(cleanup, paths);
    evaluate(`(()=>{delete globalThis.${CONTROL};return JSON.stringify({clean:true})})()`);
  }
  return { id: "markdown-embed-recovery-2953", status: "passed", assertions: checks, cleanup: "passed" };
}
