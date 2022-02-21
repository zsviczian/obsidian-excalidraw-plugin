import { App, MarkdownRenderer, Modal } from "obsidian";
import ExcalidrawPlugin from "./main";

const RELEASE_NOTES: { [k: string]: string } = {
Intro: `I want to make it easier for you to keep up with all the updates.
Going forward, after installing each release, you'll be prompted with a message summarizing the key new features and fixes.
You can disable this in plugin-settings. The release change log is also avalable on [GitHub](https://github.com/zsviczian/obsidian-excalidraw-plugin/releases).

Since March 2021, I've spent most of my free time building this plugin. By now, this means well over 100 workdays worth of my time (assuming 8-hour days).
I am greatful to all of you who have already bought me a coffee. THANK YOU! This means a lot to me!

I still have many-many ideas for making Obsidian Excalidraw better.
I will continue to keep all the features of the plugin free. If, however, you'd like to contribute to the on-going development of the plugin, I am introducing a simple membership scheme, with Insider, Supporter and VIP tiers.
If you find this plugin valuable, please consider clicking the button below.

<div class="ex-coffee-div"><a href="https://ko-fi.com/zsolt"><img src="https://cdn.ko-fi.com/cdn/kofi3.png?v=3" height=45></a></div>
`,
"1.6.16":`
<div class="excalidraw-release-youtube" style="clear: both; text-align: center;">
<iframe height="100%" width="100%" src="https://www.youtube.com/embed/_c_0zpBJ4Xc?start=20" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>

## Fixed
- CMD+Drag does not work on Mac. You can now use SHIFT+Drag to embed an image or markdown document from the file Obsidian File Explorer into a scene.

## New Features
`};

export class ReleaseNotes extends Modal {
  private plugin: ExcalidrawPlugin;
  private version: string;

  constructor(app: App, plugin: ExcalidrawPlugin, version: string) {
    super(app);
    this.plugin = plugin;
    //@ts-ignore
    this.version = version;
  }

  onOpen(): void {
    this.contentEl.classList.add("excalidraw-release");
    this.containerEl.classList.add(".excalidraw-release");
    this.titleEl.setText(`Welcome to Excalidraw ${this.version}`);
    this.createForm();
  }

  async onClose() {
    this.contentEl.empty();
    await this.plugin.loadSettings();
    this.plugin.settings.previousRelease = this.version;
    await this.plugin.saveSettings();
  }

  async createForm() {
    const prevRelease = this.plugin.settings.previousRelease;
    const message = Object
      .keys(RELEASE_NOTES)
      .filter(key=>key>prevRelease)
      .map((key:string)=>`# ${key}\n${RELEASE_NOTES[key]}`)
      .join("\n\n");
    await MarkdownRenderer.renderMarkdown(
      message,
      this.contentEl,
      "",
      this.plugin,
    );


    this.contentEl.createEl("p", { text: "" }, (el) => {
      //files manually follow one of two options:
      el.style.textAlign = "right";
      const bOk = el.createEl("button", { text: "Thank you!" });
      bOk.onclick = () => this.close();
    });
  }
}