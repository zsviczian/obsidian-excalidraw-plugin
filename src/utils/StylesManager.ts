import { WorkspaceWindow } from "obsidian";
import ExcalidrawPlugin from "src/main";
import { getAllWindowDocuments } from "./ObsidianUtils";

const STYLE_VARIABLES = ["--background-modifier-cover","--background-primary-alt","--background-secondary","--background-secondary-alt","--background-modifier-border","--text-normal","--text-muted","--text-accent","--text-accent-hover","--text-faint","--text-highlight-bg","--text-highlight-bg-active","--text-selection","--interactive-normal","--interactive-hover","--interactive-accent","--interactive-accent-hover","--scrollbar-bg","--scrollbar-thumb-bg","--scrollbar-active-thumb-bg"];
const EXCALIDRAW_CONTAINER_CLASS = "excalidraw__embeddable__outer";

export class StylesManager {
  private stylesMap = new Map<Document,{light: HTMLStyleElement, dark: HTMLStyleElement}>();
  private styleLight: string;
  private styleDark: string;
  private plugin: ExcalidrawPlugin;

  constructor(plugin: ExcalidrawPlugin) {
    this.plugin = plugin;
    plugin.app.workspace.onLayoutReady(async () => {
      await this.harvestStyles();
      getAllWindowDocuments(plugin.app).forEach(doc => {
        this.copyPropertiesToTheme(doc);
      })

      //initialize
      plugin.registerEvent(
        plugin.app.workspace.on("css-change", async () => {
          await this.harvestStyles();
          getAllWindowDocuments(plugin.app).forEach(doc => {
            this.copyPropertiesToTheme(doc);
          })    
        }),
      )

      plugin.registerEvent(
        plugin.app.workspace.on("window-open", (win: WorkspaceWindow, window: Window) => {
          this.stylesMap.set(win.doc, {
            light: document.head.querySelector(`style[id="excalidraw-embedded-light"]`),
            dark: document.head.querySelector(`style[id="excalidraw-embedded-dark"]`)
          });
          //this.copyPropertiesToTheme(win.doc);
        }),
      )

      plugin.registerEvent(
        plugin.app.workspace.on("window-open", (win: WorkspaceWindow, window: Window) => {
          this.stylesMap.delete(win.doc);
        }),
      )
    });
  }

  public unload() {
    for (const [doc, styleTags] of this.stylesMap) {
      doc.head.removeChild(styleTags.light);
      doc.head.removeChild(styleTags.dark);
    }
  }

  private async harvestStyles() {
    const body = document.body;
    const iframe:HTMLIFrameElement = document.createElement("iframe");
    iframe.style.display = "none";
    body.appendChild(iframe);

    const iframeLoadedPromise = new Promise<void>((resolve) => {
      iframe.addEventListener("load", () => resolve());
    });

    const iframeDoc = iframe.contentWindow.document;
    const iframeWin = iframe.contentWindow;
    iframeDoc.open();
    iframeDoc.write(`<head>${document.head.innerHTML}</head>`);
    iframeDoc.close();

    await iframeLoadedPromise;

    const iframeBody = iframe.contentWindow.document.body;
    iframeBody.setAttribute("style", body.getAttribute("style"));
    iframeBody.setAttribute("class", body.getAttribute("class"));

    const setTheme = (theme: "theme-light" | "theme-dark") => {
      iframeBody.classList.remove("theme-light");
      iframeBody.classList.remove("theme-dark");
      iframeBody.classList.add(theme);
    }

    const getCSSVariables = (): string => {
      const computedStyles = iframeWin.getComputedStyle(iframeBody);
      const allVariables: {[key:string]:string} = {};
      for (const variable of STYLE_VARIABLES) {
        allVariables[variable] = computedStyles.getPropertyValue(variable);
      }
      const cm = this.plugin.ea.getCM(computedStyles.getPropertyValue("--background-primary"));
      cm.alphaTo(0.9);
      allVariables["--background-primary"] = cm.stringHEX();
      return Object.entries(allVariables)
        .map(([key, value]) => `${key}: ${value} !important;`)
        .join(" ");
    }

    setTheme("theme-light");
    this.styleLight = getCSSVariables();
    setTheme("theme-dark");
    this.styleDark = getCSSVariables();
    body.removeChild(iframe);
  }

  private copyPropertiesToTheme(doc: Document) {
    const styleTags = this.stylesMap.get(doc);
    if (styleTags) {
      styleTags.light.innerHTML = `.${EXCALIDRAW_CONTAINER_CLASS} .theme-light {\n${this.styleLight}\n}`;
      styleTags.dark.innerHTML = `.${EXCALIDRAW_CONTAINER_CLASS} .theme-dark {\n${this.styleDark}\n}`;
    } else {
      const lightStyleTag = doc.createElement("style");
      lightStyleTag.type = "text/css";
      lightStyleTag.setAttribute("id", "excalidraw-embedded-light");
      lightStyleTag.innerHTML = `.${EXCALIDRAW_CONTAINER_CLASS} .theme-light {\n${this.styleLight}\n}`;
      doc.head.appendChild(lightStyleTag);

      const darkStyleTag = doc.createElement("style");
      darkStyleTag.type = "text/css";
      darkStyleTag.setAttribute("id", "excalidraw-embedded-dark");
      darkStyleTag.innerHTML = `.${EXCALIDRAW_CONTAINER_CLASS} .theme-dark {\n${this.styleDark}\n}`;
      doc.head.appendChild(darkStyleTag);

      this.stylesMap.set(doc, {light: lightStyleTag, dark: darkStyleTag});
    }
  }  	
}