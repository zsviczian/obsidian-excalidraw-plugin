import {
  MarkdownView,
  View,
  ViewState,
  ViewStateResult,
  Workspace,
  WorkspaceLeaf,
} from "obsidian";
import { around, dedupe } from "monkey-around";
import type ExcalidrawPlugin from "src/core/main";
import { VIEW_TYPE_EXCALIDRAW } from "src/constants/constants";
import { URLs } from "src/constants/safeUrls";
import { fileShouldDefaultAsExcalidraw } from "src/utils/fileUtils";
import { foldExcalidrawSection } from "src/utils/obsidianUtils";
import type ExcalidrawView from "src/view/ExcalidrawView";

type ViewConstructor<T extends View = View> = new (...args: unknown[]) => T;

/**
 * Registers workspace monkey patches that adapt Obsidian behavior
 * for Excalidraw and known plugin integrations.
 */
export class MonkeyPatchManager {
  private readonly plugin: ExcalidrawPlugin;

  constructor(plugin: ExcalidrawPlugin) {
    this.plugin = plugin;
  }

  public initialize(): void {
    this.patchTemplaterGetActiveViewOfType();
    this.patchHoverEditorGetRoot();
    this.patchWorkspaceLeafExcalidrawDefault();
  }

  private patchTemplaterGetActiveViewOfType(): void {
    const key = URLs.GITHUB_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_ISSUES;

    this.plugin.register(
      around(Workspace.prototype, {
        getActiveViewOfType(old: Workspace["getActiveViewOfType"]) {
          return dedupe(key, old, function <
            T extends View,
          >(this: Workspace, type: ViewConstructor<T>): T | null {
            const result = old.call(this, type) as T | null;
            const maybeEAView = this.getMostRecentLeaf()?.view;
            if (
              !maybeEAView ||
              maybeEAView.getViewType() !== VIEW_TYPE_EXCALIDRAW
            ) {
              return result;
            }
            const stackTrace = new Error().stack ?? "";
            if (!MonkeyPatchManager.isCallerFromTemplaterPlugin(stackTrace)) {
              return result;
            }
            const leafOrNode = (
              maybeEAView as ExcalidrawView
            ).getActiveEmbeddable();
            if (leafOrNode?.node?.isEditing) {
              return {
                file: leafOrNode.node.file,
                editor: leafOrNode.node.child.editor,
              } as unknown as T;
            }
            return result;
          });
        },
      }),
    );
  }

  private patchHoverEditorGetRoot(): void {
    if (this.plugin.app.plugins.plugins?.["obsidian-hover-editor"]) {
      return;
    }

    this.plugin.register(
      // Stolen from hover editor.
      around(WorkspaceLeaf.prototype, {
        getRoot(old: WorkspaceLeaf["getRoot"]) {
          return function (
            this: WorkspaceLeaf,
          ): ReturnType<WorkspaceLeaf["getRoot"]> {
            const top = old.call(this) as WorkspaceLeaf;
            return top.getRoot === this.getRoot ? top : top.getRoot();
          };
        },
      }),
    );
  }

  private patchWorkspaceLeafExcalidrawDefault(): void {
    const plugin = this.plugin;

    this.plugin.register(
      around(WorkspaceLeaf.prototype, {
        // Drawings can be viewed as markdown or Excalidraw, and we keep track of the mode
        // while the file is open. When the file closes, we no longer need to keep track of it.
        detach(next: WorkspaceLeaf["detach"]) {
          return function (
            this: WorkspaceLeaf,
          ): ReturnType<WorkspaceLeaf["detach"]> {
            const state = this.view?.getState();
            const stateFile =
              typeof state?.file === "string" ? state.file : null;
            const leafKey = this.id || stateFile;

            if (leafKey && plugin.excalidrawFileModes[leafKey]) {
              delete plugin.excalidrawFileModes[leafKey];
            }

            return next.apply(this);
          };
        },

        setViewState(next: WorkspaceLeaf["setViewState"]) {
          return function (
            this: WorkspaceLeaf,
            state: ViewState,
            ...rest: [ViewStateResult?]
          ): ReturnType<WorkspaceLeaf["setViewState"]> {
            const filePath = state.state?.file;
            const markdownViewLoaded =
              plugin._loaded && // Do not force Excalidraw mode during shutdown.
              state.type === "markdown" &&
              typeof filePath === "string";

            if (
              markdownViewLoaded &&
              plugin.excalidrawFileModes[this.id || filePath] !== "markdown"
            ) {
              if (
                plugin.forceToOpenInMarkdownFilepath !== filePath &&
                fileShouldDefaultAsExcalidraw(filePath, plugin.app)
              ) {
                const newState: ViewState = {
                  ...state,
                  type: VIEW_TYPE_EXCALIDRAW,
                };

                plugin.excalidrawFileModes[filePath] = VIEW_TYPE_EXCALIDRAW;

                return next.apply(this, [newState, ...rest]);
              }
              plugin.forceToOpenInMarkdownFilepath = null;
            }

            if (markdownViewLoaded) {
              window.setTimeout(() => {
                if (
                  !(this.view instanceof MarkdownView) ||
                  !this.view.file ||
                  !plugin.isExcalidrawFile(this.view.file)
                ) {
                  return;
                }
                foldExcalidrawSection(this.view);
              }, 500);
            }

            return next.apply(this, [state, ...rest]);
          };
        },
      }),
    );
  }

  private static isCallerFromTemplaterPlugin(stackTrace: string): boolean {
    const lines = stackTrace.split("\n");
    for (const line of lines) {
      if (line.trim().startsWith("at Templater.")) {
        return true;
      }
    }
    return false;
  }
}
