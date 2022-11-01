import { App, MarkdownRenderer, Modal } from "obsidian";
import { isVersionNewerThanOther } from "src/utils/Utils";
import ExcalidrawPlugin from "../main";
import { FIRST_RUN, RELEASE_NOTES } from "./Messages";

declare const PLUGIN_VERSION:string;

export class ReleaseNotes extends Modal {
  private plugin: ExcalidrawPlugin;
  private version: string;

  constructor(app: App, plugin: ExcalidrawPlugin, version: string) {
    super(app);
    this.plugin = plugin;
    this.version = version;
  }

  onOpen(): void {
    //this.contentEl.classList.add("excalidraw-release");
    this.containerEl.classList.add("excalidraw-release");
    this.titleEl.setText(`Welcome to Excalidraw ${this.version ?? ""}`);
    this.createForm();
  }

  async onClose() {
    this.contentEl.empty();
    await this.plugin.loadSettings();
    this.plugin.settings.previousRelease = PLUGIN_VERSION
    await this.plugin.saveSettings();
  }

  async createForm() {
    let prevRelease = this.plugin.settings.previousRelease;
    prevRelease = this.version === prevRelease ? "0.0.0" : prevRelease;
    const message = this.version
      ? Object.keys(RELEASE_NOTES)
          .filter((key) => key === "Intro" || isVersionNewerThanOther(key,prevRelease))
          .map((key: string) => `${key==="Intro" ? "" : `# ${key}\n`}${RELEASE_NOTES[key]}`)
          .slice(0, 10)
          .join("\n\n---\n")
      : FIRST_RUN;
    await MarkdownRenderer.renderMarkdown(
      message,
      this.contentEl,
      "",
      this.plugin,
    );

    this.contentEl.createEl("p", { text: "" }, (el) => {
      //files manually follow one of two options:
      el.style.textAlign = "right";
      const bOk = el.createEl("button", { text: "Close" });
      bOk.onclick = () => this.close();
    });
  }
}
