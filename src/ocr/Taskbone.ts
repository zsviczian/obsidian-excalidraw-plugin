import { createPNG, ExcalidrawAutomate } from "../ExcalidrawAutomate";
import {Notice, requestUrl} from "obsidian"
import ExcalidrawPlugin from "../main"
import {log} from "../utils/Utils"
import ExcalidrawView, { ExportSettings } from "../ExcalidrawView"
import FrontmatterEditor from "src/utils/Frontmatter";
import { ExcalidrawElement, ExcalidrawImageElement } from "@zsviczian/excalidraw/types/element/types";
import { EmbeddedFilesLoader } from "src/EmbeddedFileLoader";
import { blobToBase64 } from "src/utils/FileUtils";

const TASKBONE_URL = "https://api.taskbone.com/"; //"https://excalidraw-preview.onrender.com/";
const TASKBONE_OCR_FN = "execute?id=60f394af-85f6-40bc-9613-5d26dc283cbb";

export default class Taskbone {
  get apiKey() {
    return this.plugin.settings.taskboneAPIkey;
  }
 
  constructor(
    private plugin: ExcalidrawPlugin
  ) {
  }

  public async initialize(save:boolean = true):Promise<string> {
    if(this.plugin.settings.taskboneAPIkey !== "") return;
    const response = await requestUrl({
      url: `${TASKBONE_URL}users/excalidraw-obsidian/identities`,
      method: "post",
      contentType: "application/json",
      throw: false
    });
    if(!response) return;
    const apiKey = response.json?.apiKey;
    if(apiKey && typeof apiKey === "string") {
      if(save) await this.plugin.loadSettings();
      this.plugin.settings.taskboneAPIkey = apiKey;
      if(save) await this.plugin.saveSettings();
    }
    return apiKey;
  }

  public async getTextForView(view: ExcalidrawView, forceReScan: boolean) {
    await view.forceSave(true);
    const viewElements = view.excalidrawAPI.getSceneElements().filter((el:ExcalidrawElement) => 
      el.type==="freedraw" || 
      ( el.type==="image" &&
        !this.plugin.isExcalidrawFile(view.excalidrawData.getFile(el.fileId)?.file)
      ));
    if(viewElements.length === 0) {
      new Notice ("Aborting OCR because there are no image or freedraw elements on the canvas.",4000);
      return;
    }
    const fe = new FrontmatterEditor(view.data);
    if(fe.hasKey("taskbone-ocr") && !forceReScan) {
      new Notice ("The drawing has already been processed, you will find the result in the frontmatter in markdown view mode. If you ran the command from the Obsidian Panel in Excalidraw then you can CTRL(CMD)+click the command to force the rescaning.",4000)
      return;
    }   
    const bb = this.plugin.ea.getBoundingBox(viewElements);
    const size = (bb.width*bb.height);
    const minRatio = Math.sqrt(360000/size);
    const maxRatio = Math.sqrt(size/16000000);
    const scale = minRatio > 1 
      ? minRatio
      : (
          maxRatio > 1 
          ? 1/maxRatio
          : 1
        );
  
    const loader = new EmbeddedFilesLoader(
      this.plugin,
      false,
    );

    const exportSettings: ExportSettings = {
      withBackground: true,
      withTheme: true,
    };

    const img =
      await createPNG(
        view.file.path + "#^taskbone",
        scale,
        exportSettings,
        loader,
        "light",
        null,
        null,
        [],
        this.plugin,
        0
      );

    const text = await this.getTextForImage(img); 
    if(text) {
      fe.setKey("taskbone-ocr",text);
      view.data = fe.data;
      view.save(false);
      window.navigator.clipboard.writeText(text);
      new Notice("I placed the recognized in the drawing's frontmatter and onto the system clipboard.");
    }
  }

  private async getTextForImage(image: Blob):Promise<string> {
    const url = TASKBONE_URL+TASKBONE_OCR_FN;
    if(this.apiKey === "") {
      await this.initialize();
    }
    const base64Image = await blobToBase64(image);
    const input = {
      records: [{
          image: base64Image
      }]
    };

    const apiResponse = await requestUrl ({
      url: url,
      method: "post",
      contentType: "application/json",
      body: JSON.stringify(input),
      headers: {
        authorization: `Bearer ${this.apiKey}`
      },
      throw: false 
    });
    const content = apiResponse?.json;
    
    if(!content || apiResponse.status !== 200) {
      new Notice("Something went wrong while processing your request. Please check developer console for more information");
      log(apiResponse);
      return;
    }
    return content.records[0].text;
  }

}

