import type { PaneType } from "obsidian";
import type ExcalidrawPlugin from "../main";
import { linkClickModifierType } from "src/utils/modifierkeyHelper";
import { isMaskFile } from "src/utils/utils";
import { getExcalidrawFileForwardLinks } from "src/utils/excalidrawViewUtils";
import { linkPrompt } from "src/shared/Dialogs/Prompt";

/** Shared by existing open gestures and the explicit drawing-open control. */
export function openDrawingEmbed(plugin: ExcalidrawPlugin, source: string, event: MouseEvent): void {
  const srcParts = source.match(/([^#]*)(.*)/);
  if (!srcParts) return;
  const file = plugin.app.vault.getFileByPath(srcParts[1]);
  if (!file) return;
  const modifier = linkClickModifierType(event);
  if (plugin.isExcalidrawFile(file) && isMaskFile(plugin, file)) {
    void (async () => {
      const linkString = `[[${file.path}${srcParts[2] ? `#${srcParts[2]}` : ""}]] ${getExcalidrawFileForwardLinks(plugin.app, file, new Set<string>())}`;
      const result = await linkPrompt(linkString, plugin.app);
      if (!result) return;
      const [target, linkText, subpath] = result;
      if (plugin.isExcalidrawFile(target)) {
        plugin.openDrawing(target, modifier, true, subpath);
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
  plugin.openDrawing(file, modifier, true, srcParts[2]);
}
