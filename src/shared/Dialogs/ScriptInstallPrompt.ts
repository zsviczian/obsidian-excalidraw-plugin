import { Component, MarkdownRenderer, Modal, Notice, request } from "obsidian";
import ExcalidrawPlugin from "../../core/main";
import { errorlog } from "../../utils/utils";
import { log } from "src/utils/debugHelper";
import { ContentSearcher } from "../components/ContentSearcher";
import { URLs } from "src/constants/safeUrls";
import { mainDocument } from "src/constants/constants";
import { t } from "src/lang/helpers";

const URL =
  URLs.RAW_GITHUBUSERCONTENT_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_MASTER_EA_SCRIPTS_INDEX_NEW_MD;

export class ScriptInstallPrompt extends Modal {
  private contentDiv: HTMLDivElement;
  private renderComponent: Component;

  constructor(private plugin: ExcalidrawPlugin) {
    super(plugin.app);
    //    this.titleEl.setText(t("INSTAL_MODAL_TITLE"));
  }

  onOpen(): void {
    this.renderComponent = new Component();
    this.renderComponent.load();
    this.contentEl.classList.add("excalidraw-scriptengine-install");
    this.contentDiv = mainDocument.createElement("div");
    this.contentEl.appendChild(this.contentDiv);

    new ContentSearcher(this.contentDiv);

    this.containerEl.classList.add("excalidraw-scriptengine-install");
    void (async () => {
      try {
        const source = await request({ url: URL });
        if (!source) {
          new Notice(t("SCRIPT_INSTALL_PROMPT_FETCH_ERROR"), 5000);
          log(URL);
          this.close();
          return;
        }
        await MarkdownRenderer.render(
          this.plugin.app,
          source,
          this.contentDiv,
          "",
          this.renderComponent,
        );
        this.contentDiv
          .querySelectorAll(
            "h1[data-heading],h2[data-heading],h3[data-heading]",
          )
          .forEach((el) => {
            el.setAttribute("id", el.getAttribute("data-heading"));
          });
        this.contentDiv.querySelectorAll("a.internal-link").forEach((el) => {
          el.removeAttribute("target");
        });
      } catch (e: unknown) {
        errorlog({ where: "ScriptInstallPrompt.onOpen", error: e });
        new Notice(t("SCRIPT_INSTALL_PROMPT_OPEN_ERROR"));
        this.close();
      }
    })();
  }

  onClose(): void {
    this.contentEl.empty();
    this.renderComponent.unload();
  }
}
