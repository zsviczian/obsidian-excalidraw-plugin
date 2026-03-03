import { ExcalidrawTextElement } from "@zsviczian/excalidraw/types/element/src/types";
import { Notice } from "obsidian";
import { t } from "src/lang/helpers";
import { ScriptEngine } from "../Scripts";
import ExcalidrawView from "src/view/ExcalidrawView";

/**
   *
   * @param view - ExcalidrawView instance
   * @param prefix - defines the default button.
   * @returns
   */
export async function copyLinkToSelectedElementToClipboard(view: ExcalidrawView, prefix: string) {
  const elements = view.getViewSelectedElements();
  if (elements.length < 1) {
    new Notice(t("INSERT_LINK_TO_ELEMENT_ERROR"));
    return;
  }

  let elementId: string = undefined;

  if (elements.length === 2) {
    const textEl = elements.filter((el) => el.type === "text");
    if (textEl.length === 1 && (textEl[0] as ExcalidrawTextElement).containerId) {
      const container = elements.filter(
        (el) => el.boundElements && el.boundElements.some((be) => be.type === "text"),
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

  const frames = elements.filter((el) => el.type === "frame");
  const hasFrame = frames.length === 1;
  const hasMarkerFrame = hasFrame && (frames[0] as any).frameRole === "marker";
  const hasGroup = elements.some((el) => el.groupIds && el.groupIds.length > 0);

  // Feature 1: UIFM_ANCHOR checkbox (persisted)
  let anchorTo100 = Boolean(view.plugin.settings.copyLinkToElemenetAnchorTo100);

  // Feature 2: frame link by name (persisted)
  let copyFrameLinkByName = Boolean(view.plugin.settings.copyFrameLinkByName);

  const frameNameRaw = hasFrame ? (frames[0] as any)?.name : undefined;
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
        return;
      }
    },
    link: {
      caption: "Link",
      action: () => {
        cancelled = false;
        prefix = "";
        return;
      } },
    group: {
      caption: "Group",
      action: () => {
        cancelled = false;
        prefix = "group=";
        return;
      }
    },
    frame: {
      caption: "Frame",
      action: () => {
        cancelled = false;
        prefix = "frame=";
        elementId = getFrameTarget();
        return;
      },
    },
    clippedframe: {
      caption: "Clipped Frame",
      action: () => {
        cancelled = false;
        prefix = "clippedframe=";
        elementId = getFrameTarget();
        return;
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
        const wrapper = container.createDiv?.("excalidraw-prompt-checkboxes") ?? container;
        const ownerDoc = wrapper.ownerDocument ?? document;

        const anchorRow = ownerDoc.createElement("label");
        anchorRow.style.display = "flex";
        anchorRow.style.alignItems = "center";
        anchorRow.style.gap = "8px";
        anchorRow.style.marginTop = "8px";

        const anchorCb = ownerDoc.createElement("input");
        anchorCb.type = "checkbox";
        anchorCb.checked = anchorTo100;
        anchorCb.setAttribute("aria-label", t("UIFM_ANCHOR_DESC"));
        anchorCb.addEventListener("change", () => {
          anchorTo100 = anchorCb.checked;
        });

        const anchorText = ownerDoc.createElement("span");
        anchorText.textContent = t("UIFM_ANCHOR");

        anchorRow.appendChild(anchorCb);
        anchorRow.appendChild(anchorText);
        wrapper.appendChild(anchorRow);

        if (frameNameIsValid) {
          const frameRow = ownerDoc.createElement("label");
          frameRow.style.display = "flex";
          frameRow.style.alignItems = "center";
          frameRow.style.gap = "8px";
          frameRow.style.marginTop = "8px";

          const frameCb = ownerDoc.createElement("input");
          frameCb.type = "checkbox";
          frameCb.checked = copyFrameLinkByName;
          frameCb.setAttribute("aria-label", t("FRAME_WITH_NAME"));
          frameCb.addEventListener("change", () => {
            copyFrameLinkByName = frameCb.checked;
          });

          const frameText = ownerDoc.createElement("span");
          frameText.textContent = t("FRAME_WITH_NAME");

          frameRow.appendChild(frameCb);
          frameRow.appendChild(frameText);
          wrapper.appendChild(frameRow);
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

  navigator.clipboard.writeText(
    `${prefix.length > 0 ? "!" : ""}[[${view.file.path}#^${prefix}${elementId}${alias ? `|${alias}` : ``}]]`,
  );
  new Notice(t("INSERT_LINK_TO_ELEMENT_READY"));
}