/** #2967: mixed browser/file drops against an owned local PNG server. */
import assert from "node:assert/strict";
import { runLegacyTask } from "./legacyTask.mjs";
import { createServer } from "node:http";

async function exercise(
  control,
  drawingPath,
  imageURL,
  pngBase64,
  includePopout,
) {
  const c = globalThis[control],
    plugin = app.plugins.plugins["obsidian-excalidraw-plugin"];
  const main = app.workspace
    .getLeavesOfType("excalidraw")
    .find((l) => l.view.file?.path === drawingPath);
  const previous = structuredClone(plugin.settings.modifierKeyConfig);
  const existingFiles = new Set(app.vault.getFiles().map((file) => file.path));
  const pageURL = imageURL.replace(/\/[^/]+$/, "/article");
  const extensionless = imageURL.replace(/\.png$/, "?render=1");
  const blobURL = "blob:https://example.com/owned-test-image";
  const cases = [
    ...["image-url", "image-import"].flatMap((action) => [
      { id: "uri", action, source: imageURL },
      { id: "linked-image", action, source: imageURL, page: pageURL },
      { id: "extensionless", action, source: extensionless, fallback: true },
      { id: "blob", action, source: blobURL, fallback: true },
    ]),
    ...["link", "embeddable"].map((action) => ({
      id: "linked-page",
      action,
      source: imageURL,
      page: pageURL,
    })),
  ];
  c.attachments = [];
  c.results = [];
  c.ownedIds = [];
  const waitFor = async (predicate, label) => {
    for (let i = 0; i < 200; i++) {
      if (c.cancelled) throw Error("web-drop scenario cancelled");
      if (predicate()) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw Error(`Timed out: ${label}`);
  };
  // Match the lifecycle suite: observe closing the actual window from the
  // main realm instead of awaiting a promise owned by the final popout tab.
  const closePopout = async () => {
    if (!c.pop) return;
    const view = c.pop.view,
      owner = view.containerEl.ownerDocument.defaultView;
    if (owner && !owner.closed) {
      if (
        view.isDirty?.() &&
        (await view.saveWithOutcome()).status !== "persisted"
      )
        throw Error("Owned drop popout could not save before closing");
      c.pop.detach();
      if (!owner.closed) owner.close();
      const end = Date.now() + 20000;
      while (!owner.closed || view.excalidrawAPI) {
        if (Date.now() >= end) throw Error("Owned drop popout did not close");
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    }
    if (view.excalidrawAPI)
      throw Error("Closed drop popout retained its editor");
    c.pop = null;
  };
  try {
    for (const popout of includePopout ? [false, true] : [false]) {
      let leaf = main;
      if (popout) {
        leaf = app.workspace.openPopoutLeaf();
        c.pop = leaf;
        await waitFor(
          () => leaf.view.containerEl.ownerDocument !== main.view.ownerDocument,
          "empty drop popout migration",
        );
        await leaf.setViewState({
          type: "excalidraw",
          state: { file: drawingPath },
        });
        await waitFor(() => leaf.view.excalidrawAPI, "popout API");
      }
      let view = leaf.view;
      app.workspace.setActiveLeaf(leaf, { focus: true });
      for (const scenario of cases) {
        if (c.cancelled) throw Error("web-drop scenario cancelled");
        const { action, source, page, fallback } = scenario;
        for (const os of ["Mac", "Win"]) {
          plugin.settings.modifierKeyConfig[os].WebBrowserDragAction = {
            defaultAction: action,
            rules: [],
          };
          plugin.settings.modifierKeyConfig[os].LocalFileDragAction = {
            defaultAction:
              action === "image-url" ? "image-import" : "image-url",
            rules: [],
          };
        }
        const before = new Set(view.getViewElements().map((el) => el.id));
        const transfer = new view.ownerWindow.DataTransfer();
        const png = Uint8Array.from(atob(pngBase64), (char) =>
          char.charCodeAt(0),
        );
        const filename = `${control}-${popout}-${scenario.id}-${action}.png`;
        if (app.metadataCache.getFirstLinkpathDest(filename, drawingPath))
          throw Error("owned drop filename already exists");
        transfer.items.add(
          new view.ownerWindow.File([png], filename, { type: "image/png" }),
        );
        transfer.setData(
          "text/uri-list",
          `# image source\r\n${page ?? source}\r\n`,
        );
        if (scenario.id !== "uri") {
          transfer.setData(
            "text/html",
            page
              ? `<a href="${page}"><img src="${source}"></a>`
              : `<img src="${source}">`,
          );
          transfer.setData("text/plain", page ?? source);
        }
        if (action === "embeddable") {
          const target = view.containerEl.querySelector(".excalidraw");
          if (!target) throw Error("canvas drop target missing");
          target.dispatchEvent(
            new view.ownerWindow.DragEvent("drop", {
              dataTransfer: transfer,
              clientX: 300,
              clientY: 300,
              bubbles: true,
              cancelable: true,
            }),
          );
          transfer.items.clear();
        } else {
          const result = view.dropManager.onDrop({
            dataTransfer: transfer,
            clientX: 300,
            clientY: 300,
            shiftKey: false,
            ctrlKey: false,
            altKey: false,
            metaKey: false,
          });
          if (result !== false) throw Error("mixed drop was not consumed");
        }
        const navigation = action === "link" || action === "embeddable";
        let element, embedded;
        await waitFor(() => {
          element = view
            .getViewElements()
            .find(
              (el) =>
                !before.has(el.id) &&
                el.type ===
                  (navigation
                    ? action === "link"
                      ? "text"
                      : "embeddable"
                    : "image"),
            );
          embedded =
            !navigation &&
            element &&
            view.excalidrawData.getFile(element.fileId);
          return element && (navigation || embedded);
        }, `insert ${scenario.id} ${action}`);
        c.ownedIds.push(element.id);
        if (navigation) {
          if ((action === "link" ? element.text : element.link) !== pageURL)
            throw Error("navigation targeted the image instead of its page");
        } else if (action === "image-url" && !fallback) {
          if (!embedded.isHyperLink || embedded.hyperlink !== source)
            throw Error("URL action imported a local file");
        } else {
          if (!embedded.file || !app.vault.getFileByPath(embedded.file.path))
            throw Error("import action did not write a vault attachment");
          if (!existingFiles.has(embedded.file.path))
            c.attachments.push(embedded.file.path);
          const bytes = await app.vault.readBinary(embedded.file);
          if (new Uint8Array(bytes)[0] !== 137)
            throw Error("attachment is not the served PNG");
        }
        await view.forceSave(true, true);
        await leaf.setViewState({ type: "empty", state: {} });
        await leaf.setViewState({
          type: "excalidraw",
          state: { file: drawingPath },
        });
        await waitFor(() => leaf.view.excalidrawAPI, "reopen API");
        view = leaf.view;
        const reopened = view
          .getViewElements()
          .find((el) => el.id === element.id);
        if (!reopened) throw Error("dropped element missing after reopen");
        if (
          navigation &&
          (action === "link" ? reopened.text : reopened.link) !== pageURL
        )
          throw Error("navigation changed after reopen");
        if (!navigation) {
          const file = view.excalidrawData.getFile(reopened.fileId);
          if (
            !file ||
            (embedded.file
              ? file.file?.path !== embedded.file.path
              : file.hyperlink !== source)
          )
            throw Error("image storage changed after reopen");
        }
        c.results.push({
          window: popout ? "popout" : "main",
          payload: scenario.id,
          action,
          storedAs: navigation
            ? "page"
            : action === "image-import" || fallback
              ? "vault-file"
              : "URL",
          reopen: true,
        });
      }
      if (c.pop) {
        await closePopout();
      }
      app.workspace.setActiveLeaf(main, { focus: true });
    }
  } finally {
    plugin.settings.modifierKeyConfig = previous;
    let cleanupError;
    try {
      if (c.pop) {
        await closePopout();
      }
    } catch (error) {
      cleanupError = error;
    }
    // The parent runner owns the drawing. Remove these exact owned image
    // elements before deleting only attachments created by this scenario.
    try {
      if (main.view.excalidrawAPI) {
        app.workspace.setActiveLeaf(main, { focus: true });
        main.view.excalidrawAPI.updateScene({
          elements: main.view
            .getViewElements()
            .filter((el) => !c.ownedIds.includes(el.id)),
          captureUpdate: "NEVER",
        });
        await main.view.forceSave(true, true);
      }
    } catch (error) {
      cleanupError ??= error;
    }
    for (const path of c.attachments) {
      try {
        const file = app.vault.getFileByPath(path);
        if (file) await app.vault.delete(file);
      } catch (error) {
        cleanupError ??= error;
      }
    }
    if (cleanupError) {
      const error = Error("Web-drop cleanup failed: " + String(cleanupError));
      error.cleanupFailed = true;
      throw error;
    }
  }
}

/** No external service is contacted; the server and owned fixtures are closed. */
export async function runWebDropScenario({
  cli,
  drawingPath,
  includePopout = true,
}) {
  assert.ok(drawingPath.startsWith("__excalidraw_cli_smoke_"));
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3f8AAAAASUVORK5CYII=",
    "base64",
  );
  const server = createServer((_request, response) => {
    response.writeHead(200, { "Content-Type": "image/png" });
    response.end(png);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const imageURL = `http://127.0.0.1:${server.address().port}/excalidraw-drop-${Date.now()}.png`;
  try {
    const result = await runLegacyTask({
      cli,
      control: "__excalidrawWebDrop",
      execute: exercise,
      args: [drawingPath, imageURL, png.toString("base64"), includePopout],
      timeoutMs: 240000,
    });
    assert.equal(
      result.results.filter((row) => row.window === "main").length,
      10,
    );
    assert.equal(
      result.results.filter((row) => row.window === "popout").length,
      includePopout ? 10 : 0,
    );
    return {
      id: "web-drop-2967",
      status: "passed",
      input:
        "synthetic DataTransfer; real local server, Vault storage and reopen",
      cases: result.results,
      tests: [
        {
          testId: "web-drop-2967",
          featureIds: ["P05", "P07"],
          status: "passed",
          assertions: [
            "all ten main-window mixed-payload variants preserve expected storage and reopen",
          ],
          input: "synthetic DataTransfer; no OS drag claim",
        },
        ...result.results
          .filter((row) => row.window === "popout")
          .map((row) => ({
            testId: "native:drop:web:popout:" + row.payload + ":" + row.action,
            featureIds: ["P03", "P05", "P07"],
            status: "passed",
            assertions: [
              "synthetic mixed payload reaches actual popout drop handling",
              "expected URL/local file/link/embeddable storage",
              "physical save and reopen preserves target",
            ],
            input: "synthetic DataTransfer; no OS drag claim",
            ...row,
          })),
      ],
    };
  } finally {
    await new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections();
    });
  }
}
