import { App, MarkdownRenderer, Modal, Notice, request } from "obsidian";
import { Url } from "url";
import { t } from "./lang/helpers";
import ExcalidrawPlugin from "./main";
import { errorlog } from "./Utils";

const URL =
  "https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/index.md";

export class ScriptInstallPrompt extends Modal {
  constructor(private plugin: ExcalidrawPlugin) {
    super(plugin.app);
    //    this.titleEl.setText(t("INSTAL_MODAL_TITLE"));
  }

  async onOpen(): Promise<void> {
    this.contentEl.classList.add("excalidraw-scriptengine-install");
    try {
      const source = await request({ url: URL });
      await MarkdownRenderer.renderMarkdown(
        source,
        this.contentEl,
        "",
        this.plugin,
      );
      this.contentEl.querySelectorAll("h2[data-heading").forEach((el) => {
        el.setAttribute("id", el.getAttribute("data-heading"));
      });
      this.contentEl.querySelectorAll("ul>li>a.internal-link").forEach((el) => {
        el.removeAttribute("target");
      });
    } catch (e) {
      errorlog({ where: "ScriptInstallPrompt.onOpen", error: e });
      new Notice("Could not open ScriptEngine repository");
      this.close();
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
