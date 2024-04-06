import { Extension } from "@codemirror/state";
import ExcalidrawPlugin from "src/main";
import { HideTextBetweenCommentsExtension } from "./Fadeout";
export const EDITOR_FADEOUT = "fadeOutExcalidrawMarkup";

const editorExtensions: {[key:string]:Extension}= {
  [EDITOR_FADEOUT]: HideTextBetweenCommentsExtension, 
}

export class EditorHandler {
  private activeEditorExtensions: Extension[] = [];

  constructor(private plugin: ExcalidrawPlugin) {}

  setup(): void {
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