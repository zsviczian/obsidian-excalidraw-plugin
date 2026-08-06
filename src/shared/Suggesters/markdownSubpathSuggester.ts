import { resolveSubpath, type App, type TFile } from "obsidian";
import { MD_EX_SECTIONS, nanoid } from "src/constants/constants";
import { t } from "src/lang/helpers";
import { ScriptEngine } from "src/shared/Scripts";
import { cleanSectionHeading } from "src/utils/pathUtils";

type BlockCacheEntry = Awaited<
  ReturnType<App["metadataCache"]["blockCache"]["getForFile"]>
>["blocks"][number];

type HeadingBlockEntry = BlockCacheEntry & {
  display: string;
  node: BlockCacheEntry["node"] & { type: "heading" };
};

type ParagraphLikeBlockEntry = BlockCacheEntry & {
  display: string;
  node: BlockCacheEntry["node"] & {
    type: "paragraph" | "blockquote" | "listItem" | "table" | "callout";
  };
};

function isHeadingBlockEntry(entry: BlockCacheEntry): entry is HeadingBlockEntry {
  return Boolean(entry.display && entry.node?.type === "heading");
}

export type MarkdownHeadingSubpath = {
  display: string;
  subpath: string;
};

/** Returns link subpaths for user-authored Markdown headings. */
export async function getMarkdownHeadingSubpaths(
  app: App,
  file: TFile,
  isExcalidrawFile: boolean,
): Promise<MarkdownHeadingSubpath[]> {
  const sections = (
    await app.metadataCache.blockCache.getForFile(
      { isCancelled: () => false },
      file,
    )
  ).blocks
    .filter(isHeadingBlockEntry)
    .filter(
      (entry) =>
        !isExcalidrawFile || !MD_EX_SECTIONS.includes(entry.display),
    )
    .map((entry) => ({
      display: entry.display,
      subpath: `#${cleanSectionHeading(entry.display)}`,
    }));
  const fileCache = app.metadataCache.getFileCache(file);
  return fileCache
    ? sections.filter(
        (section) =>
          resolveSubpath(fileCache, section.subpath)?.type === "heading",
      )
    : [];
}

function isParagraphLikeBlockEntry(
  entry: BlockCacheEntry,
): entry is ParagraphLikeBlockEntry {
  return Boolean(
    entry.display &&
      entry.node &&
      (entry.node.type === "paragraph" ||
        entry.node.type === "blockquote" ||
        entry.node.type === "listItem" ||
        entry.node.type === "table" ||
        entry.node.type === "callout"),
  );
}

/** Prompts for a Markdown heading and returns its link subpath. */
export async function selectMarkdownHeadingSubpath(
  app: App,
  file: TFile,
  isExcalidrawFile: boolean,
  isCancelled?: () => boolean,
): Promise<string | null> {
  const sections = await getMarkdownHeadingSubpaths(
    app,
    file,
    isExcalidrawFile,
  );
  const values = sections.map((entry) => entry.subpath);
  const display = sections.map((entry) => entry.display);
  if (!isExcalidrawFile) {
    values.unshift("");
    display.unshift(t("SHOW_ENTIRE_FILE"));
  }
  const selected = await ScriptEngine.suggester(
    app,
    display,
    values,
    t("SELECT_SECTION"),
  );
  if (isCancelled?.()) {
    return null;
  }
  return selected || selected === "" ? selected : null;
}

/** Prompts for a Markdown block, creating a block ID when required. */
export async function selectMarkdownBlockSubpath(
  app: App,
  file: TFile,
  isCancelled?: () => boolean,
): Promise<string | null> {
  const paragraphs = (
    await app.metadataCache.blockCache.getForFile(
      { isCancelled: () => false },
      file,
    )
  ).blocks.filter(isParagraphLikeBlockEntry);
  const values: Array<"entire-file" | (typeof paragraphs)[number]> = [
    "entire-file",
    ...paragraphs,
  ];
  const display = [t("SHOW_ENTIRE_FILE")].concat(
    paragraphs.map(
      (entry) =>
        `${entry.node.id ? `#^${entry.node.id}: ` : ""}${entry.display.trim()}`,
    ),
  );
  const selected = await ScriptEngine.suggester(
    app,
    display,
    values,
    t("SELECT_SECTION"),
  );
  if (!selected || isCancelled?.()) {
    return null;
  }
  if (selected === "entire-file") {
    return "";
  }

  let blockId = selected.node.id;
  if (!blockId) {
    const offset = selected.node?.position?.end?.offset;
    // Preserve the existing behavior: an absent or zero offset is not writable.
    if (!offset) {
      return null;
    }
    blockId = nanoid();
    const fileContents = await app.vault.cachedRead(file);
    if (!fileContents || isCancelled?.()) {
      return null;
    }
    await app.vault.modify(
      file,
      `${fileContents.slice(0, offset)} ^${blockId}${fileContents.slice(offset)}`,
    );
    await sleep(200);
  }
  return `#^${blockId}`;
}
