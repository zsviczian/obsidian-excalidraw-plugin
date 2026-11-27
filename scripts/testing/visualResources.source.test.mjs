/** Exercise production discovery, curation, library ownership, and catalog operations. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import test from "node:test";
import { sourceHarness } from "./sourceHarness.mjs";

const base = "src/shared/visualResources/";
const model = await sourceHarness().importModule(base + "visualResourceModel.ts");
const candidate = { path: "Media/icon - Star.svg", folder: "Media", basename: "icon - Star",
  extension: "svg", size: 2300, image: true, drawing: false };

test("visual discovery combines AND rules, OR groups and independent catch-all", () => {
  const strict = { name: "Tiny", pattern: "^icon - (.*)", folderPattern: "^Media$", extensions: ".SVG", maxKb: "1" };
  const match = model.compileVisualRules("icon", [strict, { ...strict, name: "Assets", maxKb: "4" }]);
  assert.deepEqual(match(candidate), [{ group: "icon:Assets", keyword: "Star" }]);
  assert.deepEqual(match({ ...candidate, folder: "Other" }), []);
  const roleMatch = model.compileVisualRules("frame", [{ name: "Marked", pattern: "^Review (.+)", frameType: "magicframe", property: "tags", value: "#approved" }]);
  assert.deepEqual(roleMatch({ ...candidate, frame: { name: "Review Phase 1", type: "frame" }, properties: { tags: ["approved"] } }), []);
  assert.deepEqual(roleMatch({ ...candidate, frame: { name: "Review Phase 1", type: "magicframe" }, properties: { tags: ["approved"] } }),
    [{ group: "frame:Marked", keyword: "Phase 1" }]);
  const vault = { locator: { provider: "vault", path: candidate.path }, kind: "icon", title: "Star", source: candidate.path, keywords: [], groups: ["icon:Assets"] };
  const lucide = { ...vault, locator: { provider: "lucide", icon: "lucide-star" }, groups: [] };
  const other = { ...vault, locator: { provider: "vault", path: "Media/unmatched.svg" }, kind: "image", other: true, groups: [] };
  const resources = [vault, lucide, other];
  assert.deepEqual(model.filterVisualResources(resources, "", ["image"]), []);
  assert.deepEqual(model.filterVisualResources(resources, "", ["other"], []), [other]);
  assert.deepEqual(model.filterVisualResources(resources, "star", ["lucide"]), [lucide]);
  assert.deepEqual(model.filterVisualResources(resources, "", ["icon", "other"], []), [other]);
  assert.deepEqual(model.filterVisualResources(resources, "", ["icon", "other"], ["icon:Assets"]), [vault, other]);
  assert.equal(model.compileVisualExclusions("Media, Templates\nSome Folder")(candidate.path), true);
  const old = model.readIconLibrarySettings({ filters: [strict], activeFilterNames: [], defaultIconWidth: 123 });
  assert.equal(old.iconWidth, 123);
  assert.deepEqual(old.groups, []);
  assert.equal(old.rules[0].maxKb, "", "preserve the distributed script's effective size handling");
});

test("frame keywords surface only the parent and provider identities remain independent", () => {
  const locator = { provider: "vault", path: "One.md" };
  const child = { locator: { ...locator, frame: "r1" }, kind: "frame", source: locator.path, title: "Review plan", keywords: [] };
  const parent = { locator, kind: "drawing", source: locator.path, title: "Whole drawing", keywords: [], frames: [child] };
  assert.deepEqual(model.filterVisualResources([parent], "review plan", ["drawing"]), [parent]);
  assert.notEqual(model.visualResourceKey(locator), model.visualResourceKey(child.locator));
  assert.equal(model.visualResourceKey({ provider: "stencil", id: "same", path: "A" }),
    model.visualResourceKey({ provider: "stencil", id: "same", path: "B" }));
  assert.notEqual(model.visualResourceKey({ provider: "framework", id: "same", path: "A" }),
    model.visualResourceKey({ provider: "framework", id: "same", path: "B" }));
});

class Component { registerEvent() {} }
class TFolder {}
const vaultSetup = () => {
  const records = new Map(), folders = new Map(), listeners = new Map();
  const vault = {
    records,
    changes: 0,
    on(event, listener) { const bucket = listeners.get(event) ?? []; bucket.push(listener); listeners.set(event, bucket); },
    trigger(event, ...args) { for (const listener of listeners.get(event) ?? []) listener(...args); },
    getAbstractFileByPath(path) { return this.getFileByPath(path) ?? this.getFolderByPath(path); },
    getFileByPath(path) { return records.get(path)?.file ?? null; },
    getFolderByPath(path) { return folders.get(path) ?? null; },
    async createFolder(path) { const folder = Object.assign(new TFolder(), { path, children: [] }); folders.set(path, folder); return folder; },
    async create(path, text) {
      if (records.has(path)) throw Error("Collision");
      const name = path.split("/").at(-1);
      const parent = this.getFolderByPath(path.slice(0, path.lastIndexOf("/")));
      const file = { path, name, parent, extension: name.split(".").at(-1), stat: { mtime: ++this.changes } };
      records.set(path, { file, text });
      parent?.children.push(file);
      this.trigger("create", file);
      return file;
    },
    async read(file) { return records.get(file.path).text; },
    async cachedRead(file) { return this.read(file); },
    async process(file, update) {
      const record = records.get(file.path);
      const text = update(record.text);
      if (text !== record.text) { record.text = text; file.stat.mtime = ++this.changes; this.trigger("modify", file); }
      return text;
    },
    async modify(file, text) { return this.process(file, () => text); },
    async trash(file) {
      records.delete(file.path);
      file.parent.children = file.parent.children.filter(child => child !== file);
      this.trigger("delete", file);
    },
    getFiles: () => Array.from(records.values(), record => record.file),
  };
  return vault;
};
const obsidian = { Component, TFolder, normalizePath: path => path.replaceAll("//", "/"), Notice: class {} };
const makePlugin = vault => ({
  settings: { folder: "Drawings", libraryFolderPath: "Libraries", libraryFileName: "User", libraryStorageMode: "vault",
    frameworkFolder: "Frameworks", frameworkInstalls: {}, frameworkCatalog: [], frameworkCatalogCheckedAt: 0, showNewVersionNotification: false },
  app: { vault, workspace: { containerEl: { ownerDocument: { defaultView: { crypto: webcrypto, setTimeout, clearTimeout } } } },
    fileManager: { trashFile: file => vault.trash(file) } },
  register() {}, registerEvent() {}, async saveSettings() {},
  getLegacyStencilLibrary: () => ({ libraryItems: [] }),
});
const t = { t: key => key };

test("collections replay edits on the latest file and retain memberships through moves", async () => {
  const harness = sourceHarness({ obsidian });
  try {
    const { ResourceCollections } = await harness.importModule(base + "ResourceCollections.ts");
    const vault = vaultSetup(), plugin = makePlugin(vault);
    const store = new ResourceCollections(plugin);
    store.onload();
    await store.refresh();
    assert.equal(vault.getFileByPath("Drawings/resource-collections.json"), null);
    await store.savePlaylist("Parent", "parent");
    await store.savePlaylist("Child", "child", "parent");
    await store.savePlaylist("Other", "other");
    await assert.rejects(store.removePlaylist("parent"), /contains children/);
    const original = { provider: "vault", path: "Folder/drawing.md", frame: "frame-id" };
    await Promise.all([store.curate([original], { favorite: true }), store.curate([original], { playlist: "child", member: true }),
      store.curate([original], { playlist: "other", member: true })]);
    assert.deepEqual(store.state(original), { favorite: true, memberships: ["child", "other"] });
    const file = vault.getFileByPath("Drawings/resource-collections.json");
    await vault.process(file, raw => {
      const disk = JSON.parse(raw);
      disk.playlists.remote = { name: "Remote", members: ["dangling"] };
      return JSON.stringify(disk);
    });
    vault.trigger("rename", { path: "Renamed" }, "Folder");
    const moved = { ...original, path: "Renamed/drawing.md" };
    await store.curate([moved], { playlist: "other", member: false });
    const restored = new ResourceCollections(plugin);
    await restored.refresh();
    assert.deepEqual(restored.state(moved), { favorite: true, memberships: ["child"] });
    assert.deepEqual(restored.state(original), { favorite: false, memberships: [] });
    assert.deepEqual(restored.playlists.find(([id]) => id === "remote")[1].members, []);
    const replacement = { provider: "stencil", id: "s1", path: "Libraries/A.excalidrawlib" };
    await store.curate([replacement], { favorite: true, playlist: "other", member: true });
    vault.trigger("delete", { path: replacement.path });
    const destination = "Libraries/B.excalidrawlib";
    await store.moveStencils(["s1"], replacement.path, destination);
    assert.deepEqual(store.state({ ...replacement, path: destination }), { favorite: true, memberships: ["other"] });
    vault.trigger("delete", { path: moved.path });
    await store.curate([moved], { manual: true });
    assert.equal(store.state(moved).favorite, false);
  } finally { harness.close(); }
});

test("stencil moves keep empty files and can resume after source cleanup fails", async () => {
  const harness = sourceHarness({ obsidian, "src/lang/helpers": t,
    "src/constants/constants": { restoreLibraryItems: items => items },
    "src/constants/safeUrls": { URLs: { GITHUB_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_RELEASES_TAG: "release" } },
    "src/shared/Dialogs/StencilLibraryMigrationPrompt": { StencilLibraryMigrationPrompt: class {} },
    "src/utils/obsidianUtils": { getExcalidrawViews: () => [] },
  });
  const originalVersion = globalThis.PLUGIN_VERSION;
  globalThis.PLUGIN_VERSION = "test";
  try {
    const { StencilLibraryManager } = await harness.importModule("src/core/managers/StencilLibraryManager.ts");
    const vault = vaultSetup(), plugin = makePlugin(vault);
    const manager = new StencilLibraryManager(plugin);
    const source = await manager.createResourceLibrary("Source");
    const destination = await manager.createResourceLibrary("Destination");
    assert.ok((await manager.getResourceLibraries()).paths.includes(destination));
    const shape = { id: "keep-id", name: "Independent shape", created: 1, status: "unpublished", elements: [] };
    const envelope = items => JSON.stringify({ type: "excalidrawlib", version: 2, libraryItems: items });
    await vault.modify(vault.getFileByPath(source), envelope([shape]));
    manager.invalidate();
    const processFile = vault.process.bind(vault);
    vault.process = async (file, update) => {
      if (file.path === source) throw Error("Source write failed");
      return processFile(file, update);
    };
    await assert.rejects(manager.moveResourceStencils(source, destination, [shape.id]), /Source write failed/);
    const items = async path => JSON.parse(await vault.read(vault.getFileByPath(path))).libraryItems;
    assert.deepEqual(await items(source), [shape]);
    assert.deepEqual(await items(destination), [shape]);
    vault.process = processFile;
    await manager.moveResourceStencils(source, destination, [shape.id]);
    assert.deepEqual(await items(source), []);
    assert.equal((await manager.getResourceLibraries()).items.find(entry => entry.item.id === shape.id).path, destination);
    await vault.modify(vault.getFileByPath(source), envelope([{ ...shape, name: "Different" }]));
    await assert.rejects(manager.moveResourceStencils(source, destination, [shape.id]), /collision/);
    assert.equal((await items(source))[0].name, "Different");
    await manager.deleteResourceLibrary(source, null, [shape.id]);
    assert.equal(vault.getFileByPath(source), null);
    assert.deepEqual(await items(destination), [shape]);
  } finally { globalThis.PLUGIN_VERSION = originalVersion; harness.close(); }
});

test("stencil rename changes only the owned item name in vault and legacy libraries", async () => {
  const harness = sourceHarness({ obsidian, "src/lang/helpers": t,
    "src/constants/constants": { restoreLibraryItems: items => items },
    "src/constants/safeUrls": { URLs: { GITHUB_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_RELEASES_TAG: "release" } },
    "src/shared/Dialogs/StencilLibraryMigrationPrompt": { StencilLibraryMigrationPrompt: class {} },
    "src/utils/obsidianUtils": { getExcalidrawViews: () => [] },
  });
  const originalVersion = globalThis.PLUGIN_VERSION;
  globalThis.PLUGIN_VERSION = "test";
  try {
    const { StencilLibraryManager } = await harness.importModule("src/core/managers/StencilLibraryManager.ts");
    const vault = vaultSetup(), plugin = makePlugin(vault);
    const manager = new StencilLibraryManager(plugin);
    const owner = await manager.createResourceLibrary("Owner");
    const other = await manager.createResourceLibrary("Other");
    const stencil = { id: "generated", status: "unpublished", created: 1, elements: [{ id: "label", type: "text", text: "The shape", rawText: "" }] };
    const remote = { ...stencil, id: "remote", name: "Remote edit" };
    let legacy = { type: "excalidrawlib", version: 2, custom: "keep", libraryItems: [stencil] };
    const read = async path => JSON.parse(await vault.read(vault.getFileByPath(path)));
    await vault.modify(vault.getFileByPath(owner), JSON.stringify(legacy));
    await vault.modify(vault.getFileByPath(other), JSON.stringify(legacy));
    await manager.getResourceLibraries();
    // Sync changes the file after the browser has taken a snapshot.
    const edit = { ...legacy, libraryItems: [{ ...stencil, status: "published" }, remote] };
    await vault.modify(vault.getFileByPath(owner), JSON.stringify(edit));
    await manager.renameResourceStencil(owner, stencil.id, "  Tall shape  ");
    assert.deepEqual(await read(owner), { ...edit, libraryItems: [{ ...edit.libraryItems[0], name: "Tall shape" }, remote] });
    assert.deepEqual(await read(other), legacy);
    await assert.rejects(manager.renameResourceStencil(owner, "removed", "New"), /unique match/);
    await assert.rejects(manager.renameResourceStencil(owner, stencil.id, " "), /empty/);

    plugin.settings.libraryStorageMode = "data-json";
    plugin.getLegacyStencilLibrary = () => legacy;
    plugin.setLegacyStencilLibrary = async data => { legacy = data; };
    await manager.renameResourceStencil(undefined, stencil.id, "Legacy shape");
    assert.deepEqual(legacy, { type: "excalidrawlib", version: 2, custom: "keep", libraryItems: [{ ...stencil, name: "Legacy shape" }] });
    assert.equal((await manager.getResourceLibraries()).items[0].item.name, "Legacy shape");
  } finally { globalThis.PLUGIN_VERSION = originalVersion; harness.close(); }
});

test("framework catalog is local-first and coalesces checks for 24 hours", async () => {
  const asset = readFileSync(new URL("../../visual-frameworks/thinking-frameworks.excalidrawlib", import.meta.url), "utf8");
  const directory = readFileSync(new URL("../../visual-frameworks/directory-info.json", import.meta.url), "utf8");
  const remote = JSON.parse(directory)[0];
  let requested = [], shutdown = false, current = directory;
  let now = 1800000000000;
  const dateNow = Date.now;
  Date.now = () => now;
  const harness = sourceHarness({
    obsidian: { ...obsidian, Modal: class {}, Setting: class {}, requestUrl: async ({ url }) => {
      requested.push(url);
      if (shutdown) throw Error("Offline");
      return { text: url === "catalog" ? current : asset };
    }},
    "src/constants/constants": { restoreLibraryItems: items => items },
    "src/constants/safeUrls": { URLs: { VISUAL_FRAMEWORKS_CATALOG: "catalog", VISUAL_FRAMEWORKS_DIRECTORY: "files" } },
    "src/lang/helpers": t,
  });
  try {
    const { FrameworkCatalog, parseFrameworkLibrary } = await harness.importModule(base + "FrameworkCatalog.ts");
    assert.equal(parseFrameworkLibrary(asset).length, 21);
    assert.throws(() => parseFrameworkLibrary('{"type":"excalidrawlib","version":2,"libraryItems":[null]}'));
    const vault = vaultSetup(), plugin = makePlugin(vault), catalog = new FrameworkCatalog(plugin);
    assert.deepEqual(await catalog.list(), []);
    assert.deepEqual(await catalog.updates(), []);
    assert.deepEqual(requested, []);
    plugin.settings.showNewVersionNotification = true;
    await Promise.all([catalog.updates(), catalog.updates()]);
    assert.deepEqual(requested, ["catalog"]);
    await catalog.install();
    assert.deepEqual(requested, ["catalog", "files/" + remote.fname]);
    assert.equal((await catalog.list()).length, 21);
    assert.ok(plugin.settings.frameworkInstalls["Frameworks/" + remote.fname].digest);
    current = JSON.stringify([{ ...remote, mtime: remote.mtime + 1 }]);
    now += 24 * 60 * 60 * 1000 - 1;
    assert.deepEqual(await catalog.updates(), []);
    now++;
    assert.equal((await catalog.updates()).length, 1);
    assert.equal(requested.length, 3, "the update check never downloads a library");
    const path = "Frameworks/" + remote.fname;
    const file = vault.getFileByPath(path);
    const modified = asset + "\n";
    await vault.modify(file, modified);
    catalog.confirmReplace = async () => false;
    await catalog.install();
    assert.equal(await vault.read(file), modified, "declining replacement keeps local edits");
    assert.equal(plugin.settings.frameworkInstalls[path].mtime, remote.mtime);
    catalog.confirmReplace = async () => true;
    await catalog.install();
    assert.equal(await vault.read(file), asset, "accepting replacement installs the validated revision");
    assert.equal(plugin.settings.frameworkInstalls[path].mtime, remote.mtime + 1);
    shutdown = true;
    now += 24 * 60 * 60 * 1000;
    assert.deepEqual(await catalog.updates(), []);
    assert.equal((await catalog.list()).length, 21);
  } finally { Date.now = dateNow; harness.close(); }
});
