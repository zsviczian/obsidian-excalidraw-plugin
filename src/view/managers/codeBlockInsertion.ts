import type ExcalidrawView from "../ExcalidrawView";
import { GenericInputPrompt, MultiOptionConfirmationPrompt } from "../../shared/Dialogs/Prompt";
import { insertCodeBlockMarkdownImage } from "../../shared/MarkdownImage";
import type { CodeBlockInsertionPreference } from "../../types/codeBlockTypes";
import { t } from "../../lang/helpers";
import { addBackOfTheNoteCard } from "../../utils/excalidrawViewUtils";
import { CaptureUpdateAction } from "../../constants/constants";
import { fitPastedCodeBlockCard } from "./pastedCodeCardSizing";

/** Shared insertion for clipboard code and the context-menu action. */
export async function insertCodeBlock(view: ExcalidrawView, data: string): Promise<void> {
  const { file, excalidrawAPI: api } = view;
  const position = { ...view.currentPosition };
  const isCurrent = () => file && api && view.file === file &&
    view.excalidrawAPI === api && !view.isClosingOrMigrating();
  if (!isCurrent()) return;

  // Input prompts reject on Escape; cancellation is an ordinary no-op.
  const input = async (title: string, placeholder: string): Promise<string | null> => {
    try {
      return await GenericInputPrompt.Prompt(view, view.plugin, view.app, title, placeholder, "");
    } catch (error) {
      if (error === "No input given.") return null;
      throw error;
    }
  };
  data = data.replaceAll("\r\n", "\n").replaceAll("\r", "\n").trim();
  if (!data) return;
  const isCodeblock = Boolean(data.match(/^`{3}[^\n]*\n.+\n`{3}\s*$/ms));
  if (!isCodeblock) {
    const codeblockType = await input(t("PASTE_CODEBLOCK_LANGUAGE"), t("PASTE_CODEBLOCK_LANGUAGE_PLACEHOLDER"));
    if (codeblockType === null || !isCurrent()) return;
    data = `\`\`\`${codeblockType.trim()}\n${data}\n\`\`\``;
  }
  let format = view.plugin.settings.pasteCodeBlockAs;
  if (format !== "markdown-image" && format !== "embeddable") {
    const prompt = new MultiOptionConfirmationPrompt<Exclude<CodeBlockInsertionPreference, "ask"> | null>(
      view.plugin,
      t("PASTE_CODEBLOCK_CHOOSE"),
      new Map<string, Exclude<CodeBlockInsertionPreference, "ask"> | null>([
        [t("PASTE_CODEBLOCK_EMBEDDABLE"), "embeddable"],
        [t("MARKDOWN_IMAGE_TITLE"), "markdown-image"],
        [t("PROMPT_BUTTON_CANCEL"), null],
      ]),
      t("PASTE_CODEBLOCK_EMBEDDABLE"),
      { name: t("PASTE_CODEBLOCK_REMEMBER"), description: t("PASTE_CODEBLOCK_REMEMBER_DESC") },
    );
    const decision = await prompt.waitForClose;
    if (!decision || !isCurrent()) return;
    format = decision;
    if (prompt.toggleValue) {
      view.plugin.settings.pasteCodeBlockAs = decision;
      await view.plugin.saveSettings();
      if (!isCurrent()) return;
    }
  }
  if (format === "markdown-image") {
    await insertCodeBlockMarkdownImage(view, data, position);
    return;
  }
  const result = await input(t("PASTE_CODEBLOCK_TITLE"), t("PASTE_CODEBLOCK_TITLE_PLACEHOLDER"));
  if (result === null || !isCurrent()) return;
  let title = result.trim();
  if (title === "") {
    title = t("PASTE_CODEBLOCK_DEFAULT_TITLE");
  }
  const sections = await view.getBackOfTheNoteSections();
  if (!isCurrent()) return;
  if (sections.includes(title)) {
    let i = 0;
    while (sections.includes(`${title} ${++i}`)) {
      // no-op
    }
    title = `${title} ${i}`;
  }
  const id = await addBackOfTheNoteCard(
    view, title, false, data, undefined, false, undefined,
    CaptureUpdateAction.EVENTUALLY,
  );
  await fitPastedCodeBlockCard(view, id);
}
