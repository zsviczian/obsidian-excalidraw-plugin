import { WorkspaceWindow } from "obsidian";
import ExcalidrawPlugin from "src/core/main";
import { getAllWindowDocuments } from "../../utils/obsidianUtils";
import { DEBUGGING, debug } from "../../utils/debugHelper";

export let REM_VALUE = 16;

const STYLE_VARIABLES = [
  "--background-modifier-cover",
  "--background-primary-alt",
  "--background-secondary",
  "--background-secondary-alt",
  "--background-modifier-border",
  "--text-normal",
  "--text-muted",
  "--text-accent",
  "--text-accent-hover",
  "--text-faint",
  "--text-highlight-bg",
  "--text-highlight-bg-active",
  "--text-selection",
  "--interactive-normal",
  "--interactive-hover",
  "--interactive-accent",
  "--interactive-accent-hover",
  "--scrollbar-bg",
  "--scrollbar-thumb-bg",
  "--scrollbar-active-thumb-bg",
  "--tab-container-background",
  "--titlebar-background-focused",
];
const EXCALIDRAW_CONTAINER_CLASS = "excalidraw__embeddable__outer";

export class StylesManager {
  private stylesMap = new Map<Document,{light: HTMLStyleElement, dark: HTMLStyleElement}>();
  private styleLight: string;
  private styleDark: string;
  private plugin: ExcalidrawPlugin;

  constructor(plugin: ExcalidrawPlugin) {
    this.plugin = plugin;
    plugin.app.workspace.onLayoutReady(async () => {
      (process.env.NODE_ENV === 'development') && DEBUGGING && debug(undefined, "StylesManager.constructor > app.workspace.onLayoutReady", this);
      await plugin.awaitInit();
      await this.harvestStyles();
      getAllWindowDocuments(plugin.app).forEach(doc => this.copyPropertiesToTheme(doc));

      //initialize
      plugin.registerEvent(
        plugin.app.workspace.on("css-change", ()=>this.onCSSChange()),
      )

      plugin.registerEvent(
        plugin.app.workspace.on("window-open", (win)=>this.onWindowOpen(win)),
      )

      plugin.registerEvent(
        plugin.app.workspace.on("window-close", (win)=>this.onWindowClose(win)),
      )
    });
  }

  private async onCSSChange () {
    await this.harvestStyles();
    getAllWindowDocuments(this.plugin.app).forEach(doc => {
      this.copyPropertiesToTheme(doc);
    })    
  }

  private onWindowOpen (win: WorkspaceWindow) {
    this.stylesMap.set(win.doc, {
      light: document.head.querySelector(`style[id="excalidraw-embedded-light"]`),
      dark: document.head.querySelector(`style[id="excalidraw-embedded-dark"]`)
    });
    //this.copyPropertiesToTheme(win.doc);
  }

  private onWindowClose (win: WorkspaceWindow) {
    this.stylesMap.delete(win.doc);
  }

  private async harvestStyles() {
    REM_VALUE = parseInt(window.getComputedStyle(document.body).getPropertyValue('--font-text-size').trim());
    if (isNaN(REM_VALUE)) {
      REM_VALUE = 16;
    }

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
  
  public destroy() {
    for (const [doc, styleTags] of this.stylesMap) {
      doc.head.removeChild(styleTags.light);
      doc.head.removeChild(styleTags.dark);
    }
    this.plugin = null;
  }

}