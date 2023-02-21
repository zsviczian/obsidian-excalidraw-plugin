import { DEVICE, isDarwin } from "src/Constants";
export type ModifierKeys = {shiftKey:boolean, ctrlKey: boolean, metaKey: boolean, altKey: boolean};
export type KeyEvent = PointerEvent | MouseEvent | KeyboardEvent | React.DragEvent | React.PointerEvent | React.MouseEvent | ModifierKeys; 
export type PaneTarget = "active-pane"|"new-pane"|"popout-window"|"new-tab"|"md-properties";
export type ExternalDragAction = "insert-link"|"image-url"|"image-import";
export type InternalDragAction = "link"|"image"|"image-fullsize";

export const labelCTRL = () => DEVICE.isIOS || DEVICE.isMacOS ? "CMD" : "CTRL";
export const labelALT = () => DEVICE.isIOS || DEVICE.isMacOS ? "OPT" : "ALT";
export const labelMETA = () => DEVICE.isIOS || DEVICE.isMacOS ? "CTRL" : (DEVICE.isWindows ? "WIN" : "META");
export const labelSHIFT = () => "SHIFT";

export const isCTRL = (e:KeyEvent) => DEVICE.isIOS || DEVICE.isMacOS ? e.metaKey : e.ctrlKey;
export const isALT = (e:KeyEvent) => e.altKey;
export const isMETA = (e:KeyEvent) => DEVICE.isIOS || DEVICE.isMacOS ? e.ctrlKey : e.metaKey;
export const isSHIFT = (e:KeyEvent) => e.shiftKey;

export const mdPropModifier = (ev: KeyEvent): boolean => !isSHIFT(ev) && isCTRL(ev) && !isALT(ev) && isMETA(ev);
export const scaleToFullsizeModifier = (ev: KeyEvent) => 
  ( isSHIFT(ev) && !isCTRL(ev) && !isALT(ev) &&  isMETA(ev)) ||
  (!isSHIFT(ev) &&  isCTRL(ev) &&  isALT(ev) && !isMETA(ev));

export const linkClickModifierType = (ev: KeyEvent):PaneTarget => {
  if(isCTRL(ev) && !isALT(ev) && isSHIFT(ev) && !isMETA(ev)) return "active-pane";
  if(isCTRL(ev) && !isALT(ev) && !isSHIFT(ev) && !isMETA(ev)) return "new-tab";
  if(isCTRL(ev) && isALT(ev) && !isSHIFT(ev) && !isMETA(ev)) return "new-pane";
  if(DEVICE.isDesktop && isCTRL(ev) && isALT(ev) && isSHIFT(ev) && !isMETA(ev) ) return "popout-window";
  if(isCTRL(ev) && isALT(ev) && isSHIFT(ev) && !isMETA(ev)) return "new-tab";
  if(mdPropModifier(ev)) return "md-properties";
  return "active-pane";
}

export const externalDragModifierType = (ev: KeyEvent):ExternalDragAction => {
  if(!isSHIFT(ev) &&  isCTRL(ev) && !isALT(ev) && !isMETA(ev)) return "insert-link";
  if(!isSHIFT(ev) && !isCTRL(ev) && !isALT(ev) &&  isMETA(ev)) return "insert-link";
  if( isSHIFT(ev) && !isCTRL(ev) && !isALT(ev) && !isMETA(ev)) return "image-import";
  if(!isSHIFT(ev) && !isCTRL(ev) &&  isALT(ev) && !isMETA(ev)) return "image-import";
  return "image-url";
}

//https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/468
export const internalDragModifierType = (ev: KeyEvent):InternalDragAction => {
  if( isSHIFT(ev) && !isCTRL(ev) && !isALT(ev) && !isMETA(ev)) return "image";
  if(!isSHIFT(ev) &&  isCTRL(ev) && !isALT(ev) && !isMETA(ev)) return "image";
  if(scaleToFullsizeModifier(ev)) return "image-fullsize";
  return "link";
}

export const emulateCTRLClickForLinks = (e:KeyEvent) => {
  return {
    shiftKey: e.shiftKey,
    ctrlKey: e.ctrlKey || !(DEVICE.isIOS || DEVICE.isMacOS),
    metaKey: e.metaKey ||  (DEVICE.isIOS || DEVICE.isMacOS),
    altKey: e.altKey
  }
}