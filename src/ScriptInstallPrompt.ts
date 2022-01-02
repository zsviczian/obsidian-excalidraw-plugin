import {
  App,
  MarkdownRenderer,
  Modal,
  Notice,
  request,
} from "obsidian";
import { Url } from "url";
import { t } from "./lang/helpers";
import ExcalidrawPlugin from "./main";
import { errorlog } from "./Utils";

const URL = "https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/index.md";

export class ScriptInstallPrompt extends Modal {
  constructor(
    private plugin: ExcalidrawPlugin,
  ) {
    super(plugin.app);
//    this.titleEl.setText(t("INSTAL_MODAL_TITLE"));
  }

  async onOpen(): Promise<void> {
    this.contentEl.classList.add("excalidraw-scriptengine-install");  
    try {
      const source = await request({url:URL});
      MarkdownRenderer.renderMarkdown(source, this.contentEl, "", this.plugin);
    } catch(e) {
      errorlog({where:"ScriptInstallPrompt.onOpen", error: e});
      new Notice("Could not open ScriptEngine repository");
      this.close();
      return;
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}