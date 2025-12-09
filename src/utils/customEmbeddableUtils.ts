import { NonDeletedExcalidrawElement } from "@zsviczian/excalidraw/types/element/src/types";
import { AUDIO_TYPES, DEVICE, REG_LINKINDEX_INVALIDCHARS, VIDEO_TYPES } from "src/constants/constants";
import { ConstructableWorkspaceSplit, getContainerForDocument, getParentOfClass } from "./obsidianUtils";
import { App, TFile, WorkspaceLeaf, WorkspaceSplit } from "obsidian";
import { getLinkParts } from "./utils";
import ExcalidrawView from "src/view/ExcalidrawView";
import { ObsidianCanvasNode } from "src/view/managers/CanvasNodeFactory";

export const createLeaf = (view: ExcalidrawView): {leaf: WorkspaceLeaf, rootSplit: WorkspaceSplit} => {
  const doc = view.ownerDocument;
  const rootSplit:WorkspaceSplit = new (WorkspaceSplit as ConstructableWorkspaceSplit)(view.app.workspace, "vertical");
  rootSplit.getRoot = () => view.app.workspace[doc === document ? 'rootSplit' : 'floatingSplit'];
  rootSplit.getContainer = () => getContainerForDocument(doc);
  rootSplit.containerEl.style.width = '100%';
  rootSplit.containerEl.style.height = '100%';
  rootSplit.containerEl.style.borderRadius = "var(--embeddable-radius)";
  view.plugin.setDebounceActiveLeafChangeHandler();
  return {
    leaf: view.app.workspace.createLeafInParent(rootSplit, 0),
    rootSplit,
  };
}

export const useDefaultExcalidrawFrame = (element: NonDeletedExcalidrawElement) => {
  return !(element.link.startsWith("[") || element.link.startsWith("file:") || element.link.startsWith("data:")); // && !element.link.match(TWITTER_REG);
}

export const leafMap = new Map<string, WorkspaceLeaf>();

//This is definitely not the right solution, feels like sticking plaster
//patch disappearing content on mobile
//based on obsidian app.js, obsidian is looking for activeEditor, but active editor is in a leaf that is disconnected from root
export const patchMobileView = (
  view: ExcalidrawView,
  opts?: { keepAlive?: boolean; isActive?: () => boolean }
): (() => void) | void => {
  if (!DEVICE.isPhone) return;
  console.log("patching mobile view");
  const parent = getParentOfClass(view.containerEl, "mod-top");
  if (parent) {
    if (!parent.hasClass("mod-visible")) {
      parent.addClass("mod-visible");
    }
    // create observer here
    const observer = new MutationObserver(() => {
      if (opts?.keepAlive && opts?.isActive && !opts.isActive()) {
        observer.disconnect();
        return;
      }
      if (!parent.hasClass("mod-visible")) {
        parent.addClass("mod-visible");
      }
    });
    observer.observe(parent, { attributes: true, attributeFilter: ["class"] });

    const cleanup = () => observer.disconnect();

    if (opts?.keepAlive) {
      // Keep the observer alive until caller cleans up (or callback signals inactive)
      return cleanup;
    }
    // default behavior: disconnect after 500ms
    window.setTimeout(cleanup, 500);
    return cleanup;
  }
}

export const processLinkText = (linkText: string, view:ExcalidrawView): { subpath:string, file:TFile } => {
  let subpath:string = null;

  if (linkText.search("#") > -1) {
    const linkParts = getLinkParts(linkText, view.file);
    subpath = `#${linkParts.isBlockRef ? "^" : ""}${linkParts.ref}`;
    linkText = linkParts.path;
  }

  if (linkText.match(REG_LINKINDEX_INVALIDCHARS)) {
    return {subpath, file: null};
  }

  const file = view.app.metadataCache.getFirstLinkpathDest(
    linkText,
    view.file.path,
  );

  return { subpath, file };
}

export const generateEmbeddableLink = (src: string, theme: "light" | "dark"):string => {
/*  const twitterLink = src.match(TWITTER_REG);
  if (twitterLink) {
    const tweetID = src.match(/.*\/(\d*)\?/)[1];
    if (tweetID) {
      return `https://platform.twitter.com/embed/Tweet.html?frame=false&hideCard=false&hideThread=false&id=${tweetID}&lang=en&theme=${theme}&width=550px`;
      //src = `https://twitframe.com/show?url=${encodeURIComponent(src)}`;
    }
  }*/
  return src;
}

export function setFileToLocalGraph(app: App, file: TFile) {
  let lgv: any;
  app.workspace.iterateAllLeaves((l) => {
    if (l.view?.getViewType() === "localgraph") lgv = l.view;
  });
  if(!lgv) return;
  try {
    if (lgv.loadFile && lgv.file !== file) {
      lgv.loadFile(file);
    }
  } catch (e) {
    console.error(e);
  }
}

export function predictViewType(app: App, file: TFile): string {
  const ext = file.extension?.toLowerCase?.() ?? "";

  // 1) Try private registry APIs when available (covers .md files with custom views like Kanban)
  const vr = (app as any)?.viewRegistry;
  const registryFileMethods = [
    "getViewTypeForFile",
    "getViewTypeByFile",
    "getTypeByFile",
  ];
  for (const m of registryFileMethods) {
    if (vr?.[m]) {
      try {
        const vt = vr[m](file);
        if (typeof vt === "string" && vt) return vt;
      } catch {}
    }
  }
  // 2) Try extension mapping from registry
  const registryExtMethods = [
    "getViewTypeByExtension",
    "getTypeByExtension",
  ];
  for (const m of registryExtMethods) {
    if (vr?.[m]) {
      try {
        const vt = vr[m](ext);
        if (typeof vt === "string" && vt) return vt;
      } catch {}
    }
  }

  // 3) Fallbacks by extension
  if (ext === "md") return "markdown";
  if (ext === "pdf") return "pdf";
  if (ext === "canvas") return "canvas";
  if (AUDIO_TYPES.contains(ext)) return "audio";
  if (VIDEO_TYPES.contains(ext)) return "video";

  return "empty";
}