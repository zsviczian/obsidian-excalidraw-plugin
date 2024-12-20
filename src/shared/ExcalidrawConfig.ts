import { DEVICE } from "src/constants/constants";
import ExcalidrawPlugin from "src/core/main";

export class ExcalidrawConfig {
  public areaLimit: number = 16777216;
  public widthHeightLimit: number = 32767;

  constructor(plugin: ExcalidrawPlugin) {
    this.updateValues(plugin);
  }

  updateValues(plugin: ExcalidrawPlugin) {
    if(DEVICE.isIOS) return; 
    this.areaLimit = 16777216*plugin.settings.areaZoomLimit; //this.plugin.settings.areaLimit;
    this.widthHeightLimit = 32767*plugin.settings.areaZoomLimit; //his.plugin.settings.widthHeightLimit;
  }
}