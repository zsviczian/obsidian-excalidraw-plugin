import { DEVICE } from "src/constants/constants";

const isApplePlatform = () => DEVICE.isIOS || DEVICE.isMacOS;

export const labelCTRL = () => (isApplePlatform() ? "CMD" : "CTRL");
export const labelALT = () => (isApplePlatform() ? "OPT" : "ALT");
export const labelMETA = () =>
  isApplePlatform() ? "CTRL" : DEVICE.isWindows ? "WIN" : "META";
export const labelSHIFT = () => "SHIFT";
