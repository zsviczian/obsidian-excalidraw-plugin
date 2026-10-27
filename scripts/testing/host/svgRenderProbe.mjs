/** Native browser source/baseline/current rendering oracle and real getIcon() corpus. */
export async function probeSvgRendering(key, path, bridgeId, synthetic) {
  const c = globalThis[key],
    p = app.plugins.plugins["obsidian-excalidraw-plugin"];
  const leaf = app.workspace
      .getLeavesOfType("excalidraw")
      .find((l) => l.view.file?.path === path),
    v = leaf.view,
    lib = v.packages.excalidrawLib;
  const dir = app.vault.configDir + "/plugins/" + bridgeId,
    adapter = app.vault.adapter;
  const manifest = {
    id: bridgeId,
    name: "SVG import test bridge",
    version: "0.0.0",
    minAppVersion: "1.8.7",
    author: "Local test",
    dir,
  };
  try {
    if (await adapter.exists(dir)) throw Error("bridge exists");
    await adapter.mkdir(dir);
    await adapter.write(dir + "/manifest.json", JSON.stringify(manifest));
    await adapter.write(
      dir + "/main.js",
      'const o=require("obsidian");module.exports=class extends o.Plugin{onload(){this.testAPI={getIcon:o.getIcon,getIconIds:o.getIconIds}}};',
    );
    app.plugins.manifests[bridgeId] = manifest;
    const bridge = await app.plugins.loadPlugin(bridgeId),
      api = bridge.testAPI,
      ids = api.getIconIds();
    c.corpus = [];
    const selected = [];
    for (const id of ids) {
      const input = api.getIcon(id)?.outerHTML;
      if (!input) continue;
      const ea = new p.ea.constructor(p, v),
        start = performance.now();
      try {
        const ok = ea.importSVG(input),
          elements = ea.getElements();
        if (!ok || !elements.length) throw Error("empty/failed icon " + id);
        c.corpus.push({
          id,
          ms: performance.now() - start,
          elements: elements.length,
          points: elements.reduce((n, e) => n + (e.points?.length ?? 0), 0),
        });
      } finally {
        ea.destroy();
      }
      if (
        [
          "lucide-rocket",
          "lucide-equal",
          "lucide-frame",
          "lucide-brain",
          "lucide-camera",
          "lucide-circle",
          "lucide-arrow-up-right",
        ].includes(id)
      )
        selected.push({ name: id, svg: input });
    }
    c.iconCount = ids.length;
    c.lucideCount = ids.filter((id) => id.startsWith("lucide-")).length;
    const assets = app.vault.getFolderByPath("TestAssets");
    if (!assets) throw Error("TestAssets folder missing");
    for (const f of assets.children.filter((f) => f.extension === "svg"))
      selected.push({ name: f.path, svg: await app.vault.read(f) });
    selected.push(...synthetic);
    const raster = async (source, w, h, background) => {
      const win = v.ownerWindow,
        img = new win.Image(),
        url = win.URL.createObjectURL(
          new win.Blob([source], { type: "image/svg+xml" }),
        );
      try {
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = () => reject(Error("SVG decode failed"));
          img.src = url;
        });
      } finally {
        win.URL.revokeObjectURL(url);
      }
      const canvas = createFragment().createEl("canvas");
      canvas.width = Math.min(512, Math.max(192, w));
      canvas.height = Math.ceil((canvas.width * h) / w);
      const ctx = canvas.getContext("2d");
      if (background === "checker")
        for (let y = 0; y < canvas.height; y += 16)
          for (let x = 0; x < canvas.width; x += 16) {
            ctx.fillStyle = ((x + y) / 16) % 2 ? "#5e46c9" : "#30c9a1";
            ctx.fillRect(x, y, 16, 16);
          }
      else if (background !== "transparent") {
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return {
        data: ctx.getImageData(0, 0, canvas.width, canvas.height).data,
        png: canvas.toDataURL(),
        width: canvas.width,
        height: canvas.height,
      };
    };
    c.results = [];
    for (const fixture of selected) {
      const doc = new DOMParser().parseFromString(fixture.svg, "image/svg+xml"),
        root = doc.documentElement,
        box = (root.getAttribute("viewBox") ?? "").split(/[\s,]+/).map(Number);
      const w =
          parseFloat(root.getAttribute("width")) ||
          (box.length === 4 ? box[2] : 100),
        h =
          parseFloat(root.getAttribute("height")) ||
          (box.length === 4 ? box[3] : 100);
      const baselineEA = new p.ea.constructor(p, v),
        baselineStart = performance.now();
      let old, baselineApiMs;
      try {
        old = c.baseline.svgToExcalidraw(fixture.svg);
        if (old.hasErrors)
          throw Error("pinned baseline failed: " + fixture.name);
        baselineEA.copyViewElementsToEAforEditing(old.content);
        baselineApiMs = performance.now() - baselineStart;
        old.content = structuredClone(baselineEA.getElements());
      } finally {
        baselineEA.destroy();
      }
      const ea = new p.ea.constructor(p, v);
      let current, bounds, currentApiMs;
      const start = performance.now();
      try {
        if (!ea.importSVG(fixture.svg))
          throw Error("fixture import failed " + fixture.name);
        currentApiMs = performance.now() - start;
        current = structuredClone(ea.getElements());
        const id = ea.addRect(0, 0, w, h);
        bounds = ea.getElement(id);
        Object.assign(bounds, {
          opacity: 0,
          strokeWidth: 0,
          strokeColor: "transparent",
          backgroundColor: "transparent",
        });
      } finally {
        ea.destroy();
      }
      const result = {
        name: fixture.name,
        ms: performance.now() - start,
        baselineApiMs,
        currentApiMs,
        oldElements: old.content.length,
        newElements: current.length,
        oldPoints: old.content.reduce((n, e) => n + (e.points?.length ?? 0), 0),
        newPoints: current.reduce((n, e) => n + (e.points?.length ?? 0), 0),
        oldBytes: JSON.stringify(old.content).length,
        newBytes: JSON.stringify(current).length,
        metrics: [],
      };
      const serialize = async (elements) =>
        (
          await lib.exportToSvg({
            elements: [bounds, ...elements],
            files: {},
            appState: {
              exportBackground: false,
              exportWithDarkMode: false,
              theme: "light",
            },
            exportPadding: 0,
            skipInliningFonts: true,
          })
        ).outerHTML;
      let timing = performance.now();
      const before = await serialize(old.content);
      result.baselineSvgBuildMs = performance.now() - timing;
      timing = performance.now();
      const after = await serialize(current);
      result.currentSvgBuildMs = performance.now() - timing;
      result.boundsQueries = [];
      for (const [kind, elements] of [
        ["baseline", old.content],
        ["current", current],
      ]) {
        if (!elements.length) continue;
        timing = performance.now();
        lib.getCommonBoundingBox(elements);
        const cold = performance.now() - timing;
        timing = performance.now();
        for (let i = 0; i < 100; i++) lib.getCommonBoundingBox(elements);
        result.boundsQueries.push({
          kind,
          coldMs: cold,
          warm100Ms: performance.now() - timing,
        });
      }
      for (const background of [
        "transparent",
        "#ffffff",
        "#202124",
        "#24a677",
        "checker",
      ]) {
        const source = await raster(fixture.svg, w, h, background),
          baseline = await raster(before, w, h, background),
          updated = await raster(after, w, h, background);
        const error = (other) => {
          let sum = 0,
            different = 0;
          for (let i = 0; i < source.data.length; i++) {
            const d = Math.abs(source.data[i] - other.data[i]);
            sum += d;
            if (d > 12) different++;
          }
          return {
            mean: sum / source.data.length / 255,
            different: different / source.data.length,
          };
        };
        result.metrics.push({
          background,
          baseline: error(baseline),
          updated: error(updated),
        });
        if (background === "checker")
          result.previews = {
            source: source.png,
            baseline: baseline.png,
            updated: updated.png,
          };
      }
      c.results.push(result);
    }
  } finally {
    await app.plugins.unloadPlugin(bridgeId);
    delete app.plugins.manifests[bridgeId];
    if (await adapter.exists(dir)) await adapter.rmdir(dir, true);
  }
}
