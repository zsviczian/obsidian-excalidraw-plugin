import { Modifier } from "obsidian";
import { DEVICE } from "src/constants/constants";
import { ExcalidrawSettings } from "src/settings";
export type ModifierKeys = {shiftKey:boolean, ctrlKey: boolean, metaKey: boolean, altKey: boolean};
export type KeyEvent = PointerEvent | MouseEvent | KeyboardEvent | React.DragEvent | React.PointerEvent | React.MouseEvent | ModifierKeys; 
export type PaneTarget = "active-pane"|"new-pane"|"popout-window"|"new-tab"|"md-properties";
export type WebBrowserDragAction = "link"|"image-url"|"image-import"|"embeddable";
export type LocalFileDragAction = "link"|"image-url"|"image-import"|"embeddable";
export type InternalDragAction = "link"|"image"|"image-fullsize"|"embeddable";
export type ModifierSetType = "WebBrowserDragAction" | "LocalFileDragAction" | "InternalDragAction" | "LinkClickAction";

type ModifierKey = {
  shift: boolean;
  ctrl_cmd: boolean;
  alt_opt: boolean;
  meta_ctrl: boolean;
  result: WebBrowserDragAction | LocalFileDragAction | InternalDragAction | PaneTarget;
};

export type ModifierKeySet = {
  defaultAction: WebBrowserDragAction | LocalFileDragAction | InternalDragAction | PaneTarget;
  rules: ModifierKey[];
};

export type ModifierKeyTooltipMessages = Partial<{
  [modifierSetType in ModifierSetType]: Partial<{
    [action in WebBrowserDragAction | LocalFileDragAction | InternalDragAction | PaneTarget]: string;
  }>;
}>;

export const modifierKeyTooltipMessages = ():ModifierKeyTooltipMessages => {
  return {
    WebBrowserDragAction: {
      "image-import": "Import Image to Vault",
      "image-url": `Insert Image or YouTube Thumbnail with URL`,
      "link": "Insert Link",
      "embeddable": "Insert Interactive-Frame",
      // Add more messages for WebBrowserDragAction as needed
    },
    LocalFileDragAction: {
      "image-import": "Import external file or reuse existing file if path is from the Vault",
      "image-url": `Insert Image: with local URI or internal-link if from Vault`,
      "link": "Insert Link: local URI or internal-link if from Vault",
      "embeddable": "Insert Interactive-Frame: local URI or internal-link if from Vault",
    },
    InternalDragAction: {
      "image": "Insert Image",
      "image-fullsize": "Insert Image @100%",
      "link": `Insert Link`,
      "embeddable": "Insert Interactive-Frame",
    },
    LinkClickAction: {
      "active-pane": "Open in current active window",
      "new-pane": "Open in a new adjacent window",
      "popout-window": "Open in a popout window",
      "new-tab": "Open in a new tab",
      "md-properties": "Show the Markdown image-properties dialog (only relevant if you have embedded a markdown document as an image)",
    },
  }
};

const processModifiers = (ev: KeyEvent, modifierType: ModifierSetType): WebBrowserDragAction | LocalFileDragAction | InternalDragAction | PaneTarget => {
  const settings:ExcalidrawSettings = window.ExcalidrawAutomate.plugin.settings;
  const keySet = ((DEVICE.isMacOS || DEVICE.isIOS) ? settings.modifierKeyConfig.Mac : settings.modifierKeyConfig.Win)[modifierType];
  for (const rule of keySet.rules) {
    const { shift, ctrl_cmd, alt_opt, meta_ctrl, result } = rule;
    if (
      (isSHIFT(ev) === shift) &&
      (isWinCTRLorMacCMD(ev) === ctrl_cmd) &&
      (isWinALTorMacOPT(ev) === alt_opt) &&
      (isWinMETAorMacCTRL(ev) === meta_ctrl)
    ) {
      return result;
    }
  }
  return keySet.defaultAction;
}

export const labelCTRL = () => DEVICE.isIOS || DEVICE.isMacOS ? "CMD" : "CTRL";
export const labelALT = () => DEVICE.isIOS || DEVICE.isMacOS ? "OPT" : "ALT";
export const labelMETA = () => DEVICE.isIOS || DEVICE.isMacOS ? "CTRL" : (DEVICE.isWindows ? "WIN" : "META");
export const labelSHIFT = () => "SHIFT";

export const isWinCTRLorMacCMD = (e:KeyEvent) => DEVICE.isIOS || DEVICE.isMacOS ? e.metaKey : e.ctrlKey;
export const isWinALTorMacOPT = (e:KeyEvent) => e.altKey;
export const isWinMETAorMacCTRL = (e:KeyEvent) => DEVICE.isIOS || DEVICE.isMacOS ? e.ctrlKey : e.metaKey;
export const isSHIFT = (e:KeyEvent) => e.shiftKey;

export const setCTRL = (e:ModifierKeys, value: boolean): ModifierKeys => {
  if(DEVICE.isIOS || DEVICE.isMacOS) 
    e.metaKey = value;
  else 
    e.ctrlKey = value;
  return e;
}
export const setALT = (e:ModifierKeys, value: boolean): ModifierKeys => {
  e.altKey = value;
  return e;
}
export const setMETA = (e:ModifierKeys, value: boolean): ModifierKeys => {
  if(DEVICE.isIOS || DEVICE.isMacOS)
    e.ctrlKey = value;
  else
    e.metaKey = value;
  return e;
}
export const setSHIFT = (e:ModifierKeys, value: boolean): ModifierKeys => {
  e.shiftKey = value;
  return e;
}

export const mdPropModifier = (ev: KeyEvent): boolean => !isSHIFT(ev) && isWinCTRLorMacCMD(ev) && !isWinALTorMacOPT(ev) && isWinMETAorMacCTRL(ev);
export const scaleToFullsizeModifier = (ev: KeyEvent) => {
  const settings:ExcalidrawSettings = window.ExcalidrawAutomate.plugin.settings;
  const keySet = ((DEVICE.isMacOS || DEVICE.isIOS) ? settings.modifierKeyConfig.Mac : settings.modifierKeyConfig.Win )["InternalDragAction"];
  const rule = keySet.rules.find(r => r.result === "image-fullsize");
  if(!rule) return false;
  const { shift, ctrl_cmd, alt_opt, meta_ctrl, result } = rule;
  return (
    (isSHIFT(ev) === shift) &&
    (isWinCTRLorMacCMD(ev) === ctrl_cmd) &&
    (isWinALTorMacOPT(ev) === alt_opt) &&
    (isWinMETAorMacCTRL(ev) === meta_ctrl)
  );
}

export const linkClickModifierType = (ev: KeyEvent):PaneTarget => {
  const action = processModifiers(ev, "LinkClickAction") as PaneTarget;
  if(!DEVICE.isDesktop && action === "popout-window") return "active-pane";
  return action;
}

export const webbrowserDragModifierType = (ev: KeyEvent):WebBrowserDragAction => {
  return processModifiers(ev, "WebBrowserDragAction") as WebBrowserDragAction;
}

export const localFileDragModifierType = (ev: KeyEvent):LocalFileDragAction => {
  return processModifiers(ev, "LocalFileDragAction") as LocalFileDragAction;
}

//https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/468
export const internalDragModifierType = (ev: KeyEvent):InternalDragAction => {
  return processModifiers(ev, "InternalDragAction") as InternalDragAction;
}

export const emulateCTRLClickForLinks = (e:KeyEvent) => {
  return {
    shiftKey: e.shiftKey,
    ctrlKey: e.ctrlKey || !(DEVICE.isIOS || DEVICE.isMacOS),
    metaKey: e.metaKey ||  (DEVICE.isIOS || DEVICE.isMacOS),
    altKey: e.altKey
  }
}

export const emulateKeysForLinkClick = (action: PaneTarget): ModifierKeys => {
  const ev = {shiftKey: false, ctrlKey: false, metaKey: false, altKey: false};
  if(!action) return ev;
  const platform = DEVICE.isMacOS || DEVICE.isIOS ? "Mac" : "Win";
  const settings:ExcalidrawSettings = window.ExcalidrawAutomate.plugin.settings;
  const modifierKeyConfig = settings.modifierKeyConfig;

  const config = modifierKeyConfig[platform]?.LinkClickAction;

  if (config) {
    const rule = config.rules.find(rule => rule.result === action);
    if (rule) {
      setCTRL(ev, rule.ctrl_cmd);
      setALT(ev, rule.alt_opt);
      setMETA(ev, rule.meta_ctrl);
      setSHIFT(ev, rule.shift);
    } else {
      const defaultAction = config.defaultAction as PaneTarget;
      return emulateKeysForLinkClick(defaultAction);
    }
  }
  return ev;
}

export const anyModifierKeysPressed = (e: ModifierKeys): boolean => {
  return e.shiftKey || e.ctrlKey || e.metaKey || e.altKey;
}

export function modifierLabel(modifiers: Modifier[], platform?: "Mac" | "Other"): string {
  const isMacPlatform = platform === "Mac" || 
                        (platform === undefined && (DEVICE.isIOS || DEVICE.isMacOS));

  return modifiers.map(modifier => {
    switch (modifier) {
      case "Mod":
        return isMacPlatform ? "CMD" : "CTRL";
      case "Ctrl":
        return "CTRL";
      case "Meta":
        return isMacPlatform ? "CMD" : "WIN";
      case "Shift":
        return "SHIFT";
      case "Alt":
        return isMacPlatform ? "OPTION" : "ALT";
      default:
        return modifier;
    }
  }).join("+");
}