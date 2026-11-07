import type { MarkdownView, PaneType, TFile, WorkspaceLeaf } from "obsidian";
import type ExcalidrawPlugin from "../main";
import { linkClickModifierType, modifierKeyTooltipMessages, labelALT, labelCTRL, labelMETA, labelSHIFT } from "src/utils/modifierkeyHelper";
import { isMaskFile } from "src/utils/utils";
import { getExcalidrawFileForwardLinks } from "src/utils/excalidrawViewUtils";
import { linkPrompt } from "src/shared/Dialogs/Prompt";
import { DEVICE, VIEW_TYPE_EXCALIDRAW } from "src/constants/constants";
import { getNewOrAdjacentLeaf } from "src/utils/obsidianUtils";
import { errorlog } from "src/utils/coreUtils";
import { t } from "src/lang/helpers";
import type { ExcalidrawSettings } from "../settingsDefaults";
import type { PaneTarget } from "src/types/utilTypes";

/** Describe the current platform's configured actions, including their actual key combinations. */
export function getDrawingEmbedOpenTooltip(settings: ExcalidrawSettings): string {
  const rules = (DEVICE.isMacOS || DEVICE.isIOS ? settings.modifierKeyConfig.Mac : settings.modifierKeyConfig.Win).LinkClickAction.rules;
  const actions = modifierKeyTooltipMessages().LinkClickAction;
  const seen = new Set<string>(), lines = [t("EMBED_OPEN_DRAWING")];
  for (const rule of rules) {
    const keys = [rule.ctrl_cmd && labelCTRL(), rule.meta_ctrl && labelMETA(), rule.alt_opt && labelALT(), rule.shift && labelSHIFT()].filter(Boolean).join("+");
    if (!keys || seen.has(keys)) continue;
    seen.add(keys);
    if (!DEVICE.isDesktop && rule.result === "popout-window") continue;
    const action = actions[(rule.result === "md-properties" ? "new-tab" : rule.result) as PaneTarget];
    if (action) lines.push(t("EMBED_OPEN_MODIFIER").replace("{keys}", keys).replace("{action}", action));
  }
  return lines.join("\n");
}

async function openForEditing(plugin: ExcalidrawPlugin, file: TFile, location: PaneTarget, subpath: string, origin?: HTMLElement): Promise<void> {
  if (!plugin._loaded) return;
  const workspace = plugin.app.workspace;
  let source: WorkspaceLeaf, leaf: WorkspaceLeaf;
  if (origin) workspace.iterateAllLeaves(candidate => { if (candidate.view.containerEl.contains(origin)) source = candidate; });
  switch (location) {
    case "popout-window": leaf = workspace.openPopoutLeaf(); break;
    case "new-tab": case "md-properties": leaf = workspace.getLeaf("tab"); break;
    case "new-pane": leaf = getNewOrAdjacentLeaf(plugin, source ?? workspace.getLeaf(false)); break;
    default:
      leaf = source ?? workspace.getLeaf(false);
      if (plugin.settings.focusOnFileTab && leaf.view.file !== file) workspace.iterateAllLeaves(candidate => {
        if (candidate.view.file === file && candidate.view.getViewType() === VIEW_TYPE_EXCALIDRAW) leaf = candidate;
      });
  }
  const previous = leaf.view, previousFile = previous.file;
  if (previous.getViewType() === "markdown") {
    await (previous as MarkdownView).save();
    if (!plugin._loaded || leaf.view !== previous || previous.file !== previousFile) return;
  }
  if (plugin.app.vault.getFileByPath(file.path) !== file) return;
  plugin.excalidrawFileModes[leaf.id || file.path] = VIEW_TYPE_EXCALIDRAW;
  await leaf.setViewState({ type: VIEW_TYPE_EXCALIDRAW, state: { file: file.path }, active: true });
  if (plugin._loaded && leaf.view.file === file && leaf.view.getViewType() === VIEW_TYPE_EXCALIDRAW) {
    workspace.setActiveLeaf(leaf, { focus: true });
    if (subpath) leaf.view.setEphemeralState({ subpath });
  }
}

/** Shared by existing open gestures and the explicit drawing-open control. */
export function openDrawingEmbed(plugin: ExcalidrawPlugin, source: string, event: MouseEvent, origin?: HTMLElement): void {
  const srcParts = source.match(/([^#]*)(.*)/);
  if (!srcParts) return;
  const file = plugin.app.vault.getFileByPath(srcParts[1]);
  if (!file) return;
  const modifier = linkClickModifierType(event);
  const open = (target: TFile, subpath: string): void => {
    void openForEditing(plugin, target, modifier, subpath, origin).catch((error: unknown) => { errorlog({ where: "openDrawingEmbed", error }); });
  };
  if (plugin.isExcalidrawFile(file) && isMaskFile(plugin, file)) {
    void (async () => {
      const linkString = `[[${file.path}${srcParts[2] ? `#${srcParts[2]}` : ""}]] ${getExcalidrawFileForwardLinks(plugin.app, file, new Set<string>())}`;
      const result = await linkPrompt(linkString, plugin.app);
      if (!result) return;
      const [target, linkText, subpath] = result;
      if (plugin.isExcalidrawFile(target)) {
        open(target, subpath);
        return;
      }
      let pane: boolean | PaneType = false;
      switch (modifier) {
        case "active-pane": pane = false; break;
        case "new-pane": pane = "split"; break;
        case "popout-window": pane = "window"; break;
        case "new-tab": pane = "tab"; break;
        case "md-properties": pane = "tab"; break;
      }
      await plugin.app.workspace.openLinkText(linkText, "", pane, subpath ? { eState: { subpath } } : {});
    })();
    return;
  }
  open(file, srcParts[2]);
}
