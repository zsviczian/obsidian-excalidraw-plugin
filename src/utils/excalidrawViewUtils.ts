import {
  MAX_IMAGE_SIZE,
  IMAGE_TYPES,
  ANIMATED_IMAGE_TYPES,
  MD_EX_SECTIONS,
  AUDIO_TYPES,
  CARD_WIDTH,
  CARD_HEIGHT,
  getDefaultColorPalette,
  DEVICE,
  mainDocument,
  EXCALIDRAW_PLUGIN,
  PLUGIN_ID,
} from "src/constants/constants";
import { App, Modal, Notice, TFile, request, requestUrl } from "obsidian";
import { ExcalidrawAutomate } from "src/shared/ExcalidrawAutomate";
import {
  REGEX_LINK,
  REG_LINKINDEX_HYPERLINK,
  getExcalidrawMarkdownHeaderSection,
  REGEX_TAGS,
} from "../shared/ExcalidrawData";
import ExcalidrawView from "src/view/ExcalidrawView";
import {
  ExcalidrawElement,
  ExcalidrawFrameElement,
  ExcalidrawImageElement,
  ExcalidrawTextElement,
  FileId,
  NonDeletedExcalidrawElement,
} from "@zsviczian/excalidraw/types/element/src/types";
import { getAllNestedExcalidrawFiles } from "./fileUtils";
import {
  getEmbeddedFilenameParts,
  getLinkParts,
  isImagePartRef,
} from "./utils";
import { getAudioElementHeight } from "./obsidianUtils";
import { cleanSectionHeading } from "./pathUtils";
import { getEA } from "src/core";
import { AppState } from "@zsviczian/excalidraw/types/excalidraw/types";
import { EmbeddableMDCustomProps } from "src/shared/Dialogs/EmbeddableSettings";
import { nanoid } from "nanoid";
import { t } from "src/lang/helpers";
import { Mutable } from "@zsviczian/excalidraw/types/common/src/utility-types";
import { EmbeddedFile } from "src/shared/EmbeddedFileLoader";
import { CaptureUpdateAction } from "src/constants/constants";
import { setSanitizedHtml } from "./htmlUtils";
import { URLs } from "src/constants/safeUrls";

type CommandLinkOptInPlugin = {
  settings: {
    enableCommandLinks?: boolean;
  };
  saveSettings: () => Promise<void>;
};

class CommandLinkOptInPrompt extends Modal {
  public waitForClose: Promise<boolean | null>;
  private resolvePromise: (value: boolean | null) => void;
  private selectedValue: boolean | null = null;
  private readonly message: string;

  constructor(app: App, message: string) {
    super(app);
    this.message = message;
    this.waitForClose = new Promise<boolean | null>((resolve) => {
      this.resolvePromise = resolve;
    });
    this.open();
  }

  onOpen() {
    this.titleEl.setText(t("PROMPT_TITLE_CONFIRMATION"));
    const messageEl = this.contentEl.createDiv();
    setSanitizedHtml(messageEl, this.message);

    const buttonContainer = this.contentEl.createDiv();
    buttonContainer.style.display = "flex";
    buttonContainer.style.justifyContent = "flex-end";
    buttonContainer.style.marginTop = "1rem";

    const denyButton = buttonContainer.createEl("button", {
      text: t("ENABLE_COMMAND_LINKS_CONFIRM_DENY"),
    });
    denyButton.style.marginRight = "0.5rem";
    denyButton.onclick = () => {
      this.selectedValue = null;
      this.close();
    };

    const enableButton = buttonContainer.createEl("button", {
      text: t("ENABLE_COMMAND_LINKS_CONFIRM_ENABLE"),
      cls: "mod-cta",
    });
    enableButton.onclick = () => {
      this.selectedValue = true;
      this.close();
    };

    window.setTimeout(() => denyButton.focus(), 0);
  }

  onClose() {
    super.onClose();
    this.resolvePromise(this.selectedValue);
  }
}

const getCommandLinkOptInPlugin = (app: App): CommandLinkOptInPlugin | null => {
  const candidate = app.plugins?.plugins?.[PLUGIN_ID];
  if (
    candidate &&
    typeof (candidate as { saveSettings?: unknown }).saveSettings ===
      "function" &&
    typeof (candidate as { settings?: unknown }).settings === "object"
  ) {
    return candidate as unknown as CommandLinkOptInPlugin;
  }
  if (EXCALIDRAW_PLUGIN && EXCALIDRAW_PLUGIN.app === app) {
    return EXCALIDRAW_PLUGIN;
  }
  return null;
};

const executeCommandLinkWithConfirmation = async (cmd: string, app: App) => {
  const plugin = getCommandLinkOptInPlugin(app);
  if (!plugin) {
    return;
  }

  let allowCommandLinks: boolean | null =
    plugin.settings.enableCommandLinks ?? false;

  if (!allowCommandLinks) {
    const confirmationPrompt = new CommandLinkOptInPrompt(
      app,
      `<strong>${t("ENABLE_COMMAND_LINKS_NAME")}</strong><br>${t("ENABLE_COMMAND_LINKS_CONFIRMATION")}` +
        `<br><br>${t("ENABLE_COMMAND_LINKS_DESC")}`,
    );
    allowCommandLinks = await confirmationPrompt.waitForClose;
    if (allowCommandLinks) {
      plugin.settings.enableCommandLinks = true;
      await plugin.saveSettings();
    }
  }

  if (allowCommandLinks) {
    app.commands.executeCommandById(cmd);
  }
};

/**
 * Returns the set of top-level embedded-file IDs that need to be rebuilt on
 * leaf switch because either the file itself or any nested Excalidraw dependency
 * was modified since the view last completed a scene load.
 */
export function getChangedTopLevelDependencyFileIDs(
  view: ExcalidrawView,
): Set<FileId> {
  const changedFileIDs = new Set<FileId>();
  if (!view.file || !view.excalidrawData || view.lastSceneLoadTime === 0) {
    return changedFileIDs;
  }

  const plugin = view.plugin;
  const lastLoadTime = view.lastSceneLoadTime;

  // Map from embedded Excalidraw file path → fileIds that reference it,
  // used to propagate nested-dependency changes to top-level entries.
  const excalidrawFileIdsByPath = new Map<string, Set<FileId>>();

  for (const [fileId, embeddedFile] of view.excalidrawData.getFileEntries()) {
    const embeddedTarget = embeddedFile?.file;
    if (!embeddedTarget || embeddedFile.mtime === 0) {
      continue;
    }

    // Direct change: the embedded target itself was modified after the last load.
    if (embeddedTarget.stat.mtime > lastLoadTime) {
      changedFileIDs.add(fileId);
    }

    // Track Excalidraw embeds so we can walk their nested deps below.
    if (plugin.isExcalidrawFile(embeddedTarget)) {
      const set =
        excalidrawFileIdsByPath.get(embeddedTarget.path) ?? new Set<FileId>();
      set.add(fileId);
      excalidrawFileIdsByPath.set(embeddedTarget.path, set);
    }
  }

  if (excalidrawFileIdsByPath.size === 0) {
    return changedFileIDs;
  }

  // Walk the full nested dependency tree of the root drawing.
  // If any nested file changed since lastLoadTime, mark all top-level embeds
  // that include it (identified via path[1]) as needing a rebuild.
  const nestedTree = getAllNestedExcalidrawFiles(plugin, view.file, false);
  for (const [file, node] of nestedTree.entries()) {
    if (file.stat.mtime <= lastLoadTime) {
      continue;
    }
    for (const path of node.paths) {
      const topLevelDep = path[1];
      if (!topLevelDep) {
        continue;
      }
      const fileIds = excalidrawFileIdsByPath.get(topLevelDep.path);
      if (fileIds) {
        for (const fileId of fileIds) {
          changedFileIDs.add(fileId);
        }
      }
    }
  }

  return changedFileIDs;
}

export async function insertImageToView(
  ea: ExcalidrawAutomate,
  position: { x: number; y: number },
  file: TFile | string,
  scale?: boolean,
  shouldInsertToView: boolean = true,
  repositionToCursor: boolean = false,
): Promise<string> {
  if (shouldInsertToView) {
    ea.clear();
  }
  ea.style.strokeColor = "transparent";
  ea.style.backgroundColor = "transparent";
  const api = ea.getExcalidrawAPI();
  ea.canvas.theme = api.getAppState().theme;
  const id = await ea.addImage(position.x, position.y, file, scale);
  if (shouldInsertToView) {
    await ea.addElementsToView(repositionToCursor, true, true);
  }
  return id;
}

export function deleteAppStateKeys(
  st: AppState,
  [...keys]: (keyof AppState)[],
): Partial<AppState> {
  keys.forEach((key) => {
    delete (st as Mutable<AppState>)[key];
  });
  return st;
}

export async function insertEmbeddableToView(
  ea: ExcalidrawAutomate,
  position: { x: number; y: number },
  file?: TFile,
  link?: string,
  shouldInsertToView: boolean = true,
): Promise<string> {
  if (shouldInsertToView) {
    ea.clear();
  }
  const api = ea.getExcalidrawAPI();
  const st = api.getAppState();

  if (ea.plugin.settings.embeddableMarkdownDefaults.backgroundMatchElement) {
    ea.style.backgroundColor = st.currentItemBackgroundColor;
  } else {
    ea.style.backgroundColor = "transparent";
  }

  if (ea.plugin.settings.embeddableMarkdownDefaults.borderMatchElement) {
    ea.style.strokeColor = st.currentItemStrokeColor;
  } else {
    ea.style.strokeColor = "transparent";
  }

  if (
    file &&
    (IMAGE_TYPES.contains(file.extension) || ea.isExcalidrawFile(file)) &&
    !ANIMATED_IMAGE_TYPES.contains(file.extension)
  ) {
    return await insertImageToView(
      ea,
      position,
      link ?? file,
      undefined,
      shouldInsertToView,
    );
  }
  let height = MAX_IMAGE_SIZE;
  if (
    (file && AUDIO_TYPES.contains(file.extension.toLowerCase())) ||
    (link &&
      AUDIO_TYPES.contains(
        link.match(/\[\[[^\]]+?\.([^.\]]+)]]/)?.[1]?.toLocaleLowerCase(),
      ))
  ) {
    ea.style.strokeColor = "transparent";
    ea.style.backgroundColor = "transparent";
    height = getAudioElementHeight();
  }
  const id = ea.addEmbeddable(
    position.x,
    position.y,
    MAX_IMAGE_SIZE,
    height,
    link,
    file,
  );
  if (shouldInsertToView) {
    await ea.addElementsToView(false, true, true);
  }
  return id;
}

export async function addTextWithOEmbed(
  view: ExcalidrawView,
  text: string,
): Promise<void> {
  const id = await view.addText(text);
  const oEmbedURL = `${URLs.NOEMBED_COM_EMBED_URL}${encodeURIComponent(text)}`;

  const resolveTitleFromOEmbed = async (): Promise<string | null> => {
    try {
      const data = JSON.parse(await request({ url: oEmbedURL })) as {
        title?: string;
        error?: string;
      };
      const title = data?.title?.trim();
      return title && !data.error ? title : null;
    } catch (error) {
      console.error(
        "unexpected error in resolveTitleFromOEmbed",
        resolveTitleFromOEmbed,
        error,
      );
      return null;
    }
  };

  const resolveTitleFromPage = async (): Promise<string | null> => {
    try {
      const response = await requestUrl({
        url: text,
        method: "GET",
        throw: false,
      });
      const html = response?.text;
      if (!html) {
        return null;
      }

      const doc = new DOMParser().parseFromString(html, "text/html");
      const titleCandidates = [
        doc.querySelector('meta[property="og:title"]')?.getAttribute("content"),
        doc
          .querySelector('meta[name="twitter:title"]')
          ?.getAttribute("content"),
        doc.querySelector("title")?.textContent,
      ];

      const title = titleCandidates.find(
        (candidate) => candidate && candidate.trim().length > 0,
      );
      return title?.trim() ?? null;
    } catch (error) {
      console.error(
        "unexpected error in resolveTitleFromPage",
        resolveTitleFromPage,
        error,
      );
      return null;
    }
  };

  try {
    const title =
      (await resolveTitleFromOEmbed()) ?? (await resolveTitleFromPage());
    if (!title) {
      return;
    }

    const ea = getEA(view);
    try {
      const el = ea
        .getViewElements()
        .filter((el) => el.type === "text" && el.id === id);
      if (el.length === 1) {
        ea.copyViewElementsToEAforEditing(el);
        const textElement = ea.getElement(
          el[0].id,
        ) as Mutable<ExcalidrawTextElement>;
        textElement.text =
          textElement.originalText =
          textElement.rawText =
            `[${title}](${text})`;
        await ea.addElementsToView(false, false, false);
      }
    } finally {
      ea.destroy();
    }
  } catch (error) {
    console.error(
      "unexpected error in addTextWithOEmbed",
      addTextWithOEmbed,
      error,
    );
  }
}

export function getLinkTextFromLink(text: string): string {
  if (!text) {
    return;
  }
  if (text.match(REG_LINKINDEX_HYPERLINK)) {
    return;
  }

  const parts = REGEX_LINK.getRes(text).next();
  if (!parts.value) {
    return;
  }

  const linktext = REGEX_LINK.getLink(parts); //parts.value[2] ? parts.value[2]:parts.value[6];
  if (linktext.match(REG_LINKINDEX_HYPERLINK)) {
    return;
  }

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
  const result = /^\[[^\]]*]\(([^)]*)\)/.exec(link);
  return result ? result[1] : link;
}

function isInternalLink(link: string): boolean {
  link = getLinkFromMarkdownLink(link);
  if (link.startsWith("cmd://")) {
    return true;
  }
  if (link.startsWith("obsidian://")) {
    return true;
  }
  if (link.match(REG_LINKINDEX_HYPERLINK)) {
    return false;
  }
  return true;
}

export function sceneRemoveInternalLinks(scene: {
  elements: readonly ExcalidrawElement[];
}): ExcalidrawElement[] {
  const elements: ExcalidrawElement[] = JSON.parse(
    JSON.stringify(scene.elements),
  );
  elements.forEach((el) => {
    if (!el.link) {
      return;
    }
    if (isInternalLink(el.link)) {
      (el as Mutable<ExcalidrawElement>).link = null;
    }
  });
  return elements;
}

export function openExternalLink(link: string, app: App): boolean {
  link = getLinkFromMarkdownLink(link);
  if (link.match(/^cmd:\/\/.*/)) {
    const cmd = link.replace("cmd://", "");
    void executeCommandLinkWithConfirmation(cmd, app);
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
  if (!link) {
    return false;
  }
  link = getLinkFromMarkdownLink(link);
  if (!link?.startsWith("obsidian://")) {
    return false;
  }
  const url = new URL(link);
  const action = url.pathname.slice(2); // Remove leading '//'

  const props: { [key: string]: string } = {};
  url.searchParams.forEach((value, key) => {
    props[key] = decodeURIComponent(value);
  });

  if (action === "open" && props.vault === app.vault.getName()) {
    const file = props.file;
    const f = app.metadataCache.getFirstLinkpathDest(file, "");
    if (f && f instanceof TFile) {
      if (returnWikiLink) {
        return `[[${f.path}]]`;
      }
      return f.path;
    }
  }

  if (openLink) {
    window.open(link, "_blank");
  }
  return true;
}

export function getExcalidrawFileForwardLinks(
  app: App,
  excalidrawFile: TFile,
  secondOrderLinksSet: Set<string>,
): string {
  let secondOrderLinks = "";
  const forwardLinks = app.metadataCache.getLinks()[excalidrawFile.path];
  if (forwardLinks && forwardLinks.length > 0) {
    const linkset = new Set<string>();
    forwardLinks.forEach((link) => {
      const linkparts = getLinkParts(link.link);
      const f = app.metadataCache.getFirstLinkpathDest(
        linkparts.path,
        excalidrawFile.path,
      );
      if (f && f.path !== excalidrawFile.path) {
        if (secondOrderLinksSet.has(f.path)) {
          return;
        }
        secondOrderLinksSet.add(f.path);
        linkset.add(
          `[[${f.path}${linkparts.ref ? `#${linkparts.ref}` : ""}|Second Order Link: ${f.basename}]]`,
        );
      }
    });
    secondOrderLinks = [...linkset].join(" ");
  }
  return secondOrderLinks;
}

export function getFrameBasedOnFrameNameOrId(
  frameName: string,
  elements: readonly NonDeletedExcalidrawElement[],
): ExcalidrawFrameElement | null {
  const frames = elements
    .filter((el: ExcalidrawElement) => el.type === "frame")
    .map(
      (
        el: ExcalidrawFrameElement,
      ): {
        el: ExcalidrawFrameElement;
        id: string;
        name: string;
      } => ({ el, id: el.id, name: el.name ?? "Frame" }),
    )
    .filter((item) => item.id === frameName || item.name === frameName)
    .map((item) => item.el);
  return frames.length === 1 ? frames[0] : null;
}

export async function addBackOfTheNoteCard(
  view: ExcalidrawView,
  title: string,
  activate: boolean = true,
  cardBody?: string,
  embeddableCustomData?: EmbeddableMDCustomProps,
  center: boolean = false,
  position?: { x: number; y: number },
): Promise<string> {
  const data = view.data;
  const header = getExcalidrawMarkdownHeaderSection(data);
  const body = data.split(header)[1];
  const shouldAddHashtag = body && body.startsWith("%%");
  const hastag = header.match(/#\n+$/m);
  const shouldRemoveTrailingHashtag = Boolean(hastag);
  view.data = data.replace(
    header,
    () =>
      `${
        shouldRemoveTrailingHashtag
          ? header.substring(0, header.length - hastag[0].length)
          : header
      }\n# ${title}\n\n${cardBody ? `${cardBody}\n\n` : ""}${
        shouldAddHashtag || shouldRemoveTrailingHashtag ? "#\n" : ""
      }`,
  );
  await view.forceSave(true);
  let watchdog = 0;
  await sleep(200);
  let found: string;
  type BlockCacheHeadingEntry = {
    display?: string;
    node?: {
      type?: string;
    };
  };
  while (
    watchdog++ < 10 &&
    !(found = (
      await view.app.metadataCache.blockCache.getForFile(
        { isCancelled: () => false },
        view.file,
      )
    ).blocks
      .filter(
        (b: BlockCacheHeadingEntry): b is { display: string } =>
          Boolean(b.display) && b.node?.type === "heading",
      )
      .filter((b) => !MD_EX_SECTIONS.includes(b.display))
      .map((b) => cleanSectionHeading(b.display))
      .find((b) => b === title))
  ) {
    await sleep(200);
  }

  const ea = getEA(view);
  let { x, y } = position ?? ea.targetView.currentPosition;
  if (center) {
    const centerPos = ea.getViewCenterPosition();
    if (centerPos) {
      x = centerPos.x - CARD_WIDTH / 2;
      y = centerPos.y - CARD_HEIGHT / 2;
    }
  }

  const id = ea.addEmbeddable(
    x,
    y,
    CARD_WIDTH,
    CARD_HEIGHT,
    `[[${view.file.path}#${title}]]`,
    undefined,
    embeddableCustomData,
  );
  await ea.addElementsToView(!center, false, true);

  const api = view.excalidrawAPI;
  const el = ea.getViewElements().find((el) => el.id === id);
  api.selectElements([el]);
  if (activate) {
    window.setTimeout(() => {
      api.updateScene({
        appState: { activeEmbeddable: { element: el, state: "active" } },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      if (found) {
        view.getEmbeddableLeafElementById(el.id)?.editNode?.();
      }
    }, 200);
  }
  ea.destroy();
  return el.id;
}

export function renderContextMenuAction(
  React: Pick<typeof import("react"), "createElement">,
  label: string,
  action: () => void,
  onClose: (callback?: () => void) => void,
  actionId?: string,
  checked: boolean = false,
) {
  return React.createElement(
    "li",
    {
      key: nanoid(),
      onClick: () => onClose(action),
      "data-testid": actionId,
    },
    React.createElement(
      "button",
      {
        className: checked
          ? "context-menu-item checkmark"
          : "context-menu-item",
      },
      React.createElement(
        "div",
        { className: "context-menu-item__label" },
        label,
      ),
      React.createElement(
        "kbd",
        { className: "context-menu-item__shortcut" },
        "", //this is where the shortcut may go in the future
      ),
    ),
  );
}

export function tmpBruteForceCleanup(view: ExcalidrawView) {
  window.setTimeout(() => {
    if (!view) {
      return;
    }
    const mutableView = view as unknown as Record<string, unknown>;
    Object.keys(mutableView).forEach((key) => {
      delete mutableView[key];
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
export function isTextImageTransclusion(
  text: string,
  view: ExcalidrawView,
  callback: (link: string, file: TFile) => void,
): boolean {
  const REG_TRANSCLUSION = /^!\[\[([^|\]]*)?.*?]]$|^!\[[^\]]*?]\((.*?)\)$/g;
  const match = text.trim().matchAll(REG_TRANSCLUSION).next(); //reset the iterator
  if (match?.value?.[0]) {
    const link = match.value[1] ?? match.value[2];
    const file = view.app.metadataCache.getFirstLinkpathDest(
      link?.split("#")[0],
      view.file.path,
    );
    if (view.file === file) {
      if (
        link?.split("#")[1] &&
        !isImagePartRef(getEmbeddedFilenameParts(link))
      ) {
        return false;
      }
      new Notice(t("RECURSIVE_INSERT_ERROR"));
      return false;
    }
    if (file && file instanceof TFile) {
      if (
        view.plugin.isExcalidrawFile(file) &&
        link?.split("#")[1] &&
        !isImagePartRef(getEmbeddedFilenameParts(link))
      ) {
        return false;
      }
      if (file.extension !== "md" || view.plugin.isExcalidrawFile(file)) {
        callback(link, file);
        return true;
      }
      new Notice(t("USE_INSERT_FILE_MODAL"), 5000);
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
    setSanitizedHtml(div, releaseNotesHTML);
  };

  modal.open();
}

export async function toggleImageAnchoring(
  el: ExcalidrawImageElement,
  view: ExcalidrawView,
  shouldAnchor: boolean,
  ef: EmbeddedFile,
) {
  const ea = getEA(view);
  let imgEl = view
    .getViewElements()
    .find(
      (x: ExcalidrawElement) => x.id === el.id,
    ) as Mutable<ExcalidrawImageElement>;
  if (!imgEl) {
    ea.destroy();
    return;
  }
  ea.copyViewElementsToEAforEditing([imgEl]);
  imgEl = ea.getElements()[0] as Mutable<ExcalidrawImageElement>;
  if (!imgEl.customData) {
    imgEl.customData = {};
  }
  imgEl.customData.isAnchored = shouldAnchor;
  if (shouldAnchor) {
    const { height, width } = ef.size;
    const dX = width - imgEl.width;
    const dY = height - imgEl.height;
    imgEl.height = height;
    imgEl.width = width;
    imgEl.x -= dX / 2;
    imgEl.y -= dY / 2;
  }
  await ea.addElementsToView(false, false);
  ea.destroy();
}

export function onLoadMessages(scene: {
  elements: ExcalidrawElement[];
  appState: AppState;
}) {
  window.setTimeout(() => {
    if (
      !(scene.appState.frameRendering?.markerEnabled ?? true) &&
      scene.elements.some(
        (el) => el.type === "frame" && el.frameRole === "marker",
      )
    ) {
      new Notice(t("MARKER_FRAME_RENDERING_DISABLED_NOTICE"));
    }
    /*const backOfTheCardNote = getExcalidrawMarkdownHeader(data)
      .header
      .replace(/^---\n[\s\S]*?\n---/gm, "")
      .replace("==⚠  Switch to EXCALIDRAW VIEW in the MORE OPTIONS menu of this document. ⚠== You can decompress Drawing data with the command palette: 'Decompress current Excalidraw file'. For more info check in plugin settings under 'Saving'","")
      .trim();
    if(backOfTheCardNote.length>0) {
      new Notice(t("DRAWING_HAS_BACK_OF_THE_CARD")); 
    }*/
  });
}

export function getViewColorPalette(
  palette: "canvasBackground" | "elementBackground" | "elementStroke",
  view?: ExcalidrawView,
  includeSceneColors: boolean = false,
): (string[] | string)[] {
  if (!view) {
    return getDefaultColorPalette();
  }

  const api = view.excalidrawAPI;
  const { colorPalette } = api.getAppState();
  if (!colorPalette || !colorPalette.hasOwnProperty(palette)) {
    return getDefaultColorPalette();
  }

  const basePalette = colorPalette[palette];

  if (!Array.isArray(basePalette)) {
    return [basePalette];
  }

  const cmFactory =
    view.hookServer?.getCM?.bind(view.hookServer) ??
    view.plugin.ea.getCM.bind(view.plugin.ea);
  type ColorMasterLike = {
    lightness?: number;
    alpha?: number;
    stringHEX?: (opts?: { alpha?: boolean }) => string;
    toString(): string;
  };
  const isColorMasterLike = (value: unknown): value is ColorMasterLike => {
    return (
      typeof value === "object" &&
      value !== null &&
      typeof (value as { toString?: unknown }).toString === "function"
    );
  };
  const getLightness = (color: string): number => {
    const cm = cmFactory?.(color) as unknown;
    const value = isColorMasterLike(cm) ? cm.lightness : undefined;
    return typeof value === "number" ? value : Number.POSITIVE_INFINITY;
  };
  const normalize = (color: string): string => {
    if (!color) {
      return color;
    }
    if (color.toLowerCase() === "transparent") {
      return "transparent";
    }
    const cm = cmFactory?.(color) as unknown;
    if (isColorMasterLike(cm) && typeof cm.stringHEX === "function") {
      try {
        const alpha = cm.alpha;
        const includeAlpha = typeof alpha === "number" ? alpha !== 1 : true;
        return cm.stringHEX({ alpha: includeAlpha }).toLowerCase();
      } catch {
        // fall through to string coercion
      }
    }
    if (isColorMasterLike(cm)) {
      return cm.toString().toLowerCase();
    }
    return color.toLowerCase();
  };

  const groups = basePalette
    .filter((entry) => Array.isArray(entry))
    .map((entry) =>
      (entry as string[])
        .slice()
        .sort((a, b) => getLightness(b) - getLightness(a)),
    );
  const singles = basePalette.filter((entry) => typeof entry === "string");
  const groupColors = groups
    .flatMap((entry) => entry)
    .filter(Boolean)
    .map((c) => normalize(c));
  const groupColorSet = new Set(groupColors);

  const seenSingles = new Set<string>();
  const filteredSingles = singles.filter((entry) => {
    const norm = normalize(entry);
    if (!norm) {
      return false;
    }
    if (groupColorSet.has(norm)) {
      return false;
    }
    if (seenSingles.has(norm)) {
      return false;
    }
    seenSingles.add(norm);
    return true;
  });

  if (
    !includeSceneColors ||
    !["elementBackground", "elementStroke"].includes(palette)
  ) {
    return [...groups, ...filteredSingles];
  }

  const flattenPalette = (pal: readonly (string | string[])[]): string[] =>
    pal
      .flatMap((entry) => (Array.isArray(entry) ? entry : [entry]))
      .filter(
        (color): color is string => typeof color === "string" && Boolean(color),
      );

  const paletteColors = flattenPalette(basePalette).map((c) => normalize(c));
  const extraColors = new Set<string>(
    filteredSingles.filter((c) => c.toLowerCase() !== "transparent"),
  );

  view.getViewElements().forEach((el) => {
    const color =
      palette === "elementStroke"
        ? el.strokeColor
        : "backgroundColor" in el
          ? el.backgroundColor
          : undefined;
    if (!color || normalize(color) === "transparent") {
      return;
    }
    if (paletteColors.includes(normalize(color))) {
      return;
    }
    extraColors.add(color);
  });

  if (!extraColors.size) {
    return [...groups];
  }

  const sortedExtras = cmFactory
    ? Array.from(extraColors).sort((a, b) => getLightness(b) - getLightness(a))
    : Array.from(extraColors);

  return [...groups, ...sortedExtras];
}

//!Temporary hack
//https://discord.com/channels/686053708261228577/817515900349448202/1031101635784613968
export const setMobileNavbarPosition = (dock: boolean) => {
  if (DEVICE.isMobile) {
    const navbar = mainDocument.querySelector(
      "body>.app-container>.mobile-navbar",
    );
    if (navbar && navbar instanceof HTMLDivElement) {
      if (dock) {
        navbar.addClass("excalidraw-mobile-navbar-docked");
      } else {
        navbar.removeClass("excalidraw-mobile-navbar-docked");
      }
    }
  }
};
