/** PR #3046: exercise the real picker, section cards, SVG files and focused Save As. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInAppTask } from "./inAppTask.mjs";
import { behaviorEnvironment } from "./behaviorEnvironment.mjs";
import { behaviorInputDriver } from "./behaviorMatrix.mjs";
import { completeConsoleErrors } from "./debuggerSession.mjs";
import { settleBrowserDiagnostics, splitWindowErrors } from "./browserDiagnostics.mjs";

export const embedReliabilityCaseIds = ["main", "popout"].flatMap(context =>
  ["aliases", "headings", "svg", "nbsp", "save-as"].map(kind => `native:embed-reliability:${context}:${kind}`));

export async function runEmbedReliabilityScenario({ cli, drawingPath }) {
  const template = readFileSync(new URL("../../../tests/vault/Drawings/Uncompressed.excalidraw.md", import.meta.url), "utf8");
  const original = readFileSync(new URL("../../../tests/fixtures/2389.excalidraw.md", import.meta.url), "utf8");
  const tests = [], consoleErrors = [], windowErrors = [], browserIdle = [];
  for (const id of ["main", "popout"]) {
    const execute = new Function(`return async function(c,path,context,template,original,modifier){
      const env=await (${behaviorEnvironment.toString()})(c,path,context,template,${completeConsoleErrors.toString()},${settleBrowserDiagnostics.toString()});
      await (${exercise.toString()})(c,env,original,modifier,context.id);
      return {tests:c.tests,consoleErrors:c.externalConsoleErrors||[],windowErrors:env.windowErrors,browserIdle:env.browserIdle};
    }`)();
    const result = await runInAppTask({ cli, execute,
      args: [drawingPath, { id, input: "mouse" }, template, original, process.platform === "darwin" ? 4 : 2],
      timeoutMs: 240000, cleanupMs: 60000, onRequest: behaviorInputDriver(cli),
      onProgress: phase => { if (phase) process.stdout.write("Embed reliability: " + phase + "\n"); },
    }).catch(error => { error.evidence = [...tests, ...(error.evidence || [])]; throw error; });
    tests.push(...result.tests); consoleErrors.push(...result.consoleErrors); windowErrors.push(...result.windowErrors); browserIdle.push(...result.browserIdle);
  }
  assert.equal(consoleErrors.length, 0); assert.equal(splitWindowErrors(windowErrors).unexpected.length, 0);
  assert.ok(browserIdle.every(item => item.status === "passed"));
  assert.ok(tests.every(item => item.status === "passed")), assert.equal(tests.length, embedReliabilityCaseIds.length);
  return { id: "embed-reliability-3046", status: "passed", tests, consoleErrors, windowErrors, browserIdle };
}

async function exercise(c, env, original, modifier, context) {
  const { p, doc, win, leaf, create, check, openDrawing, saveReopen, key } = env;
  c.observations = {};
  let view = await openDrawing("Reliability");
  const failures = [];
  const run = async (kind, features, body) => {
    c.phase = `native:embed-reliability:${context}:${kind}`;
    try { await c.case(c.phase, features, body); }
    catch (error) { if (c.cancelled) throw error; failures.push(String(error)); }
  };
  // Capture the real modal before onOpen's fire-and-forget form creation, so
  // baseline constructor failures are observed without leaking a rejected task.
  const form = async file => {
    const { Modal } = p.ea.obsidian, open = Modal.prototype.open;
    let modal;
    Modal.prototype.open = function () { modal = this; };
    try { app.commands.executeCommandById("obsidian-excalidraw-plugin:universal-add-file"); }
    finally { Modal.prototype.open = open; }
    check(modal, "Insert file command did not construct a modal");
    modal.file = file;
    modal.onOpen = () => {};
    open.call(modal);
    try {
      await modal.createForm();
      if (file) await c.waitFor(() => modal.contentEl.querySelector("select")?.options.length > 0, "section picker initial update");
    }
    catch (error) { modal.close(); throw error; }
    return modal;
  };
  await run("aliases", ["P03"], async () => {
    const values = [undefined, null, "Whole alias", ["First", "Second"], { data: null }, 42, true, ["Good", null, {}, 8, ""]];
    const files = [];
    for (let i = 0; i < values.length; i++) files.push(await create("Alias-" + i + ".md", values[i] === undefined ? "Body" : "---\naliases: " + JSON.stringify(values[i]) + "\n---\nBody"));
    await c.waitFor(() => files.every(file => app.metadataCache.getFileCache(file)), "alias metadata");
    const bytes = await Promise.all(files.map(file => app.vault.read(file)));
    let modal;
    try {
      modal = await form();
      const input = modal.contentEl.querySelector("input");
      for (const file of files) {
        input.value = file.path; input.dispatchEvent(new win.Event("input", { bubbles: true }));
        check([...doc.querySelectorAll(".suggestion-item")].some(item => item.textContent.includes(file.basename)), "File path disappeared from mixed picker");
      }
      input.value = "Whole alias"; input.dispatchEvent(new win.Event("input", { bubbles: true }));
      check([...doc.querySelectorAll(".suggestion-item")].some(item => item.textContent.includes("Whole alias")), "Scalar alias split into characters");
    } finally { modal?.close(); }
    await app.fileManager.renameFile(files[0], env.prefix + "/Renamed.md");
    modal = await form(); modal.close();
    check((await Promise.all(files.map(file => app.vault.read(file)))).every((value, i) => value === bytes[i]), "Picker modified source YAML");
    // Remove malformed fixtures before the independent heading tests.
    for (const file of files) await app.vault.delete(file);
    return { assertions: ["unsupported aliases do not block paths", "whole string and list aliases remain searchable", "rename/reopen and source YAML fidelity"] };
  });
  // Failed alias reproduction must not poison the other independent cases.
  for (const file of app.vault.getFiles().filter(file => file.path.startsWith(env.prefix + "/Alias-") || file.path === env.prefix + "/Renamed.md")) await app.vault.delete(file);
  await run("headings", ["P05"], async () => {
    const wikiFile = await create("link to a file.md", "WIKI_DESTINATION_BODY");
    const wikiBytes = await app.vault.read(wikiFile);
    const headings = [
      "Plain heading", "[H1 Header]", "[H1 Header with Links](http://www.google.com)",
      "*Emphasis* and `code`", "[Nested](https://example.com/a_(b))", "[Escaped](https://example.com/a\\(b\\))",
      "[First](https://example.com) and [Second](https://example.org)", "[[Target]] and [[Target|Alias]]",
      "Literal [brackets] and (parentheses)", "Punctuation: # hash ^ caret | pipe", "Unicode Árvíz 中文 مرحبا שלום",
      "[Looks like a file](https://example.com/Other.md#^block|alias)", "Duplicate", "Duplicate", "Last heading",
      "[[link to a file]]", "[[link to a file|Friendly file label]]", "[[missing wiki heading target]]",
    ];
    const wikiIndices = [15, 16, 17];
    const source = headings.map((heading, i) => "#".repeat(wikiIndices.includes(i) ? 2 : i % 6 + 1) + " " + heading + "\n\nSECTION_TOKEN_" + i + "\n").join("\n") + "\nBlock body ^known-block\n";
    const target = await create("Headings.md", source);
    await c.waitFor(() => app.metadataCache.getFileCache(target)?.headings?.length === headings.length, "linked heading metadata");
    await c.waitFor(() => app.metadataCache.getFirstLinkpathDest("link to a file", target.path) === wikiFile, "heading wikilink resolves to the existing local file");
    check(!app.metadataCache.getFirstLinkpathDest("missing wiki heading target", target.path), "Missing heading wikilink unexpectedly resolves");
    const { stripHeading, resolveSubpath } = p.ea.obsidian;
    const cache = app.metadataCache.getFileCache(target);
    const expected = cache.headings.map(heading => "#" + stripHeading(heading.heading));
    c.observations.wikiHeadingCases = wikiIndices.map(i => ({ source: "## " + headings[i], subpath: expected[i], level: cache.headings[i].level }));
    check(wikiIndices.every(i => cache.headings[i].level === 2), "Exact level-two wikilink headings changed");
    const modal = await form(target);
    try {
      const options = [...modal.contentEl.querySelector("select").options];
      const values = options.map(item => item.value);
      c.observations = { ...c.observations, headings: cache.headings, expected, blocks: (await app.metadataCache.blockCache.getForFile({ isCancelled: () => false }, target)).blocks, options: options.map(item => ({ value: item.value, text: item.textContent })) };
      const missing = expected.filter(subpath => !values.includes(subpath));
      for (const subpath of expected) check(resolveSubpath(cache, subpath)?.type === "heading", "Obsidian canonical heading did not resolve: " + subpath);
      check(missing.length === 0, "Headings missing from section picker: " + JSON.stringify(missing));
      check(values[0] === "" && !values.includes("#^known-block"), "Whole-file and block choices changed");
    } finally { modal.close(); }
    const inserted = [], insertedImages = [];
    for (let i = 0; i < expected.length; i++) {
      const selected = expected[i], first = expected.indexOf(selected);
      const transclusion = await view.excalidrawData.getTransclusion(target.path + selected);
      check(transclusion.contents.includes("SECTION_TOKEN_" + first), "Image source resolved a different section: " + selected);
      if (wikiIndices.includes(i)) check(transclusion.contents.includes(headings[i]), "Image transclusion changed the heading wikilink source");
      const picker = await form(target);
      picker.contentEl.querySelector("select").value = selected;
      const before = new Set(view.excalidrawAPI.getSceneElements().map(element => element.id));
      [...picker.contentEl.querySelectorAll("button")].find(button => button.textContent === "as Embeddable").click();
      let element;
      await c.waitFor(() => element = view.excalidrawAPI.getSceneElements().find(element => !before.has(element.id)), "interactive section inserted");
      inserted.push({ id: element.id, token: "SECTION_TOKEN_" + first, link: element.link });
      view.excalidrawAPI.zoomToFit([element], 1, 0.05);
      await c.waitFor(() => {
        const node = view.getEmbeddableLeafElementById(element.id)?.node;
        c.observations.headingInsert = { i, selected, element: { id: element.id, type: element.type, link: element.link }, node: node && { keys: Object.keys(node), html: node.containerEl?.outerHTML.slice(0, 4000) } };
        return node?.containerEl.textContent.includes("SECTION_TOKEN_" + first);
      }, "interactive section body");
      if ([0, 2, 7, 10].includes(i) || wikiIndices.includes(i)) {
        const imagePicker = await form(target);
        imagePicker.contentEl.querySelector("select").value = selected;
        const before = new Set(view.excalidrawAPI.getSceneElements().map(element => element.id));
        [...imagePicker.contentEl.querySelectorAll("button")].find(button => button.textContent === "as Image").click();
        let image;
        await c.waitFor(() => image = view.excalidrawAPI.getSceneElements().find(element => !before.has(element.id) && element.type === "image"), "section image inserted");
        await c.waitFor(() => view.excalidrawAPI.getFiles()[image.fileId]?.dataURL, "section image payload");
        await env.decode(view.excalidrawAPI.getFiles()[image.fileId].dataURL);
        insertedImages.push({ id: image.id, fileId: image.fileId });
      }
    }
    view = await saveReopen(view);
    for (const entry of inserted) {
      check(view.excalidrawAPI.getSceneElements().find(element => element.id === entry.id)?.link === entry.link, "Saved heading link changed");
      view.excalidrawAPI.zoomToFit([view.excalidrawAPI.getSceneElements().find(element => element.id === entry.id)], 1, 0.05);
      await c.waitFor(() => view.getEmbeddableLeafElementById(entry.id)?.node?.containerEl.textContent.includes(entry.token), "reopened section body");
    }
    for (const entry of insertedImages) {
      check(view.excalidrawAPI.getSceneElements().find(element => element.id === entry.id)?.fileId === entry.fileId, "Saved section image identity changed");
      await c.waitFor(() => view.excalidrawAPI.getFiles()[entry.fileId]?.dataURL, "reopened section image payload");
      await env.decode(view.excalidrawAPI.getFiles()[entry.fileId].dataURL);
    }
    check(!resolveSubpath(cache, "#Nonexistent") && !resolveSubpath(cache, "#^missing-block"), "Missing sections unexpectedly resolved");
    check(resolveSubpath(cache, "#^known-block")?.type === "block", "Existing block reference changed");
    const renamed = source.replace("Plain heading", "Renamed heading");
    try {
      await app.vault.modify(target, renamed);
      await c.waitFor(() => app.metadataCache.getFileCache(target)?.headings?.[0].heading === "Renamed heading", "renamed heading metadata");
      check(!resolveSubpath(app.metadataCache.getFileCache(target), expected[0]), "Old heading silently resolved after rename");
      check(view.excalidrawAPI.getSceneElements().find(element => element.id === inserted[0].id)?.link === inserted[0].link, "Source rename rewrote the existing drawing link");
      const picker = await form(target);
      try { check([...picker.contentEl.querySelector("select").options].some(option => option.value === "#Renamed heading"), "Reopened picker did not follow the rename"); }
      finally { picker.close(); }
    } finally {
      await app.vault.modify(target, source);
      await c.waitFor(() => app.metadataCache.getFileCache(target)?.headings?.[0].heading === "Plain heading", "restored heading metadata");
    }
    const drawingFile = view.file;
    const referenceCases = [{ index: 2, label: "Linked heading" }, ...wikiIndices.map((index, i) => ({ index, label: "Wiki heading " + i }))];
    const references = await create("References.md", referenceCases.map(({ index, label }) => `[[${target.path}${expected[index]}|${label}]]`).join("\n\n") + `\n\n[[${target.path}#^known-block|Known block]]\n\n[[${target.path}|Whole file]]\n\nEnd`);
    for (const mode of ["preview", "source"]) for (const reference of referenceCases) {
      await env.input("Input.dispatchMouseEvent", { type: "mouseMoved", x: win.innerWidth - 5, y: win.innerHeight - 5 });
      await c.waitFor(() => ![...doc.querySelectorAll(".hover-popover")].some(popover => popover.getClientRects().length), "previous link hover preview closes after pointer leaves");
      // Each navigation starts with a fresh Markdown view, independently of
      // the preceding destination's renderer and section-reveal callbacks.
      await leaf.setViewState({ type: "empty", state: {} });
      await leaf.setViewState({ type: "markdown", state: { file: references.path, mode, source: false } });
      app.workspace.setActiveLeaf(leaf, { focus: true }); win.focus();
      if (mode === "source") leaf.view.editor.setCursor({ line: leaf.view.editor.lastLine(), ch: 0 });
      const findReferenceLink = () => {
        const root = leaf.view.contentEl.querySelector(mode === "preview" ? ".markdown-preview-view" : ".markdown-source-view.is-live-preview");
        return [...root?.querySelectorAll("a.internal-link,.cm-hmd-internal-link") || []].find(link => link.textContent === reference.label);
      };
      let link;
      await c.waitFor(() => {
        const root = leaf.view.contentEl.querySelector(mode === "preview" ? ".markdown-preview-view" : ".markdown-source-view.is-live-preview");
        link = findReferenceLink();
        c.observations.navigation = { mode, reference, actualMode: leaf.view.getMode(), html: root?.innerHTML.slice(0, 2500) };
        return link && link.getBoundingClientRect().width > 0;
      }, "ordinary heading link in " + mode);
      link.scrollIntoView({ block: "center", inline: "nearest" });
      let x, y, signature, stableSince = 0;
      await c.waitFor(() => {
        link = findReferenceLink();
        if (!link) return false;
        const rect = link.getBoundingClientRect(); x = rect.left + rect.width / 2; y = rect.top + rect.height / 2;
        const current = [rect.x, rect.y, rect.width, rect.height].map(value => Math.round(value * 10)).join(":");
        if (signature !== current) { signature = current; stableSince = Date.now(); }
        c.observations.navigation.hit = { bounds: rect.toJSON(), target: doc.elementFromPoint(x, y)?.outerHTML.slice(0, 500) };
        return Date.now() - stableSince >= 120 && link.contains(doc.elementFromPoint(x, y));
      }, "visible uncovered heading link in " + mode);
      const capturePointer = event => {
        c.observations.navigation.event = { trusted: event.isTrusted, href: event.target.closest?.("a.internal-link,.cm-hmd-internal-link")?.getAttribute("data-href"), text: event.target.textContent };
      };
      doc.addEventListener("mousedown", capturePointer, true);
      try {
        // One bounded native sequence avoids CLI roundtrip delays between
        // press/release. Live Preview requires Ctrl/Cmd to follow the link.
        await env.input("Input.dispatchMouseEvent", ["mousePressed", "mouseReleased"].map(type => ({ type, x, y, button: "left", buttons: type === "mousePressed" ? 1 : 0, clickCount: 1, modifiers: mode === "source" ? modifier : 0 })));
      } finally {
        doc.removeEventListener("mousedown", capturePointer, true);
      }
      check(c.observations.navigation.event?.trusted && c.observations.navigation.event.text === reference.label, "Trusted pointer did not reach the intended section link");
      let destination;
      await c.waitFor(() => {
        const candidates = app.workspace.getLeavesOfType("markdown").filter(candidate => candidate.view.containerEl.ownerDocument === doc);
        for (const candidate of candidates) if (candidate.view.file?.path.startsWith(env.prefix + "/")) env.owned.add(candidate);
        c.observations.navigation.leaves = candidates.map(candidate => ({ id: candidate.id, path: candidate.view.file?.path, mode: candidate.view.getMode() }));
        // Ctrl/Cmd-click may open a new tab; preserve that host behavior.
        return destination = candidates.find(candidate => candidate.view.file === target && candidate === app.workspace.activeLeaf);
      }, "ordinary section link navigation in " + mode);
      if (destination.view.getMode() === "source") await c.waitFor(() => {
        c.observations.navigation.cursor = destination.view.editor.getCursor("from");
        return c.observations.navigation.cursor.line === cache.headings[reference.index].position.start.line;
      }, "ordinary section link reveals its source heading");
      else await c.waitFor(() => {
        const preview = destination.view.contentEl.querySelector(".markdown-preview-view");
        c.observations.navigation.destination = { file: destination.view.file?.path, text: preview?.textContent.slice(-1200) };
        return preview?.textContent.includes("SECTION_TOKEN_" + reference.index);
      }, "ordinary section link renders its destination before the next navigation");
    }
    await leaf.openFile(drawingFile); await env.ready(leaf); view = leaf.view;
    check(await app.vault.read(target) === source, "Heading picker modified Markdown");
    check(await app.vault.read(wikiFile) === wikiBytes, "Heading insertion modified the wikilink destination");
    return { assertions: ["formatted, linked, escaped, wikilink, duplicate, six-level and Unicode heading options match Obsidian", "exact level-two wikilink-only headings with existing, aliased and missing file targets", "interactive insertion, image source and decoded image insertion", "saved links, section bodies and decoded images survive reopen", "whole file, missing sections and block choices stay separate", "rename updates picker without rewriting existing links", "ordinary links to URL and wikilink headings navigate in Reading and Live Preview", "source and wikilink destination remain unchanged"], wikiHeadings: c.observations.wikiHeadingCases };
  });
  await run("svg", ["P04"], async () => {
    const urls = ['http://google.com/search?q=<p>hello</p>', 'https://example.com/?a=1&b=2', 'https://example.com/?a=&amp;&b=%26%3C', 'https://example.com/?q="quoted"#hash', 'https://example.com/Árvíz/中文?x=<tag>&y=100%25'];
    const target = await create("ExportTarget.md", "Internal export target");
    await c.waitFor(() => app.metadataCache.getFileCache(target), "SVG internal destination");
    const originalHook = p.ea.onUpdateElementLinkForExportHook, calls = [], pathCalls = [];
    const originalPathHook = p.ea.onImageExportPathHook;
    const originalAutoexportHook = p.ea.onTriggerAutoexportHook;
    const rewritten = "https://example.com/internal?q=<tag>&value=1";
    p.ea.onUpdateElementLinkForExportHook = data => { calls.push(data.originalLink); return rewritten; };
    p.ea.onImageExportPathHook = data => { pathCalls.push({ path: data.exportFilepath, action: data.action, extension: data.exportExtension }); return data.exportFilepath.replace(/\.svg$/, ".hook.svg"); };
    const parse = xml => {
      const parsed = new win.DOMParser().parseFromString(xml, "image/svg+xml");
      check(!parsed.querySelector("parsererror"), "Exported SVG is invalid XML: " + parsed.querySelector("parsererror")?.textContent);
      return parsed;
    };
    try {
      for (const includeInternalLinks of [true, false]) {
        view = await openDrawing("SVG-" + includeInternalLinks, { "excalidraw-export-internal-links": includeInternalLinks });
        const ea = p.ea.getAPI(view);
        try {
          view.excalidrawAPI.updateScene({ elements: [], captureUpdate: "NEVER" });
          for (const [i, url] of [...urls, `[[${target.path}|Alias]]`].entries()) ea.getElement(ea.addText(0, i * 35, "Link " + i)).link = url;
          await ea.addElementsToView(false, false);
          const before = JSON.stringify(view.excalidrawAPI.getSceneElements());
          for (const theme of ["light", "dark"]) {
            const svg = await ea.createViewSVG({ theme, embedScene: true, skipInliningFonts: true });
            const links = [...parse(svg.outerHTML).querySelectorAll("a")].map(link => link.getAttribute("href"));
            c.observations.svgLinks = { theme, includeInternalLinks, urls, links };
            // The fork deliberately normalizes literal quotes before SVG creation.
            check(urls.every(url => links.includes(url.replaceAll('"', "&quot;"))), "External SVG destination escaped twice or changed");
            check(links.includes(rewritten) === includeInternalLinks, "Internal-link removal or export hook changed");
            check(svg.querySelector("metadata"), "SVG lost scene metadata");
            const clipboardSVG = await view.getSVG(true, false);
            check([...parse(clipboardSVG.outerHTML).querySelectorAll("a")].map(link => link.getAttribute("href")).join("\n") === links.join("\n"), "Clipboard SVG destinations differ");
            await view.saveSVG({ autoexportConfig: { theme } });
            const file = app.vault.getFileByPath(view.file.path.replace(/\.md$/, ".hook.svg"));
            check(file, "Manual SVG export missing");
            const parsed = parse(await app.vault.read(file));
            check([...parsed.querySelectorAll("a")].map(link => link.getAttribute("href")).join("\n") === links.join("\n"), "Manual SVG and EA destinations differ");
            const staged = await ea.createSVG(undefined, false, undefined, undefined, theme, 10, false, includeInternalLinks);
            check(parse(staged.outerHTML).querySelectorAll("a").length === urls.length + Number(includeInternalLinks), "EA createSVG link-removal option changed");
          }
          check(JSON.stringify(view.excalidrawAPI.getSceneElements()) === before, "SVG export mutated source elements");
          let autoexportCalls = 0;
          p.ea.onTriggerAutoexportHook = data => {
            check(data.excalidrawFile === view.file, "Autoexport hook file identity changed"); autoexportCalls++;
            return { ...data.autoexportConfig, svg: true, png: false, excalidraw: false, theme: "both" };
          };
          check((await view.saveWithOutcome()).status === "persisted", "SVG fixture save did not persist");
          for (const theme of ["light", "dark"]) {
            const path = view.file.path.replace(/\.md$/, "." + theme + ".hook.svg");
            await c.waitFor(() => app.vault.getFileByPath(path), "hook-controlled light/dark autoexport");
            const links = [...parse(await app.vault.read(app.vault.getFileByPath(path))).querySelectorAll("a")].map(link => link.getAttribute("href"));
            check(links.includes(rewritten) === includeInternalLinks && links.length === urls.length + Number(includeInternalLinks), "Autoexport link policy changed");
          }
          check(autoexportCalls > 0, "Autoexport hook was bypassed");
          p.ea.onTriggerAutoexportHook = originalAutoexportHook;
        } finally { ea.destroy(); }
      }
      check(calls.length > 0 && calls.every(link => link === `[[${target.path}|Alias]]`), "Link rewrite hook arguments changed");
      check(pathCalls.length > 0 && pathCalls.every(call => call.action === "export" && call.extension.endsWith(".svg")), "Export path hook contract changed");
    } finally { p.ea.onUpdateElementLinkForExportHook = originalHook; p.ea.onImageExportPathHook = originalPathHook; p.ea.onTriggerAutoexportHook = originalAutoexportHook; }
    return { assertions: ["special-character URL matrix parses as XML without double escaping", "light/dark manual, clipboard, autoexport and EA SVG agree", "per-file and EA internal-link removal preserved", "link-rewrite, path and autoexport hooks retain their arguments and overrides", "scene metadata and source elements unchanged"] };
  });
  await run("nbsp", ["P05"], async () => {
    const target = await create("NBSP.excalidraw.md", original);
    await c.waitFor(() => p.isExcalidrawFile(target), "original NBSP fixture metadata");
    const source = await app.vault.read(target);
    const { Component, MarkdownRenderer } = p.ea.obsidian;
    for (const type of ["SVGIMG", "SVG", "PNG"]) for (const warm of [false, true]) {
      p.settings.previewImageType = type;
      const component = new Component(); component.load();
      const root = doc.body.createDiv({ cls: "markdown-preview-view markdown-rendered" });
      try {
        await MarkdownRenderer.render(app, `![[${target.path}]]`, root, view.file.path, component);
        await c.waitFor(() => root.querySelector(".excalidraw-embedded-img"), "NBSP embed mounted");
        const image = root.querySelector(".excalidraw-embedded-img");
        if (image.tagName === "IMG") {
          await image.decode(); check(image.naturalWidth > 0, "NBSP image did not decode");
          if (type === "SVGIMG") {
            const xml = await (await win.fetch(image.src)).text();
            const parsed = new win.DOMParser().parseFromString(xml, "image/svg+xml");
            check(!parsed.querySelector("parsererror") && parsed.querySelector("text")?.textContent.includes("\u00a0"), "SVG image/cache lost NBSP or valid XML");
          }
        }
        else check(image.querySelector("text")?.textContent.includes("\u00a0"), "Native SVG lost NBSP");
      } finally { component.unload(); root.remove(); }
    }
    check(await app.vault.read(target) === source, "NBSP source changed");
    return { assertions: ["original issue drawing decodes as SVG image, native SVG and PNG on cold and warm renders", "SVG image XML and cache retain NBSP", "NBSP and drawing source preserved"] };
  });
  await run("save-as", ["P02", "P03"], async () => {
    view = await saveReopen(view);
    const api = view.excalidrawAPI, exports = [], restorers = [];
    for (const owner of new Set([win, app.workspace.containerEl.ownerDocument.defaultView])) {
      const descriptor = Object.getOwnPropertyDescriptor(owner, "showSaveFilePicker");
      Object.defineProperty(owner, "showSaveFilePicker", { configurable: true, value: async () => {
        exports.push("picker");
        return { name: "negative-control.excalidraw", kind: "file", createWritable: async () => ({ write: async () => exports.push("write"), close: async () => exports.push("closed") }) };
      } });
      restorers.push(() => descriptor ? Object.defineProperty(owner, "showSaveFilePicker", descriptor) : delete owner.showSaveFilePicker);
      const prototype = owner.HTMLAnchorElement.prototype, click = prototype.click;
      prototype.click = function () {
        if (this.download.endsWith(".excalidraw") && (this.href.startsWith("blob:") || this.href.startsWith("data:text/plain"))) { exports.push("download"); return; }
        return click.call(this);
      };
      restorers.push(() => { prototype.click = click; });
    }
    try {
      api.updateScene({ appState: { theme: "dark", viewModeEnabled: false }, captureUpdate: "NEVER" });
      await c.waitFor(() => api.getAppState().theme === "dark", "dark canvas");
      const theme = doc.body.className;
      view.containerEl.querySelector(".excalidraw").focus();
      await key("s", "KeyS", 83, modifier | 8);
      await key("Escape", "Escape", 27);
      check(exports.length === 0, "Focused Save As invoked standalone file picker");
      check(api.getAppState().theme === "dark" && doc.body.className === theme, "Save As changed drawing or application theme");
      const outside = doc.body.createEl("input"), received = [];
      try {
        outside.addEventListener("keydown", event => received.push(event.defaultPrevented)); outside.focus();
        await key("s", "KeyS", 83, modifier | 8);
        check(received.length === 1 && !received[0], "Drawing guard intercepted a different focused surface");
      } finally { outside.remove(); }
      await view.exportExcalidraw();
      check(exports.length === 1 && exports[0] === "download", "Dedicated legacy export stopped working");
    } finally { for (const restore of restorers.reverse()) restore(); }
    return { assertions: ["trusted focused Ctrl/Cmd+Shift+S cannot invoke external Save As", "canvas and application themes preserved after dismissal and reopen", "other focused surfaces retain their shortcut", "dedicated legacy export still downloads"] };
  });
  if (failures.length) throw Error(failures.join("\n"));
}
