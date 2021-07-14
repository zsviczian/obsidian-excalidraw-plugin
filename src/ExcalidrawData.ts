import { App, normalizePath, TFile } from "obsidian";
import { 
  nanoid,
  FRONTMATTER_KEY_CUSTOM_PREFIX,
  FRONTMATTER_KEY_CUSTOM_LINK_BRACKETS,
} from "./constants";
import { measureText } from "./ExcalidrawAutomate";
import ExcalidrawPlugin from "./main";
import { ExcalidrawSettings } from "./settings";
import {  
  JSON_parse
} from "./constants";

const DRAWING_REG = /\n# Drawing\n(```json\n)?(.*)(```)?/gm;

//![[link|alias]]![alias](link)
//1  2    3      4 5      6
export const REG_LINK_BACKETS = /(!)?\[\[([^|\]]+)\|?(.+)?]]|(!)?\[(.*)\]\((.*)\)/g;

export function getJSON(data:string):string {
  const res = data.matchAll(DRAWING_REG);
  const parts = res.next();
  if(parts.value && parts.value.length>1) {
    const result = parts.value[2];
    return result.substr(0,result.lastIndexOf("}")+1); //this is a workaround in case sync merges two files together and one version is still an old version without the ```codeblock
  }
  return data;
}

export class ExcalidrawData {
  private textElements:Map<string,{raw:string, parsed:string}> = null; 
  public scene:any = null;
  private file:TFile = null;
  private settings:ExcalidrawSettings;
  private app:App;
  private showLinkBrackets: boolean;
  private linkPrefix: string;
  private allowParse: boolean = false;

  constructor(plugin: ExcalidrawPlugin) {
    this.settings = plugin.settings;
    this.app = plugin.app;
  }  

  /**
   * Loads a new drawing
   * @param {TFile} file - the MD file containing the Excalidraw drawing
   * @returns {boolean} - true if file was loaded, false if there was an error
   */
  public async loadData(data: string,file: TFile, allowParse:boolean):Promise<boolean> {
    //console.log("Excalidraw.Data.loadData()",{data:data,allowParse:allowParse,file:file});

    this.file = file;
    this.textElements = new Map<string,{raw:string, parsed:string}>();

    //I am storing these because if the settings change while a drawing is open parsing will run into errors during save
    //The drawing will use these values until next drawing is loaded or this drawing is re-loaded
    this.setShowLinkBrackets();
    this.setLinkPrefix();  
    
    this.scene = null;
    if (this.settings.syncExcalidraw) {
      const excalfile = file.path.substring(0,file.path.lastIndexOf('.md')) + '.excalidraw';
      const f = this.app.vault.getAbstractFileByPath(excalfile);
      if(f && f instanceof TFile && f.stat.mtime>file.stat.mtime) { //the .excalidraw file is newer then the .md file
        const d = await this.app.vault.read(f);
        this.scene = JSON.parse(d);
      }
    }

    //Load scene: Read the JSON string after "# Drawing" 
    let parts = data.matchAll(DRAWING_REG).next();
    if(!(parts.value && parts.value.length>1)) return false; //JSON not found or invalid
    if(!this.scene) { //scene was not loaded from .excalidraw
      const scene = parts.value[2];
      this.scene = JSON_parse(scene.substr(0,scene.lastIndexOf("}")+1)); //this is a workaround to address when files are mereged by sync and one version is still an old markdown without the codeblock ```
    }
    //Trim data to remove the JSON string
    data = data.substring(0,parts.value.index);

    //The Markdown # Text Elements take priority over the JSON text elements. 
    //i.e. if the JSON is modified to reflect the MD in case of difference
    //Read the text elements into the textElements Map
    let position = data.search("# Text Elements");
    if(position==-1) return true; //Text Elements header does not exist
    position += "# Text Elements\n".length;
    
    const BLOCKREF_LEN:number = " ^12345678\n\n".length;
    const res = data.matchAll(/\s\^(.{8})\n/g);
    while(!(parts = res.next()).done) {
      const text = data.substring(position,parts.value.index);
      this.textElements.set(parts.value[1],{raw: text, parsed: await this.parse(text)});
      position = parts.value.index + BLOCKREF_LEN;  
    }

    //Check to see if there are text elements in the JSON that were missed from the # Text Elements section
    //e.g. if the entire text elements section was deleted.
    this.findNewTextElementsInScene();
    await this.setAllowParse(allowParse,true);
    return true;
  }

  public async loadLegacyData(data: string,file: TFile):Promise<boolean> {
    this.file = file;
    this.textElements = new Map<string,{raw:string, parsed:string}>();
    this.setShowLinkBrackets();
    this.setLinkPrefix(); 
    this.scene = JSON.parse(data);
    this.findNewTextElementsInScene();
    await this.setAllowParse(false,true);
    return true;
  }

  public async setAllowParse(allowParse:boolean,forceupdate:boolean=false) {
    this.allowParse = allowParse;
    await this.updateSceneTextElements(forceupdate);
  }

  private async updateSceneTextElements(forceupdate:boolean=false) {
    //console.log("Excalidraw.Data.updateSceneTextElements(), forceupdate",forceupdate);
    //update a single text element in the scene if the newText is different
    const update = (sceneTextElement:any, newText:string) => {
      if(forceupdate || newText!=sceneTextElement.text) {
        const measure = measureText(newText,sceneTextElement.fontSize,sceneTextElement.fontFamily);
        sceneTextElement.text = newText;
        sceneTextElement.width = measure.w;
        sceneTextElement.height = measure.h;
        sceneTextElement.baseline = measure.baseline;
      }
    }

    //update text in scene based on textElements Map
    //first get scene text elements
    const texts = this.scene.elements?.filter((el:any)=> el.type=="text")
    for (const te of texts) {
      update(te,await this.getText(te.id)); 
    }
  }

  private async getText(id:string):Promise<string> {
    if (this.allowParse) {
      if(!this.textElements.get(id)?.parsed) {
        const raw = this.textElements.get(id).raw;
        this.textElements.set(id,{raw:raw, parsed: await this.parse(raw)})
      }
      //console.log("parsed",this.textElements.get(id).parsed);
      return this.textElements.get(id).parsed;
    } 
    //console.log("raw",this.textElements.get(id).raw);
    return this.textElements.get(id).raw;
  }

  /**
   * check for textElements in Scene missing from textElements Map
   * @returns {boolean} - true if there were changes
   */
  private findNewTextElementsInScene():boolean {
    //console.log("Excalidraw.Data.findNewTextElementsInScene()");
    //get scene text elements
    const texts = this.scene.elements?.filter((el:any)=> el.type=="text")

    let jsonString = JSON.stringify(this.scene);

    let dirty:boolean = false; //to keep track if the json has changed
    let id:string; //will be used to hold the new 8 char long ID for textelements that don't yet appear under # Text Elements
    for (const te of texts) {
      id = te.id;
      //replacing Excalidraw text IDs with my own nanoid, because default IDs may contain 
      //characters not recognized by Obsidian block references
      //also Excalidraw IDs are inconveniently long
      if(te.id.length>8) {  
        dirty = true;
        id=nanoid();
        jsonString = jsonString.replaceAll(te.id,id); //brute force approach to replace all occurances (e.g. links, groups,etc.)
      }
      if(!this.textElements.has(id)) {
        dirty = true;
        this.textElements.set(id,{raw: te.text, parsed: null});
        this.parseasync(id,te.text);
      }
    }
    if(dirty) { //reload scene json in case it has changed
      this.scene = JSON_parse(jsonString);
    }

    return dirty;
  }

  /**
   * update text element map by deleting entries that are no long in the scene
   * and updating the textElement map based on the text updated in the scene
   */
  private async updateTextElementsFromScene() {
    //console.log("Excalidraw.Data.updateTextElementesFromScene()");
    for(const key of this.textElements.keys()){
      //find text element in the scene
      const el = this.scene.elements?.filter((el:any)=> el.type=="text" && el.id==key);
      if(el.length==0) {
        this.textElements.delete(key); //if no longer in the scene, delete the text element
      } else {
        if(!this.textElements.has(key)) {
          this.textElements.set(key,{raw: el[0].text,parsed: await this.parse(el[0].text)});
        } else {
          const text = await this.getText(key); 
          if(text != el[0].text) {
            this.textElements.set(key,{raw: el[0].text,parsed: await this.parse(el[0].text)});
          }
        }
      }
    }
  }

  /**
   * update text element map by deleting entries that are no long in the scene
   * and updating the textElement map based on the text updated in the scene
   */
   private updateTextElementsFromSceneRawOnly() {
    //console.log("Excalidraw.Data.updateTextElementsFromSceneRawOnly()");
    for(const key of this.textElements.keys()){
      //find text element in the scene
      const el = this.scene.elements?.filter((el:any)=> el.type=="text" && el.id==key);
      if(el.length==0) {
        this.textElements.delete(key); //if no longer in the scene, delete the text element
      } else {
        if(!this.textElements.has(key)) {
          this.textElements.set(key,{raw: el[0].text,parsed: null});
          this.parseasync(key,el[0].text);
        } else {
          const text = this.allowParse ? this.textElements.get(key).parsed : this.textElements.get(key).raw;
          if(text != el[0].text) {
            this.textElements.set(key,{raw: el[0].text,parsed: null});
            this.parseasync(key,el[0].text);
          }
        }
      }
    }
  }

  private async parseasync(key:string, raw:string) {
    this.textElements.set(key,{raw:raw,parsed: await this.parse(raw)});
  }

  /**
   * Process aliases and block embeds
   * @param text 
   * @returns 
   */
  private async parse(text:string):Promise<string>{
    const getTransclusion = async (text:string) => {
      //file-name#^blockref
      //1          2
      const REG_FILE_BLOCKREF = /(.*)#\^(.*)/g;
      const parts=text.matchAll(REG_FILE_BLOCKREF).next();
      if(parts.done || !parts.value[1] || !parts.value[2]) return text; //filename and/or blockref not found
      const file = this.app.metadataCache.getFirstLinkpathDest(parts.value[1],this.file.path);
      const contents = await this.app.vault.cachedRead(file);
      //get transcluded line and take the part before ^blockref
      const REG_TRANSCLUDE = new RegExp("(.*)\\s\\^" + parts.value[2]);
      const res = contents.match(REG_TRANSCLUDE);
      if(res) return res[1];
      return text;//if blockref not found in file, return the input string
    }

    let outString = "";
    let position = 0;
    const res = text.matchAll(REG_LINK_BACKETS);
    let linkIcon = false;
    let parts;
    while(!(parts=res.next()).done) {
      if (parts.value[1] || parts.value[4]) { //transclusion
        outString += text.substring(position,parts.value.index) + 
                     await getTransclusion(parts.value[1] ? parts.value[2] : parts.value[6]);
      } else if (parts.value[2]) {
        linkIcon = true;
        outString += text.substring(position,parts.value.index) + 
                     (this.showLinkBrackets ? "[[" : "") +
                     (parts.value[3] ? parts.value[3]:parts.value[2]) + //insert alias or link text
                     (this.showLinkBrackets ? "]]" : "");
      } else {
        linkIcon = true;
        outString += text.substring(position,parts.value.index) + 
                     (this.showLinkBrackets ? "[[" : "") +
                     (parts.value[5] ? parts.value[5]:parts.value[6]) + //insert alias or link text
                     (this.showLinkBrackets ? "]]" : "");
      }
      position = parts.value.index + parts.value[0].length;
    }
    outString += text.substring(position,text.length);
    if (linkIcon) {
      outString = this.linkPrefix + outString;
    }

    return outString;
  }

  /**
   * Generate markdown file representation of excalidraw drawing
   * @returns markdown string
   */
  generateMD():string {
    //console.log("Excalidraw.Data.generateMD()");
    let outString = '# Text Elements\n';
    for(const key of this.textElements.keys()){
      outString += this.textElements.get(key).raw+' ^'+key+'\n\n';
    }
    return outString + '# Drawing\n' 
           + String.fromCharCode(96)+String.fromCharCode(96)+String.fromCharCode(96)+'json\n' 
           + JSON.stringify(this.scene) + '\n'
           + String.fromCharCode(96)+String.fromCharCode(96)+String.fromCharCode(96);
  }

  public syncElements(newScene:any):boolean {
    //console.log("Excalidraw.Data.syncElements()");
    this.scene = newScene;//JSON_parse(newScene);
    const result = this.setLinkPrefix() || this.setShowLinkBrackets() || this.findNewTextElementsInScene();
    this.updateTextElementsFromSceneRawOnly();
    return result;
  }

  public async updateScene(newScene:any){
    //console.log("Excalidraw.Data.updateScene()");
    this.scene = JSON_parse(newScene);
    const result = this.setLinkPrefix() || this.setShowLinkBrackets() || this.findNewTextElementsInScene();
    await this.updateTextElementsFromScene();
    if(result) {
      await this.updateSceneTextElements();
      return true;
    };
    return false;
  }

  public getRawText(id:string) {  
    return this.textElements.get(id)?.raw;
  }

  private setLinkPrefix():boolean {
    const linkPrefix = this.linkPrefix;
    const fileCache = this.app.metadataCache.getFileCache(this.file);
    if (fileCache?.frontmatter && fileCache.frontmatter[FRONTMATTER_KEY_CUSTOM_PREFIX]!=null) {
      this.linkPrefix=fileCache.frontmatter[FRONTMATTER_KEY_CUSTOM_PREFIX];
    } else {
      this.linkPrefix = this.settings.linkPrefix;
    }
    return linkPrefix != this.linkPrefix;
  }

  private setShowLinkBrackets():boolean {
    const showLinkBrackets = this.showLinkBrackets;
    const fileCache = this.app.metadataCache.getFileCache(this.file);
    if (fileCache?.frontmatter && fileCache.frontmatter[FRONTMATTER_KEY_CUSTOM_LINK_BRACKETS]!=null) {
      this.showLinkBrackets=fileCache.frontmatter[FRONTMATTER_KEY_CUSTOM_LINK_BRACKETS]!=false;
    } else {
      this.showLinkBrackets = this.settings.showLinkBrackets;
    }
    return showLinkBrackets != this.showLinkBrackets;
  }

}
