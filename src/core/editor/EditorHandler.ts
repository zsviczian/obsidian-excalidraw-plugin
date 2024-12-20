import { Extension } from "@codemirror/state";
import ExcalidrawPlugin from "src/core/main";
import { HideTextBetweenCommentsExtension } from "./Fadeout";
import { debug, DEBUGGING } from "src/utils/debugHelper";
export const EDITOR_FADEOUT = "fadeOutExcalidrawMarkup";

const editorExtensions: {[key:string]:Extension}= {
  [EDITOR_FADEOUT]: HideTextBetweenCommentsExtension, 
}

export class EditorHandler {
  private activeEditorExtensions: Extension[] = [];

  constructor(private plugin: ExcalidrawPlugin) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(EditorHandler, `ExcalidrawPlugin.construct EditorHandler`);
  }

  destroy(): void {
    this.plugin = null;
  }

  setup(): void {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.setup, `ExcalidrawPlugin.construct EditorHandler.setup`);
    this.plugin.registerEditorExtension(this.activeEditorExtensions);
    this.updateCMExtensionState(EDITOR_FADEOUT, this.plugin.settings.fadeOutExcalidrawMarkup);
  }

  updateCMExtensionState(
    extensionIdentifier: string,
    extensionState: boolean,
  ) {
    const extension = editorExtensions[extensionIdentifier];
    if(!extension) return;
    if (extensionState == true) {
      this.activeEditorExtensions.push(extension);
      // @ts-ignore
      this.activeEditorExtensions[this.activeEditorExtensions.length - 1].exID = extensionIdentifier;
    } else {
      for (let i = 0; i < this.activeEditorExtensions.length; i++) {
        const ext = this.activeEditorExtensions[i];
        // @ts-ignore
        if (ext.exID === extensionIdentifier) {
          this.activeEditorExtensions.splice(i, 1);
          break;
        }
      }
    }
    this.plugin.app.workspace.updateOptions();
  }
  update(): void {
    this.plugin.app.workspace.updateOptions();
  }
}