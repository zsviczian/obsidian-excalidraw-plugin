/** Native settings/frontmatter cases operate on real metadata, loaded editors and saved files. */
export async function exerciseSettingsBehavior(c, env, rows) {
  const { p, check, openDrawing, saveReopen } = env;
  for (const row of rows) {
    await c.case(row.testId, row.featureIds, async () => {
      const v = row.values;
      Object.assign(p.settings, {
        defaultMode: v.defaultMode,
        linkOpacity: v.linkOpacity,
        showLinkBrackets: v.showLinkBrackets,
        linkPrefix: "",
        urlPrefix: "",
      });
      const fm = {};
      for (const [factor, key] of [
        ["frontMode", "excalidraw-default-mode"],
        ["frontOpacity", "excalidraw-linkbutton-opacity"],
        ["frontBrackets", "excalidraw-link-brackets"],
      ])
        if (v[factor] !== "missing") fm[key] = v[factor];
      let view = await openDrawing(row.id, fm);
      const ea = p.ea.getAPI(view);
      let textId;
      try {
        textId = ea.addText(
          20,
          220,
          "[[Links/Árvíztűrő 测试.md|Pairwise alias]]",
        );
        check(
          await ea.addElementsToView(false, true, true),
          "Pairwise linked-text publication failed",
        );
      } finally {
        ea.destroy();
      }
      await c.waitFor(
        () =>
          view.getViewElements().find((el) => el.id === textId)?.text ===
          (row.expected.brackets ? "[[Pairwise alias]]" : "Pairwise alias"),
        "actual parsed bracket rendering",
      );
      const assertState = () => {
        const state = view.excalidrawAPI.getAppState(),
          data = view.excalidrawData;
        check(
          data.getLinkOpacity() === row.expected.opacity,
          "Link opacity precedence: " + JSON.stringify(row),
        );
        check(
          state.linkOpacity === row.expected.opacity,
          "Loaded canvas link opacity differs from resolved setting",
        );
        check(
          data.showLinkBrackets === row.expected.brackets,
          "Link bracket precedence: " + JSON.stringify(row),
        );
        check(
          state.viewModeEnabled === (row.expected.mode === "view") &&
            state.zenModeEnabled === (row.expected.mode === "zen"),
          "Loaded mode precedence: " +
            JSON.stringify({
              row,
              actual: {
                view: state.viewModeEnabled,
                zen: state.zenModeEnabled,
              },
            }),
        );
      };
      assertState();
      view = await saveReopen(view);
      assertState();
      check(
        view.getViewElements().find((el) => el.id === textId)?.text ===
          (row.expected.brackets ? "[[Pairwise alias]]" : "Pairwise alias"),
        "Parsed bracket rendering changed after save/reopen",
      );
      const persisted = await app.vault.read(view.file);
      for (const key of Object.keys(fm))
        check(
          persisted.includes(key + ":"),
          "Save dropped frontmatter: " + key,
        );
      return {
        assertions: row.assertions,
        expected: row.expected,
        factors: v,
        actual: env.geometry(),
        reopened: true,
      };
    });
  }
}

export async function exerciseExportBehavior(c, env, rows) {
  const { p, check, openDrawing, saveReopen, decode } = env;
  for (const row of rows)
    await c.case(row.testId, row.featureIds, async () => {
      const v = row.values;
      Object.assign(p.settings, {
        defaultMode: "normal",
        exportWithBackground: v.withBackground,
        exportPaddingSVG: v.padding,
        exportWithTheme: false,
      });
      const fm = {};
      for (const [factor, key] of [
        ["frontTransparent", "excalidraw-export-transparent"],
        ["frontPadding", "excalidraw-export-padding"],
        ["frontDark", "excalidraw-export-dark"],
      ])
        if (v[factor] !== "missing") fm[key] = v[factor];
      let view = await openDrawing(row.id, fm);
      check(
        view.getViewExportPadding() === row.expected.padding,
        "Export padding override lost zero",
      );
      check(
        view.getViewExportWithBackground() === row.expected.background,
        "Export background precedence differs",
      );
      check(
        view.getViewExportTheme() === row.expected.theme,
        "Export theme precedence differs",
      );
      const ea = p.ea.getAPI(view);
      try {
        const svg = await ea.createViewSVG({
          withBackground: row.expected.background,
          padding: row.expected.padding,
          theme: row.expected.theme,
        });
        check(
          svg.tagName.toLowerCase() === "svg" && svg.querySelector("path,rect"),
          "Actual SVG content missing",
        );
        const png = await ea.createViewPNG({
          withBackground: row.expected.background,
          padding: row.expected.padding,
          theme: row.expected.theme,
          scale: 1,
        });
        const decoded = await decode(png);
        const dimensions = (node) =>
          ["width", "height"].map((key) =>
            Number.parseFloat(node.getAttribute(key)),
          );
        const [width, height] = dimensions(svg);
        const controlPadding = row.expected.padding === 0 ? 3 : 0;
        const control = await ea.createViewSVG({
          withBackground: row.expected.background,
          padding: controlPadding,
          theme: row.expected.theme,
        });
        const [controlWidth, controlHeight] = dimensions(control);
        const delta = 2 * (row.expected.padding - controlPadding);
        check(
          Math.abs(width - controlWidth - delta) < 1e-8 &&
            Math.abs(height - controlHeight - delta) < 1e-8,
          "Actual SVG geometry does not honor the requested padding, including zero",
        );
        check(
          Math.abs(decoded.width - width) <= 1 &&
            Math.abs(decoded.height - height) <= 1,
          "Decoded PNG geometry differs from matching SVG options beyond pixel rounding",
        );
        check(
          decoded.width > 100 && decoded.height > 60 && decoded.red > 20,
          "Export lost fixture geometry or red content",
        );
        check(
          row.expected.background
            ? decoded.cornerAlpha === 255
            : decoded.transparent > 20,
          "Decoded export transparency differs",
        );
        view = await saveReopen(view);
        return {
          assertions: row.assertions,
          expected: row.expected,
          factors: v,
          decoded,
          svg: {
            width: svg.getAttribute("width"),
            height: svg.getAttribute("height"),
          },
          actual: env.geometry(),
          reopened: true,
        };
      } finally {
        ea.destroy();
      }
    });
}
