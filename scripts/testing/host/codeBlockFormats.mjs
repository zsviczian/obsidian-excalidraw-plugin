/** Real editor paste/menu routing, modal controls, local Markdown images and settings persistence. */
export async function exerciseCodeBlockFormats(c, env, modifier) {
  const { p, doc, win, check, openDrawing, saveReopen, click, key, input, geometry } = env;
  await c.case("native:code-block-format:" + geometry().requested.id, ["P01", "P02", "P05"], async () => {
    let view = await openDrawing("code-formats");
    view.excalidrawAPI.updateScene({ elements: [], captureUpdate: "NEVER" });
    const source = " \r\n```js\r\nconsole.log('code format');\r\n``` \r\n";
    const normalized = "```js\nconsole.log('code format');\n```";
    const settingsPath = app.vault.configDir + "/plugins/obsidian-excalidraw-plugin/data.json";
    const disk = async () => JSON.parse(await app.vault.adapter.read(settingsPath));
    const ownedModals = new Set();
    c.defer(() => { for (const modal of ownedModals) if (modal.isConnected) modal.querySelector(".modal-close-button")?.click(); });
    const chooser = () => [...doc.querySelectorAll(".modal")].find(modal => modal.querySelector(".excalidraw-multiOptionConfirmationPrompt-message")?.textContent.includes("Insert this code block"));
    const choose = async (label, remember = false) => {
      let modal;
      await c.waitFor(() => {
        c.observations.codeFormat = { preference: p.settings.pasteCodeBlockAs, modifiers: view.modifierKeyDown, active: doc.activeElement?.outerHTML.slice(0, 500), modals: [...doc.querySelectorAll(".modal")].map(modal => modal.textContent.slice(0, 800)), elements: view.excalidrawAPI.getSceneElements().map(element => element.type) };
        return modal = chooser();
      }, "code format chooser in owning window");
      ownedModals.add(modal);
      if (remember) await click(modal.querySelector(".checkbox-container"));
      const button = [...modal.querySelectorAll("button")].find(button => button.textContent === label);
      await click(button);
      await c.waitFor(() => !modal.isConnected, "format chooser closes");
    };
    const title = async (value) => {
      let modal;
      await c.waitFor(() => modal = [...doc.querySelectorAll(".modal")].find(modal => modal.querySelector(".modal-title")?.textContent === "Code Block Title"), "embeddable title prompt");
      ownedModals.add(modal);
      const area = modal.querySelector("textarea"); area.value = value;
      area.dispatchEvent(new win.Event("input", { bubbles: true }));
      await click(modal.querySelector("button.mod-cta"));
    };
    const paste = async () => {
      const transfer = new win.DataTransfer(); transfer.setData("text/plain", source);
      const editor = view.containerEl.querySelector(".excalidraw"); editor.focus();
      await key("Escape", "Escape", 27);
      const r = view.containerEl.querySelector("canvas.interactive").getBoundingClientRect();
      await input("Input.dispatchMouseEvent", { type: "mouseMoved", x: r.x + r.width / 2, y: r.y + r.height / 2, button: "none" });
      editor.dispatchEvent(new win.ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: transfer }));
    };
    const menu = async () => {
      // Substitute only the OS clipboard boundary; leave the user's clipboard intact.
      // The owning editor renders its real context menu and receives trusted clicks.
      const clipboard = win.navigator.clipboard;
      const original = Object.getOwnPropertyDescriptor(clipboard, "readText");
      Object.defineProperty(clipboard, "readText", { configurable: true, value: async () => source });
      const restore = () => original ? Object.defineProperty(clipboard, "readText", original) : delete clipboard.readText;
      c.defer(restore);
      try {
        view.excalidrawAPI.updateScene({ appState: { selectedElementIds: {} }, captureUpdate: "NEVER", forceFlushSync: true });
        const canvas = view.containerEl.querySelector("canvas.interactive"), r = canvas.getBoundingClientRect();
        const point = { x: r.x + r.width * 0.12, y: r.y + r.height * 0.6 };
        await input("Input.dispatchMouseEvent", ["mousePressed", "mouseReleased"].map(type => ({ type, ...point, button: "right", buttons: type === "mousePressed" ? 2 : 0, clickCount: 1 })));
        let button;
        await c.waitFor(() => button = doc.querySelector('.context-menu [data-testid="pasteCodeblock"] button'), "Paste code block context-menu action");
        await click(button);
        await c.waitFor(() => !doc.querySelector('.context-menu [data-testid="pasteCodeblock"]'), "context menu closes");
      } finally { restore(); }
    };
    const inserted = async (before, type) => {
      let element;
      await c.waitFor(() => element = view.excalidrawAPI.getSceneElements().find(element => !before.has(element.id) && element.type === type), "inserted " + type);
      return element;
    };
    const ids = () => new Set(view.excalidrawAPI.getSceneElements().map(element => element.id));
    const assertImage = element => {
      check(element.customData?.markdownImage?.source === "local", "code image is not editable local Markdown");
      check(view.excalidrawData.getMarkdownImage(element.fileId)?.markdown === normalized, "code image source/fences/line endings changed");
      check(element.width > 0 && element.height > 0, "code image has no rendered geometry");
    };

    p.settings.pasteCodeBlockAs = "ask"; await p.saveSettings();
    // Clearing the seed drawing is a real edit. Flush it before comparing data:
    // opening any modal blurs the canvas and legitimately autosaves that edit.
    await view.forceSave(true, true);
    const initialData = view.data;
    await paste(); await choose("Cancel", true);
    check(ids().size === 0, "cancel inserted an element");
    check(view.data === initialData, "cancel changed drawing or back-of-note data after the baseline flush");
    check(p.settings.pasteCodeBlockAs === "ask" && (await disk()).pasteCodeBlockAs === "ask", "cancel remembered a preference");

    await paste(); await choose("Markdown image");
    let image = await inserted(new Set(), "image"); assertImage(image);
    check(p.settings.pasteCodeBlockAs === "ask" && (await disk()).pasteCodeBlockAs === "ask", "unremembered choice persisted");
    const imageId = image.id;
    view.containerEl.querySelector(".excalidraw").focus();
    await key("z", "KeyZ", 90, modifier);
    await c.waitFor(() => !ids().has(imageId), "image insertion has one undo step");
    // Local Markdown images use the existing deletion confirmation, including
    // undo. Resolve it before redo or cleanup can wait for its save forever.
    let deletionModal;
    await c.waitFor(() => deletionModal = [...doc.querySelectorAll(".modal")].find(modal => modal.querySelector(".excalidraw-multiOptionConfirmationPrompt-message")?.textContent.includes("Delete the Markdown text stored for this image?")), "existing Markdown deletion prompt after undo");
    ownedModals.add(deletionModal);
    await click([...deletionModal.querySelectorAll("button")].find(button => button.textContent === "Keep Markdown text"));
    await c.waitFor(() => !deletionModal.isConnected && !view.markdownImageController.markdownImageDeletionPrompt && !view.isSaveInProgress(), "Markdown deletion choice and save settle");
    view.containerEl.querySelector(".excalidraw").focus();
    await key("z", "KeyZ", 90, modifier | 8);
    await c.waitFor(() => ids().has(imageId), "image redo");
    image = view.excalidrawAPI.getSceneElements().find(element => element.id === imageId);
    assertImage(image);
    view.excalidrawAPI.mutateElement(image, { width: 440, height: 180 });
    view.excalidrawAPI.updateScene({ captureUpdate: "IMMEDIATELY" });
    view = await saveReopen(view);
    image = view.excalidrawAPI.getSceneElements().find(element => element.id === imageId);
    assertImage(image); check(image.width === 440 && image.height === 180, "image resize/source did not persist");

    let before = ids();
    await menu(); await choose("Interactive embeddable"); await title("Format card");
    const card = await inserted(before, "embeddable");
    await c.waitFor(() => view.excalidrawAPI.getSceneElements().find(element => element.id === card.id)?.height < 350, "chosen embeddable keeps initial autosize");
    check(p.settings.pasteCodeBlockAs === "ask", "embeddable unremembered choice changed setting");

    before = ids(); await menu(); await choose("Markdown image", true);
    assertImage(await inserted(before, "image"));
    check(p.settings.pasteCodeBlockAs === "markdown-image" && (await disk()).pasteCodeBlockAs === "markdown-image", "remembered image choice did not reach data.json");
    before = ids(); await paste(); assertImage(await inserted(before, "image"));
    check(!chooser(), "remembered format still asks");

    // Exercise the shared specification through the legacy control and declarative binding.
    const tab = p.settingsTab, specs = tab.getCodeBlockInsertionSpecs();
    const container = doc.body.createDiv(); c.defer(() => container.remove());
    tab.renderSettingSpecs(container, specs);
    const select = container.querySelector("select");
    check(select && [...select.options].map(option => option.value).sort().join() === ["ask", "embeddable", "markdown-image"].sort().join(), "setting is missing one of the requested formats");
    select.value = "ask"; select.dispatchEvent(new win.Event("change", { bubbles: true }));
    await c.waitFor(async () => p.settings.pasteCodeBlockAs === "ask" && (await disk()).pasteCodeBlockAs === "ask", "legacy setting persists Always ask");
    container.remove();
    const flatten = items => items.flatMap(item => [item, ...flatten(item.items || [])]);
    const definitions = flatten(tab.getSettingDefinitions());
    const definition = definitions.find(item => item.control?.key === "pasteCodeBlockAs");
    check(definition, "code format setting is missing from the complete declarative tree");
    check(definition.control.key === "pasteCodeBlockAs" && Object.keys(definition.control.options).length === 3, "declarative setting diverges from legacy setting");
    await tab.setControlValue("pasteCodeBlockAs", "embeddable");
    check((await disk()).pasteCodeBlockAs === "embeddable", "declarative preference was not serialized");
    before = ids(); await paste(); await title("Configured card");
    await inserted(before, "embeddable"); check(!chooser(), "configured Embeddable still asks");

    p.settings.pasteCodeBlockAs = "ask"; await p.saveSettings();
    before = ids(); await paste(); await choose("Interactive embeddable", true); await title("Remembered card");
    await inserted(before, "embeddable");
    check((await disk()).pasteCodeBlockAs === "embeddable", "remembered embeddable was not serialized");
    view = await saveReopen(view);
    check(view.excalidrawAPI.getSceneElements().filter(element => element.type === "image").every(element => view.excalidrawData.getMarkdownImage(element.fileId)?.markdown === normalized), "saved code images lost editable source");
    return { assertions: ["real editor paste event and trusted context-menu action share chooser", "cancel and both unremembered formats", "both remembered formats serialize and bypass chooser", "legacy control and declarative binding expose all three options", "Markdown image source, undo/redo and resized save/reopen", "embeddable titles and initial autosize preserved"], clipboard: "synthetic paste payload; context-menu OS clipboard read substituted without touching user clipboard", owner: geometry().requested.id };
  });
}
