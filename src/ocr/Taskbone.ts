import { ExcalidrawAutomate } from "../ExcalidrawAutomate";
import {Notice, requestUrl} from "obsidian"
import ExcalidrawPlugin from "../main"
import {log} from "../utils/Utils"
import ExcalidrawView from "../ExcalidrawView"
import FrontmatterEditor from "src/utils/Frontmatter";
import { ExcalidrawImageElement } from "@zsviczian/excalidraw/types/element/types";
import { bindingBorderTest } from "@zsviczian/excalidraw/types/element/collision";

const TASKBONE_URL = "https://api.taskbone.com/"; //"https://excalidraw-preview.onrender.com/";
const TASKBONE_OCR_FN = "execute?id=60f394af-85f6-40bc-9613-5d26dc283cbb";

export default class Taskbone {
  get apiKey() {
    return this.plugin.settings.taskboneAPIkey;
  }

  private ea: ExcalidrawAutomate;
  
  constructor(
    private plugin: ExcalidrawPlugin
  ) {
    this.ea = new ExcalidrawAutomate(plugin);
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
    const ea = this.ea;
    ea.clear();
    ea.setView(view);
    await view.save(false);
    const viewElements = this.ea.getViewElements().filter( el => 
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

    
    
    ea.copyViewElementsToEAforEditing(viewElements);
    const files = view.getScene().files;
    viewElements.filter(el=>el.type==="image").forEach((el:ExcalidrawImageElement)=>{
      //const img = view.excalidrawData.getFile(el.fileId);
      const img = files[el.fileId];
      if(img) {
        ea.imagesDict[img.id] = {
          mimeType: img.mimeType,
          id: img.id,
          dataURL: img.dataURL,
          created: img.created,
          file: null,
          hasSVGwithBitmap: img.hasSVGwithBitmap,
          shouldScale: img.shouldScale,
          latex: null,
        }
      }        
    })

    const bb = ea.getBoundingBox(viewElements);
    const size = (bb.width*bb.height);
    const minRatio = Math.sqrt(360000/size);
    const maxRatio = Math.sqrt(size/4000000);
    const scale = minRatio > 1 ? minRatio : (maxRatio > 1 ? 1/maxRatio : 1);
    console.log(scale);

    const img = await ea.createPNG(undefined,scale,undefined,undefined,view.excalidrawAPI.getAppState().theme,10);
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
    const base64Image = await this.blobToBase64(image);
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


  private async blobToBase64(blob: Blob): Promise<string> {
    const arrayBuffer = await blob.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    var binary = '';
    var len = bytes.byteLength;
    for (var i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}

