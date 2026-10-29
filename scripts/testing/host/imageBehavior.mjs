/** Native image references, independent geometry, source invalidation, missing files and embedded renderers. */
export async function exerciseImageBehavior(c, env, rows) {
  if (!rows.length) return;
  const { p, check, openDrawing, saveReopen } = env;
  const svgText = (color) =>
    '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="100"><rect x="20" y="20" width="120" height="60" fill="' +
    color +
    '"/></svg>';
  const source = await env.create("Behavior-source.svg", svgText("#ff0000"));
  for (const row of rows)
    await c.case(row.testId, row.featureIds, async () => {
      Object.assign(p.settings, {
        defaultMode: "normal",
        exportWithTheme: false,
      });
      let view = await openDrawing(row.id);
      let ea = p.ea.getAPI(view);
      try {
        if (row.id === "images-shared-crops") {
          const raster = app.vault.getFileByPath("Assets/Transparency.png");
          const id = await ea.addImage(10, 250, raster, false, false);
          check(id, "Raster insertion failed");
          Object.assign(ea.getElement(id), { width: 120, height: 60 });
          const copy = ea.cloneElement(ea.getElement(id));
          Object.assign(copy, {
            x: 170,
            width: 90,
            height: 45,
            crop: {
              x: 1,
              y: 0,
              width: 2,
              height: 1,
              naturalWidth: 4,
              naturalHeight: 2,
            },
          });
          ea.elementsDict[copy.id] = copy;
          const svg = await ea.addImage(300, 250, source, false, false);
          check(
            svg && ea.getElement(id).fileId === copy.fileId,
            "Shared source identity missing",
          );
          check(
            await ea.addElementsToView(false, true, true),
            "Image publication failed",
          );
          const expected = [id, copy.id, svg].map((id) => {
            const el = view.getViewElements().find((e) => e.id === id);
            return {
              id,
              fileId: el.fileId,
              width: el.width,
              height: el.height,
              crop: el.crop,
            };
          });
          const png = await ea.createViewPNG({
            elementsOverride: view
              .getViewElements()
              .filter((e) => expected.some((x) => x.id === e.id)),
            withBackground: false,
            padding: 10,
          });
          const decoded = await env.decode(png);
          check(
            decoded.transparent > 0 && decoded.red > 100 && decoded.blue > 10,
            "Image export lost alpha or actual raster/SVG pixels",
          );
          view = await saveReopen(view);
          for (const snapshot of expected) {
            const element = view
              .getViewElements()
              .find((e) => e.id === snapshot.id);
            check(
              element &&
                element.fileId === snapshot.fileId &&
                element.width === snapshot.width &&
                element.height === snapshot.height &&
                JSON.stringify(element.crop) === JSON.stringify(snapshot.crop),
              "Independent shared image geometry lost on disk/reopen",
            );
          }
          return {
            assertions: row.assertions,
            actual: env.geometry(),
            decoded,
            geometry: expected,
          };
        }
        if (row.id === "images-source-edit-missing") {
          const id = await ea.addImage(10, 10, source, false, false);
          check(id, "Source SVG insertion failed");
          check(
            await ea.addElementsToView(false, true, true),
            "Source SVG publication failed",
          );
          const current = () =>
            view.getViewElements().find((el) => el.id === id);
          const before =
            view.excalidrawAPI.getFiles()[current().fileId]?.dataURL;
          check(before, "Live source SVG data missing");
          const first = await env.decode(
            await ea.createViewPNG({
              elementsOverride: [current()],
              withBackground: false,
              padding: 10,
            }),
          );
          check(
            first.red > 100 && first.blue === 0,
            "Initial SVG source is not red",
          );
          const editNote = await env.create(
            "Source-edit-anchor.md",
            "Owned external-edit anchor.",
          );
          const editLeaf = app.workspace.getLeaf("tab");
          env.owned.add(editLeaf);
          await editLeaf.openFile(editNote);
          app.workspace.setActiveLeaf(editLeaf, { focus: true });
          await app.vault.modify(source, svgText("#0000ff"));
          app.workspace.setActiveLeaf(env.leaf, { focus: true });
          env.win.focus();
          await c.waitFor(
            () => {
              const data =
                view.excalidrawAPI.getFiles()[current().fileId]?.dataURL;
              return data && data !== before;
            },
            "live source edit invalidates image data",
            30000,
          );
          const edited = await env.decode(
            await ea.createViewPNG({
              elementsOverride: [current()],
              withBackground: false,
              padding: 10,
            }),
          );
          check(
            edited.blue > 100 && edited.red === 0,
            "Updated SVG source did not reach decoded rendering",
          );
          view = await saveReopen(view);
          ea.destroy();
          ea = p.ea.getAPI(view);
          const drawing = view.file,
            reference = source.path;
          await app.vault.delete(source);
          await env.leaf.setViewState({ type: "empty", state: {} });
          await env.leaf.openFile(drawing);
          await env.ready(env.leaf);
          view = env.leaf.view;
          const missing = current();
          check(
            missing?.type === "image" &&
              !view.excalidrawData.getFile(missing.fileId)?.file,
            "Missing source must retain its image/reference without inventing a Vault file",
          );
          check(
            (await app.vault.read(drawing)).includes("Behavior-source.svg"),
            "Missing source erased the durable reference",
          );
          await app.vault.create(reference, svgText("#0000ff"));
          await env.leaf.setViewState({ type: "empty", state: {} });
          await env.leaf.openFile(drawing);
          await env.ready(env.leaf);
          view = env.leaf.view;
          await c.waitFor(
            () => view.excalidrawAPI.getFiles()[current().fileId]?.dataURL,
            "restored source decodes after reopen",
          );
          ea.destroy();
          ea = p.ea.getAPI(view);
          const restored = await env.decode(
            await ea.createViewPNG({
              elementsOverride: [current()],
              withBackground: false,
              padding: 10,
            }),
          );
          check(
            restored.blue > 100,
            "Restored SVG reference did not recover rendering",
          );
          return {
            assertions: row.assertions,
            actual: env.geometry(),
            before: first,
            edited,
            restored,
            missing: { imageIdRetained: true, referenceRetained: true },
            expectedConsoleErrors: [
              {
                containsAll: [
                  '"value":"EmbeddedFileLoader._getObsidianImage"',
                  '"value":"' + reference + '"',
                  '"name":"depth","type":"number","value":"0"',
                  '"name":"code","type":"string","value":"ENOENT"',
                  '"name":"syscall","type":"string","value":"open"',
                  JSON.stringify({
                    name: "path",
                    type: "string",
                    value: require("node:path").join(
                      app.vault.adapter.getBasePath(),
                      reference,
                    ),
                  }),
                ],
                excludes: ["[preview truncated]"],
                min: 1,
                max: 1,
              },
            ],
          };
        }
        const markdown = await env.create(
          "Embedded-note.md",
          '---\nexcalidraw-font: Excalifont\nexcalidraw-font-color: "#ff0000"\nexcalidraw-border-color: "#0000ff"\nexcalidraw-css: "h1 { background-color: #00ff00; }"\n---\n# EMBEDDED_MARKDOWN_RENDER_TOKEN\n\n| Name | Value |\n| --- | --- |\n| Owned | 42 |\n\n$E=mc^2$\n',
        );
        const drawing = await env.create(
          "Embedded-source.excalidraw.md",
          await app.vault.read(
            app.vault.getFileByPath("Drawings/Uncompressed.excalidraw.md"),
          ),
        );
        await c.waitFor(
          () =>
            p.isExcalidrawFile(drawing) &&
            app.metadataCache.getFileCache(markdown),
          "embedded source metadata",
        );
        const ids = [];
        for (const [i, file] of [
          markdown,
          drawing,
          app.vault.getFileByPath("Assets/Small.pdf"),
        ].entries()) {
          const id = await ea.addImage(
            i * 450,
            300,
            file.extension === "pdf" ? file.path + "#page=1" : file,
            false,
            false,
          );
          check(id, "Embedded source conversion failed: " + file.path);
          ids.push(id);
        }
        const embeddable = ea.addEmbeddable(
          20,
          650,
          400,
          240,
          undefined,
          markdown,
        );
        check(
          embeddable && (await ea.addElementsToView(false, true, true)),
          "Local embeddable publication failed",
        );
        await c.waitFor(
          () =>
            ids.every((id) => {
              const el = view.getViewElements().find((e) => e.id === id);
              return el && view.excalidrawAPI.getFiles()[el.fileId]?.dataURL;
            }),
          "asynchronous embedded image data",
        );
        ea.viewZoomToElements(
          false,
          view.getViewElements().filter((e) => e.id === embeddable),
          0.05,
        );
        await c.waitFor(() => {
          const ref = view.getEmbeddableLeafElementById(embeddable);
          return (
            ref?.leaf?.view?.file?.path === markdown.path ||
            ref?.node?.file?.path === markdown.path
          );
        }, "actual local embeddable file target");
        const blob = await ea.createViewPNG({
          elementsOverride: view
            .getViewElements()
            .filter((e) => ids.includes(e.id)),
          withBackground: false,
          padding: 10,
          scale: 1,
        });
        const decoded = await env.decode(blob);
        check(
          decoded.red > 50 && decoded.blue > 50 && decoded.transparent > 0,
          "Drawing/Markdown/PDF image export lost decoded source content",
        );
        const markdownPixels = await env.decode(
          await ea.createViewPNG({
            elementsOverride: view
              .getViewElements()
              .filter((e) => e.id === ids[0]),
            withBackground: false,
            padding: 10,
            scale: 1,
          }),
        );
        check(
          markdownPixels.red > 10 &&
            markdownPixels.blue > 10 &&
            markdownPixels.green > 20,
          "Markdown font/CSS and border frontmatter did not reach actual exported pixels",
        );
        view = await saveReopen(view);
        check(
          ids.every((id) =>
            view
              .getViewElements()
              .some((el) => el.id === id && el.type === "image"),
          ) &&
            view
              .getViewElements()
              .some(
                (el) =>
                  el.id === embeddable && el.link.includes("Embedded-note"),
              ),
          "Embedded sources lost after save/reopen",
        );
        return {
          assertions: row.assertions,
          actual: env.geometry(),
          decoded,
          markdownPixels,
          sourceKinds: [
            "Markdown rendered image",
            "drawing rendered image",
            "PDF page",
            "local Markdown embeddable",
          ],
        };
      } finally {
        ea.destroy();
      }
    });
}
