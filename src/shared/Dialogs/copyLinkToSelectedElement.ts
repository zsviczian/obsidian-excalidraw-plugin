import { Notice } from "obsidian";
import { t } from "src/lang/helpers";
import { NamedExcalidrawFrameElement } from "src/types/excalidrawElementTypes";
import { ScriptEngine } from "../Scripts";
import ExcalidrawView from "src/view/ExcalidrawView";

/**
 *
 * @param view - ExcalidrawView instance
 * @param prefix - defines the default button.
 * @returns
 */
export async function copyLinkToSelectedElementToClipboard(
  view: ExcalidrawView,
  prefix: string,
) {
  const elements = view.getViewSelectedElements();
  if (elements.length < 1) {
    new Notice(t("INSERT_LINK_TO_ELEMENT_ERROR"));
    return;
  }

  let elementId: string = undefined;

  if (elements.length === 2) {
    const textEl = elements.filter((el) => el.type === "text");
    if (textEl.length === 1 && textEl[0].containerId) {
      const container = elements.filter(
        (el) =>
          el.boundElements && el.boundElements.some((be) => be.type === "text"),
      );
      if (container.length === 1) {
        elementId = textEl[0].id;
      }
    }
  }

  if (!elementId) {
    elementId =
      elements.length === 1
        ? elements[0].id
        : view.plugin.ea.getLargestElement(elements).id;
  }

  const frames = elements.filter(
    (el): el is NamedExcalidrawFrameElement => el.type === "frame",
  );
  const hasFrame = frames.length === 1;
  const hasMarkerFrame = hasFrame && frames[0].frameRole === "marker";
  const hasGroup = elements.some((el) => el.groupIds && el.groupIds.length > 0);

  // Feature 1: UIFM_ANCHOR checkbox (persisted)
  let anchorTo100 = Boolean(view.plugin.settings.copyLinkToElemenetAnchorTo100);

  // Feature 2: frame link by name (persisted)
  let copyFrameLinkByName = Boolean(view.plugin.settings.copyFrameLinkByName);

  const frameNameRaw = hasFrame ? frames[0]?.name : undefined;
  const frameName = typeof frameNameRaw === "string" ? frameNameRaw.trim() : "";
  const frameNameIsValid =
    hasFrame && frameName.length > 0 && /[\p{L}\p{N}_ -]+/u.test(frameName);

  const getFrameTarget = () =>
    frameNameIsValid && copyFrameLinkByName ? frameName : frames[0].id;

  let cancelled = true;

  const button = {
    area: {
      caption: "Area",
      action: () => {
        cancelled = false;
        prefix = "area=";
      },
    },
    link: {
      caption: "Link",
      action: () => {
        cancelled = false;
        prefix = "";
      },
    },
    group: {
      caption: "Group",
      action: () => {
        cancelled = false;
        prefix = "group=";
      },
    },
    frame: {
      caption: "Frame",
      action: () => {
        cancelled = false;
        prefix = "frame=";
        elementId = getFrameTarget();
      },
    },
    clippedframe: {
      caption: "Clipped Frame",
      action: () => {
        cancelled = false;
        prefix = "clippedframe=";
        elementId = getFrameTarget();
      },
    },
  };

  let buttons = [];
  switch (prefix) {
    case "area=":
      buttons = [
        button.area,
        button.link,
        ...(hasGroup ? [button.group] : []),
        ...(hasFrame && !hasMarkerFrame ? [button.clippedframe] : []),
        ...(hasFrame ? [button.frame] : []),
      ];
      break;
    case "group=":
      buttons = [
        ...(hasGroup ? [button.group] : []),
        button.link,
        button.area,
        ...(hasFrame && !hasMarkerFrame ? [button.clippedframe] : []),
        ...(hasFrame ? [button.frame] : []),
      ];
      break;
    case "frame=":
      buttons = [
        ...(hasFrame && !hasMarkerFrame ? [button.clippedframe] : []),
        ...(hasFrame ? [button.frame] : []),
        ...(hasGroup ? [button.group] : []),
        button.link,
        button.area,
      ];
      break;
    case "clippedframe=":
      buttons = [
        ...(hasFrame && !hasMarkerFrame ? [button.clippedframe] : []),
        ...(hasFrame ? [button.frame] : []),
        ...(hasGroup ? [button.group] : []),
        button.link,
        button.area,
      ];
      break;
    default:
      buttons = [
        button.link,
        button.area,
        button.group,
        ...(hasFrame && !hasMarkerFrame ? [button.clippedframe] : []),
        ...(hasFrame ? [button.frame] : []),
      ];
  }

  let alias: string;
  try {
    alias = await ScriptEngine.inputPrompt(
      view,
      view.plugin,
      view.app,
      "Set link alias",
      "Leave empty if you do not want to set an alias",
      "",
      buttons,
      undefined,
      undefined,
      (container: HTMLElement) => {
        const wrapper =
          container.createDiv?.("excalidraw-prompt-checkboxes") ?? container;

        const anchorRow = wrapper.createEl("label");
        anchorRow.addClass("excalidraw-copylinkprompt-label");

        const anchorCb = anchorRow.createEl("input");
        anchorCb.type = "checkbox";
        anchorCb.checked = anchorTo100;
        anchorCb.setAttribute("aria-label", t("UIFM_ANCHOR_DESC"));
        anchorCb.addEventListener("change", () => {
          anchorTo100 = anchorCb.checked;
        });

        const anchorText = anchorRow.createSpan();
        anchorText.textContent = t("UIFM_ANCHOR");

        if (frameNameIsValid) {
          const frameRow = wrapper.createEl("label");
          frameRow.addClass("excalidraw-copylinkprompt-label");

          const frameCb = frameRow.createEl("input");
          frameCb.type = "checkbox";
          frameCb.checked = copyFrameLinkByName;
          frameCb.setAttribute("aria-label", t("FRAME_WITH_NAME"));
          frameCb.addEventListener("change", () => {
            copyFrameLinkByName = frameCb.checked;
          });

          const frameText = frameRow.createSpan();
          frameText.textContent = t("FRAME_WITH_NAME");
        }
      },
    );
  } finally {
    const changed =
      view.plugin.settings.copyLinkToElemenetAnchorTo100 !== anchorTo100 ||
      view.plugin.settings.copyFrameLinkByName !== copyFrameLinkByName;

    if (changed) {
      await view.plugin.loadSettings();
      view.plugin.settings.copyLinkToElemenetAnchorTo100 = anchorTo100;
      view.plugin.settings.copyFrameLinkByName = copyFrameLinkByName;
      await view.plugin.saveSettings();
    }
  }

  if (cancelled) {
    return;
  }

  if ((alias === "" || alias == null) && anchorTo100) {
    alias = "100%";
  }

  await navigator.clipboard.writeText(
    `${prefix.length > 0 ? "!" : ""}[[${view.file.path}#^${prefix}${elementId}${alias ? `|${alias}` : ``}]]`,
  );
  new Notice(t("INSERT_LINK_TO_ELEMENT_READY"));
}
