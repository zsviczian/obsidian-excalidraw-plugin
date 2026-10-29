/** Read-only native text-history evidence. Serialized into the owned vault only. */
export function captureTextUndoState(view, workspace) {
  const doc = view?.containerEl?.ownerDocument;
  const win = doc?.defaultView;
  const api = view?.excalidrawAPI;
  const root = view?.containerEl?.querySelector(".excalidraw");
  const rect = (element) => {
    if (!element) return null;
    const r = element.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  };
  const controls = Object.fromEntries(
    ["undo", "redo"].map((action) => {
      const button = view?.containerEl?.querySelector(
        `button[data-testid="button-${action}"]`,
      );
      // Read presence/enabled state before layout measurements. No rendering,
      // focus, event, history or store method is invoked by this diagnostic.
      const present = !!button,
        disabled = button?.disabled ?? null;
      const bounds = rect(button);
      const style = button && win?.getComputedStyle(button);
      const visible =
        !!bounds &&
        bounds.width > 0 &&
        bounds.height > 0 &&
        style?.display !== "none" &&
        style?.visibility !== "hidden";
      const hit =
        bounds &&
        doc.elementFromPoint(
          bounds.x + bounds.width / 2,
          bounds.y + bounds.height / 2,
        );
      return [
        action,
        {
          present,
          disabled,
          visible,
          display: style?.display,
          visibility: style?.visibility,
          bounds,
          covered: !!button && hit?.closest?.("button") !== button,
        },
      ];
    }),
  );
  let history = { source: "not exposed by public API" };
  // Forensics only: walk the owning root's ancestors, bounded even for malformed
  // test fibers. Read bounded delta data, never retain the App/fiber or call its APIs.
  const key =
    root && Object.keys(root).find((k) => k.startsWith("__reactFiber$"));
  let fiber = key && root[key];
  const visited = new Set();
  for (
    let i = 0;
    fiber && i < 128 && !visited.has(fiber);
    i++, fiber = fiber.return
  ) {
    visited.add(fiber);
    const candidate = fiber.stateNode?.history;
    if (
      Array.isArray(candidate?.undoStack) &&
      Array.isArray(candidate?.redoStack)
    ) {
      history = {
        source: "read-only owning App fiber",
        undoDepth: candidate.undoStack.length,
        redoDepth: candidate.redoStack.length,
        undoEntries: candidate.undoStack.slice(-8).map((entry) => ({
          id: entry.id,
          elements: entry.elements,
          appState: entry.appState?.delta,
        })),
        redoEntries: candidate.redoStack.slice(-8).map((entry) => ({
          id: entry.id,
          elements: entry.elements,
          appState: entry.appState?.delta,
        })),
      };
      break;
    }
  }
  let ownerContentsId;
  try {
    ownerContentsId = win
      ?.require?.("@electron/remote")
      .getCurrentWebContents().id;
  } catch {
    /* Ownership still has document/main-window evidence below. */
  }
  const state = api?.getAppState();
  return {
    at: Date.now(),
    targetDrawing: view?.file?.path,
    owner: {
      contentsId: ownerContentsId,
      main: doc === workspace.containerEl.ownerDocument,
      closed: win?.closed,
      focused: doc?.hasFocus(),
      viewport: { width: win?.innerWidth, height: win?.innerHeight },
    },
    activeLeaf: {
      id: workspace.activeLeaf?.id,
      type: workspace.activeLeaf?.view?.getViewType?.(),
      file: workspace.activeLeaf?.view?.file?.path,
    },
    activeEditor: {
      type: workspace.activeEditor?.getViewType?.(),
      file: workspace.activeEditor?.file?.path,
      editor: !!workspace.activeEditor?.editor,
    },
    layout: workspace.getLayout(),
    root: { classes: root?.className, bounds: rect(root) },
    editorInterface: api?.getEditorInterface?.(),
    controls,
    history,
    viewState: {
      textMode: view?.textMode,
      modelTextMode: view?.excalidrawData?.textMode,
      scenePrevTextMode: view?.excalidrawData?.scene?.prevTextMode,
      compatibilityMode: view?.compatibilityMode,
      dirty: view?.isDirty?.(),
      closing: view?.isClosingOrMigrating?.(),
    },
    state: {
      viewModeEnabled: state?.viewModeEnabled,
      activeTool: state?.activeTool,
      editingTextId: state?.editingTextElement?.id,
      selectedElementIds: state?.selectedElementIds,
    },
    elements: api
      ?.getSceneElementsIncludingDeleted()
      .map((e) => ({
        id: e.id,
        type: e.type,
        isDeleted: e.isDeleted,
        version: e.version,
        text: e.text,
        originalText: e.originalText,
        rawText: e.rawText,
        link: e.link,
        x: e.x,
        y: e.y,
        width: e.width,
        height: e.height,
        cache:
          e.type === "text"
            ? view.excalidrawData.getParsedResult(e.id)
            : undefined,
      })),
    editor:
      view?.containerEl?.querySelector("textarea.excalidraw-wysiwyg")?.value ??
      null,
  };
}
