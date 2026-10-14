---
excalidraw-script: true
---

/*
╭──────────────────────────────────────────────────────────────────────────────╮
│ FRACTAL INDEX v1.0.0                                                        │
│ A "fractal brain" layer on top of the Obsidian Excalidraw plugin.           │
│                                                                              │
│ WHAT IT DOES                                                                │
│   Run this script while viewing an Excalidraw drawing that lives in a       │
│   folder. The drawing becomes a live INDEX of that folder:                  │
│     • every note/file in the folder  → a clickable node card                │
│     • every subfolder               → a "pod" with an embedded, zoomable    │
│                                        preview of that subfolder's own      │
│                                        index drawing (infinite recursion)   │
│     • nodes link to their files; pods link to their sub-indexes             │
│                                                                              │
│   THE STATIC-POSITION GUARANTEE                                             │
│     Every node's position is derived from a stable slot persisted in the    │
│     element's customData. Regenerating the index NEVER moves existing       │
│     nodes. New items are appended after the high-water mark. Renamed       │
│     folders keep all their node positions (matched by basename).            │
│                                                                              │
│ CONVENTION                                                                  │
│   Each folder's index is  <folder>/_index.excalidraw.md                     │
│   The script can create missing sub-index drawings (empty template) so      │
│   you can open them and run the script again — one level per run.           │
│                                                                              │
│ USAGE                                                                       │
│   1. Create a new Excalidraw drawing named `_index` inside a folder.        │
│   2. Run this script from that drawing.                                     │
│   3. Pick "folder + create sub-indexes" the first time.                     │
│   4. Open each generated sub `_index` drawing and re-run the script there.  │
│   Re-run any time — existing node positions are preserved.                  │
│                                                                              │
│ v1.0.0 · MIT License · tested against Excalidraw plugin 2.28.1              │
│ Settings (edit CFG below): card size, grid columns, pod size, colors.       │
╰──────────────────────────────────────────────────────────────────────────────╯
*/

if (!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("2.0.0")) {
  new Notice("Fractal Index: this script requires Excalidraw plugin version 2.0.0 or newer. Please update the Excalidraw plugin.");
  return;
}


const CFG = {
  indexName: "_index.excalidraw.md",
  maxItems: 500,
  maxLinks: 60,
  layoutVersion: 3, // bump to re-layout existing maps with the new engine (v3: balanced square grid + orientation spines)
  direction: "TD", // "TD" = top-down (hierarchy, default) | "LR" = left-right (journey)
  fileCard: { w: 230, h: 64, cols: 5, gx: 36, gy: 26, fontSize: 20, wrapAt: 26 },
  pod: { w: 380, h: 300, gapY: 60, gapX: 60, fontSize: 26 },
  embed: { marginX: 20, topOffset: 96, bottomMargin: 16 },
  colors: {
    folderStroke: "#8b5cf6",
    arrow: "#c4c4c4",
    link: "#a78bfa",
    muted: "#8a8a8a",
    text: "#1e1e1e",
  },
  gridX0: 480, // TD: files grid starts right of the pod column
  gridY0: 160,
};

/* ── deterministic helpers ─────────────────────────────────────────────── */
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h >>> 0;
}
function sid(seed) {
  // stable, URL-safe element id from a seed string
  return "fi" + fnv1a(seed).toString(36) + (fnv1a(seed + "#2") % 1679616).toString(36).padStart(4, "0");
}
function basename(p) { const s = p.split("/").pop(); return s; }

/* ── ELK first-run layout ("ELK proposes, slots dispose") ────────────────
   On FIRST generation (no previous elements), elkjs computes a layered
   layout from the link graph: connected files group together, pods sized
   by content. Falls back to the deterministic grid when offline.
   After first placement, the adoption system preserves positions forever. */
function loadElk() {
  // elkjs bundled build exposes global `ELK` (not `elk`). Hard 8s cap so a
  // blocked/stalled CDN can never hang a run — grid fallback takes over.
  return new Promise((resolve) => {
    const done = (v) => resolve(v ? new v() : null);
    const Ctor = globalThis.ELK || globalThis.elk;
    if (Ctor) return done(Ctor);
    if (typeof document === "undefined" || !document.head) return resolve(null);
    const timer = setTimeout(() => resolve(null), 8000);
    const script = document.createElement("script");
    script.onload = () => {
      clearTimeout(timer);
      done(globalThis.ELK || globalThis.elk || null);
    };
    script.onerror = () => { clearTimeout(timer); resolve(null); };
    script.src = "https://cdn.jsdelivr.net/npm/elkjs@0.8.2/lib/elk.bundled.min.js";
    document.head.appendChild(script);
  });
}

async function computeElkLayout(files, subfolders, resolvedLinks, podContentCounts, isFirstRun) {
  if (!isFirstRun || (!files.length && !subfolders.length)) return null;
  const elk = await loadElk();
  if (!elk) return null; // offline: fall back to grid
  try {
    const children = [];
    const edges = [];
    // file nodes
    for (const f of files) {
      children.push({
        id: f.path,
        width: Math.max(120, (f.basename.length + 3) * 11 + 24),
        height: 48,
      });
    }
    // pod nodes (sized by content)
    for (const sf of subfolders) {
      children.push({
        id: sf.path + "/",
        width: 380,
        height: Math.max(200, 120 + (podContentCounts.get(sf.path) || 1) * 40),
      });
    }
    // edges from resolved links
    const seen = new Set();
    for (const src in resolvedLinks) {
      const targets = resolvedLinks[src];
      for (const tp in targets) {
        if (!targets[tp]) continue;
        const srcId = files.some((f) => f.path === src) ? src
          : subfolders.some((sf) => src.startsWith(sf.path + "/")) ? subfolders.find((sf) => src.startsWith(sf.path + "/")).path + "/"
          : null;
        const dstId = files.some((f) => f.path === tp) ? tp
          : subfolders.some((sf) => tp === sf.path || tp.startsWith(sf.path + "/")) ? subfolders.find((sf) => tp === sf.path || tp.startsWith(sf.path + "/")).path + "/"
          : null;
        if (srcId && dstId && srcId !== dstId) {
          const ek = srcId + "=>" + dstId;
          if (!seen.has(ek)) { seen.add(ek); edges.push({ id: ek, sources: [srcId], targets: [dstId] }); }
        }
      }
    }
    const graph = {
      id: "root",
      layoutOptions: {
        "elk.algorithm": "layered",
        "elk.direction": "DOWN",
        "elk.spacing.nodeNode": "60",
        "elk.spacing.edgeNode": "30",
        "elk.layered.spacing.nodeNodeBetweenLayers": "80",
        "elk.hierarchyHandling": "INCLUDE_CHILDREN",
      },
      children,
      edges,
    };
    const result = await Promise.race([
      elk.layout(graph),
      new Promise((_, rej) => setTimeout(() => rej(new Error("elk layout timeout")), 15000)),
    ]);
    const positions = new Map();
    for (const ch of result.children || []) {
      positions.set(ch.id, { x: ch.x, y: ch.y, width: ch.width, height: ch.height });
    }
    return positions.size ? positions : null;
  } catch (e) {
    return null; // any ELK error falls back to grid
  }
}
/* wikilink-safe: escape characters that would break [[...]] parsing */
function wl(path) {
  return "[[" + String(path).replace(/([\[\]|])/g, "\\$1") + "]]";
}

/* ── minimal template for new _index drawings ──────────────────────────── */
function indexTemplate(folderName) {
  const scene = {
    type: "excalidraw",
    version: 2,
    source: "fractal-index",
    elements: [],
    appState: { grid: null, viewBackgroundColor: "#ffffff" },
    files: {},
  };
  return [
    "---",
    "excalidraw-plugin: parsed",
    "tags: [excalidraw]",
    "cssclasses: [fractal-index]",
    "---",
    "",
    "# Excalidraw Data",
    "## Text Elements",
    "",
    "## Drawing",
    "```json",
    JSON.stringify(scene),
    "```",
    "",
  ].join("\n");
}

/* ── main ──────────────────────────────────────────────────────────────── */
try {
  const view = ea.targetView;
  if (!view || !view.file) {
    new Notice("Fractal Index: open a drawing first (its folder becomes the index root).");
  } else {
    const indexFile = view.file;
    const folder = indexFile.parent || app.vault.getRoot();

    // when Fractal Sync drives this script, options arrive via window flag (no prompts)
    const syncOpts = globalThis.__fractalSyncOptions || null;
    let scope, drawLinks, direction;
    if (syncOpts) {
      scope = syncOpts.scope;
      drawLinks = syncOpts.links;
      direction = syncOpts.direction || "TD";
    } else {
      scope = await utils.suggester(
        ["This folder only", "This folder + create missing sub-indexes", "Cancel"],
        ["self", "self+create", "cancel"],
        "Fractal Index — scope?"
      );
    }
    if (scope === "cancel" || !scope) {
      new Notice("Fractal Index: canceled.");
    } else {
      const createSub = scope === "self+create";
      const RL = (app.metadataCache && app.metadataCache.resolvedLinks) || {};
      if (drawLinks === undefined) {
        drawLinks = await utils.suggester(
          ["With note-link arrows (ExcaliBrain dimension)", "Without link arrows"],
          [true, false],
          "Draw arrows between notes that link to each other?"
        );
      }
      if (direction === undefined) {
        direction = await utils.suggester(
          ["Top-down (hierarchy — pods stacked)", "Left-right (journey — pods side by side)"],
          ["TD", "LR"],
          "Map direction? (Mermaid convention: TD for processes, LR for pipelines)"
        ) || "TD";
      }
      // stored direction from a previous run takes priority over the prompt:
      // to change direction, delete the _index drawing and regenerate
      const prevTitleEl = ea.getViewElements().find((el) => !el.isDeleted && el.customData && el.customData.fractalIndex && el.customData.kind === "title");
      const storedDirection = prevTitleEl && prevTitleEl.customData ? prevTitleEl.customData.direction : null;
      if (storedDirection) direction = storedDirection;

      /* scan folder */
      const children = folder.children || [];
      const subfolders = children
        .filter((c) => c.children && !c.name.startsWith("."))
        .sort((a, b) => a.name.localeCompare(b.name));
      const files = children
        .filter((c) => !c.children && !c.name.startsWith(".") && c.path !== indexFile.path)
        .sort((a, b) => a.name.localeCompare(b.name));

      if (!files.length && !subfolders.length) {
        new Notice("Fractal Index: this folder is empty — nothing to index.");
        return;
      }
      if (files.length + subfolders.length > CFG.maxItems) {
        new Notice(`Fractal Index: ${files.length + subfolders.length} items exceeds cap ${CFG.maxItems}; truncating.`);
      }
      const filesCapped = files.slice(0, CFG.maxItems);
      const subfoldersCapped = subfolders.slice(0, Math.max(0, CFG.maxItems - filesCapped.length));

      /* create missing sub-index drawings */
      const subIndexByPath = new Map();
      for (const sf of subfoldersCapped) {
        const p = sf.path + "/" + CFG.indexName;
        let f = app.vault.getAbstractFileByPath(p);
        if (!f && createSub) {
          try {
            await app.vault.create(p, indexTemplate(sf.name));
          } catch (e) {
            new Notice("Fractal Index: could not create " + p + " (" + e.message + ")");
          }
          f = app.vault.getAbstractFileByPath(p);
        }
        if (f) subIndexByPath.set(sf.path, f);
      }

      /* previous generated elements → slot memory (separate slot spaces for
         pods and files, so file-grid columns never depend on pod count) */
      const prevEls = ea
        .getViewElements()
        .filter((el) => !el.isDeleted && el.customData && el.customData.fractalIndex);
      const prevByKey = new Map(); // customData.key → element
      for (const el of prevEls) {
        const k = el.customData.key;
        if (k && !prevByKey.has(k)) prevByKey.set(k, el);
      }
      const consumed = new Set();
      const hiWater = { pod: -1, file: -1 };
      const prevPos = new Map(); // key → {x,y}: MANUAL MOVES are adopted as truth
      // layout versioning: when the layout engine improves, old maps re-layout
      // once (positions from an older engine are not worth preserving)
      const prevTitle = prevEls.find((el) => el.customData && el.customData.kind === "title");
      const versionMatch = prevTitle && prevTitle.customData.layoutVersion === CFG.layoutVersion;
      for (const el of prevEls) {
        const cd = el.customData || {};
        const space = String(cd.key || "").split("|")[0];
        if (space in hiWater && typeof cd.slot === "number") {
          hiWater[space] = Math.max(hiWater[space], cd.slot);
        }
        if (!versionMatch) continue; // stale engine: positions discarded
        if (cd.kind === "file" && typeof el.x === "number") prevPos.set(cd.key, { x: el.x, y: el.y });
        if (cd.kind === "frame" && cd.key && cd.key.startsWith("pod|") && cd.key.endsWith("|frame")) {
          const podPath = cd.key.slice(4, -6); // strip "pod|" and "|frame"
          prevPos.set("pod|" + podPath, { x: el.x, y: el.y });
        }
      }
      if (!versionMatch) prevByKey.clear(); // cold start: fresh slots for everything
      const nextSlot = (space) => ++hiWater[space];

      /* adopt a slot: exact key match → basename-orphan match (same space) → fresh slot */
      function adoptSlot(key, name, space) {
        const exact = prevByKey.get(key);
        if (exact && typeof exact.customData.slot === "number") {
          consumed.add(key);
          return exact.customData.slot;
        }
        for (const [k, el] of prevByKey) {
          if (consumed.has(k) || !k.startsWith(space + "|")) continue;
          const cd = el.customData || {};
          if (cd.basename === name && typeof cd.slot === "number") {
            consumed.add(k); // folder/file renamed → keep its position
            return cd.slot;
          }
        }
        return nextSlot(space);
      }

      /* ── ELK first-run: "ELK proposes, slots dispose" ── */
      const isFirstRun = prevEls.length === 0;
      const podContentCounts = new Map();
      for (const sf of subfoldersCapped) podContentCounts.set(sf.path, sf.children.length);
      const elkPositions = drawLinks
        ? await computeElkLayout(filesCapped, subfoldersCapped, RL, podContentCounts, isFirstRun)
        : null;

      /* delete previous generated elements (they are re-added from slot memory) */
      if (prevEls.length) {
        ea.copyViewElementsToEAforEditing(prevEls);
        for (const el of prevEls) {
          const copy = ea.getElement(el.id);
          if (copy) copy.isDeleted = true;
        }
      }

      /* keep track of what we create, for customData stamping */
      function stamp(id, key, name, kind, slot) {
        const el = ea.getElement(id);
        if (el) {
          el.customData = { fractalIndex: true, key, basename: name, kind, slot };
        }
      }

      /* ── title ── */
      ea.setStyle({ fontFamily: 1, fontSize: 36, strokeColor: CFG.colors.text });
      const titleKey = "title|" + folder.path;
      const titleId = sid(titleKey);
      const isRootFolder = folder.path === "/" || folder.path === "";
      ea.addText(0, 0, "🧠 " + (isRootFolder ? "Vault" : folder.name), { textAlign: "left" }, titleId);
      stamp(titleId, titleKey, folder.name, "title", 0);
      // store direction choice on the title element so regeneration preserves it
      const titleEl = ea.getElement(titleId);
      if (titleEl) titleEl.customData = { ...titleEl.customData, direction, layoutVersion: CFG.layoutVersion };

      /* breadcrumb up to parent index when it exists */
      const parentIndexPath = isRootFolder
        ? null
        : (folder.parent ? folder.parent.path + "/" + CFG.indexName : null);
      const parentIndex = parentIndexPath ? app.vault.getAbstractFileByPath(parentIndexPath) : null;
      if (parentIndex) {
        ea.setStyle({ fontFamily: 2, fontSize: 18, strokeColor: CFG.colors.muted });
        const bcKey = "bc|" + folder.path;
        const bcId = sid(bcKey);
        ea.addText(0, 62, "↑ " + ((folder.parent.path === "/" || folder.parent.path === "") ? "vault" : folder.parent.name) + "/", {}, bcId);
        stamp(bcId, bcKey, "..", "breadcrumb", 0);
        ea.getElement(bcId).link = wl(parentIndexPath);
      }

      /* ── layout: balanced square grid in both directions ──
         Pods pack into a near-square grid (3 pods -> 2x2, 8 -> 3x3): no
         endless columns, no thin one-line strips. Direction changes the
         spine side and reading order: TD = rows, spine above; LR = columns,
         spine on the left. Files sit below the pod area either way. */
      const podCount = subfoldersCapped.length;
      const podCols = Math.max(1, Math.min(podCount, Math.ceil(Math.sqrt(podCount))));
      const podRows = Math.ceil(podCount / podCols);
      const podsBottom = CFG.gridY0 + podRows * (CFG.pod.h + CFG.pod.gapY) - CFG.pod.gapY;
      const fileCols = Math.max(CFG.fileCard.cols, podCols);
      const slotPos = {
        pod: direction === "LR"
          ? (s) => {
              // LR: column-major fill (journey reads down each column)
              return {
                x: Math.floor(s / podRows) * (CFG.pod.w + CFG.pod.gapX),
                y: CFG.gridY0 + (s % podRows) * (CFG.pod.h + CFG.pod.gapY),
              };
            }
          : (s) => ({
              x: (s % podCols) * (CFG.pod.w + CFG.pod.gapX),
              y: CFG.gridY0 + Math.floor(s / podCols) * (CFG.pod.h + CFG.pod.gapY),
            }),
        file: (s) => ({
          x: 40 + (s % fileCols) * (CFG.fileCard.w + CFG.fileCard.gx),
          y: podsBottom + 80 + Math.floor(s / fileCols) * (CFG.fileCard.h + CFG.fileCard.gy),
        }),
      };
      const podSlots = new Map(); // subfolder path → slot (for arrows)

      const podOrigin = new Map(); // final pod origin after move-adoption
      for (const sf of subfoldersCapped) {
        const key = "pod|" + sf.path;
        const slot = adoptSlot(key, sf.name, "pod");
        podSlots.set(sf.path, slot);
        const moved = prevPos.get(key);
        const elkPos = elkPositions ? elkPositions.get(sf.path + "/") : null;
        const base = moved || elkPos || slotPos.pod(slot);
        const x = base.x, y = base.y;
        podOrigin.set(sf.path, { x, y });
        const idx = subIndexByPath.get(sf.path);

        const fid = ea.addFrame(x, y, CFG.pod.w, CFG.pod.h);
        stamp(fid, key + "|frame", sf.name, "frame", slot);

        // concentric inner border — the visual "recursion" motif
        ea.setStyle({ strokeColor: CFG.colors.folderStroke });
        const motifId = ea.addRect(x + 8, y + 8, CFG.pod.w - 16, CFG.pod.h - 16);
        ea.getElement(motifId).strokeStyle = "dashed";
        ea.getElement(motifId).strokeWidth = 1;
        stamp(motifId, key + "|motif", sf.name, "pod-motif", slot);

        ea.setStyle({ fontFamily: 1, fontSize: CFG.pod.fontSize, strokeColor: CFG.colors.folderStroke });
        const labelId = sid(key + "|label");
        ea.addText(x + 20, y + 18, "📁 " + sf.name + "  (" + sf.children.length + ")", { wrapAt: 30 }, labelId);
        stamp(labelId, key + "|label", sf.name, "pod-label", slot);
        if (idx) ea.getElement(labelId).link = wl(idx.path);

        let embId = null, hintId = null;
        if (idx) {
          embId = ea.addEmbeddable(
            x + CFG.embed.marginX,
            y + CFG.embed.topOffset,
            CFG.pod.w - 2 * CFG.embed.marginX,
            CFG.pod.h - CFG.embed.topOffset - CFG.embed.bottomMargin,
            null,
            idx
          );
          stamp(embId, key + "|embed", sf.name, "embed", slot);
        } else {
          ea.setStyle({ fontFamily: 2, fontSize: 16, strokeColor: CFG.colors.muted });
          hintId = sid(key + "|hint");
          ea.addText(x + CFG.embed.marginX, y + CFG.embed.topOffset, "(no _index yet — run Fractal Index inside\nthis subfolder to grow the fractal)", { wrapAt: 42 }, hintId);
          stamp(hintId, key + "|hint", sf.name, "hint", slot);
        }

        ea.setStyle({ fontFamily: 2, fontSize: 14, strokeColor: CFG.colors.link });
        const diveId = sid(key + "|dive");
        ea.addText(
          x + CFG.pod.w - 150, y - 24,
          "⤢ click pod to dive",
          { textAlign: "right" },
          diveId
        );
        stamp(diveId, key + "|dive", sf.name, "dive-hint", slot);

        try {
          if (typeof ea.addToGroup === "function") {
            // move any pod element → the whole pod moves with it
            ea.addToGroup([fid, motifId, labelId, embId || hintId, diveId].filter(Boolean));
          }
        } catch (e) { /* grouping is a convenience; never fail generation for it */ }
      }

      /* ── file cards (grid, right of pods) ── */
      const iconFor = (f) =>
        f.extension === "md" ? "📝" :
        ["png", "jpg", "jpeg", "gif", "svg", "webp", "avif"].includes(f.extension) ? "🖼️" :
        f.extension === "pdf" ? "📕" : "📄";

      for (const f of filesCapped) {
        const key = "file|" + f.path;
        const slot = adoptSlot(key, f.name, "file");
        const moved = prevPos.get(key);
        const elkPos = elkPositions ? elkPositions.get(f.path) : null;
        const { x, y } = moved || elkPos || slotPos.file(slot);
        ea.setStyle({ fontFamily: 2, fontSize: CFG.fileCard.fontSize, strokeColor: CFG.colors.text });
        const id = sid(key);
        ea.addText(x, y, iconFor(f) + " " + f.basename, {
          box: true,
          wrapAt: CFG.fileCard.wrapAt,
          boxPadding: 10,
        }, id);
        stamp(id, key, f.name, "file", slot);
        ea.getElement(id).link = wl(f.path);
      }

      /* ── ExcaliBrain dimension: note-link arrows between cards/pods ──
         Uses app.metadataCache.resolvedLinks. Mutual links collapse into a
         double-headed arrow; file↔subfolder links become card↔pod arrows.
         Positions derive from stable card geometry → arrows are deterministic. */
      if (drawLinks) {
        const cardRect = new Map(); // path (or "folderPath/" for pods) → rect
        for (const f of filesCapped) {
          const el = ea.getElement(sid("file|" + f.path));
          if (el) cardRect.set(f.path, { x: el.x - 10, y: el.y - 10, w: el.width + 20, h: el.height + 20 });
        }
        for (const sf of subfoldersCapped) {
          const p = slotPos.pod(podSlots.get(sf.path));
          cardRect.set(sf.path + "/", { x: p.x, y: p.y, w: CFG.pod.w, h: CFG.pod.h });
        }
        const podKeys = subfoldersCapped.map((sf) => sf.path);


        const edges = new Map(); // "src=>dst" → {src, dst, weight}
        const addEdge = (src, dst, w) => {
          const k = src + "=>" + dst;
          const e = edges.get(k);
          if (e) e.weight += w;
          else edges.set(k, { src, dst, weight: w });
        };
        // outgoing links of this folder's own files
        for (const f of filesCapped) {
          const targets = RL[f.path] || {};
          for (const tp in targets) {
            if (!targets[tp] || tp === f.path) continue;
            if (cardRect.has(tp)) addEdge(f.path, tp, targets[tp]);
            for (const pk of podKeys) {
              if (tp === pk || tp.startsWith(pk + "/")) addEdge(f.path, pk + "/", 1);
            }
          }
        }
        // incoming links from files living inside indexed subfolders:
        // pod → card, and pod → pod (cross-folder dependencies)
        for (const src in RL) {
          for (const pk of podKeys) {
            if (src.startsWith(pk + "/")) {
              const targets = RL[src];
              for (const tp in targets) {
                if (!targets[tp]) continue;
                if (cardRect.has(tp) && !tp.endsWith("/")) {
                  addEdge(pk + "/", tp, 1);
                } else {
                  for (const pk2 of podKeys) {
                    if (pk2 !== pk && (tp === pk2 || tp.startsWith(pk2 + "/"))) {
                      addEdge(pk + "/", pk2 + "/", 1);
                    }
                  }
                }
              }
            }
          }
        }
        // merge mutual pairs into double-headed edges (deterministic: src < dst keeps the key)
        const merged = [];
        const seen = new Set();
        for (const [k, e] of [...edges.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
          if (seen.has(k)) continue;
          const rev = e.dst + "=>" + e.src;
          const r = edges.get(rev);
          seen.add(k);
          if (r) {
            seen.add(rev);
            merged.push({ a: e.src, b: e.dst, weight: e.weight + r.weight, mutual: true });
          } else {
            merged.push({ a: e.src, b: e.dst, weight: e.weight, mutual: false });
          }
        }
        merged.sort((x, y) => y.weight - x.weight || (x.a + x.b < y.a + y.b ? -1 : 1));
        const drawn = merged.slice(0, CFG.maxLinks);
        if (merged.length > CFG.maxLinks) {
          new Notice("Fractal Index: " + merged.length + " note links found; drawing the strongest " + CFG.maxLinks + ".");
        }
        const anchor = (r, toward) => {
          const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
          const dx = toward.x + toward.w / 2 - cx, dy = toward.y + toward.h / 2 - cy;
          if (!dx && !dy) return [cx, cy];
          const sx = dx ? (r.w / 2) / Math.abs(dx) : Infinity;
          const sy = dy ? (r.h / 2) / Math.abs(dy) : Infinity;
          const s = Math.min(sx, sy);
          return [cx + dx * s, cy + dy * s];
        };

        /* ── relationship-aware curved arrows ──
           Types inferred from topology: mutual = "resonates" (thick, both heads),
           same-folder = "peer" (solid curve), pod↔pod = "bridges" (dashed blue),
           pod→card = "nourishes" (dotted), card→pod = "feeds" (faint).
           All link arrows use roundness {type:1} for Bezier-style curves.
           Parallel arrows get perpendicular offsets to prevent overlap. */
        const classifyRel = (a, b, isMutual) => {
          if (isMutual) return "resonates";
          const aPod = a.endsWith("/"), bPod = b.endsWith("/");
          if (aPod && bPod) return "bridges";
          if (aPod && !bPod) return "nourishes";
          if (!aPod && bPod) return "feeds";
          return "peer";
        };
        const REL_STYLE = {
          resonates:  { w: 2.5, dash: "solid",   op: 100, color: "#7c3aed" },
          peer:       { w: 1.5, dash: "solid",   op: 100, color: "#8b5cf6" },
          bridges:    { w: 2,   dash: "dashed",  op: 70,  color: "#2563eb" },
          nourishes:  { w: 1.5, dash: "dotted",  op: 70,  color: "#7c6f9e" },
          feeds:      { w: 1,   dash: "dotted",  op: 50,  color: "#a78bfa" },
        };
        // group parallel arrows (same source OR same destination) for offsetting
        const bySrc = new Map();
        for (const e of drawn) {
          if (!bySrc.has(e.a)) bySrc.set(e.a, []);
          bySrc.get(e.a).push(e);
        }
        const srcIndex = new Map();
        for (const [, list] of bySrc) list.forEach((e, i) => srcIndex.set(e, i));

        for (const e of drawn) {
          const ra = cardRect.get(e.a), rb = cardRect.get(e.b);
          if (!ra || !rb) continue;
          const p1 = anchor(ra, rb), p2 = anchor(rb, ra);
          const key = "link|" + e.a + "=>" + e.b;
          const rel = classifyRel(e.a, e.b, e.mutual);
          const style = REL_STYLE[rel];

          // perpendicular offset for parallel arrows from the same source
          const siblings = bySrc.get(e.a) || [];
          const myIndex = srcIndex.get(e) || 0;
          let ox = 0, oy = 0;
          if (siblings.length > 1) {
            const dx = p2[0] - p1[0], dy = p2[1] - p1[1];
            const len = Math.hypot(dx, dy) || 1;
            const spread = 14;
            const off = (myIndex - (siblings.length - 1) / 2) * spread;
            ox = (-dy / len) * off;
            oy = (dx / len) * off;
          }

          const aId = ea.addArrow(
            [[p1[0] + ox, p1[1] + oy], [p2[0] + ox, p2[1] + oy]],
            {
              strokeColor: style.color,
              strokeWidth: style.w,
              startArrowHead: e.mutual ? "arrow" : null,
              endArrowHead: "arrow",
            }
          );
          const arrowEl = ea.getElement(aId);
          if (arrowEl) {
            arrowEl.strokeStyle = style.dash;
            arrowEl.opacity = style.op;
            arrowEl.roundness = { type: 1 }; // Bezier curve
          }
          stamp(aId, key, basename(e.a), "link", 0);
          if (ea.getElement(aId)) ea.getElement(aId).customData = { ...ea.getElement(aId).customData, rel };
        }
      }

      /* ── spine + orthogonal stubs, orientation by direction ──
         TD: horizontal spine above the grid, vertical stubs into first-row pods.
         LR: vertical spine left of the grid, horizontal stubs into first-column
         pods (journey reads down each column). */
      ea.setStyle({ strokeColor: CFG.colors.arrow, strokeStyle: "dashed" });
      if (subfoldersCapped.length) {
        const origins = subfoldersCapped.map((sf) => podOrigin.get(sf.path) || slotPos.pod(podSlots.get(sf.path)));
        if (direction === "LR") {
          const spineX = -40;
          const cys = origins.map((o) => o.y + CFG.pod.h / 2);
          const lastY = Math.max(...cys);
          const spineId = ea.addArrow(
            [[spineX, CFG.gridY0], [spineX, lastY]],
            { startArrowHead: null, endArrowHead: null, strokeStyle: "dashed", strokeColor: CFG.colors.arrow, elbowed: true }
          );
          stamp(spineId, "spine|" + folder.path, folder.name, "spine", 0);
          subfoldersCapped.forEach((sf, i) => {
            const key = "pod|" + sf.path;
            const o = origins[i];
            const colX = Math.min(...origins.map((o2) => o2.x));
            if (o.x > colX + 40) return; // later columns: no stub
            const cy = o.y + CFG.pod.h / 2;
            const aId = ea.addArrow(
              [[spineX, cy], [o.x - 4, cy]],
              { startArrowHead: null, endArrowHead: "arrow", strokeStyle: "dashed", strokeColor: CFG.colors.arrow, elbowed: true }
            );
            stamp(aId, key + "|arrow", sf.name, "arrow", i);
          });
        } else {
          const spineY = CFG.gridY0 - 40;
          const centers = origins.map((o) => o.x + CFG.pod.w / 2);
          const lastX = Math.max(...centers);
          const spineId = ea.addArrow(
            [[0, spineY], [lastX, spineY]],
            { startArrowHead: null, endArrowHead: null, strokeStyle: "dashed", strokeColor: CFG.colors.arrow, elbowed: true }
          );
          stamp(spineId, "spine|" + folder.path, folder.name, "spine", 0);
          subfoldersCapped.forEach((sf, i) => {
            const key = "pod|" + sf.path;
            const o = origins[i];
            const rowY = Math.min(...origins.map((o2) => o2.y));
            if (o.y > rowY + 40) return; // later rows: no stub
            const cx = o.x + CFG.pod.w / 2;
            const aId = ea.addArrow(
              [[cx, spineY], [cx, o.y - 4]],
              { startArrowHead: null, endArrowHead: "arrow", strokeStyle: "dashed", strokeColor: CFG.colors.arrow, elbowed: true }
            );
            stamp(aId, key + "|arrow", sf.name, "arrow", i);
          });
        }
      }

      await ea.addElementsToView(false, false);

      new Notice(
        `Fractal Index: ${filesCapped.length} files, ${subfoldersCapped.length} folders` +
        (createSub ? `, ${subIndexByPath.size} sub-indexes ready` : "") +
        ". Positions of existing nodes preserved."
      );
    }
  }
} catch (err) {
  if (typeof Notice !== "undefined") new Notice("Fractal Index error: " + (err && err.message ? err.message : err));
  console.error("Fractal Index error:", err);
}
