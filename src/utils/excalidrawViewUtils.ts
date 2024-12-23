
import { MAX_IMAGE_SIZE, IMAGE_TYPES, ANIMATED_IMAGE_TYPES, MD_EX_SECTIONS } from "src/constants/constants";
import { App, Modal, Notice, TFile, WorkspaceLeaf } from "obsidian";
import { ExcalidrawAutomate } from "src/shared/ExcalidrawAutomate";
import { REGEX_LINK, REG_LINKINDEX_HYPERLINK, getExcalidrawMarkdownHeaderSection, REGEX_TAGS } from "../shared/ExcalidrawData";
import ExcalidrawView from "src/view/ExcalidrawView";
import { ExcalidrawElement, ExcalidrawFrameElement, ExcalidrawImageElement } from "@zsviczian/excalidraw/types/excalidraw/element/types";
import { getEmbeddedFilenameParts, getLinkParts, isImagePartRef } from "./utils";
import { cleanSectionHeading } from "./obsidianUtils";
import { getEA } from "src/core";
import { ExcalidrawImperativeAPI } from "@zsviczian/excalidraw/types/excalidraw/types";
import { EmbeddableMDCustomProps } from "src/shared/Dialogs/EmbeddableSettings";
import { nanoid } from "nanoid";
import { t } from "src/lang/helpers";
import { Mutable } from "@zsviczian/excalidraw/types/excalidraw/utility-types";
import { EmbeddedFile } from "src/shared/EmbeddedFileLoader";

export async function insertImageToView(
  ea: ExcalidrawAutomate,
  position: { x: number, y: number },
  file: TFile | string,
  scale?: boolean,
  shouldInsertToView: boolean = true,
  repositionToCursor: boolean = false,
):Promise<string> {
  if(shouldInsertToView) {ea.clear();}
  ea.style.strokeColor = "transparent";
  ea.style.backgroundColor = "transparent";
  const api = ea.getExcalidrawAPI();
  ea.canvas.theme = api.getAppState().theme;
  const id = await ea.addImage(
    position.x,
    position.y,
    file,
    scale,
  );
  if(shouldInsertToView) {await ea.addElementsToView(repositionToCursor, true, true);}
  return id;
}

export async function insertEmbeddableToView (
  ea: ExcalidrawAutomate,
  position: { x: number, y: number },
  file?: TFile,
  link?: string,
  shouldInsertToView: boolean = true,
):Promise<string> {
  if(shouldInsertToView) {ea.clear();}
  const api = ea.getExcalidrawAPI() as ExcalidrawImperativeAPI;
  const st = api.getAppState();
  
  if(ea.plugin.settings.embeddableMarkdownDefaults.backgroundMatchElement) {
    ea.style.backgroundColor = st.currentItemBackgroundColor;
  } else {
    ea.style.backgroundColor = "transparent";
  }

  if(ea.plugin.settings.embeddableMarkdownDefaults.borderMatchElement) {
    ea.style.strokeColor = st.currentItemStrokeColor;
  } else {
    ea.style.strokeColor = "transparent";
  }
  
  if(file && (IMAGE_TYPES.contains(file.extension) || ea.isExcalidrawFile(file)) && !ANIMATED_IMAGE_TYPES.contains(file.extension)) {
    return await insertImageToView(ea, position, link??file, undefined, shouldInsertToView);
  } else {
    const id = ea.addEmbeddable(
      position.x,
      position.y,
      MAX_IMAGE_SIZE,
      MAX_IMAGE_SIZE,
      link,
      file,
    );
    if(shouldInsertToView) {await ea.addElementsToView(false, true, true);}
    return id;
  }
}

export function getLinkTextFromLink (text: string): string {
  if (!text) return;
  if (text.match(REG_LINKINDEX_HYPERLINK)) return;

  const parts = REGEX_LINK.getRes(text).next();
  if (!parts.value) return;

  const linktext = REGEX_LINK.getLink(parts); //parts.value[2] ? parts.value[2]:parts.value[6];
  if (linktext.match(REG_LINKINDEX_HYPERLINK)) return;

  return linktext;
}

export function openTagSearch(link: string, app: App, view?: ExcalidrawView) {
  const tags = REGEX_TAGS.getResList(link);

  if (!tags.length || !tags[0].value || tags[0].value.length < 2) {
    return;
  }

  const query = `tag:${tags[0].value[1]}`;
  const searchPlugin = app.internalPlugins.getPluginById("global-search");
  if (searchPlugin) {
    const searchInstance = searchPlugin.instance;
    if (searchInstance) {
      searchInstance.openGlobalSearch(query);
    }
  }

  if (view && view.isFullscreen()) {
    view.exitFullscreen();
  }
}

function getLinkFromMarkdownLink(link: string): string {
  const result = /^\[[^\]]*]\(([^\)]*)\)/.exec(link);
  return result ? result[1] : link;
}

export function openExternalLink (link:string, app: App, element?: ExcalidrawElement):boolean {
  link = getLinkFromMarkdownLink(link);
  if (link.match(/^cmd:\/\/.*/)) {
    const cmd = link.replace("cmd://", "");
    //@ts-ignore
    app.commands.executeCommandById(cmd);
    return true;
  }
  if (!link.startsWith("obsidian://") && link.match(REG_LINKINDEX_HYPERLINK)) {
    window.open(link, "_blank");
    return true;
  }

  return false;
}

/**
 * 
 * @param link 
 * @param app 
 * @param returnWikiLink 
 * @param openLink: if set to false, the link will not be opened just true will be returned for an obsidian link.
 * @returns 
 *   false if the link is not an obsidian link,
 *   true if the link is an obsidian link and it was opened (i.e. it is a link to another Vault or not a file link e.g. plugin link), or
 *   the link to the file path. By default as a wiki link, or as a file path if returnWikiLink is false.
 */
export function parseObsidianLink(
  link: string,
  app: App,
  returnWikiLink: boolean = true,
  openLink: boolean = true,
): boolean | string {
  if(!link) return false;
  link = getLinkFromMarkdownLink(link);
  if (!link?.startsWith("obsidian://")) {
      return false;
  }
  const url = new URL(link);
  const action = url.pathname.slice(2); // Remove leading '//'

  const props: {[key: string]: string} = {};
  url.searchParams.forEach((value, key) => {
      props[key] = decodeURIComponent(value);
  });

  if (action === "open" && props.vault === app.vault.getName()) {
      const file = props.file;
      const f = app.metadataCache.getFirstLinkpathDest(file, "");
      if (f && f instanceof TFile) {
          if (returnWikiLink) {
            return `[[${f.path}]]`;
          } else {
            return f.path;
          }
      }
  }

  if(openLink) {
    window.open(link, "_blank");
  }
  return true;
}

export function getExcalidrawFileForwardLinks (
  app: App, excalidrawFile: TFile,
  secondOrderLinksSet: Set<string>,
):string {
  let secondOrderLinks = "";
  const forwardLinks = app.metadataCache.getLinks()[excalidrawFile.path];
  if(forwardLinks && forwardLinks.length > 0) {
    const linkset = new Set<string>();
    forwardLinks.forEach(link => {
      const linkparts = getLinkParts(link.link);
      const f = app.metadataCache.getFirstLinkpathDest(linkparts.path, excalidrawFile.path);
      if(f && f.path !== excalidrawFile.path) {
        if(secondOrderLinksSet.has(f.path)) return;
        secondOrderLinksSet.add(f.path);
        linkset.add(`[[${f.path}${linkparts.ref?"#"+linkparts.ref:""}|Second Order Link: ${f.basename}]]`);
      }
    });
    secondOrderLinks = [...linkset].join(" ");             
  }
  return secondOrderLinks;
}

export function getFrameBasedOnFrameNameOrId(
  frameName: string,
  elements: ExcalidrawElement[],
): ExcalidrawFrameElement | null {
  const frames = elements
    .filter((el: ExcalidrawElement)=>el.type==="frame")
    .map((el: ExcalidrawFrameElement, idx: number)=>{
      return {el: el, id: el.id, name: el.name ?? `Frame ${String(idx+1).padStart(2,"0")}`};
    })
    .filter((item:any) => item.id === frameName || item.name === frameName)
    .map((item:any)=>item.el as ExcalidrawFrameElement);
  return frames.length === 1 ? frames[0] : null;
}

export async function addBackOfTheNoteCard(
  view: ExcalidrawView,
  title: string,
  activate: boolean = true,
  cardBody?: string,
  embeddableCustomData?: EmbeddableMDCustomProps,
):Promise<string> {
  const data = view.data;
  const header = getExcalidrawMarkdownHeaderSection(data);
  const body = data.split(header)[1];
  const shouldAddHashtag = body && body.startsWith("%%");
  const hastag = header.match(/#\n+$/m);
  const shouldRemoveTrailingHashtag = Boolean(hastag);
  view.data = data.replace(
    header,
    (shouldRemoveTrailingHashtag 
      ? header.substring(0,header.length-hastag[0].length) 
      : header) +
        `\n# ${title}\n\n${cardBody ? cardBody+"\n\n" : ""}${
          shouldAddHashtag || shouldRemoveTrailingHashtag ? "#\n" : ""}`);
  
  await view.forceSave(true);
  let watchdog = 0;
  await sleep(200);
  let found:string;
  while (watchdog++ < 10 && !(found=(await view.app.metadataCache.blockCache
    .getForFile({ isCancelled: () => false },view.file))
    .blocks.filter((b: any) => b.display && b.node?.type === "heading")
    .filter((b: any) => !MD_EX_SECTIONS.includes(b.display))
    .map((b: any) => cleanSectionHeading(b.display))
    .find((b: any) => b === title))) {
      await sleep(200);
  }

  const ea = getEA(view) as ExcalidrawAutomate;
  const id = ea.addEmbeddable(
    0,0,400,500,
    `[[${view.file.path}#${title}]]`,
    undefined,
    embeddableCustomData
  );
  await ea.addElementsToView(true, false, true);

  const api = view.excalidrawAPI as ExcalidrawImperativeAPI;
  const el = ea.getViewElements().find(el=>el.id === id);
  api.selectElements([el]);
  if(activate) {
    window.setTimeout(()=>{
      api.updateScene({appState: {activeEmbeddable: {element: el, state: "active"}}, storeAction: "update"});
      if(found) view.getEmbeddableLeafElementById(el.id)?.editNode?.();
    });
  }
  ea.destroy();
  return el.id;
}

export function renderContextMenuAction(
  React: any,
  label: string,
  action: Function,
  onClose: (callback?: () => void) => void,
) {
  return React.createElement (
    "li",          
    {
      key: nanoid(),
      onClick: () => {
        onClose(()=>action())
      },
    },
    React.createElement(
      "button",
      {              
        className: "context-menu-item",
      },
      React.createElement(
        "div",
        {
          className: "context-menu-item__label",
        },
        label,
      ),
      React.createElement(
        "kbd",
        {
          className: "context-menu-item__shortcut",
        },
        "", //this is where the shortcut may go in the future
      ),
    )
  );
}

export function tmpBruteForceCleanup (view: ExcalidrawView) {
  window.setTimeout(()=>{
    if(!view) return;
    // const cleanupHTMLElement = (el: Element) => {
    //   //console.log(el);
    //   while(el.firstElementChild) {
    //     cleanupHTMLElement(el.firstElementChild);
    //     el.removeChild(el.firstElementChild);
    //   }
    //   Object.keys(el).forEach((key) => {
    //     //@ts-ignore
    //     delete el[key];
    //   });
    //   el.empty();
    // }

    // const cleanupLeaf = (l:any) => {
    //   l.detach?.();
    //   l.resizeObserver?.disconnect?.();
    //   l.view?.unload?.();
    //   l.component?.unload?.();      
    //   Object.keys(l).forEach((key) => {
    //     const obj = l[key];
    //     if (obj instanceof Element) {
    //       // Recursively empty the DOM element's children
    //       while (obj.firstChild) {
    //         cleanupHTMLElement(obj.firstElementChild);
    //         obj.removeChild(obj.firstElementChild);
    //       }
    //       obj.empty();
    //       delete l[key];
    //       return;
    //     }
    //     //@ts-ignore
    //     delete l[key];
    //   });
    // }

    // //@ts-ignore
    // if(view.leaf && !view.leaf.parent) {
    //   if(view.containerEl) {
    //     cleanupHTMLElement(view.containerEl);
    //   }
    //   const leaves = new Set();
    //   leaves.add(view.leaf);
    //   while(leaves.has(view.leaf.getContainer())) { 
    //     leaves.add(view.leaf.getContainer());
    //   }
    //   const roots = new Set();
    //   roots.add(view.leaf.getRoot());
    //   leaves.forEach((leaf:WorkspaceLeaf) => {
    //     roots.add(leaf.getRoot());
    //   });
    //   leaves.forEach((l:any) => cleanupLeaf(l));
    //   leaves.clear();
    //   roots.forEach((root:any) => cleanupLeaf(root));
    //   roots.clear();
    // }

    Object.keys(view).forEach((key) => {
      //@ts-ignore    
      delete view[key];
    });
  }, 500);
}

/**
* Check if the text matches the transclusion pattern and if so,
 * check if the link in the transclusion can be resolved to a file in the vault.
 * if yes, call the callback function with the link and the file.
 * @param text 
 * @param callback 
 * @returns true if text is a transclusion and the link can be resolved to a file in the vault, false otherwise.
 */
export function isTextImageTransclusion (
  text: string,
  view: ExcalidrawView,
  callback: (link: string, file: TFile)=>void
): boolean {
  const REG_TRANSCLUSION = /^!\[\[([^|\]]*)?.*?]]$|^!\[[^\]]*?]\((.*?)\)$/g;
  const match = text.trim().matchAll(REG_TRANSCLUSION).next(); //reset the iterator
  if(match?.value?.[0]) {                
    const link = match.value[1] ?? match.value[2];
    const file = view.app.metadataCache.getFirstLinkpathDest(link?.split("#")[0], view.file.path);
    if(view.file === file) {
      if(link?.split("#")[1] && !isImagePartRef(getEmbeddedFilenameParts(link))) {
        return false;
      }
      new Notice(t("RECURSIVE_INSERT_ERROR"));
      return false;
    }
    if(file && file instanceof TFile) {
      if(
        view.plugin.isExcalidrawFile(file) &&
        link?.split("#")[1] &&
        !isImagePartRef(getEmbeddedFilenameParts(link)))
      {
        return false;
      }
      if (file.extension !== "md" || view.plugin.isExcalidrawFile(file)) {
        callback(link, file);
        return true;
      } else {
        new Notice(t("USE_INSERT_FILE_MODAL"),5000);
      }
    }
  }
  return false;
}

export function displayFontMessage(app: App) {
  const modal = new Modal(app);

  modal.onOpen = () => {
    const contentEl = modal.contentEl;
    contentEl.createEl("h2", { text: t("FONT_INFO_TITLE") });

    const releaseNotesHTML = t("FONT_INFO_DETAILED");

    const div = contentEl.createDiv({ cls: "release-notes" });
    div.innerHTML = releaseNotesHTML;
  }

  modal.open();
}

export async function toggleImageAnchoring(
  el: ExcalidrawImageElement,
  view: ExcalidrawView,
  shouldAnchor: boolean,
  ef: EmbeddedFile,
) {
  const ea = getEA(view) as ExcalidrawAutomate;
  let imgEl = view.getViewElements().find((x:ExcalidrawElement)=>x.id === el.id) as Mutable<ExcalidrawImageElement>;
  if(!imgEl) {
    ea.destroy();
    return;
  }
  ea.copyViewElementsToEAforEditing([imgEl]);
  imgEl = ea.getElements()[0] as Mutable<ExcalidrawImageElement>;
  if(!imgEl.customData) {
    imgEl.customData = {};
  }
  imgEl.customData.isAnchored = shouldAnchor;
  if(shouldAnchor) {
    const {height, width} = ef.size;
    const dX = width - imgEl.width;
    const dY = height - imgEl.height;
    imgEl.height = height;
    imgEl.width = width;
    imgEl.x -= dX/2;
    imgEl.y -= dY/2;
  }
  await ea.addElementsToView(false, false);
  ea.destroy();
}