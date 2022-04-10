import ExcalidrawPlugin from "./main";

export class OneOffs {
  private plugin: ExcalidrawPlugin;

  constructor(plugin: ExcalidrawPlugin) {
    this.plugin = plugin;
  }

  /*
  public patchCommentBlock() {
    //This is a once off cleanup process to remediate incorrectly placed comment %% before # Text Elements
    if (!this.plugin.settings.patchCommentBlock) {
      return;
    }
    const plugin = this.plugin;

    log(
      `${window
        .moment()
        .format("HH:mm:ss")}: Excalidraw will patch drawings in 5 minutes`,
    );
    setTimeout(async () => {
      await plugin.loadSettings();
      if (!plugin.settings.patchCommentBlock) {
        log(
          `${window
            .moment()
            .format(
              "HH:mm:ss",
            )}: Excalidraw patching aborted because synched data.json is already patched`,
        );
        return;
      }
      log(
        `${window
          .moment()
          .format("HH:mm:ss")}: Excalidraw is starting the patching process`,
      );
      let i = 0;
      const excalidrawFiles = plugin.app.vault.getFiles();
      for (const f of (excalidrawFiles || []).filter((f: TFile) =>
        plugin.isExcalidrawFile(f),
      )) {
        if (
          f.extension !== "excalidraw" && //legacy files do not need to be touched
          plugin.app.workspace.getActiveFile() !== f
        ) {
          //file is currently being edited
          let drawing = await plugin.app.vault.read(f);
          const orig_drawing = drawing;
          drawing = drawing.replaceAll("\r\n", "\n").replaceAll("\r", "\n"); //Win, Mac, Linux compatibility
          drawing = drawing.replace(
            "\n%%\n# Text Elements\n",
            "\n# Text Elements\n",
          );
          if (drawing.search("\n%%\n# Drawing\n") === -1) {
            const sceneJSONandPOS = getJSON(drawing);
            drawing = `${drawing.substr(
              0,
              sceneJSONandPOS.pos,
            )}\n%%\n# Drawing\n\`\`\`json\n${sceneJSONandPOS.scene}\n\`\`\`%%`;
          }
          if (drawing !== orig_drawing) {
            i++;
            log(`Excalidraw patched: ${f.path}`);
            await plugin.app.vault.modify(f, drawing);
          }
        }
      }
      plugin.settings.patchCommentBlock = false;
      plugin.saveSettings();
      log(
        `${window
          .moment()
          .format("HH:mm:ss")}: Excalidraw patched in total ${i} files`,
      );
    }, 300000); //5 minutes
  }

  public migrationNotice() {
    if (this.plugin.settings.loadCount > 0) {
      return;
    }
    const plugin = this.plugin;

    plugin.app.workspace.onLayoutReady(async () => {
      plugin.settings.loadCount++;
      plugin.saveSettings();
      const files = plugin.app.vault
        .getFiles()
        .filter((f) => f.extension === "excalidraw");
      if (files.length > 0) {
        const prompt = new MigrationPrompt(plugin.app, plugin);
        prompt.open();
      }
    });
  }

  public imageElementLaunchNotice() {
    if (!this.plugin.settings.imageElementNotice) {
      return;
    }
    const plugin = this.plugin;

    plugin.app.workspace.onLayoutReady(async () => {
      const prompt = new ImageElementNotice(plugin.app, plugin);
      prompt.open();
    });
  }

  public wysiwygPatch() {
    if (this.plugin.settings.patchCommentBlock) {
      return;
    } //the comment block patch needs to happen first (unlikely that someone has waited this long with the update...)
    //This is a once off process to patch excalidraw files remediate incorrectly placed comment %% before # Text Elements
    if (
      !(
        this.plugin.settings.runWYSIWYGpatch ||
        this.plugin.settings.fixInfinitePreviewLoop
      )
    ) {
      return;
    }
    const plugin = this.plugin;

    log(
      `${window
        .moment()
        .format(
          "HH:mm:ss",
        )}: Excalidraw will patch drawings to support WYSIWYG in 7 minutes`,
    );
    setTimeout(async () => {
      await plugin.loadSettings();
      if (
        !(
          this.plugin.settings.runWYSIWYGpatch ||
          this.plugin.settings.fixInfinitePreviewLoop
        )
      ) {
        log(
          `${window
            .moment()
            .format(
              "HH:mm:ss",
            )}: Excalidraw patching aborted because synched data.json is already patched`,
        );
        return;
      }
      log(
        `${window
          .moment()
          .format("HH:mm:ss")}: Excalidraw is starting the patching process`,
      );
      let i = 0;
      const excalidrawFiles = plugin.app.vault.getFiles();
      for (const f of (excalidrawFiles || []).filter((f: TFile) =>
        plugin.isExcalidrawFile(f),
      )) {
        if (
          f.extension !== "excalidraw" && //legacy files do not need to be touched
          plugin.app.workspace.getActiveFile() !== f
        ) {
          //file is currently being edited
          try {
            const excalidrawData = new ExcalidrawData(plugin);
            const data = await plugin.app.vault.read(f);
            const textMode = getTextMode(data);
            await excalidrawData.loadData(data, f, textMode);

            let trimLocation = data.search(/(^%%\n)?# Text Elements\n/m);
            if (trimLocation == -1) {
              trimLocation = data.search(/(%%\n)?# Drawing\n/);
            }
            if (trimLocation > -1) {
              let header = data
                .substring(0, trimLocation)
                .replace(
                  /excalidraw-plugin:\s.*\n/,
                  `${FRONTMATTER_KEY}: ${
                    textMode == TextMode.raw ? "raw\n" : "parsed\n"
                  }`,
                );

              header = header.replace(
                /cssclass:[\s]*excalidraw-hide-preview-text[\s]*\n/,
                "",
              );

              const REG_IMG = /(^---[\w\W]*?---\n)(!\[\[.*?]]\n(%%\n)?)/m; //(%%\n)? because of 1.4.8-beta... to be backward compatible with anyone who installed that version
              if (header.match(REG_IMG)) {
                header = header.replace(REG_IMG, "$1");
              }
              const newData = header + excalidrawData.generateMD();

              if (data !== newData) {
                i++;
                log(`Excalidraw patched: ${f.path}`);
                await plugin.app.vault.modify(f, newData);
              }
            }
          } catch (e) {
            errorlog({
              where: "OneOffs.wysiwygPatch",
              message: `Unable to process: ${f.path}`,
              error: e,
            });
          }
        }
      }
      plugin.settings.runWYSIWYGpatch = false;
      plugin.settings.fixInfinitePreviewLoop = false;
      plugin.saveSettings();
      log(
        `${window
          .moment()
          .format("HH:mm:ss")}: Excalidraw patched in total ${i} files`,
      );
    }, 420000); //7 minutes
  }
}

class MigrationPrompt extends Modal {
  private plugin: ExcalidrawPlugin;

  constructor(app: App, plugin: ExcalidrawPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen(): void {
    this.titleEl.setText("Welcome to Excalidraw 1.2");
    this.createForm();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  createForm(): void {
    const div = this.contentEl.createDiv();
    //    div.addClass("excalidraw-prompt-div");
    //    div.style.maxWidth = "600px";
    div.createEl("p", {
      text: "This version comes with tons of new features and possibilities. Please read the description in Community Plugins to find out more.",
    });
    div.createEl("p", { text: "" }, (el) => {
      el.innerHTML =
        "Drawings you've created with version 1.1.x need to be converted to take advantage of the new features. You can also continue to use them in compatibility mode. " +
        "During conversion your old *.excalidraw files will be replaced with new *.excalidraw.md files.";
    });
    div.createEl("p", { text: "" }, (el) => {
      //files manually follow one of two options:
      el.innerHTML =
        "To convert your drawings you have the following options:<br><ul>" +
        "<li>Click <code>CONVERT FILES</code> now to convert all of your *.excalidraw files, or if you prefer to make a backup first, then click <code>CANCEL</code>.</li>" +
        "<li>In the Command Palette select <code>Excalidraw: Convert *.excalidraw files to *.excalidraw.md files</code></li>" +
        "<li>Right click an <code>*.excalidraw</code> file in File Explorer and select one of the following options to convert files one by one: <ul>" +
        "<li><code>*.excalidraw => *.excalidraw.md</code></li>" +
        "<li><code>*.excalidraw => *.md (Logseq compatibility)</code>. This option will retain the original *.excalidraw file next to the new Obsidian format. " +
        "Make sure you also enable <code>Compatibility features</code> in Settings for a full solution.</li></ul></li>" +
        "<li>Open a drawing in compatibility mode and select <code>Convert to new format</code> from the <code>Options Menu</code></li></ul>";
    });
    div.createEl("p", {
      text: "This message will only appear maximum 3 times in case you have *.excalidraw files in your Vault.",
    });
    const bConvert = div.createEl("button", { text: "CONVERT FILES" });
    bConvert.onclick = () => {
      this.plugin.convertExcalidrawToMD();
      this.close();
    };
    const bCancel = div.createEl("button", { text: "CANCEL" });
    bCancel.onclick = () => {
      this.close();
    };
  }
}

class ImageElementNotice extends Modal {
  private plugin: ExcalidrawPlugin;
  private saveChanges: boolean = false;

  constructor(app: App, plugin: ExcalidrawPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen(): void {
    this.titleEl.setText("Image Elements have arrived!");
    this.createForm();
  }

  async onClose() {
    this.contentEl.empty();
    if (!this.saveChanges) {
      return;
    }
    await this.plugin.loadSettings();
    this.plugin.settings.imageElementNotice = false;
    this.plugin.saveSettings();
  }

  createForm(): void {
    const div = this.contentEl.createDiv();
    //div.addClass("excalidraw-prompt-div");
    //div.style.maxWidth = "600px";

    div.createEl("p", { text: "" }, (el) => {
      el.innerHTML =
        "Welcome to Obsidian-Excalidraw 1.4! I've added Image Elements. " +
        "Please watch the video below to learn how to use this new feature.";
    });

    div.createEl("p", { text: "" }, (el) => {
      el.innerHTML =
        "<u>⚠ WARNING:</u> Opening new drawings with an older version of the plugin will lead to loss of images. " +
        "Update the plugin on all your devices.";
    });

    div.createEl("p", { text: "" }, (el) => {
      el.innerHTML =
        "Since March, I have spent most of my free time building this plugin. Close to 75 workdays worth of my time (assuming 8-hour days).  " +
        "Some of you have already bought me a coffee. THANK YOU! Your support really means a lot to me! If you have not yet done so, please consider clicking the button below.";
    });

    const coffeeDiv = div.createDiv("coffee");
    coffeeDiv.addClass("ex-coffee-div");
    const coffeeLink = coffeeDiv.createEl("a", {
      href: "https://ko-fi.com/zsolt",
    });
    const coffeeImg = coffeeLink.createEl("img", {
      attr: {
        src: "https://cdn.ko-fi.com/cdn/kofi3.png?v=3",
      },
    });
    coffeeImg.height = 45;

    div.createEl("p", { text: "" }, (el) => {
      //files manually follow one of two options:
      el.style.textAlign = "center";
      el.innerHTML =
        '<iframe width="560" height="315" src="https://www.youtube.com/embed/_c_0zpBJ4Xc?start=20" title="YouTube video player" ' +
        'frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ' +
        "allowfullscreen></iframe>";
    });

    div.createEl("p", { text: "" }, (el) => {
      //files manually follow one of two options:
      el.style.textAlign = "right";

      const bOk = el.createEl("button", { text: "OK - Don't show this again" });
      bOk.onclick = () => {
        this.saveChanges = true;
        this.close();
      };

      const bCancel = el.createEl("button", {
        text: "CANCEL - Read next time",
      });
      bCancel.onclick = () => {
        this.saveChanges = false;
        this.close();
      };
    });
  }
  */
}
