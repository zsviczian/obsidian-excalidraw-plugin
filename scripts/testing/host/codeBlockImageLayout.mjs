/** Measure the built SVG's actual code layout, independently of canvas zoom. */
export async function exerciseCodeBlockImageLayout(c, env) {
  const { p, doc, win, check, openDrawing, saveReopen, geometry } = env;
  await c.case("native:code-block-image-layout:" + geometry().requested.id, ["P02", "P05"], async () => {
    p.settings.pasteCodeBlockAs = "markdown-image";
    p.settings.markdownImageSettings.defaults.width = 180;
    let view = await openDrawing("code-image-layout");
    view.excalidrawAPI.updateScene({ elements: [], captureUpdate: "NEVER" });
    const bodies = [
      { name: "medium", body: "console.log('A moderately long line needs more than 180 pixels');" },
      { name: "short", body: "const x = 1;" },
      { name: "long", body: "const token = '" + "x".repeat(260) + "';\nconsole.log(token);", wrapped: true },
      { name: "tabs-unicode", body: "\t// Unicode: 漢字 Ελληνικά café\n\tconsole.log('" + "long text ".repeat(22) + "');", wrapped: true },
    ];
    const records = [];
    const inspect = async (element, variant) => {
      const svg = await (await win.fetch(view.excalidrawAPI.getFiles()[element.fileId].dataURL)).text();
      const iframe = doc.createElement("iframe");
      iframe.style.cssText = "position:fixed;left:-100000px;top:0;width:" + element.customData.markdownImage.render.width + "px;height:10000px;border:0;visibility:hidden";
      doc.body.appendChild(iframe);
      let record;
      try {
        const frameDoc = iframe.contentDocument, frameWin = iframe.contentWindow;
        const parsed = new win.DOMParser().parseFromString(svg, "image/svg+xml");
        frameDoc.body.style.margin = "0";
        frameDoc.body.appendChild(frameDoc.importNode(parsed.documentElement, true));
        await frameDoc.fonts.ready;
        const pre = frameDoc.querySelector("pre"), code = pre?.querySelector("code");
        check(code, "exported SVG has no code");
        const codeStyle = frameWin.getComputedStyle(code), preStyle = frameWin.getComputedStyle(pre);
        record = { name: variant.name, width: element.width, flowWidth: element.customData.markdownImage.render.width,
          svgWidth: parsed.documentElement.getAttribute("width"), height: element.height,
          svgBytes: new win.TextEncoder().encode(svg).length,
          codeHeight: code.getBoundingClientRect().height, lineHeight: Number.parseFloat(codeStyle.lineHeight),
          pre: { clientWidth: pre.clientWidth, scrollWidth: pre.scrollWidth, clientHeight: pre.clientHeight, scrollHeight: pre.scrollHeight, whiteSpace: preStyle.whiteSpace, overflowX: preStyle.overflowX },
          code: { clientWidth: code.clientWidth, scrollWidth: code.scrollWidth, whiteSpace: codeStyle.whiteSpace, overflowX: codeStyle.overflowX } };
        // Embedded fonts make each SVG large; keep geometry evidence in the
        // polled controller instead of repeatedly transporting the full payload.
        c.observations = { ...c.observations, codeImageLayout: [...records, record] };
        check(element.width >= 180 && element.width <= 800 && record.flowWidth === element.width, "code image width is outside adaptive bounds or differs from its layout width");
        if (variant.name === "medium") check(element.width > 180 && element.width < 800, "medium code still inherits the narrow 180-pixel Markdown default");
        if (variant.name === "short") check(element.width < records[0].width, "short code is not narrower than medium code");
        check(code.textContent.trimEnd() === variant.body.trimEnd(), "wrapping changed code, indentation or Unicode");
        check(["pre-wrap", "break-spaces"].includes(preStyle.whiteSpace) && ["pre-wrap", "break-spaces"].includes(codeStyle.whiteSpace), "code does not wrap in the exported image");
        check(!["auto", "scroll"].includes(preStyle.overflowX) && !["auto", "scroll"].includes(codeStyle.overflowX), "a static horizontal scrollbar is still exported");
        check(pre.scrollWidth <= pre.clientWidth + 1 && code.scrollWidth <= code.clientWidth + 1 && pre.scrollHeight <= pre.clientHeight + 1, "code is clipped instead of wrapping and growing");
        if (variant.wrapped) {
          check(element.width === (variant.expectedWidth ?? 800), "long code differs from its capped or explicit layout width");
          check(record.codeHeight > record.lineHeight * variant.body.split("\n").length + 1, "long code did not grow into additional visual lines");
        }
      } finally { iframe.remove(); }
      return record;
    };
    for (const variant of bodies) {
      const api = view.excalidrawAPI, before = new Set(api.getSceneElements().map(element => element.id));
      const source = "```js\n" + variant.body + "\n```";
      await view.pasteCodeBlock(source);
      const element = api.getSceneElements().find(element => !before.has(element.id) && element.type === "image");
      check(element, "pasted code image missing");
      let record = await inspect(element, variant);
      records.push(record);
      if (variant.name === "long") {
        app.workspace.setActiveLeaf(view.leaf, { focus: true });
        api.updateScene({ appState: { selectedElementIds: { [element.id]: true } }, captureUpdate: "NEVER", forceFlushSync: true });
        const panel = await p.openSidepanel(false), previousTabs = new Set(panel.tabs.keys());
        await view.openMarkdownImageEditor(element.id);
        const tab = [...panel.tabs.values()].find(tab => !previousTabs.has(tab.id));
        check(tab, "Markdown editor tab missing for width change");
        c.defer(() => { if (tab.contentEl.isConnected) tab.close(); });
        try {
          await c.waitFor(() => tab.contentEl.querySelector(".excalidraw-markdown-image-editor__markdown-view .cm-content"), "Markdown width editor source readiness");
          let widthInput;
          await c.waitFor(() => {
            widthInput = tab.contentEl.querySelector('input[type="number"]');
            c.observations.widthEditor = { width: widthInput?.value, selected: view.excalidrawAPI.getAppState().selectedElementIds, html: tab.contentEl.outerHTML.slice(0, 1200) };
            return widthInput?.value === "800";
          }, "Markdown layout width control targets the selected code image");
          widthInput.value = "600";
          widthInput.dispatchEvent(new tab.contentEl.ownerDocument.defaultView.Event("input", { bubbles: true }));
          await c.waitFor(() => {
            const current = view.excalidrawAPI.getSceneElements().find(item => item.id === element.id);
            const status = tab.contentEl.querySelector(".excalidraw-markdown-image-editor__status");
            c.observations.widthEditor = { ...c.observations.widthEditor, input: widthInput.value, width: current?.width, flow: current?.customData?.markdownImage?.render.width, sameAPI: view.excalidrawAPI === api, status: status?.outerHTML };
            return current?.customData?.markdownImage?.render.width === 600 && !status?.classList.contains("is-updating");
          }, "Markdown editor renders at explicit width 600");
        } finally {
          tab.close();
          await c.waitForCleanup(() => !view.isSameFileEditingActive() && !view.isSaveInProgress() && view.isLoaded && view.excalidrawAPI && !view.semaphores.justLoaded, "Markdown width editor close persistence and save-grace release");
          app.workspace.setActiveLeaf(view.leaf, { focus: true });
        }
        const resized = view.excalidrawAPI.getSceneElements().find(item => item.id === element.id);
        record = await inspect(resized, { ...variant, name: "long-at-600", expectedWidth: 600 });
        records.push(record);
      }
      const expected = { id: element.id, width: record.width, height: record.height, flowWidth: record.flowWidth };
      // Closing the same-file editor queues one final Vault synchronization.
      // Its acquisition wait can outlive the owner grace period; do not race it
      // with the save whose physical acknowledgment is asserted by saveReopen.
      await c.waitFor(() => {
        c.observations.layoutSaveReadiness = { busy: view.isPersistenceBusy(), editing: view.isSameFileEditingActive(), pendingPath: view.pendingExternalSyncPath, pendingLoop: !!view.externalSyncLoopPromise, loaded: view.isLoaded };
        return !view.isPersistenceBusy() && !view.isSameFileEditingActive() && !view.pendingExternalSyncPath && !view.externalSyncLoopPromise && view.isLoaded;
      }, "code image editor's pending file synchronization settles before save/reopen");
      view = await saveReopen(view);
      const restored = view.excalidrawAPI.getSceneElements().find(element => element.id === expected.id);
      check(restored?.width === expected.width && restored?.height === expected.height && restored.customData.markdownImage.render.width === expected.flowWidth, "adaptive image dimensions changed on reopen");
      check(view.excalidrawData.getMarkdownImage(restored.fileId)?.markdown === source, "reopen lost editable code source");
    }
    check(p.settings.markdownImageSettings.defaults.width === 180, "code insertion changed the general Markdown image default");
    return { assertions: ["initial code width adapts to actual rendered content from a 180px global default", "short code remains compact; long lines cap at 800px", "long tokens, tabs and Unicode wrap without exported scrollbars or clipping", "explicit editor width 600 reflows existing code without clipping or scrollbars", "editable source and adaptive/manual dimensions survive save/reopen", "general Markdown image defaults remain unchanged"], records };
  });
}
