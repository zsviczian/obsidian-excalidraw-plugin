import { DEVICE } from "src/constants/constants";
import ExcalidrawPlugin from "src/main";

export class ExcalidrawConfig {
  public areaLimit: number = 16777216;
  public widthHeightLimit: number = 32767;

  constructor(private plugin: ExcalidrawPlugin) {
    this.updateValues();
  }

  updateValues() {
    if(DEVICE.isIOS) return; 
    this.areaLimit = 16777216*this.plugin.settings.areaZoomLimit; //this.plugin.settings.areaLimit;
    this.widthHeightLimit = 32767*this.plugin.settings.areaZoomLimit; //his.plugin.settings.widthHeightLimit;
  }
}