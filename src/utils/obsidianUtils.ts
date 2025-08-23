import {
  App,
  Editor,
  FrontMatterCache,
  MarkdownView,
  OpenViewState, parseFrontMatterEntry, TFile, View, ViewState, Workspace, WorkspaceLeaf, WorkspaceSplit
} from "obsidian";
import ExcalidrawPlugin from "../core/main";
import { splitFolderAndFilename } from "./fileUtils";
import { linkClickModifierType, ModifierKeys } from "./modifierkeyHelper";
import { DEVICE, EXCALIDRAW_PLUGIN, REG_BLOCK_REF_CLEAN, REG_SECTION_REF_CLEAN, VIEW_TYPE_EXCALIDRAW } from "src/constants/constants";
import yaml from "js-yaml";
import { debug, DEBUGGING } from "./debugHelper";
import ExcalidrawView from "src/view/ExcalidrawView";

export const getParentOfClass = (element: Element, cssClass: string):HTMLElement | null => {
  let parent = element.parentElement;
  while (
    parent &&
    !parent.classList.contains(cssClass) &&
    !(parent instanceof window.HTMLBodyElement)
  ) {
    parent = parent.parentElement;
  }
  return parent?.classList?.contains(cssClass) ? parent : null;
};

export function getExcalidrawViews(app: App): ExcalidrawView[] {
  const leaves = app.workspace.getLeavesOfType(VIEW_TYPE_EXCALIDRAW).filter(l=>l.view instanceof ExcalidrawView);
  return leaves.map(l=>l.view as ExcalidrawView);
}

export const getLeaf = (
  plugin: ExcalidrawPlugin,
  origo: WorkspaceLeaf,
  ev: ModifierKeys
) => {
  const newTab = ():WorkspaceLeaf => {
    if(!plugin.settings.openInMainWorkspace) return plugin.app.workspace.getLeaf('tab');
    const [leafLoc, mainLeavesIds] = getLeafLoc(origo);
    if(leafLoc === 'main') return plugin.app.workspace.getLeaf('tab');
    return getNewOrAdjacentLeaf(plugin,origo);
  }
  const newTabGroup = ():WorkspaceLeaf => getNewOrAdjacentLeaf(plugin,origo);
  const newWindow = ():WorkspaceLeaf => plugin.app.workspace.openPopoutLeaf();

  switch(linkClickModifierType(ev)) {
    case "active-pane": return origo;
    case "new-tab": return newTab();
    case "new-pane": return newTabGroup();
    case "popout-window": return newWindow();
    default: return newTab();
  }
}

const getLeafLoc = (leaf: WorkspaceLeaf): ["main" | "popout" | "left" | "right" | "hover",any] => {
  //@ts-ignore
  const leafId = leaf.id;
  const layout = EXCALIDRAW_PLUGIN.app.workspace.getLayout();
  const getLeaves = (l:any)=> l.children
    .filter((c:any)=>c.type!=="leaf")
    .map((c:any)=>getLeaves(c))
    .flat()
    .concat(l.children.filter((c:any)=>c.type==="leaf").map((c:any)=>c.id))
  
  const mainLeavesIds = getLeaves(layout.main);

  return [
    layout.main && mainLeavesIds.contains(leafId)
    ? "main"
    : layout.floating && getLeaves(layout.floating).contains(leafId)
      ? "popout"
      : layout.left && getLeaves(layout.left).contains(leafId)
        ? "left"
        : layout.right && getLeaves(layout.right).contains(leafId)
          ? "right"
          : "hover",
     mainLeavesIds
  ];
}

/*
| Setting                 |                                       Originating Leaf                                                       |
|                         | Main Workspace                   | Hover Editor                           | Popout Window                    |
| ----------------------- | -------------------------------- | -------------------------------------- | -------------------------------- |
| InMain  && InAdjacent   | 1.1 Reuse Leaf in Main Workspace | 1.1 Reuse Leaf in Main Workspace       | 1.1 Reuse Leaf in Main Workspace |
| InMain  && !InAdjacent  | 1.2 New Leaf in Main Workspace   | 1.2 New Leaf in Main Workspace         | 1.2 New Leaf in Main Workspace   |
| !InMain && InAdjacent   | 1.1 Reuse Leaf in Main Workspace | 3   Reuse Leaf in Current Hover Editor | 4   Reuse Leaf in Current Popout |
| !InMain && !InAdjacent  | 1.2 New Leaf in Main Workspace   | 2   New Leaf in Current Hover Editor   | 2   New Leaf in Current Popout   |
*/
export const getNewOrAdjacentLeaf = (
  plugin: ExcalidrawPlugin,
  leaf: WorkspaceLeaf
): WorkspaceLeaf | null => {
  const [leafLoc, mainLeavesIds] = getLeafLoc(leaf);

  const getMostRecentOrAvailableLeafInMainWorkspace = (inDifferentTabGroup?: boolean):WorkspaceLeaf => {
    let mainLeaf = plugin.app.workspace.getMostRecentLeaf();
    if(mainLeaf && mainLeaf !== leaf && mainLeaf.view?.containerEl.ownerDocument === document) {
      //Found a leaf in the main workspace that is not the originating leaf
      return mainLeaf;
    }
    //Iterate all leaves in the main workspace and find the first one that is not the originating leaf
    mainLeaf = null;
    mainLeavesIds
      .forEach((id:any)=> {
        const l = plugin.app.workspace.getLeafById(id);
        if(mainLeaf ||
          !l.view?.navigation || 
          leaf === l ||
          //@ts-ignore
          (inDifferentTabGroup && (l?.parent === leaf?.parent))
        ) return;
        mainLeaf = l;
    })
    return mainLeaf;
  }

  //1 - In Main Workspace
  if(plugin.settings.openInMainWorkspace || ["main","left","right"].contains(leafLoc)) {
    //1.1 - Create new leaf in main workspace
    if(!plugin.settings.openInAdjacentPane) {
      if(leafLoc === "main") {
        return plugin.app.workspace.createLeafBySplit(leaf);
      }
      const ml = getMostRecentOrAvailableLeafInMainWorkspace();
      return ml
        ? (ml.view.getViewType() === "empty" ? ml : plugin.app.workspace.createLeafBySplit(ml))
        : plugin.app.workspace.getLeaf(true);
    }

    //1.2 - Reuse leaf if it is adjacent
    const ml = getMostRecentOrAvailableLeafInMainWorkspace(true);
    return ml ?? plugin.app.workspace.createLeafBySplit(leaf); //app.workspace.getLeaf(true);
  }

  //2
  if(!plugin.settings.openInAdjacentPane) {
    return plugin.app.workspace.createLeafBySplit(leaf);
  }

  //3
  if(leafLoc === "hover") {
    const leaves = new Set<WorkspaceLeaf>();
    plugin.app.workspace.iterateAllLeaves(l=>{
      //@ts-ignore
      if(l!==leaf && leaf.containerEl.parentElement === l.containerEl.parentElement) leaves.add(l);
    })
    if(leaves.size === 0) {
      return plugin.app.workspace.createLeafBySplit(leaf);      
    }
    return Array.from(leaves)[0];  
  }

  //4
  if(leafLoc === "popout") {
    const popoutLeaves = new Set<WorkspaceLeaf>();  
    plugin.app.workspace.iterateAllLeaves(l=>{
      if(l !== leaf && l.view.navigation && l.view.containerEl.ownerDocument === leaf.view.containerEl.ownerDocument) {
        popoutLeaves.add(l);
      }
    });
    if(popoutLeaves.size === 0) {
      return plugin.app.workspace.createLeafBySplit(leaf);
    }
    return Array.from(popoutLeaves)[0];
  }

  return plugin.app.workspace.createLeafBySplit(leaf);
};

export const getAttachmentsFolderAndFilePath = async (
  app: App,
  activeViewFilePath: string,
  newFileName: string
): Promise<{ folder: string; filepath: string; }> => {
  const { basename, extension } = splitFolderAndFilename(newFileName);
  const activeViewFile = app.vault.getFileByPath(activeViewFilePath);
  const attachmentFilePath = await app.vault.getAvailablePathForAttachments(basename, extension, activeViewFile);
  const { folderpath } = splitFolderAndFilename(attachmentFilePath);
  return {
    folder: folderpath,
    filepath: attachmentFilePath
  };
};

export const isObsidianThemeDark = () => document.body.classList.contains("theme-dark");

export type ConstructableWorkspaceSplit = new (ws: Workspace, dir: "horizontal"|"vertical") => WorkspaceSplit;

export const getContainerForDocument = (doc:Document) => {
  if (doc !== document && EXCALIDRAW_PLUGIN.app.workspace.floatingSplit) {
    for (const container of EXCALIDRAW_PLUGIN.app.workspace.floatingSplit.children) {
      if (container.doc === doc) return container;
    }
  }
  return EXCALIDRAW_PLUGIN.app.workspace.rootSplit;
};

export const cleanSectionHeading = (heading:string) => {
  if(!heading) return heading;
  return heading.replace(REG_SECTION_REF_CLEAN, "").replace(/\s+/g, " ").trim();
}

export const cleanBlockRef = (blockRef:string) => {
  if(!blockRef) return blockRef;
  return blockRef.replace(REG_BLOCK_REF_CLEAN, "").replace(/\s+/g, " ").trim();
}

//needed for backward compatibility
export const legacyCleanBlockRef = (blockRef:string) => {
  if(!blockRef) return blockRef;
  return blockRef.replace(/[!"#$%&()*+,.:;<=>?@^`{|}~\/\[\]\\]/g, "").replace(/\s+/g, " ").trim();
}

export const getAllWindowDocuments = (app:App):Document[] => {
  const documents = new Set<Document>();
  documents.add(document);
  app.workspace.iterateAllLeaves(l=>{
    if(l.view.containerEl.ownerDocument !== document) {
      documents.add(l.view.containerEl.ownerDocument);
    }
  });
  return Array.from(documents);
}

export const obsidianPDFQuoteWithRef = (text:string):{quote: string, link: string} => {
  const reg = /^> (.*)\n\n\[\[([^|\]]*)\|[^\]]*]]$/gm;
  const match = reg.exec(text);
  if(match) {
    return {quote: match[1], link: match[2]};
  }
  return null;
}

export const extractSVGPNGFileName = (text:string) => {
  const regex = /\[\[([^\]|#^]+\.(?:svg|png))(?:[^\]]+)?\]\]|\[[^\]]+\]\(([^\)]+\.(?:svg|png))\)/;
  const match = text.match(regex);
  return match ? (match[1] || match[2]) : null;
}

export const getFileCSSClasses = (
  file: TFile,
): string[] => {
  if (file) {
    const plugin = window?.ExcalidrawAutomate?.plugin;
    if(!plugin) return [];
    const fileCache = plugin.app.metadataCache.getFileCache(file);
    if(!fileCache?.frontmatter) return [];
    const x = parseFrontMatterEntry(fileCache.frontmatter, "cssclasses");
    if (Array.isArray(x)) return x
    if (typeof x === "string") return Array.from(new Set(x.split(/[, ]+/).filter(Boolean)));
    return [];
  }
  return [];
}

//@ts-ignore
export const getActivePDFPageNumberFromPDFView = (view: View): number => view?.viewer?.child?.pdfViewer?.page;

export const openLeaf = ({
  plugin,
  fnGetLeaf,
  file,
  openState
}:{
  plugin: ExcalidrawPlugin,
  fnGetLeaf: ()=>WorkspaceLeaf,
  file: TFile,
  openState?: OpenViewState
}) : {
  leaf: WorkspaceLeaf
  promise: Promise<void>
 } => {
  let leaf:WorkspaceLeaf = null;
  if (plugin.settings.focusOnFileTab) {
    plugin.app.workspace.iterateAllLeaves((l) => {
      if(leaf) return;
      //@ts-ignore
      if (l?.view?.file === file) {
        plugin.app.workspace.setActiveLeaf(l,{focus: true});
        leaf = l;
      }
    });
    if(leaf) {
      if(openState) {
        const promise = leaf.openFile(file, openState);
        return {leaf, promise};
      }
      return {leaf, promise: Promise.resolve()};
    }
  }
  leaf = fnGetLeaf();
  const promise = leaf.openFile(file, openState);
  return {leaf, promise};
}

export function mergeMarkdownFiles (template: string, target: string): string {
  // Template frontmatter
  const templateFrontmatterEnd = template.indexOf('---', 4);
  const templateFrontmatterRaw = template.substring(4, templateFrontmatterEnd).trim();
  const templateContent = template.substring(templateFrontmatterEnd + 3);
  const templateFrontmatterObj: FrontMatterCache = yaml.load(templateFrontmatterRaw) || {};

  const hasTargetFM = target.startsWith('---\n') && target.indexOf('---\n', 4) > 0;
  if (hasTargetFM) {
    const targetFrontmatterEnd = target.indexOf('---\n', 4);
    let targetFrontmatterRaw = target.substring(4, targetFrontmatterEnd).replace(/\s+$/,''); // keep as-is
    const targetContent = target.substring(targetFrontmatterEnd + 3);

    const targetFrontmatterObj: FrontMatterCache = yaml.load(targetFrontmatterRaw) || {};

    // 1. Merge array keys present in both (target has precedence for ordering)
    const mergeArrayKeys = Object.keys(templateFrontmatterObj)
      .filter(k => Array.isArray(templateFrontmatterObj[k]) && Array.isArray(targetFrontmatterObj[k]));

    if (mergeArrayKeys.length) {
      for (const k of mergeArrayKeys) {
        const tArr = targetFrontmatterObj[k] as any[];
        const tplArr = templateFrontmatterObj[k] as any[];
        const merged = [...tArr, ...tplArr.filter(v => !tArr.includes(v))];
        // Produce YAML for just this key
        const mergedYaml = yaml.dump({ [k]: merged }).trimEnd();
        targetFrontmatterRaw = replaceYamlKeyBlock(targetFrontmatterRaw, k, mergedYaml) ?? targetFrontmatterRaw;
      }
    }

    // 2. Append only missing keys (not present in target)
    const newKeys: Record<string, any> = {};
    for (const k of Object.keys(templateFrontmatterObj)) {
      if (!(k in targetFrontmatterObj)) {
        newKeys[k] = templateFrontmatterObj[k];
      }
    }

    const appended = Object.keys(newKeys).length
      ? targetFrontmatterRaw + '\n' + yaml.dump(newKeys).trimEnd()
      : targetFrontmatterRaw;

    return `---\n${appended}\n---\n${targetContent}\n\n${templateContent.trim()}\n`;
  } else {
    // No frontmatter in target: use template FM + target content + template content
    const targetContent = target.trim();
    const templateFMYaml = yaml.dump(templateFrontmatterObj).trimEnd();
    return `---\n${templateFMYaml}\n---\n${targetContent}\n\n${templateContent.trim()}\n`;
  }
};

// Helper: replace a top-level YAML key block (line-based, avoids partial matches causing duplicates)
function replaceYamlKeyBlock(src: string, key: string, newBlock: string): string | null {
  const lines = src.split(/\r?\n/);
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (new RegExp(`^${escapeRegex(key)}\\s*:`).test(lines[i])) {
      start = i;
      break;
    }
  }
  if (start === -1) return null;

  let end = start + 1;
  while (end < lines.length) {
    const line = lines[end];
    if (line.trim() === "") { // blank line ends block (retain blank after replacement)
      break;
    }
    if (/^[^\s].*?:/.test(line)) { // next top-level key
      break;
    }
    if (!/^\s/.test(line)) { // safety: non-indented (shouldn't happen)
      break;
    }
    end++;
  }

  const before = lines.slice(0, start);
  const after = lines.slice(end);
  const replaced = [...before, newBlock, ...after].join('\n');

  return replaced;
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const editorInsertText = (editor: Editor, text: string)=> {
  const cursor = editor.getCursor();
  const line = editor.getLine(cursor.line);
  const updatedLine = line.slice(0, cursor.ch) + text + line.slice(cursor.ch);
  editor.setLine(cursor.line, updatedLine);
}

export const foldExcalidrawSection = (view: MarkdownView) => {
  if (!view || !(view instanceof MarkdownView)) return;

  const foldStart = {
    ed: -1, // # Excalidraw Data
    te: -1, // ## Text Elements
    el: -1, // ## Element Links
    ef: -1, // ## Embedded Files
    d: -1,  // ## Drawing
  };

  const existingFolds = view.currentMode.getFoldInfo()?.folds ?? [];
  const lineCount = view.editor.lineCount();
  
  for (let i = 0; i < lineCount; i++) {
    const line = view.editor.getLine(i);
    switch (line) {
      case "# Excalidraw Data": foldStart.ed = i; break;
      case "## Text Elements": foldStart.te = i; break;
      case "## Element Links": foldStart.el = i; break;
      case "## Embedded Files": foldStart.ef = i; break;
      case "## Drawing": foldStart.d = i; break;
    }
    if (line === "## Drawing") break;
  }

  if (foldStart.ed > -1 && foldStart.d > -1) {
    const foldPositions = [
      ...existingFolds,
      ...(foldStart.te > -1 ? [{ from: foldStart.te, to: (foldStart.el > -1 ? foldStart.el : (foldStart.ef > -1 ? foldStart.ef : foldStart.d)) - 1 }] : []),
      ...(foldStart.el > -1 ? [{ from: foldStart.el, to: (foldStart.ef > -1 ? foldStart.ef : foldStart.d) - 1 }] : []),
      ...(foldStart.ef > -1 ? [{ from: foldStart.ef, to: foldStart.d - 1 }] : []),
      { from: foldStart.d, to: lineCount - 1 },
      { from: foldStart.ed, to: lineCount - 1 },
    ];

    view.currentMode.applyFoldInfo({ folds: foldPositions, lines: lineCount });
  }
};

export async function setExcalidrawView(leaf: WorkspaceLeaf) {
  (process.env.NODE_ENV === 'development') && DEBUGGING && debug(setExcalidrawView,`setExcalidrawView`, leaf);
  await leaf.setViewState({
    type: VIEW_TYPE_EXCALIDRAW,
    state: leaf.view.getState(),
    popstate: true,
  } as ViewState);
}

export async function closeLeafView(leaf: WorkspaceLeaf) {
  (process.env.NODE_ENV === 'development') && DEBUGGING && debug(setExcalidrawView,`setExcalidrawView`, leaf);
  await leaf.setViewState({
    type: "empty",
    state: {},
  });
}

//In Obsidian 1.8.x the active excalidraw leaf is obscured by an empty leaf without a parent
//In some ways similar to patchMobileView() - though does something completely different, but both mobile leaf related
export function isUnwantedLeaf(leaf:WorkspaceLeaf):boolean {
  return !DEVICE.isDesktop && 
    leaf.view?.getViewType() === "empty" && leaf.parent && !leaf.parent.parent &&
    //@ts-ignore
    leaf.parent.type === "split" && leaf.parent.children.length === 1
}

/**
 * Gets the height of an audio element in Obsidian's CSS environment
 * @returns The height of the audio element in pixels
 */
export function getAudioElementHeight(): number {
  // Create a temporary audio element with controls
  const audioElement = document.createElement("audio");
  audioElement.controls = true;
  audioElement.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA"; // Minimal valid audio
  
  // Create a wrapper to avoid affecting page layout
  const wrapper = document.createElement("div");
  wrapper.style.position = "absolute";
  wrapper.style.left = "-9999px";
  wrapper.style.visibility = "hidden";
  wrapper.style.pointerEvents = "none";
  wrapper.appendChild(audioElement);
  
  // Add to document to allow CSS to be applied
  document.body.appendChild(wrapper);
  
  // Get height
  let height = 0;
  try {
    // Force layout calculation
    document.body.offsetHeight;
    
    // Get height from bounding rect
    const rect = audioElement.getBoundingClientRect();
    height = rect.height;
    
    // Fallback to computed style if bounding rect returns 0
    if (height === 0) {
      const computedStyle = window.getComputedStyle(audioElement);
      height = parseFloat(computedStyle.height) || 0;
      
      // If still 0, try measuring the wrapper
      if (height === 0) {
        height = wrapper.getBoundingClientRect().height;
      }
    }
  } finally {
    // Clean up
    document.body.removeChild(wrapper);
  }
  
  return Math.round(height);
}