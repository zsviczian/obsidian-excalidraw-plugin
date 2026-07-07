/*

![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-comic-strip-director.jpg)

# Comic Strip Director

Turn the Excalidraw canvas into a comic-strip studio: pick a page layout, fill
the panels with hand-drawn characters in any costume and pose, then punch it up
with painted sound-effect FX — no drawing skills required.

- **Build a page** — a visual picker with **30 layout templates** (grids, manga
  tiers, dynamic angled gutters, splash pages) in landscape / portrait / square,
  plus a **generator** that composes layouts for any panel count. Building again
  stacks the next page below the last one.
- **Split the selected panel** — a local **diagonal** or **horizontal**
  action-beat cut; each region is its own placement target.
- **Characters** — pick **who → as what → doing what** from the character packs
  you've imported. The picker only shows combinations you actually own, with a
  real thumbnail for every tile. Show/hide characters with **⚙ Manage**.
- **Character & FX packs** — install `.strippack` files with **Import pack…** /
  **Import FX pack…** (idempotent, backed-up merges). New characters, costumes
  and FX: [comicstripdirector.com](https://comicstripdirector.com/).
- **FX callouts** — painted POW! / ZAP! / KABOOM! bursts, stamped into a panel.
- **Hand-drawn vector library** — your original `figures.json` set; stamped with
  your exact strokes, colours and jitter preserved. Your art is never restyled.
- **Callout zone** — a light, dashed placeholder where dialogue goes. Select it
  and run the **Comicbook Callout Editor** to turn it into a real speech bubble.

Tags everything in `customData.stripDirector` and never touches `comicCallout`.

![](https://raw.githubusercontent.com/iwanhoogendoorn/obsidian-excalidraw-plugin/main/ea-scripts/comic-strip-director/demo.gif)

## Quick start

1. Install this script (you just did — this is the store).
2. Open a drawing and run **Comic Strip Director** from the script menu.
3. Click **⭐ Get the free starter pack** at the top of the panel — one click
   downloads and imports the free Core Cast (8 characters, 176 poses) plus
   3 painted FX, with a progress bar. It also creates the data folder for you.
4. More characters, costumes, themes and the full FX set:
   [comicstripdirector.com](https://comicstripdirector.com/). Unzip a purchase,
   drop the `.strippack` in your scripts folder (or `Scripts/Downloaded/`), then
   **Import pack…** — you can import many packs in one go.

> **Using Obsidian Sync?** Consider excluding the `Comic Strip Director (Library)` data
> folder from sync — packs contain a lot of images. And after a big import,
> restart Obsidian so indexing catches up.

## The free Core Cast

|  |  |  |  |
|---|---|---|---|
|![](https://raw.githubusercontent.com/iwanhoogendoorn/obsidian-excalidraw-plugin/main/ea-scripts/comic-strip-director/previews/free/mia-present.png)|![](https://raw.githubusercontent.com/iwanhoogendoorn/obsidian-excalidraw-plugin/main/ea-scripts/comic-strip-director/previews/free/walt-present.png)|![](https://raw.githubusercontent.com/iwanhoogendoorn/obsidian-excalidraw-plugin/main/ea-scripts/comic-strip-director/previews/free/priya-present.png)|![](https://raw.githubusercontent.com/iwanhoogendoorn/obsidian-excalidraw-plugin/main/ea-scripts/comic-strip-director/previews/free/sam-present.png)|
|**Mia**|**Walt**|**Priya**|**Sam**|
|![](https://raw.githubusercontent.com/iwanhoogendoorn/obsidian-excalidraw-plugin/main/ea-scripts/comic-strip-director/previews/free/nadia-present.png)|![](https://raw.githubusercontent.com/iwanhoogendoorn/obsidian-excalidraw-plugin/main/ea-scripts/comic-strip-director/previews/free/rico-present.png)|![](https://raw.githubusercontent.com/iwanhoogendoorn/obsidian-excalidraw-plugin/main/ea-scripts/comic-strip-director/previews/free/grace-present.png)|![](https://raw.githubusercontent.com/iwanhoogendoorn/obsidian-excalidraw-plugin/main/ea-scripts/comic-strip-director/previews/free/felix-present.png)|
|**Dr. Nadia**|**Rico**|**Grace**|**Felix**|

Full documentation, the extended cast, and the free packs as plain files:
[github.com/iwanhoogendoorn/obsidian-excalidraw-plugin](https://github.com/iwanhoogendoorn/obsidian-excalidraw-plugin/tree/main/ea-scripts/comic-strip-director)

Requires Excalidraw plugin 2.19.1 or higher.

```javascript
*/

if (!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("2.19.1")) {
  new Notice("Please update the Excalidraw Plugin to version 2.19.1 or higher.");
  return;
}

// If a side panel for this script is already open, just reveal it.
const existingTab = ea.checkForActiveSidepanelTabForScript();
if (existingTab) {
  const hostEA = existingTab.getHostEA();
  if (hostEA && hostEA !== ea) {
    hostEA.setView(ea.targetView);
    existingTab.open();
    return;
  }
}

// ===========================================================================
// VOCAB + STYLING  (panel engine — reused from modules/layout.js)
// ===========================================================================
// Per-panel action-beat cuts offered in the UI. (splitPanel() also understands the
// triangle-wedge modes tri-up/-down/-left/-right for back-compat with older strips.)
const SPLIT_OPTIONS = [
  { id: "diag-back",  label: "Diagonal \\", tip: "Diagonal top-left → bottom-right (2 regions)" },
  { id: "diag-fwd",   label: "Diagonal /",  tip: "Diagonal top-right → bottom-left (2 regions)" },
  { id: "horizontal", label: "Horizontal",  tip: "Split into top / bottom halves (2 regions)" },
];
const STRIP_ROLES = ["panel", "calloutZone", "figure", "panelGroup", "subpanel", "fx"];
const COMIC_STROKE = "#1e1e1e";
const COMIC_STROKE_WIDTH = 4;
const COMIC_ROUGHNESS = 0;
const CALLOUT_STROKE = "#868e96";
const CALLOUT_OPACITY = 35;
const CALLOUT_TEXT_OPACITY = 55;
const FIGURES_FILE = "figures.json";
// Where users get new character / add-on packs. Surfaced as a quiet, muted link in a
// few natural spots (near the import buttons, the empty state, the footer) — never a
// banner or popup.
const STORE_URL = "https://comicstripdirector.com/";
// The companion script that letters the reserved callout zones (speech bubbles etc.).
const CALLOUT_EDITOR_URL = "https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Comicbook%20Callout%20Editor.md";
const FIT_PAD = 0.9;          // breathing room when scaling a figure into a panel

// ===========================================================================
// SECTION A — LAYOUT  (panel split, tagging, callout zones)
//   Pure geometry; helpers that touch the scene take `ea` and only add + tag —
//   never commit. Page layouts themselves live in SECTION A2 (the catalog).
// ===========================================================================
function splitPanel(rect, mode) {
  const { x, y, w, h } = rect;
  const x2 = x + w, y2 = y + h, cx = x + w / 2, cy = y + h / 2;
  const TL = [x, y], TR = [x2, y], BR = [x2, y2], BL = [x, y2];
  const TC = [cx, y], BC = [cx, y2], LC = [x, cy], RC = [x2, cy];
  switch (mode) {
    case "diagonal":            // back-compat alias for "\"
    case "diag-back":           // "\" top-left -> bottom-right
      return [ [TL, TR, BR], [TL, BR, BL] ];
    case "diag-fwd":            // "/" top-right -> bottom-left
      return [ [TL, TR, BL], [TR, BR, BL] ];
    case "horizontal":          // top / bottom halves
      return [ [TL, TR, RC, LC], [LC, RC, BR, BL] ];
    case "triangle":            // back-compat alias for apex-up
    case "tri-up":              // central wedge apex at top centre (3 regions)
      return [ [TC, BR, BL], [TL, TC, BL], [TC, TR, BR] ];
    case "tri-down":            // V — central wedge apex at bottom centre
      return [ [BC, TL, TR], [TL, BC, BL], [TR, BR, BC] ];
    case "tri-left":            // apex at left centre
      return [ [LC, TR, BR], [TL, TR, LC], [LC, BR, BL] ];
    case "tri-right":           // apex at right centre
      return [ [RC, TL, BL], [TL, TR, RC], [RC, BR, BL] ];
    case "none":
    default:
      return [ [TL, TR, BR, BL] ];
  }
}
function tagStripDirector(ea, id, data) {
  const ids = Array.isArray(id) ? id : [id];
  const role = data && data.role;
  if (!STRIP_ROLES.includes(role)) {
    throw new Error(`tagStripDirector: role "${role}" not in ${JSON.stringify(STRIP_ROLES)}`);
  }
  const payload = { role };
  if (data.index !== undefined) payload.index = data.index;
  if (data.panel !== undefined) payload.panel = data.panel;
  if (data.half !== undefined) payload.half = data.half;
  if (data.poly !== undefined) payload.poly = data.poly;
  if (data.page !== undefined) payload.page = data.page;
  ids.forEach((i) => ea.addAppendUpdateCustomData(i, { stripDirector: payload }));
  return ids;
}
function addCalloutZonePlaceholder(ea, rect, panelIndex, seedText, page) {
  const padX = rect.w * 0.1;
  const padTop = rect.h * 0.08;
  const zone = {
    x: rect.x + padX, y: rect.y + padTop,
    w: rect.w - 2 * padX, h: Math.min(rect.h * 0.34, rect.h - 2 * padTop),
  };
  ea.style.strokeColor = CALLOUT_STROKE;
  ea.style.strokeWidth = 1.5;
  ea.style.strokeStyle = "dashed";
  ea.style.backgroundColor = "transparent";
  ea.style.roughness = 1;
  ea.style.roundness = { type: 3 };
  ea.style.opacity = CALLOUT_OPACITY;
  const ids = [];
  ids.push(ea.addRect(zone.x, zone.y, zone.w, zone.h));
  if (seedText && String(seedText).trim().length) {
    ea.style.strokeColor = CALLOUT_STROKE;
    ea.style.strokeStyle = "solid";
    ea.style.opacity = CALLOUT_TEXT_OPACITY;
    ea.style.fontSize = 16;
    ids.push(ea.addText(zone.x + 8, zone.y + 8, String(seedText).trim(), {
      width: zone.w - 16, textAlign: "center", verticalAlign: "top",
    }));
  }
  ea.style.opacity = 100;
  ea.style.strokeStyle = "solid";
  ea.style.roundness = null;
  tagStripDirector(ea, ids, { role: "calloutZone", panel: panelIndex, page: page === undefined ? (state.page || 0) : page });
  return ids;
}
// ===========================================================================
// SECTION B — FIGURE LIBRARY  (load companion figures.json from the bundle)
// ===========================================================================
let FIGURES = null;   // { styles:[...], figures:[{id,name,style,w,h,elements:[...]}] }

function _vaultApp() { return (ea.plugin && ea.plugin.app) || (typeof app !== "undefined" ? app : null); }

// All companion data (vector figures, AI pngs, manifests, roster, anchors) lives
// in a folder named exactly like this script, INSIDE the Scripts folder — so the
// script and its data move / share as one portable bundle.
const BUNDLE_DIR_NAME = "Comic Strip Director (Library)";
// Data folders created under the script's previous names keep working.
const LEGACY_BUNDLE_DIR_NAMES = ["Comic Strip Director", "Comicbook Strip Director (Library)"];
// Where the data bundle lives. Resolved once at startup: normally in the scripts
// folder root, but when this script is installed via the official script store it
// runs from Scripts/Downloaded/ — so the data folder is honoured in EITHER place.
let _BUNDLE_DIR = null;
function _scriptsRoot() {
  const sf = ea.plugin && ea.plugin.settings && ea.plugin.settings.scriptFolderPath;
  return sf ? sf.replace(/\/+$/, "") : "Excalidraw/Scripts";
}
function _bundleDir() {
  return _BUNDLE_DIR || (_scriptsRoot() + "/" + BUNDLE_DIR_NAME);
}
async function resolveBundleDir() {
  if (_BUNDLE_DIR) return _BUNDLE_DIR;
  try {
    const appRef = _vaultApp();
    const ad = appRef && appRef.vault && appRef.vault.adapter;
    const root = _scriptsRoot();
    const names = [BUNDLE_DIR_NAME, ...LEGACY_BUNDLE_DIR_NAMES];
    for (const nm of names) for (const c of [root + "/" + nm, root + "/Downloaded/" + nm]) {
      if (ad && (await ad.exists(c))) { _BUNDLE_DIR = c; return c; }
    }
  } catch (e) { /* fall through to default */ }
  _BUNDLE_DIR = _scriptsRoot() + "/" + BUNDLE_DIR_NAME;
  return _BUNDLE_DIR;
}

// Candidate paths for the companion figures JSON (bundle first, then legacy spots).
function _figureCandidates() {
  const out = [];
  const s = (ea.getScriptSettings && ea.getScriptSettings()) || {};
  if (s.figuresPath) out.push(s.figuresPath);
  out.push(_bundleDir() + "/" + FIGURES_FILE);  // portable bundle (preferred)
  const sf = ea.plugin && ea.plugin.settings && ea.plugin.settings.scriptFolderPath;
  if (sf) out.push(sf.replace(/\/+$/, "") + "/" + FIGURES_FILE); // legacy: loose in Scripts
  out.push(FIGURES_FILE);                       // vault root fallback
  out.push("Excalidraw/Scripts/" + FIGURES_FILE);
  return out;
}

async function loadFigures(force) {
  if (FIGURES && !force) return FIGURES;
  const appRef = _vaultApp();
  if (!appRef || !appRef.vault || !appRef.vault.adapter) return null;
  const adapter = appRef.vault.adapter;
  for (const p of _figureCandidates()) {
    try {
      if (await adapter.exists(p)) {
        const txt = await adapter.read(p);
        const data = JSON.parse(txt);
        if (data && Array.isArray(data.figures)) {
          data._path = p;
          FIGURES = data;
          return FIGURES;
        }
      }
    } catch (e) { /* try next candidate */ }
  }
  return null;
}

function figuresForStyle(style) {
  if (!FIGURES) return [];
  return FIGURES.figures.filter((f) => f.style === style);
}

// --- AI-composed figures (Character Composer, R5C) — embedded image figures ---
// Generated outside Obsidian (style-referenced AI) and listed in a vault manifest;
// stamped into a panel as an Excalidraw image element (his art is never restyled —
// these are an OPTIONAL additional placement source alongside the vector figures).
let AI_FIGURES = null;          // { figures:[{id,name,base,baseName,action,file,w,h}], _dir }
const AI_MANIFEST = "ai-figures.json";

function _aiDir() {
  const s = (ea.getScriptSettings && ea.getScriptSettings()) || {};
  if (s.aiFiguresDir) return s.aiFiguresDir.replace(/\/+$/, "");
  return _bundleDir();   // AI pngs + manifest + roster now live in the portable bundle
}
function _baseName(p) { return String(p || "").split("/").pop(); }
// Resolve a manifest entry to a vault-relative image path (robust to how `file` was stored).
// If `file` carries a sub-folder (e.g. "New Figures/…" or "Legacy Figures/…") we keep it,
// so the two AI libraries can live in separate folders under the bundle. A bare filename
// (older manifests) still resolves against the bundle root via basename.
function aiFigureImagePath(entry) {
  const f = entry.file || (entry.id + ".png");
  const rel = String(f).includes("/") ? String(f).replace(/^\/+/, "") : _baseName(f);
  return _aiDir() + "/" + rel;
}
// Displayable thumbnail URL for an AI figure (Obsidian app:// resource path), or null.
function aiThumbURL(entry) {
  try {
    const appRef = _vaultApp();
    const ad = appRef && appRef.vault && appRef.vault.adapter;
    if (ad && ad.getResourcePath) return ad.getResourcePath(aiFigureImagePath(entry));
  } catch (e) { /* no thumbnail */ }
  return null;
}
// Lowercase haystack for filtering an AI figure entry.
function aiSearchText(entry) {
  return [entry.name, entry.id, entry.character, entry.function, entry.action, entry.base, entry.baseName]
    .filter(Boolean).join(" ").toLowerCase();
}

async function loadAIFigures(force) {
  if (AI_FIGURES && !force) return AI_FIGURES;
  const appRef = _vaultApp();
  if (!appRef || !appRef.vault || !appRef.vault.adapter) return null;
  const adapter = appRef.vault.adapter;
  const dir = _aiDir();
  const candidates = [dir + "/" + AI_MANIFEST, AI_MANIFEST, "AI Figures/" + AI_MANIFEST];
  for (const p of candidates) {
    try {
      if (await adapter.exists(p)) {
        const data = JSON.parse(await adapter.read(p));
        if (data && Array.isArray(data.figures)) {
          data._dir = dir;
          AI_FIGURES = data;
          return AI_FIGURES;
        }
      }
    } catch (e) { /* next candidate */ }
  }
  AI_FIGURES = { figures: [], _dir: dir };   // defined-but-empty so the UI can say "none yet"
  return AI_FIGURES;
}

// --- Character system roster (R7): characters × functions × actions ---------
// Generation runs OUTSIDE Obsidian (Gemini CLI); this script picks a combination
// and STAMPS it if already generated+cached, else shows the exact compose command.
let ROSTER = null;             // { characters:[], functions:[], actions:[] }
const ROSTER_FILE = "roster.json";

async function loadRoster(force) {
  if (ROSTER && !force) return ROSTER;
  const appRef = _vaultApp();
  if (!appRef || !appRef.vault || !appRef.vault.adapter) return null;
  const adapter = appRef.vault.adapter;
  const dir = _aiDir();
  for (const p of [dir + "/" + ROSTER_FILE, ROSTER_FILE, "AI Figures/" + ROSTER_FILE]) {
    try {
      if (await adapter.exists(p)) {
        const data = JSON.parse(await adapter.read(p));
        if (data && Array.isArray(data.characters)) { ROSTER = data; return ROSTER; }
      }
    } catch (e) { /* next */ }
  }
  ROSTER = { characters: [], functions: [], actions: [] };
  return ROSTER;
}

// Legacy roster (old 8 characters / 9 roles / 11 actions) — drives the picker's
// "Legacy" library toggle. Optional: absent → the toggle simply offers nothing.
let ROSTER_LEGACY = null;
const ROSTER_LEGACY_FILE = "roster-legacy.json";
async function loadRosterLegacy(force) {
  if (ROSTER_LEGACY && !force) return ROSTER_LEGACY;
  const appRef = _vaultApp();
  if (!appRef || !appRef.vault || !appRef.vault.adapter) return null;
  const adapter = appRef.vault.adapter;
  const dir = _aiDir();
  for (const p of [dir + "/" + ROSTER_LEGACY_FILE, ROSTER_LEGACY_FILE]) {
    try {
      if (await adapter.exists(p)) {
        const data = JSON.parse(await adapter.read(p));
        if (data && Array.isArray(data.characters)) { ROSTER_LEGACY = data; return ROSTER_LEGACY; }
      }
    } catch (e) { /* next */ }
  }
  ROSTER_LEGACY = { characters: [], functions: [], actions: [] };
  return ROSTER_LEGACY;
}

// ===========================================================================
// SECTION B2 — CHARACTER PACKS  (import + enable/disable)
//   A `.strippack` is a single JSON file (see packs/build-packs.js) carrying a
//   roster slice + figures with PNG/SVG embedded as base64. Importing merges the
//   slice into this bundle's roster.json + ai-figures.json and writes the images
//   into New/Legacy Figures/, so purchased or shared packs light up the picker.
//   Everything an import writes is provenance-tagged with the pack id, and the
//   index files are read and validated BEFORE any file is written, and backed
//   up right before each merge is committed.
// ===========================================================================
const PACK_FORMAT = "strippack/v1";

// atob → ArrayBuffer for writeBinary (works for both PNG and SVG payloads).
function _b64ToArrayBuffer(b64) {
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}
// Strip the "data:...;base64," prefix from a data URI (tolerates a bare base64 string).
function _dataURIPayload(uri) {
  const s = String(uri || "");
  const i = s.indexOf("base64,");
  return i >= 0 ? s.slice(i + 7) : s;
}

// Sanitise a pack-supplied relative path. Returns a clean bundle-relative path, or
// null when the entry is unusable or tries to escape the bundle ("..", absolute
// paths, drive/scheme prefixes). Every pack-controlled path MUST pass through this.
function _safeRel(rel) {
  let s = String(rel || "").trim().replace(/\\/g, "/").replace(/\/{2,}/g, "/").replace(/^\/+/, "");
  if (!s || s.includes(":")) return null;
  const parts = s.split("/").filter((p) => p && p !== ".");
  if (!parts.length || parts.some((p) => p === "..")) return null;
  return parts.join("/");
}
// Pack-facing variant: additionally refuses bundle-root paths that would shadow the
// index files (a figure named "roster.json" must never become the roster).
const _RESERVED_INDEX_FILES = new Set(["roster.json", "roster-legacy.json", "ai-figures.json", "fx-figures.json", "figures.json"]);
function _safePackRel(rel) {
  const s = _safeRel(rel);
  if (!s) return null;
  if (!s.includes("/") && _RESERVED_INDEX_FILES.has(s.toLowerCase())) return null;
  return s;
}

// Read + parse a .strippack from a vault path. ZIPs are not accepted — the shop
// delivers a zip AROUND the pack; the user unzips it and drops the .strippack in.
async function _readPackAt(path) {
  if (String(path).toLowerCase().endsWith(".zip"))
    throw new Error("That's a ZIP archive — unzip it first, then put the .strippack in your Excalidraw scripts folder and import again.");
  return JSON.parse(await _vaultApp().vault.adapter.read(path));
}

// Decode a pack PNG payload and verify the PNG signature — returns the bytes, or
// null when the data is undecodable or not a PNG (never write garbage image files).
function _decodePng(dataUri) {
  try {
    const buf = _b64ToArrayBuffer(_dataURIPayload(dataUri));
    const v = new Uint8Array(buf);
    if (v.length >= 8 && v[0] === 0x89 && v[1] === 0x50 && v[2] === 0x4e && v[3] === 0x47) return buf;
  } catch (e) { /* undecodable */ }
  return null;
}

// Discover *.strippack files the user could import — THREE places, no
// recursion: the Excalidraw scripts folder itself, its Downloaded/ subfolder
// (where the script-store installs), and the script's own data folder
// ("Comic Strip Director (Library)", legacy names included). NOTE: Obsidian
// does not index unknown extensions, so vault.getFiles() can't see
// .strippack — we list the adapter.
async function listStrippackFiles() {
  const appRef = _vaultApp();
  if (!appRef || !appRef.vault || !appRef.vault.adapter) return [];
  const adapter = appRef.vault.adapter;
  const hits = new Set();
  const root = _scriptsRoot();
  const dirs = [root, root + "/Downloaded"];
  try { const b = await resolveBundleDir(); if (b && !dirs.includes(b)) dirs.push(b); } catch (e) { /* no bundle yet */ }
  for (const d of dirs) {
    try {
      if (!(await adapter.exists(d))) continue;
      const listing = await adapter.list(d);
      for (const f of (listing.files || [])) { if (String(f).toLowerCase().endsWith(".strippack")) hits.add(f); }
    } catch (e) { /* unreadable — skip */ }
  }
  return [...hits].sort();
}

// --- multi-pack import ------------------------------------------------------
// Import ONE .strippack, dispatched to the right installer for its declared
// format — character packs and FX packs can therefore be mixed in a batch.
// Returns a one-line summary; throws an Error with a friendly message.
const _CANCEL_MSG = "__import_cancelled__";
async function importPackFileAt(path, prog) {
  const base = String(path).split("/").pop();
  if (prog && prog.cancelled) throw new Error(_CANCEL_MSG);
  let pack;
  try { pack = await _readPackAt(path); }
  catch (e) { throw new Error(base + ": " + ((e && e.message) || "could not read or parse this file.")); }
  const onFig = (done, total) => {
    if (prog && prog.cancelled) throw new Error(_CANCEL_MSG);   // aborts before index merges — nothing half-written
    if (prog) prog.figures(done, total);
  };
  const fmt = pack ? String(pack.format || "") : "";
  if (fmt === PACK_FORMAT) {
    const res = await installPack(pack, onFig);
    const nothingNew = res.figsAdded === 0 && res.charsAdded === 0 && res.imagesWritten === 0 && !res.provenanceAdded;
    if (nothingNew) return `“${res.name}” was already installed (${res.imagesSkipped} figures present)`;
    const prov = res.provenanceAdded ? `, tagged ${res.provenanceAdded} existing figure(s)` : "";
    return `${res.name}: +${res.charsAdded} character(s), +${res.figsAdded} figure(s), ${res.imagesWritten} new image(s)${prov}`;
  }
  if (fmt === "strippack-fx/v1") {
    const res = await importFXPack(pack, onFig);
    return `${res.name}: +${res.added} FX (${res.written} images)`;
  }
  if (fmt.startsWith("strippack/") || fmt.startsWith("strippack-fx/"))
    throw new Error(base + ": needs a newer version of this script (" + fmt + ") — update Comic Strip Director.");
  throw new Error(base + ": not a Strip Director pack.");
}
// Import a batch of .strippack files sequentially, with per-file progress and a
// combined summary/failed notice at the end. Returns how many were attempted.
async function importPackFiles(files, prog) {
  const done = [], failed = [];
  let cancelled = false;
  for (let i = 0; i < files.length; i++) {
    if (prog && prog.cancelled) { cancelled = true; break; }
    const base = String(files[i]).split("/").pop();
    if (prog) prog.pack(i + 1, files.length, base);
    try { done.push(await importPackFileAt(files[i], prog)); }
    catch (e) {
      if (String(e && e.message) === _CANCEL_MSG) { cancelled = true; break; }
      failed.push(String((e && e.message) || base));
    }
    if (prog) prog.packDone(i + 1, files.length);
  }
  if (cancelled) new Notice(`Import cancelled — ${done.length} of ${files.length} pack(s) completed and kept. Import again to finish the rest (already-installed packs are skipped instantly).`, 10000);
  if (done.length) new Notice("Imported " + done.length + " pack(s):\n• " + done.join("\n• "), 10000);
  if (failed.length) new Notice("Skipped " + failed.length + " file(s):\n• " + failed.join("\n• "), 10000);
  return done.length + failed.length;
}
// Reload every data cache the importers can touch (characters AND FX).
async function reloadPackCaches() {
  await loadRoster(true); await loadAIFigures(true); await loadRosterLegacy(true); await loadFXFigures(true);
}
// Checkbox multi-select for pack files (import 25 packs in one go). All boxes
// start CHECKED — confirm-all is two clicks; uncheck to exclude. Resolves to the
// selected paths (possibly []), null on cancel, or undefined when the Modal API
// itself is unavailable (caller then falls back to the suggester).
function pickPacksMulti(files, title) {
  return new Promise((resolve) => {
    let M = null;
    try { M = ea.obsidian && ea.obsidian.Modal; } catch (e) { /* no modal */ }
    const appRef = _vaultApp();
    if (!M || !appRef) { resolve(undefined); return; }
    const base = (x) => String(x).split("/").pop();
    const chosen = new Set(files);
    let confirmed = false;
    const m = new M(appRef);
    m.onClose = () => { if (!confirmed) resolve(null); };
    m.titleEl.setText(title);
    const body = m.contentEl;
    const bar = body.createDiv();
    bar.style.cssText = "display:flex;gap:8px;align-items:center;margin:0 0 8px";
    const counter = bar.createEl("span", { text: `${chosen.size} of ${files.length} selected` });
    counter.style.cssText = "font-size:0.85em;color:var(--text-muted)";
    const toggleAll = bar.createEl("button", { text: "Toggle all" });
    toggleAll.style.marginLeft = "auto";
    const list = body.createDiv();
    list.style.cssText = "max-height:340px;overflow-y:auto;display:flex;flex-direction:column;gap:2px;border:1px solid var(--background-modifier-border);border-radius:5px;padding:6px";
    const boxes = [];
    const recount = () => { counter.setText(`${chosen.size} of ${files.length} selected`); };
    for (const f of files) {
      const row = list.createEl("label");
      row.style.cssText = "display:flex;gap:8px;align-items:center;cursor:pointer;padding:2px 4px";
      const cb = row.createEl("input");
      cb.type = "checkbox"; cb.checked = true;
      cb.addEventListener("change", () => { if (cb.checked) chosen.add(f); else chosen.delete(f); recount(); });
      boxes.push(cb);
      row.createEl("span", { text: base(f) });
    }
    toggleAll.addEventListener("click", () => {
      const check = chosen.size < files.length;   // any unchecked → check all, else clear
      boxes.forEach((cb, i) => { cb.checked = check; if (check) chosen.add(files[i]); else chosen.delete(files[i]); });
      recount();
    });
    const foot = body.createDiv();
    foot.style.cssText = "display:flex;gap:8px;justify-content:flex-end;margin:10px 0 0";
    const cancel = foot.createEl("button", { text: "Cancel" });
    cancel.addEventListener("click", () => m.close());
    const go = foot.createEl("button", { text: "Import selected" });
    go.classList.add("mod-cta");
    go.addEventListener("click", () => { confirmed = true; m.close(); resolve(files.filter((f) => chosen.has(f))); });
    m.open();
  });
}
// Progress overlay shown while packs import. It covers (and so LOCKS) the
// SECTION the import was started from — Characters for character packs, FX
// callouts for FX packs — with two bars: overall packs and the current pack's
// figures, plus a Cancel button. Cancelling stops between figures/packs;
// packs that already finished are kept. All DOM work is defensive so a
// headless/mocked environment degrades to a silent no-op.
function createImportProgress(hostEl) {
  let ov = null, bar1 = null, bar2 = null, l1 = null, l2 = null, cancelBtn = null, prevMinH = null;
  const api = { cancelled: false };
  const mkBar = (parent) => {
    const outer = parent.createDiv();
    outer.style.cssText = "width:88%;max-width:340px;height:8px;border-radius:4px;background:var(--background-modifier-border);overflow:hidden";
    const inner = outer.createDiv();
    inner.style.cssText = "width:0%;height:100%;border-radius:4px;background:var(--interactive-accent)";
    return inner;
  };
  try {
    if (hostEl && hostEl.style) {
      if (!hostEl.style.position) hostEl.style.position = "relative";
      prevMinH = hostEl.style.minHeight;
      hostEl.style.minHeight = "190px";          // room for the progress UI in short sections
    }
    ov = hostEl.createDiv();
    ov.style.cssText = "position:absolute;inset:0;z-index:50;background:var(--background-primary);opacity:0.97;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:18px;text-align:center";
    ov.createEl("div", { text: "Importing packs…" }).style.cssText = "font-weight:600;font-size:0.95em";
    l1 = ov.createEl("div", { text: "" }); l1.style.cssText = "font-size:0.78em;color:var(--text-muted)";
    bar1 = mkBar(ov);
    l2 = ov.createEl("div", { text: "" }); l2.style.cssText = "font-size:0.78em;color:var(--text-muted)";
    bar2 = mkBar(ov);
    cancelBtn = ov.createEl("button", { text: "✕ Cancel import" });
    cancelBtn.style.cssText = "margin-top:6px;font-size:0.75em;padding:3px 12px;border-radius:5px;cursor:pointer;border:1px solid var(--background-modifier-border);background:var(--background-secondary)";
    makeActivatable(cancelBtn, () => {
      api.cancelled = true;
      try { cancelBtn.setText("Cancelling…"); cancelBtn.style.opacity = "0.6"; cancelBtn.style.pointerEvents = "none"; } catch (e) { /* headless */ }
    });
    ov.createEl("div", { text: "This section is locked until the import finishes." }).style.cssText = "font-size:0.7em;color:var(--text-faint)";
  } catch (e) { ov = null; }
  const pct = (d, t) => (t > 0 ? Math.max(0, Math.min(100, Math.round((d / t) * 100))) : 0);
  api.pack = (i, n, name) => {
    try {
      if (l1) l1.setText(`Pack ${i} of ${n} — ${name}`);
      if (bar1) bar1.style.width = pct(i - 1, n) + "%";
      if (l2) l2.setText("Reading pack file…");
      if (bar2) bar2.style.width = "0%";
    } catch (e) { /* headless */ }
  };
  api.figures = (done, total) => {
    if (done % 25 !== 0 && done !== total) return;   // throttle DOM updates
    try {
      if (l2) l2.setText(`Figures ${done} / ${total}`);
      if (bar2) bar2.style.width = pct(done, total) + "%";
    } catch (e) { /* headless */ }
  };
  api.packDone = (i, n) => { try { if (bar1) bar1.style.width = pct(i, n) + "%"; if (bar2) bar2.style.width = "100%"; } catch (e) { /* headless */ } };
  api.done = () => {
    try { if (hostEl && hostEl.style && prevMinH != null) hostEl.style.minHeight = prevMinH; } catch (e) { /* headless */ }
    try { if (ov && ov.remove) ov.remove(); else if (ov && ov.parentNode) ov.parentNode.removeChild(ov); } catch (e) { /* gone */ }
  };
  return api;
}

// Lock SEVERAL sections at once during an import (characters + FX): one overlay
// per section, every call fanned out, cancel from either overlay stops the run.
function createImportProgressMulti(hosts) {
  const kids = (hosts || []).filter(Boolean).map((h) => createImportProgress(h));
  return {
    get cancelled() { return kids.some((k) => k.cancelled); },
    pack(i, n, name) { kids.forEach((k) => k.pack(i, n, name)); },
    figures(done, total) { kids.forEach((k) => k.figures(done, total)); },
    packDone(i, n) { kids.forEach((k) => k.packDone(i, n)); },
    done() { kids.forEach((k) => k.done()); },
  };
}

// --- free starter pack (two-file install) -----------------------------------
// The script ships with NO data folder — users copy just the .md and .svg. The
// free tier (Core Cast + FX) is fetched on demand from the repo and pushed
// through the NORMAL import pipeline (progress overlay, section locks, cancel,
// idempotent re-import). The downloaded .strippacks land in the scripts folder
// like any manually-dropped pack, so the manual route stays identical.
const FREE_PACK_URLS = [
  "https://raw.githubusercontent.com/iwanhoogendoorn/obsidian-excalidraw-plugin/main/ea-scripts/comic-strip-director/free/core-free.strippack",
  "https://raw.githubusercontent.com/iwanhoogendoorn/obsidian-excalidraw-plugin/main/ea-scripts/comic-strip-director/free/comic-fx-free.strippack",
];
const _FREE_MANUAL_HINT = "Get the packs manually instead: download them from the GitHub repo's free/ folder (or comicstripdirector.com), drop them in your Excalidraw scripts folder, then use ⬇ Import pack…";
function _freeTierInstalled() {
  try {
    const s = (ea.getScriptSettings && ea.getScriptSettings()) || {};
    return (s.installedPacks || []).some((r) => r && (r.product === "core-free" || r.packId === "core-free"));
  } catch (e) { return false; }
}
async function downloadFreeStarterPacks(makeProgress) {
  if (_importActive) { new Notice("An import is already running — wait for it to finish (or cancel it) first."); return false; }
  _importActive = true;
  const prog = makeProgress ? makeProgress() : null;
  try {
    const ad = _vaultApp() && _vaultApp().vault && _vaultApp().vault.adapter;
    if (!ad) { new Notice("No vault adapter available."); return false; }
    const req = ea.obsidian && ea.obsidian.requestUrl;
    const root = _scriptsRoot();
    const local = [];
    for (let i = 0; i < FREE_PACK_URLS.length; i++) {
      if (prog && prog.cancelled) return false;
      const url = FREE_PACK_URLS[i];
      const name = url.split("/").pop();
      const dest = root + "/" + name;
      if (prog) prog.pack(i + 1, FREE_PACK_URLS.length, name + " — downloading…");
      if (!(await ad.exists(dest))) {              // already downloaded earlier → reuse
        if (!req) { new Notice("This app version can't download files. " + _FREE_MANUAL_HINT, 12000); return false; }
        try {
          const res = await req({ url, throw: true });
          await ad.writeBinary(dest, res.arrayBuffer);
        } catch (e) {
          console.error("Strip Director: free pack download failed", url, e);
          new Notice(name + ": download failed — check your internet connection. " + _FREE_MANUAL_HINT, 12000);
          return false;
        }
      }
      local.push(dest);
      if (prog) prog.packDone(i + 1, FREE_PACK_URLS.length);
    }
    if (prog && prog.cancelled) return false;
    return (await importPackFiles(local, prog)) > 0;
  } finally { _importActive = false; if (prog) prog.done(); }
}

// --- pack provenance → website product (picker filter sections) -------------
// Split packs stamp each figure with their PART id (e.g. "fantasy-wizard");
// the website sells the parent PRODUCT ("Fantasy Pack"). This static catalog
// mirrors comicstripdirector.com; installedPacks records (which carry the
// `product` field from the pack file) take precedence, so future packs group
// correctly without a script update. Order here = chip display order.
const PACK_PRODUCTS = [
  { id: "core-free", nm: "Original Cast (free)" },
  { id: "core-new", nm: "Original Cast" },
  { id: "core-legacy", nm: "Original Cast — Legacy" },
  { id: "fantasy", nm: "Fantasy Pack" },
  { id: "sci-fi", nm: "Sci-Fi Pack" },
  { id: "action-heroes", nm: "Action Heroes Pack" },
  { id: "professions", nm: "Professions Pack" },
  { id: "comic-fx", nm: "Comic FX Pack" },
  { id: "founding-eight", nm: "Founding Eight" },
  { id: "everything-premium", nm: "Everything Bundle" },
  { id: "everything", nm: "Everything Bundle" },
  { id: "all-new", nm: "All Characters — New Style" },
  { id: "all-legacy", nm: "All Characters — Legacy" },
];
function _installedPackProducts() {
  const map = new Map();
  try {
    const s = (ea.getScriptSettings && ea.getScriptSettings()) || {};
    for (const r of (s.installedPacks || [])) if (r && r.packId) map.set(r.packId, r.product || r.packId);
  } catch (e) { /* no settings */ }
  return map;
}
function packProductOf(packId, installed) {
  if (!packId) return "";                        // pre-pack / dev-library content
  if (installed && installed.has(packId)) return installed.get(packId);
  for (const p of PACK_PRODUCTS) if (packId === p.id || packId.startsWith(p.id + "-")) return p.id;
  return packId;                                  // per-character packs are their own product
}
function packProductLabel(product) {
  if (!product) return "My library";
  const hit = PACK_PRODUCTS.find((p) => p.id === product);
  if (hit) return hit.nm;
  let m = /^char-(.+)$/.exec(product);
  if (m) return prettyId(m[1]) + " — Character Pack";
  m = /^legacy-(.+)$/.exec(product);
  if (m) return prettyId(m[1]) + " — Legacy";
  return prettyId(product);
}

let _importActive = false;   // one import at a time — the other section stays usable but can't start a second import
// Shared import-button flow: list packs → multi-select (checkboxes) → install
// every selected pack. Single pack skips straight to a confirm suggester; if the
// Modal API is unavailable the suggester fallback offers one-or-ALL.
// `makeProgress` builds the section-locking overlay once files are actually chosen.
// Returns true when at least one import was attempted (caller then repaints).
async function importPacksFlow(placeholder, makeProgress) {
  // Claim the import slot for the WHOLE flow (picker included) — otherwise two
  // pickers opened side by side could both proceed to import.
  if (_importActive) { new Notice("An import is already running — wait for it to finish (or cancel it) first."); return false; }
  _importActive = true;
  try {
    const files = await listStrippackFiles();
    if (!files.length) {
      new Notice("No .strippack files found in your Excalidraw scripts folder, Scripts/Downloaded, or the Comic Strip Director (Library) folder. Unzip the product download, copy the .strippack into one of those with Finder/Explorer (drag-dropping onto Obsidian silently ignores it), then retry.", 9000);
      return false;
    }
    const base = (x) => String(x).split("/").pop();
    const runImport = async (targets) => {
      const prog = makeProgress ? makeProgress() : null;
      try { return (await importPackFiles(targets, prog)) > 0; }
      finally { if (prog) prog.done(); }
    };
    if (files.length === 1) {
      const one = await pickFromList(files, files.map(base), placeholder);
      return one ? await runImport([one]) : false;
    }
    const picked = await pickPacksMulti(files, placeholder);
    if (picked === undefined) {                  // no Modal API — suggester with an "Import ALL" row
      const ALL = "__import_all__";
      const chosen = await pickFromList([ALL, ...files], [`⬇ Import ALL ${files.length} packs`, ...files.map(base)], placeholder);
      if (!chosen) return false;
      return await runImport(chosen === ALL ? files : [chosen]);
    }
    if (!picked || !picked.length) return false; // cancelled, or everything unchecked
    return await runImport(picked);
  } finally { _importActive = false; }
}

// Snapshot a vault file to a single rolling .import-backup sibling (bounded — one
// pre-import snapshot per file, overwritten each import, so backups never pile up).
async function _backupVaultFile(adapter, path) {
  try {
    if (!(await adapter.exists(path))) return;
    await adapter.write(path + ".import-backup", await adapter.read(path));
  } catch (e) { /* non-fatal */ }
}

// Ensure a (possibly nested) folder exists under the vault — creates each level.
async function _ensureDir(adapter, dir) {
  if (!dir) return;
  const parts = String(dir).split("/").filter(Boolean);
  let cur = "";
  for (const p of parts) {
    cur = cur ? cur + "/" + p : p;
    try { if (!(await adapter.exists(cur))) await adapter.mkdir(cur); } catch (e) { /* may already exist */ }
  }
}

// First existing path in candidate order, else the first candidate (the write target).
// Mirrors the loader candidate order so a merge reads+writes the SAME file the picker
// loaded from — otherwise installing could shadow a library loaded from a fallback path.
async function _resolveIndexPath(adapter, candidates) {
  for (const p of candidates) { try { if (await adapter.exists(p)) return p; } catch (e) { /* next */ } }
  return candidates[0];
}

// Read an existing JSON index. Returns null if absent; THROWS if it exists but does
// not parse — never silently treat a corrupt live index as empty (that would let the
// merge overwrite and discard the user's real library).
async function _readIndexOrThrow(adapter, path, label) {
  if (!(await adapter.exists(path))) return null;
  const raw = await adapter.read(path);
  try { return JSON.parse(raw); }
  catch (e) { throw new Error("Existing " + label + " at \"" + path + "\" is not valid JSON — aborting import so your library is not overwritten (a .import-backup sibling may hold a good copy)."); }
}

// Write JSON through a verified temp file, then commit. Not a true rename-swap, but the
// serialization is proven to round-trip before the live file is touched, and a rolling
// .import-backup already exists — so a corrupt or half-written index cannot slip in.
async function _writeIndexSafely(adapter, path, obj) {
  const json = JSON.stringify(obj);
  const tmp = path + ".tmp-write";
  await adapter.write(tmp, json);
  JSON.parse(await adapter.read(tmp));            // verify it round-trips
  await adapter.write(path, json);                // commit (json known-good)
  try { if (await adapter.exists(tmp)) await adapter.remove(tmp); } catch (e) { /* leave temp */ }
}

// Reconstitute a manifest row from a pack figure entry (adds pack provenance).
function _figureToManifestRow(f, packId) {
  return {
    id: f.id, name: f.name, base: f.base, baseName: f.baseName,
    character: f.character || null, function: f.function || null, action: f.action || null,
    cacheKey: f.cacheKey, file: f.file, w: f.w, h: f.h, lib: f.lib, pack: packId,
    packs: [packId],
  };
}

// Install a parsed .strippack into this bundle. Returns a summary of what changed.
// Idempotent: existing images / cacheKeys / roster ids are skipped, so re-importing
// the same pack (or importing on the author's own full library) is a safe no-op.
async function installPack(pack, onProgress) {
  const appRef = _vaultApp();
  const adapter = appRef && appRef.vault && appRef.vault.adapter;
  if (!adapter) throw new Error("No vault adapter available.");
  if (!pack || pack.format !== PACK_FORMAT) {
    const fmt = pack && String(pack.format || "");
    if (fmt && fmt.startsWith("strippack/")) throw new Error("This pack uses a newer format (" + fmt + ") — update the Comic Strip Director script, then import again.");
    throw new Error("Not a Strip Director pack (expected " + PACK_FORMAT + ").");
  }
  const dir = _aiDir();

  // 0) Read (and validate) BOTH index files before any file is written — a corrupt
  //    index aborts the import with zero side effects (no orphaned images).
  const rosterPath = await _resolveIndexPath(adapter, [dir + "/" + ROSTER_FILE, ROSTER_FILE, "AI Figures/" + ROSTER_FILE]);
  const roster = (await _readIndexOrThrow(adapter, rosterPath, "roster.json")) || { characters: [], functions: [], actions: [] };
  roster.characters = (roster.characters || []).filter(Boolean);
  roster.functions = (roster.functions || []).filter(Boolean);
  roster.actions = (roster.actions || []).filter(Boolean);
  const manifestPath = await _resolveIndexPath(adapter, [dir + "/" + AI_MANIFEST, AI_MANIFEST, "AI Figures/" + AI_MANIFEST]);
  const manifest = (await _readIndexOrThrow(adapter, manifestPath, "ai-figures.json")) || { figures: [] };
  manifest.figures = (manifest.figures || []).filter(Boolean);
  await _ensureDir(adapter, dir);

  // 1) Write figure images (PNG required, SVG optional). Skip ones already present.
  //    `available` = figures whose PNG is on disk after this step (written or pre-existing);
  //    only those earn a manifest row, so a png-less entry can't create a broken thumbnail.
  let imagesWritten = 0, imagesSkipped = 0;
  const available = new Set();
  const figs = Array.isArray(pack.figures) ? pack.figures.filter((f) => f && typeof f === "object") : [];

  // Pre-list the target sub-folders once and pre-create them, so the per-figure loop
  // is pure in-memory membership checks + writes — no exists() round-trip per image.
  // Paths are normalized so membership matches adapter.list output regardless of how a
  // pack authored f.file (leading/duplicate slashes, ./ etc).
  const norm = (p) => { try { return ea.obsidian.normalizePath(p); } catch (e) { return String(p).replace(/\\/g, "/").replace(/\/{2,}/g, "/").replace(/^\.\//, ""); } };
  const onDisk = new Set();                       // normalized abs paths already present
  const subdirs = new Set();
  for (const f of figs) { const rel = _safePackRel(f.file) || ""; subdirs.add(rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : ""); }
  for (const sd of subdirs) {
    const full = norm(sd ? dir + "/" + sd : dir);
    await _ensureDir(adapter, full);
    try { const l = await adapter.list(full); (l.files || []).forEach((p) => onDisk.add(norm(p))); } catch (e) { /* empty dir */ }
  }
  // Existing manifest rows per file path — used to detect cross-pack path collisions.
  const fileOwners = new Map();
  for (const m of manifest.figures) if (m && m.file) { const k = norm(dir + "/" + m.file); if (!fileOwners.has(k)) fileOwners.set(k, m.cacheKey || m.id); }

  for (let i = 0; i < figs.length; i++) {
    const f = figs[i];
    let rel = _safePackRel(f.file);              // bundle-relative, e.g. "New Figures/x.png"
    if (!rel) { if (onProgress) onProgress(i + 1, figs.length); continue; }
    // Cross-pack collision: the path already exists on disk but belongs to a DIFFERENT
    // figure (other cacheKey) — write this pack's art under a pack-suffixed name instead
    // of silently reusing foreign artwork. Same-figure overlap (dedupe) is untouched.
    const key = f.cacheKey || f.id;
    const owner = fileOwners.get(norm(dir + "/" + rel));
    if (owner && key && owner !== key && f.png) {
      const dot = rel.lastIndexOf(".");
      const suffixed = dot > 0 ? rel.slice(0, dot) + "-" + String(pack.packId || "pack") + rel.slice(dot) : rel + "-" + String(pack.packId || "pack");
      rel = _safePackRel(suffixed) || rel;
    }
    f.file = rel;                                // manifest rows keep the sanitised path
    const relSvg = _safePackRel(f.fileSvg);
    const abs = norm(dir + "/" + rel);
    const svgAbs = relSvg ? norm(dir + "/" + relSvg) : null;
    let present = onDisk.has(abs);
    if (present) imagesSkipped++;                 // a genuinely pre-existing image
    try {
      if (f.png && !present) {
        const bytes = _decodePng(f.png);
        if (bytes) { await adapter.writeBinary(abs, bytes); onDisk.add(abs); imagesWritten++; present = true; }
      }
      if (f.svg && svgAbs && !onDisk.has(svgAbs)) {
        await adapter.writeBinary(svgAbs, _b64ToArrayBuffer(_dataURIPayload(f.svg)));
        onDisk.add(svgAbs);
      }
    } catch (e) { /* write failed — leave counters untouched, figure just isn't available */ }
    if (present && (f.cacheKey || f.id)) available.add(f.cacheKey || f.id);
    if (onProgress) onProgress(i + 1, figs.length);
  }

  // 2) Merge roster.json (pre-read + validated in step 0) — back up, then commit
  //    through a verified temp write.
  await _backupVaultFile(adapter, rosterPath);
  const merge = (arr, incoming, tag) => {
    const have = new Set(arr.map((x) => x && x.id).filter(Boolean));
    let added = 0;
    for (const x of (Array.isArray(incoming) ? incoming : [])) {
      if (x && x.id && !have.has(x.id)) { arr.push(tag ? { ...x, pack: pack.packId } : { ...x }); have.add(x.id); added++; }
    }
    return added;
  };
  const charsAdded = merge(roster.characters, pack.characters, true);
  merge(roster.functions, pack.functions, false);
  merge(roster.actions, pack.actions, false);
  await _writeIndexSafely(adapter, rosterPath, roster);

  // 3) Merge ai-figures.json manifest (only figures whose image is actually on disk).
  await _backupVaultFile(adapter, manifestPath);
  const rowByKey = new Map();
  for (const x of manifest.figures) { const k = x && (x.cacheKey || x.id); if (k && !rowByKey.has(k)) rowByKey.set(k, x); }
  let figsAdded = 0, provenanceAdded = 0;
  for (const f of figs) {
    const key = f.cacheKey || f.id;
    if (!key || !available.has(key)) continue;
    const row = rowByKey.get(key);
    if (!row) {
      const nr = _figureToManifestRow(f, pack.packId);
      manifest.figures.push(nr); rowByKey.set(key, nr); figsAdded++;
    } else {
      // Figure already owned (e.g. the all-new bundle) — RECORD this pack as an
      // additional owner so a later theme pack still gets its own picker section.
      if (!Array.isArray(row.packs)) row.packs = row.pack ? [row.pack] : [];
      if (!row.packs.includes(pack.packId)) { row.packs.push(pack.packId); provenanceAdded++; }
    }
  }
  await _writeIndexSafely(adapter, manifestPath, manifest);

  // 4) Record the installed pack in script settings (keyed by packId; parts of a split
  //    pack share `product`). Re-importing the same packId just refreshes the record.
  let alreadyInstalled = false;
  try {
    const s = (ea.getScriptSettings && ea.getScriptSettings()) || {};
    s.installedPacks = Array.isArray(s.installedPacks) ? s.installedPacks : [];
    const idx = s.installedPacks.findIndex((p) => p.packId === pack.packId);
    alreadyInstalled = idx >= 0 && s.installedPacks[idx].version === pack.version;
    const rec = { packId: pack.packId, product: pack.product || pack.packId, name: pack.name, version: pack.version, tier: pack.tier, figures: figs.length, installedAt: new Date().toISOString() };
    if (idx >= 0) s.installedPacks[idx] = rec; else s.installedPacks.push(rec);
    ea.setScriptSettings(s);
  } catch (e) { /* settings unavailable — non-fatal */ }

  return { packId: pack.packId, name: pack.name, imagesWritten, imagesSkipped, charsAdded, figsAdded, provenanceAdded, alreadyInstalled };
}

// --- Enable / disable characters (persisted in script settings) -------------
function getDisabledChars() {
  try {
    const s = (ea.getScriptSettings && ea.getScriptSettings()) || {};
    return new Set(Array.isArray(s.disabledCharacters) ? s.disabledCharacters : []);
  } catch (e) { return new Set(); }
}
function setCharDisabled(id, disabled) {
  try {
    const s = (ea.getScriptSettings && ea.getScriptSettings()) || {};
    const set = new Set(Array.isArray(s.disabledCharacters) ? s.disabledCharacters : []);
    if (disabled) set.add(id); else set.delete(id);
    s.disabledCharacters = [...set];
    ea.setScriptSettings(s);
  } catch (e) { /* non-fatal */ }
}

// Cache key for a combination — matches compose-character.js (character-function-action).
function comboKey(character, func, action) {
  return [character, func, action].filter(Boolean).join("-");
}
// Find a cached composed figure for a combination (by cacheKey or id).
// `prefix` namespaces the lookup so the Legacy library (whose ids/cacheKeys are
// stored as "legacy-…") can be resolved alongside the New library.
function findComposed(character, func, action, prefix) {
  if (!AI_FIGURES) return null;
  const key = (prefix || "") + comboKey(character, func, action);
  return AI_FIGURES.figures.find((f) => f.cacheKey === key || f.id === key) || null;
}

// ===========================================================================
// SECTION C — STAMP  (clone a figure's elements into a panel; one commit)
//   Recipe from the ea-insert notes. Injects foreign element objects
//   into ea.elementsDict with fresh ids + remapped refs, scaled to fit, then
//   the caller commits ONCE. Keeps seed/colours/roughness verbatim (his art).
// ===========================================================================
function stampFigure(ea, figure, panel, panelIdx, half, page) {
  const s = Math.min(panel.w / figure.w, panel.h / figure.h) * FIT_PAD;
  const dx = panel.x + (panel.w - figure.w * s) / 2;
  const dy = panel.y + (panel.h - figure.h * s) / 2;

  const idMap = new Map();
  for (const el of figure.elements) idMap.set(el.id, ea.generateElementId());
  const groupMap = new Map();
  const remapGroup = (g) => {
    if (!groupMap.has(g)) groupMap.set(g, ea.generateElementId());
    return groupMap.get(g);
  };
  const sharedGroupId = ea.generateElementId();
  const remap = (oldId) => idMap.get(oldId) || oldId;

  const newIds = [];
  for (const src of figure.elements) {
    const el = JSON.parse(JSON.stringify(src));
    el.id = idMap.get(src.id);
    el.versionNonce = Math.floor(Math.random() * 1000000000);
    el.version = (src.version || 1) + 1;
    el.updated = Date.now();
    delete el.index;
    // keep el.seed verbatim — byte-identical roughjs jitter (his look)

    el.groupIds = [ ...(src.groupIds || []).map(remapGroup), sharedGroupId ];
    if (src.containerId) el.containerId = remap(src.containerId);
    if (src.frameId) el.frameId = remap(src.frameId);
    if (Array.isArray(src.boundElements)) el.boundElements = src.boundElements.map((b) => ({ ...b, id: remap(b.id) }));
    if (src.startBinding) el.startBinding = { ...src.startBinding, elementId: remap(src.startBinding.elementId) };
    if (src.endBinding) el.endBinding = { ...src.endBinding, elementId: remap(src.endBinding.elementId) };

    el.x = dx + src.x * s;
    el.y = dy + src.y * s;
    if (typeof src.width === "number") el.width = src.width * s;
    if (typeof src.height === "number") el.height = src.height * s;
    if (Array.isArray(src.points)) el.points = src.points.map(([px, py]) => [px * s, py * s]);
    if (typeof src.fontSize === "number") el.fontSize = src.fontSize * s;
    if (typeof src.strokeWidth === "number") el.strokeWidth = Math.max(0.5, src.strokeWidth * s);

    ea.elementsDict[el.id] = el;
    newIds.push(el.id);
  }
  const tag = { role: "figure", panel: panelIdx, page: page === undefined ? (state.page || 0) : page };
  if (half !== undefined) tag.half = half;
  tagStripDirector(ea, newIds, tag);
  return newIds;
}

// ===========================================================================
// SECTION D — CONTROLLER
// ===========================================================================
const state = {
  layoutId: null,
  panels: [],            // [{rect, index, page, frameIds, figureIds, zoneIds, split, subpanels}]
  origin: { x: 0, y: 0 },
  page: 0,               // current page id = the page's y-origin (0 for the first page)
  activePanel: 0,
};

function clampIdx(i) {
  const n = state.panels.length;
  if (!n) return 0;
  return Math.max(0, Math.min(n - 1, i));
}
// Look a panel up by its INDEX (array position only matches while the page is
// contiguous — after a reload with a deleted outline the array has gaps).
function panelByIndex(idx, page) {
  return state.panels.find((x) => x.index === idx && (page === undefined || (x.page || 0) === (page || 0)))
    || state.panels[idx] || null;
}
function getActivePanelIndex() {
  try {
    const sel = ea.getViewSelectedElements ? ea.getViewSelectedElements() : [];
    for (const el of sel) {
      const sd = el.customData && el.customData.stripDirector;
      if (!sd) continue;
      if ((sd.page || 0) !== (state.page || 0)) continue;   // selection on another page — ignore
      if (sd.role === "panel" && typeof sd.index === "number") return clampIdx(sd.index);
      if (typeof sd.panel === "number") return clampIdx(sd.panel);
    }
  } catch (e) { /* no selection */ }
  return clampIdx(typeof state.activePanel === "number" ? state.activePanel : 0);
}
// Inner box where a figure is placed inside a region (leaves a margin all round).
function figureBox(rect) {
  return { x: rect.x + rect.w * 0.08, y: rect.y + rect.h * 0.10, w: rect.w * 0.84, h: rect.h * 0.80 };
}

// --- split sub-region geometry (FIX 2: place figures INSIDE a split half) ---
function polyCentroid(poly) {
  let x = 0, y = 0;
  for (const p of poly) { x += p[0]; y += p[1]; }
  return [x / poly.length, y / poly.length];
}
function pointInPoly(pt, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    const hit = ((yi > pt[1]) !== (yj > pt[1])) &&
      (pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi);
    if (hit) inside = !inside;
  }
  return inside;
}
// Largest-ish axis-aligned box inside a (convex) polygon — grow from the centroid.
function inscribedBox(poly) {
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const c = polyCentroid(poly);
  if (!pointInPoly(c, poly)) return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  let L = c[0], R = c[0], T = c[1], B = c[1];
  const sx = (maxX - minX) / 48 || 1, sy = (maxY - minY) / 48 || 1;
  const ok = (l, r, t, b) =>
    pointInPoly([l, t], poly) && pointInPoly([r, t], poly) &&
    pointInPoly([r, b], poly) && pointInPoly([l, b], poly) &&
    pointInPoly([(l + r) / 2, t], poly) && pointInPoly([(l + r) / 2, b], poly) &&
    pointInPoly([l, (t + b) / 2], poly) && pointInPoly([r, (t + b) / 2], poly);
  let grew = true, guard = 0;
  while (grew && guard++ < 600) {
    grew = false;
    if (L - sx > minX && ok(L - sx, R, T, B)) { L -= sx; grew = true; }
    if (R + sx < maxX && ok(L, R + sx, T, B)) { R += sx; grew = true; }
    if (T - sy > minY && ok(L, R, T - sy, B)) { T -= sy; grew = true; }
    if (B + sy < maxY && ok(L, R, T, B + sy)) { B += sy; grew = true; }
  }
  return { x: L, y: T, w: R - L, h: B - T };
}

// --- placement SLOTS (FIX: figures fill the next empty space, never overwrite) -
// A plain panel is one slot; a split panel is one slot PER sub-region (its
// inscribed box, already centred off the divider line). Occupancy is read live
// from the canvas (occupiedSlots), so each +Figure advances to the next empty one.
function slotKey(page, panelIdx, half) { return (page || 0) + "/" + panelIdx + ":" + (half === undefined ? "_" : half); }
function panelSlots(p) {
  if (p.subpanels && p.subpanels.length) {
    return p.subpanels.map((s) => ({ page: p.page || 0, panelIdx: p.index, half: s.half, region: s.box }));
  }
  return [{ page: p.page || 0, panelIdx: p.index, half: undefined, region: p.rect }];
}
function allSlots() {
  const slots = [];
  for (const p of state.panels) slots.push(...panelSlots(p));
  return slots;
}
// Live occupancy: a slot counts as full ONLY if a figure element is actually on
// the canvas right now. Reading the view each time (instead of a cached Set) means
// deleting a figure frees its slot — so re-adding drops straight back in, no stale
// "all boxes filled".
function occupiedSlots() {
  const occ = new Set();
  try {
    const els = ea.getViewElements ? ea.getViewElements() : [];
    for (const el of els) {
      if (!el || el.isDeleted) continue;
      const sd = el.customData && el.customData.stripDirector;
      if (sd && sd.role === "figure" && typeof sd.panel === "number") occ.add(slotKey(sd.page, sd.panel, sd.half));
    }
  } catch (e) { /* view unavailable */ }
  return occ;
}
function nextEmptySlot() {
  const occ = occupiedSlots();
  for (const s of allSlots()) if (!occ.has(slotKey(s.page, s.panelIdx, s.half))) return s;
  return null;
}

// Rehydrate state.panels from the canvas. After the script is reloaded or a saved
// drawing is reopened, the in-memory state is empty even though the tagged panel
// outlines are still on the canvas — which made placement wrongly report "build a
// strip first". We rebuild the panel list (and any split sub-regions) from the
// customData tags so an existing strip is recognised without rebuilding it.
function syncPanelsFromCanvas() {
  try {
    const els = ea.getViewElements ? ea.getViewElements() : [];
    const byIndex = {};
    const panels = [];
    for (const el of els) {
      if (!el || el.isDeleted) continue;
      const sd = el.customData && el.customData.stripDirector;
      if (sd && sd.role === "panel" && typeof sd.index === "number" && !byIndex[sd.index]) {
        // Prefer the stored polygon's inscribed box (angled panels); fall back to the
        // element's bounding box for older/rectangular panels.
        const rect = (sd.poly && sd.poly.length >= 3)
          ? Object.assign(panelPlacementBox(sd.poly), { index: sd.index })
          : { x: el.x, y: el.y, w: el.width, h: el.height, index: sd.index };
        const p = { rect, poly: sd.poly || null, index: sd.index, frameIds: [el.id], figureIds: [], zoneIds: [], split: "none", subpanels: [] };
        byIndex[sd.index] = p; panels.push(p);
      }
    }
    for (const el of els) {
      if (!el || el.isDeleted) continue;
      const sd = el.customData && el.customData.stripDirector;
      if (sd && sd.role === "subpanel" && typeof sd.panel === "number" && byIndex[sd.panel]) {
        byIndex[sd.panel].subpanels.push({ half: sd.half, box: { x: el.x, y: el.y, w: el.width, h: el.height } });
        byIndex[sd.panel].split = "manual";
      }
    }
    panels.sort((a, b) => a.index - b.index);
    if (panels.length) state.panels = panels;
    return panels.length;
  } catch (e) { return 0; }
}

// Resolve where the next figure / callout zone goes.
//   opts.forFigure → honour an explicitly selected EMPTY panel/region, else fall
//   to the next empty slot (never overwrite); null when every slot is full.
//   Otherwise (callout zones) → selected sub-region, else the active panel.
// Returns { panelIdx, half, region, explicit?|auto?|defaulted? }.
function getPlacementContext(opts) {
  const forFigure = opts && opts.forFigure;
  // Recognise an existing strip on the canvas even if this is a fresh script load
  // (in-memory panels empty but the tagged outlines are still there).
  if (!state.panels || !state.panels.length) syncPanelsFromCanvas();
  const occ = forFigure ? occupiedSlots() : null;   // live canvas occupancy
  // 1. Explicit selection of a split sub-region always wins.
  try {
    const sel = ea.getViewSelectedElements ? ea.getViewSelectedElements() : [];
    for (const el of sel) {
      const sd = el.customData && el.customData.stripDirector;
      if (!sd) continue;
      const selPage = sd.page || 0;
      if (sd.role === "subpanel" && typeof sd.panel === "number") {
        // The selected element itself carries its geometry — works across pages.
        const region = { x: el.x, y: el.y, w: el.width, h: el.height };
        if (!forFigure || !occ.has(slotKey(selPage, sd.panel, sd.half)))
          return { page: selPage, panelIdx: sd.panel, half: sd.half, region, explicit: true };
      }
      // An explicitly selected panel outline targets that panel (its first empty
      // region when split). For figures a full panel falls through to auto-advance.
      if (sd.role === "panel" && typeof sd.index === "number") {
        const p = state.panels.find((x) => x.index === sd.index && (x.page || 0) === selPage);
        if (p && p.subpanels && p.subpanels.length) {
          const sub = forFigure
            ? p.subpanels.find((s) => !occ.has(slotKey(selPage, p.index, s.half)))
            : p.subpanels[0];
          if (sub) return { page: selPage, panelIdx: p.index, half: sub.half, region: sub.box, explicit: true };
        } else if (!forFigure || !occ.has(slotKey(selPage, sd.index, undefined))) {
          // Even when the panel isn't in in-memory state (other page after reload),
          // the element carries its own geometry.
          const region = (p && p.rect) || ((sd.poly && sd.poly.length >= 3) ? panelPlacementBox(sd.poly) : { x: el.x, y: el.y, w: el.width, h: el.height });
          return { page: selPage, panelIdx: sd.index, half: undefined, region, explicit: true };
        }
      }
    }
  } catch (e) { /* no selection */ }

  // 2. Figures: auto-advance to the next empty slot (don't overwrite).
  if (forFigure) {
    const slot = nextEmptySlot();
    return slot ? { page: slot.page, panelIdx: slot.panelIdx, half: slot.half, region: slot.region, auto: true } : null;
  }

  // 3. Callout zones / default: the active panel (first region if split).
  const idx = getActivePanelIndex();
  const panel = panelByIndex(idx);
  if (!panel) return null;
  if (panel.subpanels && panel.subpanels.length) {
    const sub = panel.subpanels[0]; // split panel, no half chosen -> default to first
    return { page: panel.page || 0, panelIdx: idx, half: sub.half, region: sub.box, defaulted: true };
  }
  return { page: panel.page || 0, panelIdx: idx, half: undefined, region: panel.rect };
}

// Commit the EA workbench once. `onTop` puts figures above the panel frames.
async function commit(onTop) {
  await ea.addElementsToView(false, true, !!onTop);
  if (ea.clear) ea.clear();
}

// Frame elements in the viewport (zoom-to-fit). Pass the ids to focus, or call
// with no args to fit every Strip Director element on the canvas. Templates are
// drawn at a fixed 1320px width, so without this the strip overflows a 100% view.
function fitToView(ids) {
  try {
    const api = ea.getExcalidrawAPI && ea.getExcalidrawAPI();
    if (!api || !api.scrollToContent) return;
    const all = ea.getViewElements ? ea.getViewElements() : api.getSceneElements();
    let els = ids && ids.length ? all.filter((el) => ids.includes(el.id)) : null;
    if (!els || !els.length) els = all.filter((el) => el.customData && el.customData.stripDirector);
    if (!els || !els.length) return;
    api.scrollToContent(els, { fitToContent: true, animate: true });
  } catch (e) { console.error("Strip Director fit-to-view failed", e); }
}

// Where the next page is drawn: below any Strip Director content already on the
// canvas (so building again stacks a new page down the canvas instead of on top of
// the last one). Returns {x:0,y:0} for the first page.
function nextPageOrigin() {
  try {
    const els = ea.getViewElements ? ea.getViewElements() : [];
    let maxY = null;
    for (const el of els) {
      if (!el || el.isDeleted) continue;
      const sd = el.customData && el.customData.stripDirector;
      if (!sd) continue;
      const bottom = el.y + (el.height || 0);
      if (maxY === null || bottom > maxY) maxY = bottom;
    }
    return maxY === null ? { x: 0, y: 0 } : { x: 0, y: maxY + 90 };
  } catch (e) { return { x: 0, y: 0 }; }
}

// ===========================================================================
// SECTION A2 — LAYOUT CATALOG + GENERATOR + POLYGON PANELS
//   30 named templates (grids, mixed, angled, splash) as normalized 0..1
//   polygons, plus a parametric generator (any N panels). Panels can be
//   arbitrary polygons; placement uses each panel's inscribed box, so the
//   existing figure/zone/slot machinery works unchanged on angled panels.
// ===========================================================================
const _R = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
const _grid = (cols, rows) => {
  const o = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) o.push(_R(c / cols, r / rows, 1 / cols, 1 / rows));
  return o;
};
const LAYOUT_CATALOG = [
  { id: "g-2x2", nm: "2 × 2", grp: "Grids", asp: "sq", p: _grid(2, 2) },
  { id: "g-3col", nm: "3 columns", grp: "Grids", asp: "ld", p: _grid(3, 1) },
  { id: "g-3row", nm: "3 rows", grp: "Grids", asp: "pt", p: _grid(1, 3) },
  { id: "g-4strip", nm: "4-strip", grp: "Grids", asp: "ld", p: _grid(4, 1) },
  { id: "g-2x3", nm: "2 × 3", grp: "Grids", asp: "pt", p: _grid(2, 3) },
  { id: "g-3x3", nm: "3 × 3", grp: "Grids", asp: "sq", p: _grid(3, 3) },
  { id: "g-2x4", nm: "2 × 4", grp: "Grids", asp: "pt", p: _grid(2, 4) },
  { id: "g-3x2", nm: "3 × 2", grp: "Grids", asp: "ld", p: _grid(3, 2) },
  { id: "m-bigL2", nm: "Big left + 2", grp: "Mixed", asp: "ld", p: [_R(0, 0, .5, 1), _R(.5, 0, .5, .5), _R(.5, .5, .5, .5)] },
  { id: "m-2bigR", nm: "2 + big right", grp: "Mixed", asp: "ld", p: [_R(0, 0, .5, .5), _R(0, .5, .5, .5), _R(.5, 0, .5, 1)] },
  { id: "m-wideTop3", nm: "Wide top + 3", grp: "Mixed", asp: "pt", p: [_R(0, 0, 1, .42), _R(0, .44, .3333, .56), _R(.3334, .44, .3333, .56), _R(.6667, .44, .3333, .56)] },
  { id: "m-212", nm: "2·1·2 hero", grp: "Mixed", asp: "pt", p: [_R(0, 0, .5, .3), _R(.5, 0, .5, .3), _R(0, .32, 1, .36), _R(0, .7, .5, .3), _R(.5, .7, .5, .3)] },
  { id: "m-221", nm: "Manga 2·2·1", grp: "Mixed", asp: "pt", p: [_R(0, 0, .5, .3), _R(.5, 0, .5, .3), _R(0, .32, .5, .3), _R(.5, .32, .5, .3), _R(0, .64, 1, .36)] },
  { id: "m-tallL", nm: "Tall-L + stack + row", grp: "Mixed", asp: "pt", p: [_R(0, 0, .42, .62), _R(.44, 0, .56, .3), _R(.44, .32, .56, .3), _R(0, .64, .3333, .36), _R(.3334, .64, .3333, .36), _R(.6667, .64, .3333, .36)] },
  { id: "m-narrowL", nm: "Narrow L + big + 2", grp: "Mixed", asp: "pt", p: [_R(0, 0, .28, .6), _R(.3, 0, .7, .6), _R(0, .62, .5, .38), _R(.5, .62, .5, .38)] },
  { id: "m-w2w", nm: "Wide·2·wide", grp: "Mixed", asp: "pt", p: [_R(0, 0, 1, .28), _R(0, .3, .5, .4), _R(.5, .3, .5, .4), _R(0, .72, 1, .28)] },
  { id: "m-222", nm: "Manga 2·2·2", grp: "Mixed", asp: "pt", p: _grid(2, 3) },
  { id: "m-Lhero3", nm: "L-hero + 3", grp: "Mixed", asp: "sq", p: [_R(0, 0, .66, .66), _R(.66, 0, .34, .5), _R(.66, .5, .34, .5), _R(0, .66, .66, .34)] },
  { id: "a-slashMid", nm: "2 + slash mid + 2", grp: "Angled", asp: "pt", p: [_R(0, 0, .5, .28), _R(.5, 0, .5, .28), [[0, .3], [.62, .3], [.38, .68], [0, .68]], [[.64, .3], [1, .3], [1, .68], [.4, .68]], _R(0, .7, .5, .3), _R(.5, .7, .5, .3)] },
  { id: "a-fwdPair", nm: "Forward-slash pair", grp: "Angled", asp: "ld", p: [[[0, 0], [.62, 0], [.38, 1], [0, 1]], [[.64, 0], [1, 0], [1, 1], [.4, 1]]] },
  { id: "a-backPair", nm: "Back-slash pair", grp: "Angled", asp: "ld", p: [[[0, 0], [.38, 0], [.62, 1], [0, 1]], [[.4, 0], [1, 0], [1, 1], [.64, 1]]] },
  { id: "a-wideSlashBot", nm: "Wide top + slash bot", grp: "Angled", asp: "pt", p: [_R(0, 0, 1, .44), [[0, .47], [1, .47], [1, .72], [0, .86]], [[0, .88], [1, .74], [1, 1], [0, 1]]] },
  { id: "a-zigzag", nm: "Zig-zag 3-tier", grp: "Angled", asp: "pt", p: [[[0, 0], [.55, 0], [.45, .31], [0, .31]], [[.57, 0], [1, 0], [1, .31], [.47, .31]], [[0, .34], [.45, .34], [.55, .65], [0, .65]], [[.47, .34], [1, .34], [1, .65], [.57, .65]], [[0, .68], [.55, .68], [.45, 1], [0, 1]], [[.57, .68], [1, .68], [1, 1], [.47, 1]]] },
  { id: "a-cascade", nm: "Diagonal cascade", grp: "Angled", asp: "pt", p: [[[0, 0], [1, 0], [1, .28], [0, .36]], [[0, .38], [1, .3], [1, .62], [0, .7]], [[0, .72], [1, .64], [1, 1], [0, 1]]] },
  { id: "a-fullSlash", nm: "Full-page slash", grp: "Angled", asp: "pt", p: [[[0, 0], [1, 0], [1, .3], [0, .62]], [[0, .66], [1, .34], [1, 1], [0, 1]]] },
  { id: "a-wedge", nm: "Wedge splash (Λ)", grp: "Angled", asp: "ld", p: [[[.5, 0], [1, 1], [0, 1]], [[0, 0], [.5, 0], [0, 1]], [[.5, 0], [1, 0], [1, 1]]] },
  { id: "s-full", nm: "Full splash", grp: "Splash", asp: "pt", p: [_R(0, 0, 1, 1)] },
  { id: "s-insets", nm: "Splash + 2 insets", grp: "Splash", asp: "pt", p: [_R(0, 0, 1, 1), _R(.04, .04, .26, .2), _R(.7, .76, .26, .2)] },
  { id: "s-cinematic", nm: "Cinematic + splash", grp: "Splash", asp: "pt", p: [_R(0, 0, 1, .26), _R(0, .28, 1, .72)] },
  { id: "s-3tall", nm: "3 vertical tall", grp: "Splash", asp: "pt", p: _grid(3, 1) },
];
function layoutById(id) { return LAYOUT_CATALOG.find((L) => L.id === id) || null; }
function shrinkToward(pts, f) { const c = polyCentroid(pts); return pts.map((p) => [p[0] + (c[0] - p[0]) * f, p[1] + (c[1] - p[1]) * f]); }
// Canvas page box for an aspect (ld landscape / pt portrait / sq square), offset by origin.
function catalogArea(asp) {
  const dims = ({ ld: [1320, 820], pt: [1000, 1320], sq: [1080, 1080] })[asp] || [1320, 820];
  return { x: state.origin.x, y: state.origin.y, w: dims[0], h: dims[1] };
}
// Normalized layout → canvas-space panels (with a proportional gutter inset).
function instantiateLayout(layout, area, gutterFrac) {
  const gf = gutterFrac == null ? 0.05 : gutterFrac;
  return layout.p.map((poly, index) => ({
    poly: shrinkToward(poly, gf).map(([nx, ny]) => [area.x + nx * area.w, area.y + ny * area.h]),
    index,
  }));
}
// Placement box for a panel polygon: exact bbox for an axis-aligned rectangle,
// inscribed box (fits inside) for angled/triangular panels.
function panelPlacementBox(poly) {
  const axis = poly.length === 4 &&
    poly[0][1] === poly[1][1] && poly[2][1] === poly[3][1] &&
    poly[0][0] === poly[3][0] && poly[1][0] === poly[2][0];
  if (axis) {
    const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  }
  return inscribedBox(poly);
}
// Parametric generator — any N panels → a few sensible layout variants.
function factorPairs(n) { const o = []; for (let r = 1; r <= n; r++) if (n % r === 0) o.push([n / r, r]); return o; }
function genLayouts(n, asp) {
  if (n < 1) return [];
  const out = [];
  for (const [cols, rows] of factorPairs(n)) out.push({ id: `gen-${n}-${cols}x${rows}`, nm: `${cols}×${rows}`, grp: "Generated", asp: asp || (rows > cols ? "pt" : "ld"), p: _grid(cols, rows) });
  if (n >= 3) {
    const rest = n - 1;
    const top = [_R(0, 0, 1, .5)];
    for (let i = 0; i < rest; i++) top.push(_R(i / rest, .52, 1 / rest, .48));
    out.push({ id: `gen-${n}-hero`, nm: `Hero + ${rest}`, grp: "Generated", asp: asp || "pt", p: top });
    const left = [_R(0, 0, .5, 1)];
    for (let i = 0; i < rest; i++) left.push(_R(.5, i / rest, .5, 1 / rest));
    out.push({ id: `gen-${n}-bigL`, nm: `Big left + ${rest}`, grp: "Generated", asp: asp || "ld", p: left });
  }
  const seen = new Set();
  return out.filter((L) => (seen.has(L.id) ? false : (seen.add(L.id), true)));
}
// Build a page from a catalog/generated layout (polygon panels).
async function buildStripFromLayout(layout, asp) {
  if (!layout || !Array.isArray(layout.p)) { new Notice("Unknown layout."); return; }
  state.panels = [];
  state.layoutId = layout.id;
  state.origin = nextPageOrigin();
  const area = catalogArea(asp || layout.asp);
  state.page = area.y;                     // page id = its y-origin (stacked pages differ)
  const panels = instantiateLayout(layout, area, 0.05);
  ea.style.strokeColor = COMIC_STROKE; ea.style.strokeWidth = COMIC_STROKE_WIDTH;
  ea.style.strokeStyle = "solid"; ea.style.roughness = COMIC_ROUGHNESS;
  ea.style.backgroundColor = "transparent"; ea.style.opacity = 100;
  panels.forEach((pn) => {
    const id = ea.addLine(pn.poly.concat([pn.poly[0]]));
    // Persist the panel polygon so a reload rebuilds the exact inscribed placement
    // box for angled panels (not just the bounding box).
    tagStripDirector(ea, [id], { role: "panel", index: pn.index, poly: pn.poly, page: state.page });
    state.panels.push({ rect: panelPlacementBox(pn.poly), poly: pn.poly, index: pn.index, page: state.page, frameIds: [id], figureIds: [], zoneIds: [], split: "none", subpanels: [] });
  });
  state.activePanel = 0;
  await commit(false);
  fitToView(state.panels.flatMap((p) => p.frameIds));
  new Notice(`Built "${layout.nm}" — ${panels.length} panels. Select a panel, then fill it or add FX.`);
}

// ===========================================================================
// SECTION F — FX CALLOUTS (painted comic bursts: POW! ZAP! BAM! …)
//   Bundled/importable raster art, stamped as an image element, tagged role
//   "fx". Not a speech bubble (those come from the Callout Editor).
// ===========================================================================
let FX_FIGURES = null;
const FX_MANIFEST = "fx-figures.json";
function _fxDir() { return _aiDir(); }
// Resolve an FX entry to a bundle path — sanitised end-to-end (the id fallback too),
// or null when the entry's paths are unusable.
function fxImagePath(entry) {
  const raw = entry.file || (entry.id != null ? "FX/" + entry.id + ".png" : null);
  const rel = _safePackRel(String(raw || "").includes("/") ? raw : (raw ? "FX/" + raw : null));
  return rel ? _fxDir() + "/" + rel : null;
}
function fxThumbURL(entry) {
  try { const p = fxImagePath(entry); const ad = _vaultApp() && _vaultApp().vault && _vaultApp().vault.adapter; if (p && ad && ad.getResourcePath) return ad.getResourcePath(p); } catch (e) { /* none */ }
  return null;
}
async function loadFXFigures(force) {
  if (FX_FIGURES && !force) return FX_FIGURES;
  const ad = _vaultApp() && _vaultApp().vault && _vaultApp().vault.adapter;
  if (!ad) { FX_FIGURES = { figures: [] }; return FX_FIGURES; }
  const dir = _fxDir();
  for (const p of [dir + "/" + FX_MANIFEST, FX_MANIFEST]) {
    try { if (await ad.exists(p)) { const d = JSON.parse(await ad.read(p)); if (d && Array.isArray(d.figures)) { FX_FIGURES = d; return FX_FIGURES; } } } catch (e) { /* next */ }
  }
  FX_FIGURES = { figures: [] };
  return FX_FIGURES;
}
// Stamp a painted raster FX into the active panel (overlay — does not consume a slot).
async function placeRasterFX(entry) {
  if (!entry) return;
  const basePath = fxImagePath(entry);
  if (!basePath) { new Notice(`Could not place ${entry.word || entry.name || "FX"} — its image path is invalid.`); return; }
  const ai = getActivePanelIndex();
  const p = panelByIndex(ai);
  const region = (p && p.rect) || { x: state.origin.x, y: state.origin.y, w: 460, h: 340 };
  ea.clear();
  let id;
  try { const fxPath = await _preferSvgSibling(basePath); id = await ea.addImage(region.x, region.y, fxPath, false, false); }
  catch (e) { console.error("Strip Director — FX stamp failed", e); new Notice(`Could not place ${entry.word || entry.name} — is its image imported?`); if (ea.clear) ea.clear(); return; }
  const el = ea.getElement ? ea.getElement(id) : null;
  if (el) {
    const natW = el.width || entry.w || 300, natH = el.height || entry.h || 300;
    const target = Math.min(region.w, region.h) * 0.55, s = target / Math.max(natW, natH);
    el.width = natW * s; el.height = natH * s;
    el.x = region.x + (region.w - el.width) / 2;
    el.y = region.y + (region.h - el.height) * 0.28;
  }
  tagStripDirector(ea, [id], { role: "fx", panel: ai, page: state.page || 0 });
  await ea.addElementsToView(false, true, true);
  if (ea.clear) ea.clear();
  new Notice(`Placed ${entry.word || entry.name}.`);
}
// Install a Comic FX pack (strippack-fx/v1) — writes PNGs + merges fx-figures.json.
async function importFXPack(pack, onProgress) {
  const ad = _vaultApp() && _vaultApp().vault && _vaultApp().vault.adapter;
  if (!ad) throw new Error("No vault adapter.");
  if (!pack || pack.format !== "strippack-fx/v1") {
    const fmt = pack && String(pack.format || "");
    if (fmt && fmt.startsWith("strippack-fx/")) throw new Error("This FX pack uses a newer format (" + fmt + ") — update the Comic Strip Director script, then import again.");
    throw new Error("Not a Comic FX pack (strippack-fx/v1).");
  }
  const dir = _fxDir();
  const norm = (x) => { try { return ea.obsidian.normalizePath(x); } catch (e) { return String(x).replace(/\\/g, "/").replace(/\/{2,}/g, "/"); } };
  const figsIn = Array.isArray(pack.figures) ? pack.figures.filter((f) => f && typeof f === "object") : [];
  // Read (and validate) the manifest BEFORE any file is written — a corrupt index
  // aborts the import with zero side effects.
  const mpath = await _resolveIndexPath(ad, [dir + "/" + FX_MANIFEST, FX_MANIFEST]);
  const man = (await _readIndexOrThrow(ad, mpath, "fx-figures.json")) || { figures: [] };
  man.figures = (man.figures || []).filter(Boolean);
  await _ensureDir(ad, dir);
  // Resolve every path through the sanitiser (the id-based fallback INCLUDED — a
  // hostile id must never escape the bundle), pre-create referenced subfolders,
  // and pre-list their contents once.
  const rels = new Map();
  const subdirs = new Set(["FX"]);
  for (const f of figsIn) {
    const rel = _safePackRel(f.file) || _safePackRel(f.id != null ? "FX/" + f.id + ".png" : null);
    if (!rel) continue;
    const relSvg = _safePackRel(f.fileSvg);
    rels.set(f, { rel, relSvg });
    if (rel.includes("/")) subdirs.add(rel.slice(0, rel.lastIndexOf("/")));
    if (relSvg && relSvg.includes("/")) subdirs.add(relSvg.slice(0, relSvg.lastIndexOf("/")));
  }
  const onDisk = new Set();
  for (const sd of subdirs) {
    const full = norm(dir + "/" + sd);
    await _ensureDir(ad, full);
    try { const l = await ad.list(full); (l.files || []).forEach((x) => onDisk.add(norm(x))); } catch (e) { /* empty */ }
  }
  try { const l = await ad.list(norm(dir)); (l.files || []).forEach((x) => onDisk.add(norm(x))); } catch (e) { /* empty */ }
  // Write images; only figures whose PNG is actually on disk become available —
  // a failed write (bad base64, IO error) must not create a broken manifest row.
  let written = 0, figIdx = 0;
  const available = new Set();
  for (const f of figsIn) {
    figIdx++;
    if (onProgress) onProgress(figIdx, figsIn.length);
    const r = rels.get(f);
    if (!r) continue;
    f.file = r.rel;
    if (r.relSvg) f.fileSvg = r.relSvg; else delete f.fileSvg;
    const abs = norm(dir + "/" + r.rel);
    let present = onDisk.has(abs);
    if (f.png && !present) {
      const bytes = _decodePng(f.png);
      if (bytes) {
        try { await ad.writeBinary(abs, bytes); onDisk.add(abs); written++; present = true; }
        catch (e) { /* unwritable — not available */ }
      }
    }
    if (f.svg && r.relSvg) {
      const svgAbs = norm(dir + "/" + r.relSvg);
      if (!onDisk.has(svgAbs)) { try { await ad.writeBinary(svgAbs, _b64ToArrayBuffer(_dataURIPayload(f.svg))); onDisk.add(svgAbs); } catch (e) { /* optional */ } }
    }
    if (present && f.id != null) available.add(f.id);
  }
  await _backupVaultFile(ad, mpath);
  const have = new Set(man.figures.map((x) => x && x.id).filter((x) => x != null));
  let added = 0;
  for (const f of figsIn) {
    if (f.id != null && available.has(f.id) && !have.has(f.id)) {
      man.figures.push({ id: f.id, name: f.name, word: f.word, file: f.file, fileSvg: f.fileSvg, w: f.w, h: f.h, kind: "fx" });
      have.add(f.id); added++;
    }
  }
  await _writeIndexSafely(ad, mpath, man);
  return { written, added, name: pack.name };
}

async function splitSelectedPanel(mode) {
  if (mode === "none") { new Notice("Pick Diagonal or Triangle to split a panel."); return; }
  const idx = getActivePanelIndex();
  const panel = panelByIndex(idx);
  if (!panel) { new Notice("Build a strip and select a panel first."); return; }
  // Draw each resulting sub-region as its OWN closed, selectable outline tagged
  // role:"subpanel" so a figure / zone can be placed INSIDE one half (not the
  // parent rect). Polygon edges coincide with the panel border + the divider, so
  // at roughness 0 the overlap is invisible — it just looks like a split panel.
  const polys = splitPanel(panel.rect, mode);
  ea.style.strokeColor = COMIC_STROKE;
  ea.style.strokeWidth = COMIC_STROKE_WIDTH;
  ea.style.strokeStyle = "solid";
  ea.style.roughness = COMIC_ROUGHNESS;
  ea.style.backgroundColor = "transparent";
  ea.style.opacity = 100;
  panel.subpanels = [];
  polys.forEach((poly, hi) => {
    const id = ea.addLine(poly.concat([poly[0]]));
    tagStripDirector(ea, [id], { role: "subpanel", panel: idx, half: hi, page: panel.page || 0 });
    panel.frameIds.push(id);
    panel.subpanels.push({ poly, half: hi, box: inscribedBox(poly) });
  });
  panel.split = mode;
  await commit(false);
  new Notice(`Split panel ${idx + 1} into ${polys.length} regions (${mode}). Select a region, then place a figure / zone in it.`);
}

async function addCalloutZone() {
  const pc = getPlacementContext();
  if (!pc) { new Notice("Build a strip and select a panel first."); return; }
  const ids = addCalloutZonePlaceholder(ea, pc.region, pc.panelIdx, "", pc.page);
  if (pc.half !== undefined) tagStripDirector(ea, ids, { role: "calloutZone", panel: pc.panelIdx, half: pc.half, page: pc.page || 0 });
  const panel = panelByIndex(pc.panelIdx, pc.page);
  if (panel) panel.zoneIds.push(...ids);
  await commit(false);
  new Notice("Reserved a callout zone — select it and run Comicbook Callout Editor to letter it.");
}

// Stamp one of the user's hand-drawn figures into the selected panel or split sub-region.
async function placeFigure(figure) {
  if (!figure) return;
  const pc = getPlacementContext({ forFigure: true });
  if (!pc) {
    new Notice(state.panels.length
      ? "All slots are filled — split a panel or build a new strip for more room."
      : "Build a strip first, then place figures.");
    return;
  }
  ea.clear();                                  // fresh workbench
  const ids = stampFigure(ea, figure, figureBox(pc.region), pc.panelIdx, pc.half, pc.page);
  await ea.addElementsToView(false, true, true); // one commit, figures on top
  if (ea.clear) ea.clear();
  const panel = panelByIndex(pc.panelIdx, pc.page);
  if (panel) panel.figureIds.push(...ids);
  const where = pc.half !== undefined ? `panel ${pc.panelIdx + 1}, region ${pc.half + 1}` : `panel ${pc.panelIdx + 1}`;
  new Notice(`Placed "${figure.name}" in ${where}.`);
}

// Prefer a crisp vector sibling (<figure>.svg) over the raster .png when one exists,
// so placed figures stay sharp at any zoom. Falls back to the png if no svg is there.
async function _preferSvgSibling(pngPath) {
  try {
    const ad = _vaultApp() && _vaultApp().vault && _vaultApp().vault.adapter;
    if (ad && ad.exists) {
      const svgPath = pngPath.replace(/\.png$/i, ".svg");
      if (await ad.exists(svgPath)) return svgPath;
    }
  } catch (e) { /* fall back to png */ }
  return pngPath;
}

// Stamp an AI-composed figure (image element) into a placement box, scaled to fit.
// EA owns the image id + fileId (binary embedded on commit) — no id/group remap
// (unlike the vector clone path). Recipe per the ea-image notes.
async function stampImageFigure(entry, box, panelIdx, half, page) {
  const path = await _preferSvgSibling(aiFigureImagePath(entry));
  // scale=false → keep natural size (we scale to fit below); anchor=false → a
  // normal, freely RESIZABLE image (anchored images are pinned to 100% and refuse resize).
  const id = await ea.addImage(box.x, box.y, path, false, false);
  const el = ea.getElement ? ea.getElement(id) : null;
  if (el) {
    const natW = el.width || entry.w || box.w;
    const natH = el.height || entry.h || box.h;
    const s = Math.min(box.w / natW, box.h / natH) * FIT_PAD;
    el.width = natW * s;
    el.height = natH * s;
    el.x = box.x + (box.w - el.width) / 2;
    el.y = box.y + (box.h - el.height) / 2;
  }
  const tag = { role: "figure", panel: panelIdx, page: page === undefined ? (state.page || 0) : page };
  if (half !== undefined) tag.half = half;
  tagStripDirector(ea, [id], tag);
  return [id];
}

// Place an AI-composed image figure into the selected panel / split region.
async function placeAIFigure(entry) {
  if (!entry) return;
  const pc = getPlacementContext({ forFigure: true });
  if (!pc) {
    new Notice(state.panels.length
      ? "All slots are filled — split a panel or build a new strip for more room."
      : "Build a strip first, then place figures.");
    return;
  }
  ea.clear();
  let ids;
  try {
    ids = await stampImageFigure(entry, figureBox(pc.region), pc.panelIdx, pc.half, pc.page);
  } catch (e) {
    console.error("Comic Strip Director — AI figure stamp failed", e);
    new Notice(`Could not place "${entry.name}" — is its image in the AI Figures folder?`);
    if (ea.clear) ea.clear();
    return;
  }
  await ea.addElementsToView(false, true, true);
  if (ea.clear) ea.clear();
  const panel = panelByIndex(pc.panelIdx, pc.page);
  if (panel) panel.figureIds.push(...ids);
  const where = pc.half !== undefined ? `panel ${pc.panelIdx + 1}, region ${pc.half + 1}` : `panel ${pc.panelIdx + 1}`;
  new Notice(`Placed AI figure "${entry.name}" in ${where}.`);
}

// R7: resolve a character × function × action combination. If already generated
// (cached in the manifest) → stamp it. Else → show the exact composer command
// (generation runs outside Obsidian; the CLI auto-creates the character anchor on
// first use). Returns true if it stamped, false if it surfaced a command.
async function composeOrPlace(sel) {
  const character = sel.character || "";
  const func = sel.func || "";
  const action = sel.action || "";
  if (!character && !func) { new Notice("Pick a character and/or a function (plus an action)."); return false; }
  await loadAIFigures(true);                 // refresh in case the composer just added it
  const prefix = sel.lib === "legacy" ? "legacy-" : "";
  const entry = findComposed(character, func, action, prefix);
  if (entry) { await placeAIFigure(entry); return true; }
  const key = comboKey(character, func, action);
  const cmd = "compose-character.js --compose"
    + (character ? " --character " + character : "")
    + (func ? " --function " + func : "")
    + " --action " + action + " --best-of 3 --remove-bg";
  console.log("[Strip Director] Not in the library yet (" + key + "). Composer command:\n" + cmd);
  new Notice("Not in the library yet: \"" + key + "\".\nThat character / role / action combination hasn't been generated.", 12000);
  return false;
}

// ===========================================================================
// SECTION E — UI
// ===========================================================================
const ABOUT = `
**Comic Strip Director** turns the canvas into a comic-strip studio.

- **Build a page** → pick a shape (landscape / portrait / square), then click a
  layout thumbnail — 30 templates from clean grids to angled gutters and splash
  pages — or **Generate** layouts for any panel count. Each new page is placed
  below the previous one.
- **Split the selected panel** → a local diagonal or horizontal action-beat cut;
  each region becomes its own placement target.
- **Characters** → pick **who** → **as what** (costume) → **doing what**
  (action). The picker shows only combinations from the packs you've imported,
  each with a real preview. **⚙ Manage** shows/hides imported characters.
- **Import pack… / Import FX pack…** → install \`.strippack\` character or FX
  packs. Imports are safe: existing files are never overwritten, indexes are
  backed up first, and re-importing is a no-op.
- **FX callouts** → click a painted POW! / ZAP! / KABOOM! to stamp it into the
  selected panel.
- **Hand-drawn vector library** → your original figures.json set, stamped with
  strokes, colours and jitter preserved exactly — never restyled.
- **Add callout zone** reserves an empty speech/caption area. It does **not**
  draw a bubble — select that zone and run the
  [Comicbook Callout Editor](${CALLOUT_EDITOR_URL}) to turn it into a real
  speech bubble, caption box or thought cloud.

Figures load from **\`figures.json\`** in this script's data bundle (a folder
named after the script, in your Excalidraw scripts folder). The same figures are
also an importable **\`.excalidrawlib\`** stencil. Everything is tagged \`customData.stripDirector\`;
\`comicCallout\` is never touched.

**New characters & add-on packs** (character packs, costume/theme packs and FX)
are available at [comicstripdirector.com](${STORE_URL}) — import them with the
**⬇ Import pack…** / **⬇ Import FX pack…** buttons.

Requires Excalidraw plugin 2.19.1 or higher.
`;

function prettyId(id) {
  return String(id).split("-").map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(" ");
}
// "Get more packs" pointers to the store. Two visible-but-tasteful styles:
//   addStoreLink → an accent-coloured text link;  addStoreBtn → an accent-filled button.
// Both open the store in the browser. No banners or popups.
function _wireStore(a) {
  try { a.setAttr("href", STORE_URL); a.setAttr("target", "_blank"); a.setAttr("rel", "noopener"); a.setAttr("aria-label", "Get more character and add-on packs at comicstripdirector.com"); } catch (e) {}
  a.title = "New characters, costumes & FX packs — comicstripdirector.com";
  a.onclick = (e) => { try { e.preventDefault(); } catch (x) {} try { window.open(STORE_URL, "_blank"); } catch (x) {} };
  return a;
}
function addStoreLink(parent, text) {
  const a = parent.createEl("a", { text: text || "More packs →" });
  a.style.cssText = "font-size:0.82em;font-weight:600;color:var(--interactive-accent);text-decoration:none;cursor:pointer;overflow-wrap:anywhere;min-width:0";
  a.onmouseenter = () => { a.style.textDecoration = "underline"; };
  a.onmouseleave = () => { a.style.textDecoration = "none"; };
  return _wireStore(a);
}
// Store CTA button — accent-filled, but the SAME rounded-rectangle shape/size as every
// other button in the panel (only the colour differs, so it reads as a call-to-action).
function addStoreBtn(parent, text) {
  const a = parent.createEl("a", { text: text || "Get more packs" });
  a.style.cssText = "display:inline-flex;align-items:center;gap:5px;font-size:0.75em;font-weight:600;" +
    "color:var(--text-on-accent);background:var(--interactive-accent);border:1px solid transparent;" +
    "padding:3px 10px;border-radius:5px;text-decoration:none;cursor:pointer;white-space:nowrap";
  a.onmouseenter = () => { a.style.filter = "brightness(1.08)"; };
  a.onmouseleave = () => { a.style.filter = "none"; };
  return _wireStore(a);
}
// Neutral action button — one shared rounded-rectangle style so Import / Import FX /
// Manage / Fit-to-view / Generate all match each other and the store button.
function styleActionBtn(b, opts) {
  const accent = !!(opts && opts.accent);
  const baseBg = accent ? "var(--interactive-accent)" : "var(--background-secondary)";
  const hoverBg = accent ? "var(--interactive-accent-hover)" : "var(--background-modifier-hover)";
  b.style.cssText = "display:inline-flex;align-items:center;gap:5px;font-size:0.75em;font-weight:500;" +
    `color:${accent ? "var(--text-on-accent)" : "var(--text-normal)"};background:${baseBg};` +
    `border:1px solid ${accent ? "var(--interactive-accent)" : "var(--background-modifier-border)"};` +
    "padding:3px 10px;border-radius:5px;cursor:pointer;white-space:nowrap";
  try { b.classList.add("csd-btn"); } catch (e) { /* headless */ }
  // Hover restores the button's OWN base colour — an accent button must not
  // fall back to the plain background on mouse-leave.
  b.onmouseenter = () => { b.style.background = hoverBg; };
  b.onmouseleave = () => { b.style.background = baseBg; };
  return b;
}

// Open the Comicbook Callout Editor the friendliest way available, in order:
// (1) installed → invoke the COMMAND the Excalidraw plugin registers for every
// installed script ("obsidian-excalidraw-plugin:<subpath>/<basename>") — the
// script engine itself is not a published API, commands are how scripts are
// meant to be triggered; (2) installed but no command yet → point at the script
// menu; (3) not installed → open the in-app script store; (4) GitHub.
async function openCalloutEditor() {
  const SCRIPT_MD = "Comicbook Callout Editor.md";
  try {
    const appRef = _vaultApp();
    const scriptsFolder = (((ea.plugin && ea.plugin.settings && ea.plugin.settings.scriptFolderPath) || "Excalidraw/Scripts").replace(/\/+$/, "")) + "/";
    const f = (appRef.vault.getMarkdownFiles ? appRef.vault.getMarkdownFiles() : [])
      .filter((x) => x.name === SCRIPT_MD && x.path.startsWith(scriptsFolder))[0];
    if (f) {
      const scriptpath = (f.parent && f.parent.path + "/").split(scriptsFolder)[1] ?? "";
      const cmd = appRef.commands && appRef.commands.commands &&
        appRef.commands.commands[`obsidian-excalidraw-plugin:${scriptpath}${f.basename}`];
      if (cmd && typeof cmd.checkCallback === "function") {
        // The command only fires when an Excalidraw view is the ACTIVE view —
        // clicking a link in this side panel focuses the panel's leaf instead.
        // Re-activate the drawing first, then invoke.
        try {
          if (ea.targetView && ea.targetView.leaf && appRef.workspace && appRef.workspace.setActiveLeaf) {
            appRef.workspace.setActiveLeaf(ea.targetView.leaf, { focus: true });
          }
        } catch (e) { /* leaf activation unavailable */ }
        if (cmd.checkCallback(false) !== false) return;
        new Notice("Click into your Excalidraw drawing first, then try again — the Callout Editor runs on the active drawing.", 7000);
        return;
      }
      new Notice("Comicbook Callout Editor is installed — select a callout zone, then run it from the Excalidraw script menu.", 7000);
      return;
    }
  } catch (e) { console.error("Strip Director: Callout Editor lookup failed", e); }
  try {
    const panel = ea.targetView && ea.targetView.toolsPanelRef && ea.targetView.toolsPanelRef.current;
    if (panel && typeof panel.actionOpenScriptInstallDialog === "function") {
      panel.actionOpenScriptInstallDialog();
      new Notice("Search for \"Comicbook Callout Editor\" in the script store to install it.", 6000);
      return;
    }
  } catch (e) { /* store dialog unavailable — keep going */ }
  try { window.open(CALLOUT_EDITOR_URL, "_blank"); } catch (e) { /* headless */ }
}

// Make a non-button clickable element keyboard-operable (Enter / Space), so the
// thumbnail tiles aren't mouse-only.
function makeActivatable(el, handler) {
  el.onclick = handler;
  try {
    el.setAttribute("role", "button");
    el.tabIndex = 0;
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") { e.preventDefault(); handler(e); }
    });
  } catch (e) { /* DOM unavailable */ }
}
async function pickFromList(values, labels, placeholder) {
  const lbls = labels || values.map(prettyId);
  try {
    if (typeof ea !== "undefined" && ea.suggester) return await ea.suggester(lbls, values, placeholder);
    if (typeof utils !== "undefined" && utils.suggester) return await utils.suggester(lbls, values, placeholder);
  } catch (e) {
    console.error("Comic Strip Director: suggester failed", e);
  }
  return undefined;
}
// One consistent action row per section: flex, wrapping, uniform 6px gaps.
function toolbarRow(parent) {
  const r = parent.createDiv();
  r.style.cssText = "display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:0 0 8px";
  return r;
}
function section(parent, title, desc) {
  const sec = parent.createDiv();
  sec.style.margin = "14px 0 0";
  sec.style.paddingTop = "10px";
  sec.style.borderTop = "1px solid var(--background-modifier-border)";
  const h = sec.createEl("div", { text: title });
  h.style.fontWeight = "600";
  h.style.fontSize = "0.95em";
  h.style.margin = "0 0 2px";
  if (desc) {
    const d = sec.createEl("div", { text: desc });
    d.style.fontSize = "0.78em";
    d.style.color = "var(--text-muted)";
    d.style.margin = "0 0 8px";
  }
  const row = sec.createDiv();
  row.style.display = "flex";
  row.style.flexWrap = "wrap";
  row.style.alignItems = "center";
  row.style.gap = "6px";
  return row;
}

async function buildPanel(tab, ctx) {
  if (!tab) return;
  ctx = ctx || {};
  const contentEl = tab.contentEl;
  // Build generation: the bootstrap fires buildPanel twice (direct call + tab.open→onOpen)
  // and they race around the awaits below. Stamp each run; a run that finds a newer
  // generation aborts before appending async sections, so the panel renders exactly once.
  const __gen = (tab.__buildGen = (tab.__buildGen || 0) + 1);
  contentEl.empty();
  // Responsive behaviour for any panel width: images scale, button rows wrap,
  // long names break instead of overflowing, buttons share one size.
  try {
    if (contentEl.classList) contentEl.classList.add("csd-panel");
    const st = contentEl.createEl("style");
    st.setText(".csd-panel img { max-width: 100%; height: auto; }" +
      " .csd-panel a { max-width: 100%; }" +
      " .csd-panel .csd-btn { min-height: 26px; max-width: 100%; }" +
      " .csd-panel button { flex-shrink: 1; }" +
      " .csd-panel div { overflow-wrap: break-word; min-width: 0; }");
  } catch (e) { /* headless */ }

  renderHeader(contentEl);
  renderStatusLine(contentEl, tab, ctx);
  renderBuildPage(contentEl, tab, ctx);
  renderSplitSection(contentEl, ctx);
  renderVectorLibrary(contentEl, ctx);
  if (!(await renderCharacters(contentEl, tab, ctx, __gen))) return;
  renderCalloutSection(contentEl, ctx);
  renderFooter(contentEl);
}

// Title bar + the ℹ️ About toggle.
function renderHeader(contentEl) {
  const header = contentEl.createDiv();
  header.style.display = "flex";
  header.style.alignItems = "center";
  header.style.gap = "6px";
  const h2 = header.createEl("h2", { text: "Strip Director" });
  h2.style.margin = "0";
  h2.style.flex = "1 1 auto";
  const about = contentEl.createDiv();
  about.style.display = "none";
  about.style.background = "var(--background-secondary)";
  about.style.padding = "8px 10px";
  about.style.borderRadius = "6px";
  about.style.margin = "8px 0";
  about.style.fontSize = "0.82em";
  try { ea.obsidian.MarkdownRenderer.render(ea.plugin.app, ABOUT, about, "", ea.plugin); }
  catch (e) { about.setText(ABOUT); }
  new ea.obsidian.ButtonComponent(header)
    .setIcon("info").setTooltip("About Strip Director")
    .onClick(() => { about.style.display = about.style.display === "none" ? "block" : "none"; });
}

// Status line — a one-line inventory of what IS loaded (characters, costumes,
// actions, FX, optional hand-drawn vector library), expandable to the full name
// lists. Only warns when the data folder itself is missing — figures.json is an
// optional extra, never a warning.
function renderStatusLine(contentEl, tab, ctx) {
  const fig = FIGURES;
  {
    const all = (AI_FIGURES && AI_FIGURES.figures) || [];
    // Same rule as the picker: the legacy/new split only applies when a legacy
    // roster exists; otherwise every imported figure counts, whatever its lib.
    const _hasLegacyRoster = ((ROSTER_LEGACY && ROSTER_LEGACY.characters) || []).length > 0;
    const pool = _hasLegacyRoster && all.some((f) => f.lib !== "legacy") ? all.filter((f) => f.lib !== "legacy") : all;
    const uniq = (arr) => [...new Set(arr.filter(Boolean))];
    const charIds = uniq(pool.map((f) => f.character));
    const funcIds = uniq(pool.map((f) => f.function));
    const actIds = uniq(pool.map((f) => f.action));
    const fxList = (FX_FIGURES && FX_FIGURES.figures) || [];
    const nameOf = (list, id, key) => { const hit = (list || []).find((x) => x.id === id); return (hit && (hit.name || hit[key])) || prettyId(id); };
    const R = ROSTER || {};

    const statusRow = contentEl.createDiv();
    statusRow.style.fontSize = "0.78em";
    statusRow.style.margin = "6px 0 0";
    if (charIds.length || fxList.length || fig) {
      statusRow.style.color = "var(--text-muted)";
      statusRow.style.cursor = "pointer";
      const bits = [];
      if (charIds.length) bits.push(`${charIds.length} character${charIds.length > 1 ? "s" : ""}`);
      if (funcIds.length) bits.push(`${funcIds.length} costume${funcIds.length > 1 ? "s" : ""}`);
      if (actIds.length) bits.push(`${actIds.length} action${actIds.length > 1 ? "s" : ""}`);
      if (fxList.length) bits.push(`${fxList.length} FX`);
      if (fig) bits.push(`${fig.figures.length} hand-drawn figures`);
      let open = false;
      const paint = () => statusRow.setText((open ? "▾ " : "▸ ") + "Loaded: " + bits.join(" · "));
      paint();
      statusRow.title = "Click for the full list of what's available";

      const detail = contentEl.createDiv();
      detail.style.cssText = "display:none;font-size:0.74em;color:var(--text-muted);margin:4px 0 2px;padding:7px 9px;border:1px solid var(--background-modifier-border);border-radius:6px;background:var(--background-secondary)";
      const addLine = (label, txt) => {
        if (!txt) return;
        const d = detail.createDiv(); d.style.margin = "1px 0";
        const b = d.createEl("span", { text: label + ": " }); b.style.fontWeight = "600";
        d.createEl("span", { text: txt });
      };
      // Coverage maps — packs can drift (a costume sold for only some characters,
      // a new character with fewer actions). Annotate coverage ONLY when it isn't
      // universal, so the list stays clean while the matrix is complete.
      const cov = { func: new Map(), act: new Map(), charFuncs: new Map() };
      for (const f of pool) {
        if (!f.character) continue;
        if (f.function) {
          if (!cov.func.has(f.function)) cov.func.set(f.function, new Set());
          cov.func.get(f.function).add(f.character);
          if (!cov.charFuncs.has(f.character)) cov.charFuncs.set(f.character, new Set());
          cov.charFuncs.get(f.character).add(f.function);
        }
        if (f.action) {
          if (!cov.act.has(f.action)) cov.act.set(f.action, new Set());
          cov.act.get(f.action).add(f.character);
        }
      }
      const nChar = charIds.length;
      const withCov = (m, id, label) => { const n = (m.get(id) || new Set()).size; return n && n < nChar ? `${label} (${n}/${nChar})` : label; };
      // Characters: annotate costume count only for those that deviate from the norm.
      const costumeCounts = charIds.map((id) => (cov.charFuncs.get(id) || new Set()).size);
      const mode = costumeCounts.length ? costumeCounts.sort((a, b) =>
        costumeCounts.filter((v) => v === a).length - costumeCounts.filter((v) => v === b).length).pop() : 0;
      const charLabel = (id) => {
        const nm = nameOf(R.characters, id, "name");
        const n = (cov.charFuncs.get(id) || new Set()).size;
        if (n === mode) return nm;
        return n === 0 ? `${nm} (base only)` : `${nm} (${n} costume${n > 1 ? "s" : ""})`;
      };
      addLine("Characters", charIds.map(charLabel).sort().join(", "));
      addLine("Costumes", funcIds.map((id) => withCov(cov.func, id, nameOf(R.functions, id, "name"))).sort().join(", "));
      addLine("Actions", actIds.map((id) => withCov(cov.act, id, nameOf(R.actions, id, "label"))).sort().join(", "));
      addLine("FX", fxList.map((f) => f.word || f.name || f.id).join(", "));
      if (fig) addLine("Hand-drawn library", `${fig.figures.length} figures in ${fig.styles.length} styles`);
      makeActivatable(statusRow, () => { open = !open; detail.style.display = open ? "block" : "none"; paint(); });
    } else {
      // Empty library — the FIRST thing a fresh two-file install sees. Put the
      // one-click starter right here at the top instead of a stale warning.
      statusRow.style.color = "var(--text-muted)";
      statusRow.setText("No characters installed yet — grab the free starter cast:");
      const getRow = contentEl.createDiv();
      getRow.style.cssText = "display:flex;align-items:center;gap:8px;margin:6px 0 0;flex-wrap:wrap";
      const freeBtn = getRow.createEl("button", { text: "⭐ Get the free starter pack" });
      styleActionBtn(freeBtn, { accent: true });
      freeBtn.title = "One click: downloads the free Core Cast + FX packs and imports them";
      freeBtn.onclick = async () => {
        try {
          // getRow first: the progress box appears right HERE where the user
          // clicked (top of the panel), plus over the sections further down.
          if (await downloadFreeStarterPacks(() => createImportProgressMulti([getRow, tab && tab.__csdCharSection, tab && tab.__csdFxSection]))) { await reloadPackCaches(); await buildPanel(tab, ctx); }
        } catch (e) { console.error("Strip Director: starter pack install failed", e); new Notice("Starter pack install failed — see console."); }
      };
      const hint = getRow.createEl("span", { text: "8 characters + FX, free — or drop a .strippack in your scripts folder and use ⬇ Import pack… below." });
      hint.style.cssText = "font-size:0.72em;color:var(--text-faint)";
    }
  }
}

// Build a page — visual layout picker + generator + painted FX. A small SVG
// thumbnail per layout (black = gutter, panels = paper); click to drop the frames.
// The generator adds "any N panels" variants; the FX row stamps painted bursts.
function renderBuildPage(contentEl, tab, ctx) {
  {
    const wPrefs = (ea.getScriptSettings && ea.getScriptSettings()) || {};
    const wSave = (patch) => { try { const s = ea.getScriptSettings() || {}; Object.assign(s, patch); ea.setScriptSettings(s); } catch (e) {} };
    let aspect = ["ld", "pt", "sq"].includes(wPrefs.pageAspect) ? wPrefs.pageAspect : "pt";
    let genList = [];   // currently generated variants (appended to the picker)

    const layoutThumbSVG = (L) => {
      const dims = ({ ld: [108, 68], pt: [80, 106], sq: [92, 92] })[L.asp] || [92, 92];
      const W = dims[0], H = dims[1], pad = 4, iw = W - pad * 2, ih = H - pad * 2, gf = 0.06;
      let panels = "";
      L.p.forEach((poly) => {
        let cx = 0, cy = 0; poly.forEach((p) => { cx += p[0]; cy += p[1]; }); cx /= poly.length; cy /= poly.length;
        const s = poly.map((p) => [p[0] + (cx - p[0]) * gf, p[1] + (cy - p[1]) * gf]);
        const d = s.map((p, i) => (i ? "L" : "M") + (pad + p[0] * iw).toFixed(1) + " " + (pad + p[1] * ih).toFixed(1)).join(" ") + " Z";
        panels += `<path d="${d}" fill="var(--background-primary)" stroke="var(--text-normal)" stroke-width="2" stroke-linejoin="round"/>`;
      });
      return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="display:block"><rect width="${W}" height="${H}" fill="var(--text-normal)"/>${panels}</svg>`;
    };

    const wsec = contentEl.createDiv();
    wsec.style.margin = "12px 0 0"; wsec.style.paddingTop = "10px";
    wsec.style.borderTop = "1px solid var(--background-modifier-border)";
    const wh = wsec.createEl("div", { text: "Build a page" });
    wh.style.fontWeight = "600"; wh.style.fontSize = "0.95em"; wh.style.margin = "0 0 2px";
    const wsub = wsec.createEl("div", { text: "Pick a layout — or generate one for N panels. Select a panel, fill it below, then add FX." });
    wsub.style.fontSize = "0.78em"; wsub.style.color = "var(--text-muted)"; wsub.style.margin = "0 0 8px";

    // aspect toggle
    const aspRow = wsec.createDiv();
    aspRow.style.display = "flex"; aspRow.style.gap = "6px"; aspRow.style.margin = "0 0 8px";
    let paintAsp = () => {};
    const aspBtns = [["ld", "Landscape"], ["pt", "Portrait"], ["sq", "Square"]].map(([id, label]) => {
      const b = aspRow.createEl("button", { text: label });
      b.style.fontSize = "0.75em"; b.style.padding = "3px 10px"; b.style.borderRadius = "5px";
      b.style.border = "1px solid var(--background-modifier-border)"; b.style.cursor = "pointer";
      b.onclick = () => { aspect = id; wSave({ pageAspect: id }); paintAsp(); renderPicker(); };
      return { id, b };
    });
    paintAsp = () => aspBtns.forEach(({ id, b }) => {
      const on = aspect === id;
      b.style.background = on ? "var(--interactive-accent)" : "var(--background-secondary)";
      b.style.color = on ? "var(--text-on-accent)" : "var(--text-normal)";
    });
    paintAsp();
    const fitBtn = aspRow.createEl("button", { text: "⤢ Fit to view" });
    styleActionBtn(fitBtn);
    fitBtn.title = "Zoom the canvas so the whole strip is visible";
    fitBtn.onclick = () => ctx.fitToView && ctx.fitToView();

    // generator row
    const genRow = wsec.createDiv();
    genRow.style.display = "flex"; genRow.style.gap = "6px"; genRow.style.alignItems = "center"; genRow.style.margin = "0 0 8px";
    const genLbl = genRow.createEl("span", { text: "Generate for" });
    genLbl.style.fontSize = "0.78em"; genLbl.style.color = "var(--text-muted)";
    const genN = genRow.createEl("input"); genN.type = "number"; genN.min = "1"; genN.max = "12"; genN.value = "6";
    genN.style.width = "52px"; genN.style.padding = "2px 6px"; genN.style.fontSize = "0.8em";
    genN.style.border = "1px solid var(--background-modifier-border)"; genN.style.borderRadius = "4px";
    genN.style.background = "var(--background-primary)"; genN.style.color = "var(--text-normal)";
    genRow.createEl("span", { text: "panels" }).style.cssText = "font-size:0.78em;color:var(--text-muted)";
    const genBtn = genRow.createEl("button", { text: "Generate" });
    styleActionBtn(genBtn);
    genBtn.onclick = () => { const n = Math.max(1, Math.min(12, parseInt(genN.value, 10) || 6)); genList = genLayouts(n, aspect); renderPicker(); };

    const pickGrid = wsec.createDiv();
    pickGrid.style.display = "grid";
    pickGrid.style.gridTemplateColumns = "repeat(auto-fill, minmax(72px, 1fr))";
    pickGrid.style.gap = "6px"; pickGrid.style.marginBottom = "4px";

    function layoutCard(L) {
      const cell = pickGrid.createDiv();
      cell.style.cursor = "pointer"; cell.style.textAlign = "center";
      cell.style.border = "1px solid var(--background-modifier-border)"; cell.style.borderRadius = "5px";
      cell.style.padding = "4px"; cell.style.background = "var(--background-secondary)";
      cell.title = `${L.nm} — ${L.p.length} panel${L.p.length > 1 ? "s" : ""}`;
      const holder = cell.createDiv(); holder.innerHTML = layoutThumbSVG(L);
      const svg = holder.querySelector("svg"); if (svg) { svg.style.width = "100%"; svg.style.height = "auto"; }
      const cap = cell.createEl("div", { text: L.nm });
      cap.style.fontSize = "0.6em"; cap.style.lineHeight = "1.1"; cap.style.marginTop = "2px";
      cap.style.whiteSpace = "nowrap"; cap.style.overflow = "hidden"; cap.style.textOverflow = "ellipsis";
      makeActivatable(cell, async () => { wSave({ lastLayout: L.id }); await buildStripFromLayout(L, aspect); });
      return cell;
    }
    function renderPicker() {
      pickGrid.empty();
      LAYOUT_CATALOG.filter((L) => L.asp === aspect).forEach(layoutCard);
      genList.forEach(layoutCard);
      if (!pickGrid.children.length) { const n = pickGrid.createEl("div", { text: "No templates for this shape." }); n.style.cssText = "font-size:0.75em;color:var(--text-muted)"; }
    }
    renderPicker();

    // FX callouts — painted comic bursts (POW! ZAP! BAM! …) stamped into the panel.
    const fxWrap = wsec.createDiv();
    tab.__csdFxSection = fxWrap;               // import lock target (locked together with Characters)
    fxWrap.style.margin = "10px 0 2px";
    const fxh = fxWrap.createEl("div", { text: "FX callouts" });
    fxh.style.fontWeight = "600"; fxh.style.fontSize = "0.82em"; fxh.style.margin = "0 0 4px";
    const fxHint = fxWrap.createEl("div", { text: "Click an effect to drop it into the selected panel. (Speech bubbles: use the Callout Editor.)" });
    fxHint.style.fontSize = "0.72em"; fxHint.style.color = "var(--text-muted)"; fxHint.style.margin = "0 0 6px";

    // Painted (raster) FX — the built-in / importable comic effect art.
    const rfx = (FX_FIGURES && FX_FIGURES.figures) || [];
    const rfxWrap = fxWrap.createDiv();
    const rfxHead = rfxWrap.createDiv(); rfxHead.style.cssText = "display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0 0 5px";
    const rfxTitle = rfxHead.createEl("span", { text: rfx.length ? `${rfx.length} effects` : "No effects yet" });
    rfxTitle.style.cssText = "font-size:0.76em;color:var(--text-muted)";
    const impFx = rfxHead.createEl("button", { text: "⬇ Import FX pack…" });
    styleActionBtn(impFx);
    impFx.onclick = async () => {
      try {
        if (await importPacksFlow("Pick an FX pack — or import all", () => createImportProgressMulti([tab.__csdCharSection, tab.__csdFxSection]))) { await reloadPackCaches(); await buildPanel(tab, ctx); }
      } catch (e) { console.error("Strip Director: FX import failed", e); new Notice("FX import failed — see console."); }
    };
    if (rfx.length) {
      const rfxGrid = rfxWrap.createDiv(); rfxGrid.style.cssText = "display:flex;flex-wrap:wrap;gap:5px";
      rfx.forEach((entry) => {
        const cell = rfxGrid.createDiv();
        cell.style.cssText = "width:52px;cursor:pointer;text-align:center;border:1px solid var(--background-modifier-border);border-radius:5px;padding:3px;background:var(--background-secondary)";
        cell.title = entry.word || entry.name || entry.id;
        const url = fxThumbURL(entry);
        if (url) { const img = cell.createEl("img"); img.src = url; img.style.cssText = "width:44px;height:44px;object-fit:contain"; img.setAttr("loading", "lazy"); }
        else { cell.createEl("div", { text: entry.word || entry.id }).style.cssText = "font-size:0.6em"; }
        makeActivatable(cell, async () => { await placeRasterFX(entry); });
      });
    } else {
      const none = rfxWrap.createEl("div", { text: "None yet — import a Comic FX pack for painted effects." });
      none.style.cssText = "font-size:0.72em;color:var(--text-muted)";
    }
  }

  // (The old "Layout template" dropdown was removed — the visual layout picker in
  // "Build a page" supersedes it; its "Fit to view" moved next to the aspect toggle.)
}

// AI characters — the guided who → costume → action picker, with pack import and
// the Manage panel. Async (loads the roster + figures). Returns false if a newer
// buildPanel run superseded this one mid-await (so the caller stops before
// appending the callout/footer sections), true otherwise.
async function renderCharacters(contentEl, tab, ctx, __gen) {
  {
    const aiData = await ctx.ensureAIFigures();
    const list = (aiData && aiData.figures) || [];
    const rosterNew = (await ctx.ensureRoster()) || { characters: [], functions: [], actions: [] };
    const rosterLegacy = (await ctx.ensureRosterLegacy()) || { characters: [], functions: [], actions: [] };
    // A newer buildPanel run superseded this one while we awaited — abort so we don't
    // append a second "AI characters" section over the newer render.
    if (tab.__buildGen !== __gen) return false;
    // Active library: "new" (default) or "legacy". Each swaps the roster shown AND
    // the cacheKey namespace used to resolve figures (legacy ids are "legacy-…").
    let AI_LIB = "new";
    let chars = rosterNew.characters || [];
    let funcs = rosterNew.functions || [];
    let acts = rosterNew.actions || [];
    const libPrefix = () => (AI_LIB === "legacy" ? "legacy-" : "");
    function applyLib(lib) {
      AI_LIB = lib;
      const r = (lib === "legacy") ? rosterLegacy : rosterNew;
      chars = r.characters || []; funcs = r.functions || []; acts = r.actions || [];
    }
    const hasAnyRoster = (rosterNew.characters || []).length || (rosterLegacy.characters || []).length;

    const sec = contentEl.createDiv();
    tab.__csdCharSection = sec;                // import lock target (locked together with FX)
    sec.style.margin = "14px 0 0";
    sec.style.paddingTop = "10px";
    sec.style.borderTop = "1px solid var(--background-modifier-border)";
    const hRow = sec.createDiv();
    hRow.style.cssText = "display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:0 0 2px";
    const h = hRow.createEl("div", { text: "Characters" });
    h.style.fontWeight = "600"; h.style.fontSize = "0.95em";
    // Manage lives on the character header (it filters this section), not in the import
    // toolbar. Created here; wired to its panel further down.
    const manageBtn = hRow.createEl("button", { text: "⚙ Manage" });
    styleActionBtn(manageBtn); manageBtn.style.marginLeft = "auto";
    manageBtn.title = "Show or hide imported characters in the picker";
    const sub = sec.createEl("div", { text: "Pick a character → a role → an action. The action stamps into the next empty slot." });
    sub.style.fontSize = "0.78em"; sub.style.color = "var(--text-muted)"; sub.style.margin = "0 0 8px";

    // --- Character packs: import + enable/disable -----------------------------
    // Set below once the picker's render() exists, so toggling a character can
    // repaint the picker in place.
    let rerenderPicker = () => {};
    // A full, clean rebuild of the side panel (buildPanel empties contentEl first).
    const refreshPanel = async (force) => {
      if (force) { await loadRoster(true); await loadAIFigures(true); await loadRosterLegacy(true); }
      await buildPanel(tab, ctx);
    };

    const packBar = sec.createDiv();
    packBar.style.display = "flex"; packBar.style.flexWrap = "wrap"; packBar.style.gap = "6px"; packBar.style.margin = "0 0 8px";

    if (!_freeTierInstalled()) {
      const freeBtn = packBar.createEl("button", { text: "⭐ Get the free starter pack" });
      styleActionBtn(freeBtn, { accent: true });
      freeBtn.title = "One click: downloads the free Core Cast + FX packs and imports them";
      freeBtn.onclick = async () => {
        try {
          if (await downloadFreeStarterPacks(() => createImportProgressMulti([tab.__csdCharSection, tab.__csdFxSection]))) { await reloadPackCaches(); await buildPanel(tab, ctx); }
        } catch (e) { console.error("Strip Director: starter pack install failed", e); new Notice("Starter pack install failed — see console."); }
      };
    }
    const importBtn = packBar.createEl("button", { text: "⬇ Import pack…" });
    styleActionBtn(importBtn);
    importBtn.title = "Install a .strippack character pack";
    importBtn.onclick = async () => {
      try {
        if (await importPacksFlow("Pick a character pack — or import all", () => createImportProgressMulti([tab.__csdCharSection, tab.__csdFxSection]))) { await reloadPackCaches(); await buildPanel(tab, ctx); }
      } catch (e) {
        console.error("Strip Director: import failed", e);
        new Notice("Import failed — see console for details.");
      }
    };

    // Store button flows right after Import — auto-margins in a WRAPPING row
    // leave an orphaned right-pushed button on the second line when it wraps.
    addStoreBtn(packBar, "🛒 More characters & packs");
    const managePanel = sec.createDiv();
    managePanel.style.display = "none"; managePanel.style.margin = "0 0 10px"; managePanel.style.padding = "8px";
    managePanel.style.border = "1px solid var(--background-modifier-border)"; managePanel.style.borderRadius = "6px";
    managePanel.style.background = "var(--background-secondary)";
    manageBtn.onclick = () => {
      const open = managePanel.style.display !== "none";
      managePanel.style.display = open ? "none" : "block";
      if (!open) renderManage();
    };
    function renderManage() {
      managePanel.empty();
      const disabled = getDisabledChars();
      const hint = managePanel.createEl("div", { text: "Click a character to show or hide it in the picker. Hidden characters stay installed." });
      hint.style.fontSize = "0.74em"; hint.style.color = "var(--text-muted)"; hint.style.margin = "0 0 6px";
      const wrap = managePanel.createDiv();
      wrap.style.display = "flex"; wrap.style.flexWrap = "wrap"; wrap.style.gap = "5px";
      // Only the characters actually imported (have figures) — matches the picker,
      // including ids the roster doesn't know (synthesised names).
      const present = new Set((list || []).filter((f) => f.character).map((f) => f.character));
      const rosterChars = rosterNew.characters || [];
      const manageable = rosterChars.filter((c) => present.has(c.id))
        .concat([...present].filter((id) => !rosterChars.some((c) => c.id === id)).map((id) => ({ id, name: prettyId(id) })));
      if (!manageable.length) {
        const none = wrap.createEl("div", { text: "No characters imported yet." });
        none.style.cssText = "font-size:0.74em;color:var(--text-muted)";
      }
      manageable.forEach((c) => {
        const off = disabled.has(c.id);
        const chip = wrap.createEl("button", { text: (off ? "◻ " : "◼ ") + c.name });
        chip.style.fontSize = "0.74em"; chip.style.padding = "2px 8px"; chip.style.borderRadius = "10px"; chip.style.cursor = "pointer";
        chip.style.border = "1px solid var(--background-modifier-border)";
        chip.style.background = off ? "var(--background-primary)" : "var(--interactive-accent)";
        chip.style.color = off ? "var(--text-muted)" : "var(--text-on-accent)";
        chip.style.opacity = off ? "0.6" : "1";
        chip.onclick = () => { setCharDisabled(c.id, !off); renderManage(); rerenderPicker(); };
      });
      const n = [...getDisabledChars()].filter((id) => present.has(id)).length;
      const foot = managePanel.createEl("div", { text: n ? `${n} character${n > 1 ? "s" : ""} hidden` : "All characters visible" });
      foot.style.fontSize = "0.72em"; foot.style.color = "var(--text-muted)"; foot.style.marginTop = "6px";
    }

    if (!hasAnyRoster || !list.length) {
      const note = sec.createEl("div", { text: !hasAnyRoster
        ? "No roster.json found in your AI Figures folder."
        : "No AI figures generated yet — run the composer, then reopen." });
      note.style.fontSize = "0.78em"; note.style.color = "var(--text-muted)";
    } else {
      // Thumbnail URL for a character × role × action combo (or null if missing).
      // Uses the active library's namespace so New and Legacy both resolve.
      const thumb = (c, f, a) => { const e = findComposed(c, f, a, libPrefix()); return e ? aiThumbURL(e) : null; };
      const prefs = (ea.getScriptSettings && ea.getScriptSettings()) || {};
      const savePrefs = (patch) => { try { const s = ea.getScriptSettings() || {}; Object.assign(s, patch); ea.setScriptSettings(s); } catch (e) {} };
      // Restore last pick ("" is a valid value = the Generic character / Plain role).
      let selChar = (prefs.lastChar === "" || chars.some((c) => c.id === prefs.lastChar)) ? prefs.lastChar : null;
      let selFunc = (selChar != null && typeof prefs.lastFunc === "string") ? prefs.lastFunc : null;
      let selPack = typeof prefs.lastPack === "string" ? prefs.lastPack : null;   // null = all packs

      // Library toggle: New (all characters) ⇄ Legacy (original set). Shown only
      // when a legacy roster exists. Switching swaps roster + lookup namespace.
      let repaintLib = () => {};
      if ((rosterLegacy.characters || []).length) {
        const libRow = sec.createDiv();
        libRow.style.display = "flex"; libRow.style.gap = "6px"; libRow.style.margin = "0 0 8px";
        const btns = [["new", "New (" + (rosterNew.characters || []).length + ")"],
                      ["legacy", "Legacy (" + (rosterLegacy.characters || []).length + ")"]]
          .map(([lib, text]) => {
            const b = libRow.createEl("button", { text });
            b.style.fontSize = "0.75em"; b.style.padding = "2px 10px"; b.style.borderRadius = "5px";
            b.style.border = "1px solid var(--background-modifier-border)"; b.style.cursor = "pointer";
            b.onclick = () => { if (AI_LIB === lib) return; applyLib(lib); selChar = null; selFunc = null; repaintLib(); render(); };
            return { lib, b };
          });
        repaintLib = () => btns.forEach(({ lib, b }) => {
          const on = AI_LIB === lib;
          b.style.background = on ? "var(--interactive-accent)" : "var(--background-secondary)";
          b.style.color = on ? "var(--text-on-accent)" : "var(--text-normal)";
        });
        repaintLib();
      }

      const stepWrap = sec.createDiv();

      function tile(parent, url, label, selected, onClick) {
        const cell = parent.createDiv();
        cell.style.width = "64px"; cell.style.cursor = "pointer"; cell.style.textAlign = "center";
        cell.style.border = selected ? "2px solid var(--interactive-accent)" : "1px solid var(--background-modifier-border)";
        cell.style.borderRadius = "5px"; cell.style.padding = "3px";
        cell.style.background = selected ? "var(--background-modifier-hover)" : "var(--background-secondary)";
        cell.title = label;
        if (url) {
          const img = cell.createEl("img");
          img.src = url; img.style.width = "56px"; img.style.height = "56px";
          img.style.objectFit = "contain"; img.setAttr("loading", "lazy");
          img.style.background = "#ffffff"; img.style.borderRadius = "3px";
        } else {
          const ph = cell.createDiv(); ph.style.width = "56px"; ph.style.height = "56px";
          ph.style.display = "flex"; ph.style.alignItems = "center"; ph.style.justifyContent = "center";
          ph.style.fontSize = "0.7em"; ph.setText("▦");
        }
        const cap = cell.createEl("div", { text: label });
        cap.style.fontSize = "0.62em"; cap.style.lineHeight = "1.1"; cap.style.marginTop = "2px";
        cap.style.whiteSpace = "nowrap"; cap.style.overflow = "hidden"; cap.style.textOverflow = "ellipsis";
        makeActivatable(cell, onClick);
        return cell;
      }
      function grid(parent) {
        const g = parent.createDiv();
        g.style.display = "flex"; g.style.flexWrap = "wrap"; g.style.gap = "6px"; g.style.marginBottom = "4px";
        return g;
      }
      function stepLabel(parent, text) {
        const l = parent.createEl("div", { text });
        l.style.fontSize = "0.76em"; l.style.fontWeight = "600"; l.style.color = "var(--text-muted)";
        l.style.margin = "8px 0 4px";
      }

      function render() {
        stepWrap.empty();
        const DISABLED = getDisabledChars();

        // Index what's ACTUALLY in the library for the active lib, so the picker only
        // offers characters / costumes / actions that have a real figure — and every
        // tile shows a real thumbnail. Someone who imported only the Superhero pack
        // sees those 8 characters AS superheroes, only the Superhero costume, and only
        // its actions — no blank placeholders for figures they don't own.
        // The New/Legacy split only exists for vaults that HAVE a legacy roster
        // (the toggle). Without one, imported packs may still carry lib:"legacy"
        // figures (e.g. legacy-art character packs) — show EVERYTHING, deduped
        // per combo, preferring non-legacy art for thumbnails.
        const hasLegacyRoster = ((rosterLegacy && rosterLegacy.characters) || []).length > 0;
        const inLib = (f) => !hasLegacyRoster || (AI_LIB === "legacy" ? f.lib === "legacy" : f.lib !== "legacy");
        const rank = (f) => (f.action === "present" ? 3 : f.action === "stand" ? 2 : f.action === "wave" ? 1 : 0) * 2 + (f.lib !== "legacy" ? 1 : 0);
        // PACK FILTER (step 0) — group figures by the website product they came
        // from (split parts collapse into their parent pack). Chips only appear
        // when more than one product is present, so pack-less libraries see no noise.
        const instProducts = _installedPackProducts();
        // A figure can belong to SEVERAL packs (the all-new bundle plus a theme
        // pack that ships the same art) — count and filter by every owner.
        const prodsOf = (f) => {
          const ids = (Array.isArray(f.packs) && f.packs.length) ? f.packs : [f.pack];
          const out = new Set();
          for (const pid of ids) out.add(packProductOf(pid, instProducts));
          return out;
        };
        const packsHere = new Map();             // product → figure count (lib-filtered)
        for (const f of list) {
          if (!inLib(f)) continue;
          for (const prod of prodsOf(f)) packsHere.set(prod, (packsHere.get(prod) || 0) + 1);
        }
        if (selPack != null && !packsHere.has(selPack)) selPack = null;  // pack no longer present
        if (packsHere.size > 1) {
          stepLabel(stepWrap, "Pack");
          const pRow = stepWrap.createDiv();
          pRow.style.cssText = "display:flex;flex-wrap:wrap;gap:4px;margin:0 0 2px";
          const chip = (label, active, onClick) => {
            const b = pRow.createEl("button", { text: label });
            b.style.cssText = "font-size:0.68em;padding:2px 8px;border-radius:5px;cursor:pointer;border:1px solid " +
              (active ? "var(--interactive-accent);background:var(--interactive-accent);color:var(--text-on-accent)"
                      : "var(--background-modifier-border);background:var(--background-secondary);color:var(--text-normal)");
            makeActivatable(b, onClick);
          };
          chip("All packs", selPack == null, () => { selPack = null; savePrefs({ lastPack: null }); render(); });
          const order = (prod) => { const i = PACK_PRODUCTS.findIndex((x) => x.id === prod); return i < 0 ? PACK_PRODUCTS.length : i; };
          [...packsHere.keys()].sort((a, b) => order(a) - order(b) || String(a).localeCompare(String(b))).forEach((prod) => {
            chip(packProductLabel(prod) + " · " + packsHere.get(prod), selPack === prod,
              () => { selPack = prod; savePrefs({ lastPack: prod }); render(); });
          });
        }

        const charSet = new Set(), charFuncs = new Map(), comboActs = new Map();
        const charRep = new Map(), comboRep = new Map(), comboFig = new Map();
        for (const f of list) {
          if (!inLib(f)) continue;
          if (selPack != null && !prodsOf(f).has(selPack)) continue;
          const ch = f.character || "", fn = f.function || "", key = ch + "|" + fn;
          charSet.add(ch);
          if (!charFuncs.has(ch)) charFuncs.set(ch, new Set());
          charFuncs.get(ch).add(fn);
          // Action-less figures are reachable under a synthetic "pose" action, so a
          // pack of untagged art never creates a dead-end costume.
          const act = f.action || "pose";
          if (!comboActs.has(key)) comboActs.set(key, new Set());
          comboActs.get(key).add(act);
          const k3 = key + "|" + act;
          if (!comboFig.has(k3) || rank(f) > rank(comboFig.get(k3))) comboFig.set(k3, f);
          if (!charRep.has(ch) || rank(f) > rank(charRep.get(ch))) charRep.set(ch, f);
          if (!comboRep.has(key) || rank(f) > rank(comboRep.get(key))) comboRep.set(key, f);
        }
        const repURL = (m, k) => { const e = m.get(k); return e ? aiThumbURL(e) : null; };

        // Self-heal the vocabulary: a pack may ship figures whose character /
        // costume / action ids are missing from the roster (or ship no roster
        // arrays at all). Figures are the source of truth — synthesise entries
        // with prettified names so imported content is ALWAYS reachable.
        const funcSet = new Set(), actSet = new Set();
        for (const s of charFuncs.values()) for (const id of s) if (id) funcSet.add(id);
        for (const s of comboActs.values()) for (const id of s) actSet.add(id);
        const charsAll = chars.concat([...charSet].filter((id) => id && !chars.some((c) => c.id === id)).map((id) => ({ id, name: prettyId(id) })));
        const funcsAll = funcs.concat([...funcSet].filter((id) => !funcs.some((f) => f.id === id)).map((id) => ({ id, name: prettyId(id) })));
        const actsAll = acts.concat([...actSet].filter((id) => !acts.some((a) => a.id === id)).map((id) => ({ id, label: prettyId(id) })));

        // Drop stale selections (character/costume no longer present, or hidden).
        if (selChar != null && (DISABLED.has(selChar) || !charSet.has(selChar))) { selChar = null; selFunc = null; }
        if (selChar != null && selFunc != null) {
          const fs = charFuncs.get(selChar);
          if (!fs || !fs.has(selFunc)) selFunc = null;
        }

        // STEP 1 — WHO (only characters that have figures; thumbnail = a real figure)
        stepLabel(stepWrap, "1 · Who");
        const g1 = grid(stepWrap);
        charsAll.filter((c) => charSet.has(c.id) && !DISABLED.has(c.id)).forEach((c) => {
          tile(g1, repURL(charRep, c.id), c.name, selChar === c.id, () => {
            selChar = c.id; selFunc = null; savePrefs({ lastChar: c.id }); render();
          });
        });
        // Generic = a character-less figure — offered whenever such figures exist.
        if (charSet.has("")) {
          tile(g1, repURL(charRep, ""), "Generic", selChar === "", () => {
            selChar = ""; selFunc = null; savePrefs({ lastChar: "" }); render();
          });
        }
        if (!g1.children.length) {
          const disabledHere = charsAll.some((c) => charSet.has(c.id) && DISABLED.has(c.id));
          const none = g1.createEl("div", { text: disabledHere
            ? "Every imported character is hidden — open ⚙ Manage characters to show some."
            : "No characters yet — click ⭐ Get the free starter pack above (one click), import a .strippack, or" });
          none.style.fontSize = "0.74em"; none.style.color = "var(--text-muted)";
          if (!disabledHere) addStoreLink(none, " get characters at comicstripdirector.com →");
        }
        if (selChar == null) return;

        // STEP 2 — AS WHAT (only costumes that exist for this character; Plain if present)
        stepLabel(stepWrap, "2 · As what");
        const g2 = grid(stepWrap);
        const fset = charFuncs.get(selChar) || new Set();
        if (selChar !== "" && fset.has("")) {
          tile(g2, repURL(comboRep, selChar + "|"), "Plain", selFunc === "", () => {
            selFunc = ""; savePrefs({ lastFunc: "" }); render();
          });
        }
        funcsAll.filter((f) => fset.has(f.id)).forEach((f) => {
          tile(g2, repURL(comboRep, selChar + "|" + f.id), f.name, selFunc === f.id, () => {
            selFunc = f.id; savePrefs({ lastFunc: f.id }); render();
          });
        });
        if (selFunc == null) return;

        // STEP 3 — DOING WHAT (only actions that exist for this character+costume)
        stepLabel(stepWrap, "3 · Doing what — click to place");
        const g3 = grid(stepWrap);
        const aset = comboActs.get(selChar + "|" + selFunc) || new Set();
        actsAll.filter((a) => aset.has(a.id)).forEach((a) => {
          // Stamp the indexed figure entry directly — robust to any cacheKey
          // namespace an imported pack uses. Composer only as fallback.
          const entry = comboFig.get(selChar + "|" + selFunc + "|" + a.id);
          const cell = tile(g3, entry ? aiThumbURL(entry) : thumb(selChar, selFunc, a.id), a.label || a.id, false, async () => {
            if (entry && ctx.placeAIFigure) { await ctx.placeAIFigure(entry); return; }
            if (ctx.composeOrPlace) await ctx.composeOrPlace({ character: selChar, func: selFunc, action: a.id, lib: AI_LIB });
          });
          if (entry && (entry.pack || entry.packs)) cell.title = (a.label || a.id) + " — " + [...prodsOf(entry)].map(packProductLabel).join(", ");
        });
      }
      rerenderPicker = render;
      render();
    }
  }
  return true;
}

// Split-the-selected-panel action buttons (diagonal / horizontal cuts).
function renderSplitSection(contentEl, ctx) {
  const row = section(contentEl, "Split the selected panel", "Local action-beat cut — carve the panel you've selected into regions, each its own placement target");
  const bar = toolbarRow(row);
  SPLIT_OPTIONS.forEach((opt) => {
    const bc = new ea.obsidian.ButtonComponent(bar)
      .setButtonText(opt.label)
      .setTooltip(opt.tip)
      .onClick(() => ctx.splitSelectedPanel && ctx.splitSelectedPanel(opt.id));
    if (bc.buttonEl) styleActionBtn(bc.buttonEl);
  });
}

// Hand-drawn vector library (optional figures.json) — only shown when present, so
// fresh free-tier installs aren't confronted with a feature they don't have.
function renderVectorLibrary(contentEl, ctx) {
  if (!FIGURES) return;
  const row = section(contentEl, "Hand-drawn vector library", "Your original figures.json set — pick a style, then a figure, to stamp into the selected panel");
  const bar = toolbarRow(row);
  const figBC = new ea.obsidian.ButtonComponent(bar)
    .setButtonText("+ Figure").setCta()
    .setTooltip("Choose style → figure, then stamp it into the selected panel")
    .onClick(async () => {
      const data = await ctx.ensureFigures();
      if (!data) { new Notice(`No figure library found (${FIGURES_FILE}).`); return; }
      const style = await pickFromList(data.styles, data.styles, "Style");
      if (style === undefined) return;
      const figs = figuresForStyle(style);
      if (!figs.length) { new Notice(`No figures in style "${style}".`); return; }
      const id = await pickFromList(figs.map((f) => f.id), figs.map((f) => f.name), `${style} — pick a figure`);
      if (id === undefined) return;
      const figure = figs.find((f) => f.id === id);
      if (ctx.placeFigure) await ctx.placeFigure(figure);
    });
  if (figBC.buttonEl) styleActionBtn(figBC.buttonEl, { accent: true });
}

// Reserve-a-callout-zone control + a link that opens the companion Callout Editor.
function renderCalloutSection(contentEl, ctx) {
  const row = section(contentEl, "Callout zone", "Reserve a speech/caption area — fill it with the Comicbook Callout Editor");
  const bar = toolbarRow(row);
  const zoneBC = new ea.obsidian.ButtonComponent(bar)
    .setButtonText("+ Callout zone")
    .setTooltip("Adds a reserved zone to the selected panel (run Comicbook Callout Editor to letter it)")
    .onClick(() => ctx.addCalloutZone && ctx.addCalloutZone());
  if (zoneBC.buttonEl) styleActionBtn(zoneBC.buttonEl, { accent: true });
  // Companion-script icon (same pattern the Callout Editor uses for THIS script):
  // installed → the Callout Editor's own icon, click runs it; not installed →
  // an ⓘ icon whose click shows a Script Recommendation dialog.
  try {
    const _iconHTML = (name, fallback) => { try { return ea.obsidian.getIcon(name).outerHTML; } catch (e) { return fallback; } };
    const btn = bar.createEl("button", { cls: "clickable-icon" });
    btn.style.cssText = "padding:2px;background:transparent;box-shadow:none;border:none;cursor:pointer;display:inline-flex;align-items:center";
    const appRef = _vaultApp();
    const scriptsFolder = (((ea.plugin && ea.plugin.settings && ea.plugin.settings.scriptFolderPath) || "Excalidraw/Scripts").replace(/\/+$/, "")) + "/";
    const f = (appRef.vault.getMarkdownFiles ? appRef.vault.getMarkdownFiles() : [])
      .find((x) => x.name === "Comicbook Callout Editor.md" && x.path.startsWith(scriptsFolder));
    const svgFile = (appRef.vault.getFiles ? appRef.vault.getFiles() : [])
      .find((x) => x.name === "Comicbook Callout Editor.svg" && x.path.startsWith(scriptsFolder));
    if (f) {
      if (svgFile) {
        appRef.vault.read(svgFile).then((svg) => {
          btn.innerHTML = svg;
          const el = btn.querySelector && btn.querySelector("svg");
          if (el) { el.style.width = "24px"; el.style.height = "24px"; }
        }).catch(() => { btn.innerHTML = _iconHTML("message-square", "💬"); });
      } else {
        btn.innerHTML = _iconHTML("message-square", "💬");
      }
      btn.title = "Open Comicbook Callout Editor";
      btn.setAttribute("aria-label", "Open Comicbook Callout Editor");
      btn.onclick = () => openCalloutEditor();
    } else {
      btn.innerHTML = _iconHTML("info", "ⓘ");
      btn.title = "Comicbook Callout Editor recommended";
      btn.setAttribute("aria-label", "Comicbook Callout Editor recommended");
      btn.onclick = () => {
        const modal = new ea.obsidian.Modal(appRef);
        modal.onOpen = () => {
          const c = modal.contentEl;
          c.createEl("h3", { text: "Script Recommendation" });
          c.createEl("p", { text: "For speech bubbles and captions, please install the 'Comicbook Callout Editor' script from the Excalidraw script store." });
          const bc = c.createDiv({ attr: { style: "display: flex; justify-content: flex-end; margin-top: 20px;" } });
          const ok = bc.createEl("button", { text: "OK", cls: "mod-cta" });
          ok.onclick = () => modal.close();
        };
        modal.open();
      };
    }
  } catch (e) { console.error("Comic Strip Director: callout companion icon failed", e); }
}

// Footer — quiet store credit on the left, Close on the right.
function renderFooter(contentEl) {
  const footer = contentEl.createDiv();
  footer.style.marginTop = "14px";
  footer.style.display = "flex";
  footer.style.flexWrap = "wrap";
  footer.style.alignItems = "center";
  footer.style.justifyContent = "space-between";
  footer.style.gap = "10px";
  addStoreLink(footer, "🛒 More characters, costumes & FX packs — comicstripdirector.com");
}

// ===========================================================================
// BOOTSTRAP
// ===========================================================================
const ctx = {
  splitSelectedPanel,
  addCalloutZone,
  placeFigure,
  placeAIFigure,
  composeOrPlace,
  fitToView,
  ensureFigures: () => loadFigures(false),
  ensureAIFigures: () => loadAIFigures(false),
  ensureRoster: () => loadRoster(false),
  ensureRosterLegacy: () => loadRosterLegacy(false),
  ensureFXFigures: () => loadFXFigures(false),
};

ea.createSidepanelTab("Strip Director", false, true).then(async (tab) => {
  await resolveBundleDir();                    // locate the data folder (scripts root or Downloaded/)
  await loadFigures(false);                    // preload so the status line is accurate
  await loadAIFigures(false);                  // preload AI-composed figures (if any)
  await loadRoster(false);                     // preload the character-system roster (R7)
  await loadRosterLegacy(false);               // preload legacy roster too, so both racing renders hit warm cache
  await loadFXFigures(false);                  // preload painted FX so the FX picker is populated
  tab.onOpen = async () => { await loadFigures(false); await loadAIFigures(false); await loadRoster(false); await loadRosterLegacy(false); await loadFXFigures(false); await buildPanel(tab, ctx); };
  tab.onFocus = async (view) => {
    if (view && view !== ea.targetView) { ea.setView(view); ea.clear(); }
  };
  buildPanel(tab, ctx);
  tab.open();
});
