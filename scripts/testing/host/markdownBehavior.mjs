/** Real Obsidian reading/Live Preview renderers, followed by source edits and raw/parsed drawing text. */
export async function exerciseMarkdownBehavior(c, env, rows) {
  if (!rows.length) return;
  const { p, check, create, doc, leaf } = env;
  const target = await create(
    "Render-target.md",
    await app.vault.read(app.vault.getFileByPath("Notes/Render target.md")),
  );
  const nested = await create(
    "Render-nested.md",
    (
      await app.vault.read(app.vault.getFileByPath("Notes/Render nested.md"))
    ).replaceAll("Notes/Render target", target.path.slice(0, -3)),
  );
  const drawing = await create(
    "Render-drawing.excalidraw.md",
    await app.vault.read(
      app.vault.getFileByPath("Drawings/Uncompressed.excalidraw.md"),
    ),
  );
  const noteText = (
    await app.vault.read(app.vault.getFileByPath("Notes/Render matrix.md"))
  )
    .replaceAll("Notes/Render target", target.path.slice(0, -3))
    .replaceAll("Notes/Render nested", nested.path.slice(0, -3))
    .replaceAll("Drawings/Uncompressed.excalidraw.md", drawing.path);
  const note = await create("Render-matrix.md", noteText);
  await c.waitFor(
    () =>
      p.isExcalidrawFile(drawing) &&
      app.metadataCache.getFileCache(target)?.blocks?.["owned-block"],
    "Markdown heading/block and drawing metadata",
  );
  const activeRoot = (mode) => {
    const root = leaf.view.contentEl.querySelector(
      mode === "preview"
        ? ".markdown-preview-view"
        : ".markdown-source-view.is-live-preview",
    );
    const bounds = root?.getBoundingClientRect();
    return bounds?.width > 0 && bounds.height > 0 ? root : null;
  };
  const open = async (mode) => {
    await leaf.setViewState({
      type: "markdown",
      state: { file: note.path, mode, source: false },
    });
    app.workspace.setActiveLeaf(leaf, { focus: true });
    env.win.focus();
    await c.waitFor(
      () =>
        leaf.view.getViewType() === "markdown" &&
        leaf.view.file?.path === note.path &&
        leaf.view.getMode() === mode,
      "actual Markdown mode",
    );
    if (mode === "source") {
      leaf.view.editor.setCursor({ line: 0, ch: 0 });
      await c.waitFor(
        () => activeRoot("source"),
        "Live Preview enabled rather than plain source",
      );
    }
    return leaf.view;
  };
  const rendered = async (mode, token, predicate) => {
    if (mode === "source") {
      const lines = noteText.split("\n"),
        index = lines.findIndex((line) => line.includes(token));
      if (index >= 0)
        leaf.view.editor.setCursor({
          line: Math.min(lines.length - 1, index + 3),
          ch: 0,
        });
    }
    await c.waitFor(
      () => activeRoot(mode) && predicate(activeRoot(mode)),
      mode + " rendered " + token,
    );
  };
  for (const row of rows)
    await c.case(row.testId, row.featureIds, async () => {
      if (row.id === "raw-parsed-text") {
        let view = await env.openDrawing(row.id, {
          "excalidraw-link-prefix": "",
          "excalidraw-link-brackets": false,
        });
        const raw = "[[" + target.path + "#Reference heading|Heading alias]]",
          ea = p.ea.getAPI(view);
        try {
          const id = ea.addText(25, 25, raw);
          check(
            await ea.addElementsToView(false, true, true),
            "Drawing text publication failed",
          );
          await c.waitFor(
            () =>
              view.getViewElements().find((el) => el.id === id)?.text ===
              "Heading alias",
            "parsed drawing alias",
          );
          check(
            view.getViewElements().find((el) => el.id === id).rawText === raw,
            "Parsed mode lost the original link source",
          );
          await view.changeTextMode("raw");
          await c.waitFor(
            () =>
              view.excalidrawAPI &&
              view.getViewElements().find((el) => el.id === id)?.text === raw,
            "raw drawing text",
          );
          await view.changeTextMode("parsed");
          await c.waitFor(
            () =>
              view.excalidrawAPI &&
              view.getViewElements().find((el) => el.id === id)?.text ===
                "Heading alias",
            "parsed drawing text restored",
          );
          view = await env.saveReopen(view);
          const saved = view.getViewElements().find((el) => el.id === id);
          check(
            saved.rawText === raw && saved.text === "Heading alias",
            "Raw/parsed data did not survive save/reopen",
          );
        } finally {
          ea.destroy();
        }
      } else if (row.id === "markdown-source-edit") {
        await open("preview");
        await rendered("preview", "NESTED_RENDER_TOKEN", (root) =>
          root.textContent.includes("ORIGINAL_SOURCE_TOKEN"),
        );
        const edited = (await app.vault.read(target)).replace(
          "ORIGINAL_SOURCE_TOKEN",
          "UPDATED_SOURCE_TOKEN",
        );
        await app.vault.modify(target, edited);
        await c.waitFor(
          () =>
            activeRoot("preview")?.textContent.includes(
              "UPDATED_SOURCE_TOKEN",
            ) &&
            !activeRoot("preview")?.textContent.includes(
              "ORIGINAL_SOURCE_TOKEN",
            ),
          "nested source edit rerender",
        );
        check(
          (await app.vault.read(target)).includes("UPDATED_SOURCE_TOKEN"),
          "Nested source edit not persisted",
        );
        await open("source");
        await rendered("source", "Render-nested", (root) =>
          root.textContent.includes("UPDATED_SOURCE_TOKEN"),
        );
      } else {
        const mode = row.id === "markdown-reading" ? "preview" : "source";
        await open(mode);
        await rendered(mode, "TABLE_EVIDENCE_TOKEN", (root) =>
          [...root.querySelectorAll("table")].some((el) =>
            el.textContent.includes("TABLE_EVIDENCE_TOKEN"),
          ),
        );
        await rendered(mode, "CALLOUT_EVIDENCE_TOKEN", (root) =>
          [...root.querySelectorAll('.callout[data-callout="note"]')].some(
            (el) => el.textContent.includes("CALLOUT_EVIDENCE_TOKEN"),
          ),
        );
        await rendered(
          mode,
          "$$E=mc^2$$",
          (root) =>
            !!root.querySelector(".math .MathJax, .math svg, mjx-container"),
        );
        await rendered(
          mode,
          "Render-nested",
          (root) =>
            root.textContent.includes("NESTED_RENDER_TOKEN") &&
            root.textContent.includes("ORIGINAL_SOURCE_TOKEN"),
        );
        let raster;
        await rendered(mode, "Transparency.png", (root) => {
          raster = [...root.querySelectorAll("img")].find(
            (img) =>
              img.src.includes("Transparency.png") &&
              img.complete &&
              img.naturalWidth > 0,
          );
          return raster;
        });
        const decoded = await env.decode(raster.currentSrc || raster.src);
        check(
          decoded.width === 4 &&
            decoded.height === 2 &&
            decoded.transparent > 0,
          "Markdown raster output lost natural dimensions or alpha",
        );
        let svgImage;
        await rendered(mode, "Layers.svg", (root) => {
          svgImage = [...root.querySelectorAll("img")].find(
            (img) =>
              img.src.includes("Layers.svg") &&
              img.complete &&
              img.naturalWidth > 0,
          );
          return svgImage;
        });
        const svgPixels = await env.decode(svgImage.currentSrc || svgImage.src);
        check(
          svgPixels.red > 10 && svgPixels.blue > 10,
          "Markdown SVG source colors missing from decoded output",
        );
        await rendered(mode, "Render-drawing", (root) =>
          [...root.querySelectorAll("[fileSource]")].some(
            (el) =>
              el.getAttribute("fileSource")?.split("#")[0] === drawing.path &&
              (el.tagName === "IMG"
                ? el.complete && el.naturalWidth > 0
                : !!el.querySelector("svg path, svg rect")),
          ),
        );
        if (mode === "preview")
          for (const [alias, subpath] of [
            ["Heading alias", "#Reference heading"],
            ["Block alias", "#^owned-block"],
          ]) {
            await open("preview");
            let link;
            await c.waitFor(() => {
              link = [
                ...(activeRoot("preview")?.querySelectorAll(
                  "a.internal-link",
                ) || []),
              ].find((a) => a.textContent === alias);
              return link;
            }, "rendered link alias");
            check(
              (
                link.getAttribute("data-href") || link.getAttribute("href")
              ).endsWith(subpath),
              "Alias lost heading/block reference",
            );
            await env.click(link);
            await c.waitFor(
              () => leaf.view.file?.path === target.path,
              "trusted internal alias navigation",
            );
          }
        return {
          assertions: row.assertions,
          actual: env.geometry(),
          decoded,
          svgPixels,
          mode,
          input:
            mode === "preview"
              ? "trusted CDP navigation; renderer inspection"
              : "renderer inspection with editor viewport positioning",
        };
      }
      return { assertions: row.assertions, actual: env.geometry() };
    });
}
