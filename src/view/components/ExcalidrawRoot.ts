import {
  AppState,
  ExcalidrawInitialDataState,
} from "@zsviczian/excalidraw/types/excalidraw/types";
import { ExcalidrawElement } from "@zsviczian/excalidraw/types/element/src/types";
import { DEVICE, obsidianToExcalidrawMap } from "../../constants/constants";
import { t } from "../../lang/helpers";
import { isMarkdownImageElement } from "../../shared/MarkdownImage";
import { shouldRenderMermaid } from "../../utils/mermaidUtils";
import type ExcalidrawView from "../ExcalidrawView";
import { EmbeddableMenu } from "./menu/EmbeddableActionsMenu";
import { ObsidianMenu } from "./menu/ObsidianMenu";
import { SelectedElementActionsMenu } from "./menu/SelectedElementActionsMenu";
import { ToolsPanel } from "./menu/ToolsPanel";

/**
 * Purpose:
 *   Package-aware Excalidraw root render tree, mechanically extracted from
 *   `ExcalidrawView.excalidrawRootElement()` (RefactorPlan.md Phase 7). This
 *   is a plain function, not a `.tsx` component: it still uses
 *   `view.packages.react.createElement()` throughout rather than JSX, and
 *   calls hooks (`useRef`, `useEffect`) exactly as before. Converting it to
 *   JSX/TSX is a deliberately separate later step (Phase 8), since a syntax
 *   change and a structural move must not be combined in one checkpoint.
 *
 * Author:
 *   zsviczian (extraction), original implementation predates this move
 *
 * References:
 *   RefactorPlan.md, "Phase 7: extract the React root without changing
 *   rendering syntax"
 *
 * Notes:
 *   Every hook call here executes as part of the same React render as
 *   before -- React tracks hooks by the rendering component's fiber, not by
 *   which function's source text contains the call, so delegating the
 *   entire render body to this free function (invoked as
 *   `createExcalidrawRootElement.bind(null, view, initdata)`, mirroring the
 *   previous `this.excalidrawRootElement.bind(this, initdata)`) is
 *   behaviorally identical to keeping it as a bound method.
 *
 *   Several `ExcalidrawView` members this function touches (menus, drag/drop
 *   handlers, and the large family of Excalidraw prop callbacks) were
 *   `private` and were widened to `public` as a mechanical, type-only part
 *   of this same extraction -- consistent with how `packages`, `plugin`,
 *   `excalidrawAPI`, and similar members were already public for the same
 *   reason. No runtime behavior changed.
 */
export function createExcalidrawRootElement(
  view: ExcalidrawView,
  initdata: ExcalidrawInitialDataState,
) {
  const React = view.packages.react;
  const { Excalidraw } = view.packages.excalidrawLib;

  const excalidrawWrapperRef = React.useRef<HTMLDivElement>(null);
  const toolsPanelRef = React.useRef<ToolsPanel>(null);
  const embeddableMenuRef = React.useRef<HTMLDivElement>(null);
  view.toolsPanelRef = toolsPanelRef;

  React.useEffect(() => {
    view.embeddableMenuRef = embeddableMenuRef;
    view.obsidianMenu = new ObsidianMenu(view.plugin, toolsPanelRef, view);
    view.embeddableMenu = new EmbeddableMenu(view, embeddableMenuRef);
    view.excalidrawWrapperRef = excalidrawWrapperRef;
    view.selectedElementActionsMenu = new SelectedElementActionsMenu(
      () => view.excalidrawContainer,
    );
    view.selectedElementActionsMenu.registerProvider({
      id: "markdown-image",
      getActions: (element) =>
        element.type === "image" && isMarkdownImageElement(view, element)
          ? [
              {
                id: "edit-markdown-image",
                title: t("EDIT_MARKDOWN_IMAGE"),
                icon: "pen-line",
                action: () => void view.openMarkdownImageEditor(element.id),
              },
              {
                id: "convert-markdown-image-to-embeddable",
                title: t("CONVERT_MARKDOWN_IMAGE_TO_EMBEDDABLE"),
                icon: "layout-template",
                action: () =>
                  void view.convertMarkdownImageToEmbeddable(element.id),
              },
            ]
          : [],
    });
    const appState = view.excalidrawAPI?.getAppState();
    if (appState) {
      view.selectedElementActionsMenu.update(
        view.getViewElements(),
        appState,
      );
    }
    view.plugin.scriptEngine.runAutostartScripts(view);
    return () => {
      view.obsidianMenu.destroy();
      view.obsidianMenu = null;
      view.embeddableMenu.destroy();
      view.embeddableMenu = null;
      view.selectedElementActionsMenu.destroy();
      view.selectedElementActionsMenu = null;
      view.toolsPanelRef.current = null;
      view.embeddableMenuRef.current = null;
      view.excalidrawWrapperRef.current = null;
    };
  }, []);

  const observer = React.useRef(
    new ResizeObserver((entries) => {
      if (!toolsPanelRef || !toolsPanelRef.current) {
        return;
      }
      const { width, height } = entries[0].contentRect;
      if (width === 0 || height === 0) {
        return;
      }
      const dx = toolsPanelRef.current.onRightEdge
        ? toolsPanelRef.current.previousWidth - width
        : 0;
      const dy = toolsPanelRef.current.onBottomEdge
        ? toolsPanelRef.current.previousHeight - height
        : 0;
      toolsPanelRef.current.updatePosition(dy, dx);
    }),
  );

  React.useEffect(() => {
    if (toolsPanelRef?.current) {
      observer.current.observe(toolsPanelRef.current.containerRef.current);
    }
    return () => {
      //unobserve is done in ToolsPanel componentWillUnmount
    };
  }, [toolsPanelRef, observer]);

  //---------------------------------------------------------------------------------
  //---------------------------------------------------------------------------------
  // Render Excalidraw DIV
  //---------------------------------------------------------------------------------
  //---------------------------------------------------------------------------------
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      "div",
      {
        className: "excalidraw-wrapper",
        ref: excalidrawWrapperRef,
        key: "abc",
        tabIndex: 0,
        onKeyDown: view.excalidrawDIVonKeyDown.bind(view),
        onKeyUp: view.excalidrawDIVonKeyUp.bind(view),
        onPointerDown: view.onPointerDown.bind(view),
        onMouseMove: view.onMouseMove.bind(view),
        onMouseOver: view.onMouseOver.bind(view),
        onDragOver: view.dropManager?.onDragOver.bind(view.dropManager),
        onDragLeave: view.dropManager?.onDragLeave.bind(view.dropManager),
      },
      React.createElement(
        Excalidraw,
        {
          ownerDocument: view.ownerDocument,
          onExcalidrawAPI: (api) => view.setExcalidrawAPI(api),
          onInitialize: (api) => view.onExcalidrawInitialize(api),
          UIOptions: {
            canvasActions: {
              loadScene: false,
              export: false,
              saveAsImage: false,
              saveToActiveFile: false,
            },
            //desktopUIMode: calculateUIModeValue(view.plugin.settings), //2026.05.15
            //formFactor: DEVICE.isMobile ? "phone" : DEVICE.isTablet ? "tablet" : "desktop",
          },
          imageOptions: {
            maxWidthOrHeight: 3440,
            maxFileSizeBytes: 20 * 1024 * 1024,
          },
          initState: initdata?.appState as AppState,
          initialData: initdata,
          detectScroll: true,
          onPointerUpdate: (p) => view.onPointerUpdate(p),
          libraryReturnUrl: "app://obsidian.md",
          autoFocus: true,
          langCode: obsidianToExcalidrawMap[view.plugin.locale] ?? "en-EN",
          aiEnabled: view.plugin.settings.aiEnabled ?? true,
          onChange: (et, st, files) =>
            view.onChange(et as ExcalidrawElement[], st, files),
          onIncrement: (event) => view.onExcalidrawIncrement(event),
          onLibraryChange: (libraryItems) =>
            view.onLibraryChange(libraryItems),
          renderTopRightUI: (isMobile: boolean, appState: AppState) =>
            view.renderTopRightUI(isMobile, appState),
          renderEmbeddableMenu: (appState) =>
            view.renderEmbeddableMenu(appState),
          onPaste: (data, event, files) => view.onPaste(data, event, files),
          onThemeChange: (theme: string) => {
            void view.onThemeChange(theme);
          },
          onDrop: (event) => view.dropManager?.onDrop(event),
          onBeforeTextEdit: (element, isExisting) =>
            view.onBeforeTextEdit(element, isExisting),
          onBeforeTextSubmit: (
            element,
            nextText,
            nextOriginalText,
            isDeleted,
          ) =>
            view.onBeforeTextSubmit(
              element,
              nextText,
              nextOriginalText,
              isDeleted,
            ),
          onLinkOpen: (element, e) => {
            void view.onLinkOpen(element, e);
          },
          onLinkHover: (element, event) => view.onLinkHover(element, event),
          onContextMenu: (elements, st, onClose) =>
            view.onContextMenu(elements, st, onClose),
          onViewModeChange: (isViewModeEnabled) =>
            view.onViewModeChange(isViewModeEnabled),
          validateEmbeddable: true,
          renderWebview: DEVICE.isDesktop,
          renderEmbeddable: (el, st) => view.renderEmbeddable(el, st),
          renderMermaid: shouldRenderMermaid(),
          showDeprecatedFonts: true,
          insertLinkAction: DEVICE.isDesktop
            ? undefined
            : (linkval) => view.insertLinkAction(linkval),
        },
        view.renderCustomActionsMenu(),
        view.renderWelcomeScreen(),
        view.ttdDialog(),
        view.diagramToCode(),
        view.ttdDialogTrigger(),
      ),
      view.renderToolsPanel(observer),
    ),
  );
}
