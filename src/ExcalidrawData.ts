import { App, normalizePath, TFile } from "obsidian";
import { 
  nanoid,
  FRONTMATTER_KEY_CUSTOM_PREFIX,
  FRONTMATTER_KEY_CUSTOM_LINK_BRACKETS,
  FRONTMATTER_KEY_CUSTOM_URL_PREFIX,
} from "./constants";
import { measureText } from "./ExcalidrawAutomate";
import ExcalidrawPlugin from "./main";
import {  
  JSON_parse
} from "./constants";
import { TextMode } from "./ExcalidrawView";
import { getAttachmentsFolderAndFilePath, getBinaryFileFromDataURL, isObsidianThemeDark, wrapText } from "./Utils";
import { ExcalidrawImageElement, ExcalidrawTextElement, FileId } from "@zsviczian/excalidraw/types/element/types";
import { BinaryFiles, SceneData } from "@zsviczian/excalidraw/types/types";

type SceneDataWithFiles = SceneData & { files: BinaryFiles};

declare module "obsidian" {
  interface MetadataCache {
    blockCache: {
      getForFile(x:any,f:TAbstractFile):any;
    }
  }
}

export const REGEX_LINK = {
  //![[link|alias]] [alias](link){num}
  //      1  2     3           4        5      6  7     8  9
  EXPR: /(!)?(\[\[([^|\]]+)\|?([^\]]+)?]]|\[([^\]]*)]\(([^)]*)\))(\{(\d+)\})?/g, //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/187
  getRes: (text:string):IterableIterator<RegExpMatchArray> => {
    return text.matchAll(REGEX_LINK.EXPR);
  },
  isTransclusion: (parts: IteratorResult<RegExpMatchArray, any>):boolean => {
    return parts.value[1] ? true:false;
  },
  getLink: (parts: IteratorResult<RegExpMatchArray, any>):string => {
    return parts.value[3] ? parts.value[3] : parts.value[6];
  },
  isWikiLink: (parts: IteratorResult<RegExpMatchArray, any>):boolean => {
    return parts.value[3] ? true:false;
  },
  getAliasOrLink: (parts: IteratorResult<RegExpMatchArray, any>):string => {
    return REGEX_LINK.isWikiLink(parts)
           ? (parts.value[4] ? parts.value[4] : parts.value[3]) 
           : (parts.value[5] ? parts.value[5] : parts.value[6]);
  },
  getWrapLength: (parts: IteratorResult<RegExpMatchArray, any>):number => {
    return parts.value[8];
  }
}


export const REG_LINKINDEX_HYPERLINK = /^\w+:\/\//;

const DRAWING_REG = /\n%%\n# Drawing\n[^`]*(```json\n)([\s\S]*?)```/gm; //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/182
const DRAWING_REG_FALLBACK = /\n# Drawing\n(```json\n)?(.*)(```)?(%%)?/gm;
export function getJSON(data:string):[string,number] {
  let res = data.matchAll(DRAWING_REG);

  //In case the user adds a text element with the contents "# Drawing\n"
  let parts;
  parts = res.next();
  if(parts.done) { //did not find a match
    res = data.matchAll(DRAWING_REG_FALLBACK);
    parts = res.next();
  }
  if(parts.value && parts.value.length>1) {
    const result = parts.value[2];
    return [result.substr(0,result.lastIndexOf("}")+1),parts.value.index]; //this is a workaround in case sync merges two files together and one version is still an old version without the ```codeblock
  }
  return [data,parts.value ? parts.value.index : 0];
}

//extracts SVG snapshot from Excalidraw Markdown string
const SVG_REG = /.*?```html\n([\s\S]*?)```/gm;
export function getSVGString(data:string):string {
  let res = data.matchAll(SVG_REG);

  let parts;
  parts = res.next();
  if(parts.value && parts.value.length>1) {
    return parts.value[1].replaceAll("\n","");
  }
  return null;
}

export function getMarkdownDrawingSection(jsonString: string,svgString: string) {
  return '%%\n# Drawing\n'
  + String.fromCharCode(96)+String.fromCharCode(96)+String.fromCharCode(96)+'json\n' 
  + jsonString + '\n'
  + String.fromCharCode(96)+String.fromCharCode(96)+String.fromCharCode(96)
  + (svgString ? //&& this.settings.saveSVGSnapshots
      '\n\n# SVG snapshot\n'
      + "==⚠ Remove all linebreaks from SVG string before use. Linebreaks were added to improve markdown view speed. ⚠==\n"
      + String.fromCharCode(96)+String.fromCharCode(96)+String.fromCharCode(96)+'html\n'
      + svgString + '\n'
      + String.fromCharCode(96)+String.fromCharCode(96)+String.fromCharCode(96) 
     : '') 
  + '\n%%';
}

export class ExcalidrawData {
  public svgSnapshot: string = null;
  private textElements:Map<string,{raw:string, parsed:string}> = null; 
  public scene:any = null;
  private file:TFile = null;
  private app:App;
  private showLinkBrackets: boolean;
  private linkPrefix: string;
  private urlPrefix: string;
  private textMode: TextMode = TextMode.raw;
  private plugin: ExcalidrawPlugin;
  public loaded: boolean = false;
  public files:Map<FileId,string> = null; //fileId, path
  public equations:Map<FileId,string> = null; //fileId, path
  private compatibilityMode:boolean = false;

  constructor(plugin: ExcalidrawPlugin) {
    this.plugin = plugin;
    this.app = plugin.app;
    this.files = new Map<FileId,string>();
    this.equations = new Map<FileId,string>();
  }  

  /**
   * Loads a new drawing
   * @param {TFile} file - the MD file containing the Excalidraw drawing
   * @returns {boolean} - true if file was loaded, false if there was an error
   */
  public async loadData(data: string,file: TFile, textMode:TextMode):Promise<boolean> {
    this.loaded = false;
    this.file = file;
    this.textElements = new Map<string,{raw:string, parsed:string}>();
    this.files.clear();
    this.equations.clear();
    this.compatibilityMode = false;

    //I am storing these because if the settings change while a drawing is open parsing will run into errors during save
    //The drawing will use these values until next drawing is loaded or this drawing is re-loaded
    this.setShowLinkBrackets();
    this.setLinkPrefix();  
    this.setUrlPrefix();
    
    this.scene = null;

    //In compatibility mode if the .excalidraw file was more recently updated than the .md file, then the .excalidraw file
    //should be loaded as the scene.
    //This feature is mostly likely only relevant to people who use Obsidian and Logseq on the same vault and edit .excalidraw
    //drawings in Logseq.
    if (this.plugin.settings.syncExcalidraw) {
      const excalfile = file.path.substring(0,file.path.lastIndexOf('.md')) + '.excalidraw';
      const f = this.app.vault.getAbstractFileByPath(excalfile);
      if(f && f instanceof TFile && f.stat.mtime>file.stat.mtime) { //the .excalidraw file is newer then the .md file
        const d = await this.app.vault.read(f);
        this.scene = JSON.parse(d);
      }
    }

    //Load scene: Read the JSON string after "# Drawing" 
    const [scene,pos] = getJSON(data);
    if (pos === -1) {
      return false; //JSON not found
    }
    if (!this.scene) {
      this.scene = JSON_parse(scene); //this is a workaround to address when files are mereged by sync and one version is still an old markdown without the codeblock ```
    }

    if(!this.scene.files) {
      this.scene.files = {}; //loading legacy scenes that do not yet have the files attribute.
    }

    if(this.plugin.settings.matchThemeAlways) {
      this.scene.appState.theme = isObsidianThemeDark() ? "dark" : "light";
    }

    this.svgSnapshot = getSVGString(data.substr(pos+scene.length));

    data = data.substring(0,pos);

    //The Markdown # Text Elements take priority over the JSON text elements. Assuming the scenario in which the link was updated due to filename changes
    //The .excalidraw JSON is modified to reflect the MD in case of difference
    //Read the text elements into the textElements Map
    let position = data.search(/(^%%\n)?# Text Elements\n/m);
    if(position==-1) {
      await this.setTextMode(textMode,false);  
      this.loaded = true;
      return true; //Text Elements header does not exist
    }
    position += data.match(/((^%%\n)?# Text Elements\n)/m)[0].length
    
    data = data.substring(position);
    position = 0;

    //iterating through all the text elements in .md
    //Text elements always contain the raw value
    const BLOCKREF_LEN:number = " ^12345678\n\n".length;
    let res = data.matchAll(/\s\^(.{8})[\n]+/g);
    let parts;
    while(!(parts = res.next()).done) {
      const text = data.substring(position,parts.value.index);
      const id:string = parts.value[1];
      this.textElements.set(id,{raw: text, parsed: await this.parse(text)});
      //this will set the rawText field of text elements imported from files before 1.3.14, and from other instances of Excalidraw
      const textEl = this.scene.elements.filter((el:any)=>el.id===id)[0];
      if(textEl && (!textEl.rawText || textEl.rawText === "")) textEl.rawText = text; 

      position = parts.value.index + BLOCKREF_LEN;  
    }


    data = data.substring(data.indexOf("# Embedded files\n")+"# Embedded files\n".length);
    //Load Embedded files
    const REG_FILEID_FILEPATH = /([\w\d]*):\s*\[\[([^\]]*)]]\n/gm;
    res = data.matchAll(REG_FILEID_FILEPATH);
    while(!(parts = res.next()).done) {
      this.files.set(parts.value[1] as FileId,parts.value[2]);
    }

    //Load Equations
    const REG_FILEID_EQUATION = /([\w\d]*):\s*\$\$(.*)(\$\$\s*\n)/gm;
    res = data.matchAll(REG_FILEID_EQUATION);
    while(!(parts = res.next()).done) {
      this.equations.set(parts.value[1] as FileId,parts.value[2]);
    }

    //Check to see if there are text elements in the JSON that were missed from the # Text Elements section
    //e.g. if the entire text elements section was deleted.
    this.findNewTextElementsInScene();
    await this.setTextMode(textMode,true);
    this.loaded = true;
    return true;
  }

  public async loadLegacyData(data: string,file: TFile):Promise<boolean> {
    this.compatibilityMode = true;
    this.file = file;
    this.textElements = new Map<string,{raw:string, parsed:string}>();
    this.setShowLinkBrackets();
    this.setLinkPrefix(); 
    this.setUrlPrefix();
    this.scene = JSON.parse(data);
    if(!this.scene.files) {
      this.scene.files = {}; //loading legacy scenes without the files element
    }
    if(this.plugin.settings.matchThemeAlways) {
      this.scene.appState.theme = isObsidianThemeDark() ? "dark" : "light";
    }
    this.files.clear();
    this.equations.clear();
    this.findNewTextElementsInScene();
    await this.setTextMode(TextMode.raw,true); //legacy files are always displayed in raw mode.
    return true;
  }

  public async setTextMode(textMode:TextMode,forceupdate:boolean=false) {
    this.textMode = textMode;
    await this.updateSceneTextElements(forceupdate);
  }

  //update a single text element in the scene if the newText is different
  public updateTextElement(sceneTextElement:any, newText:string, forceUpdate:boolean = false) {
    if(forceUpdate || newText!=sceneTextElement.text) {
      const measure = measureText(newText,sceneTextElement.fontSize,sceneTextElement.fontFamily);
      sceneTextElement.text = newText;
      sceneTextElement.width = measure.w;
      sceneTextElement.height = measure.h;
      sceneTextElement.baseline = measure.baseline;
    }
  }

  /**
   * Updates the TextElements in the Excalidraw scene based on textElements MAP in ExcalidrawData
   * Depending on textMode, TextElements will receive their raw or parsed values
   * @param forceupdate : will update text elements even if text contents has not changed, this will
   * correct sizing issues
   */
  private async updateSceneTextElements(forceupdate:boolean=false) {
    //update text in scene based on textElements Map
    //first get scene text elements
    const texts = this.scene.elements?.filter((el:any)=> el.type=="text")
    for (const te of texts) {
      this.updateTextElement(te,await this.getText(te.id),forceupdate); 
    }
  }

  private async getText(id:string):Promise<string> {
    if (this.textMode == TextMode.parsed) {
      if(!this.textElements.get(id).parsed) {
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
      if(te.id.length > 8 && this.textElements.has(te.id)) { //element was created with onBeforeTextSubmit
        const element = this.textElements.get(te.id);
        this.textElements.set(id,{raw: element.raw, parsed: element.parsed})
        this.textElements.delete(te.id); //delete the old ID from the Map
        dirty = true;
      } else if(!this.textElements.has(id)) {
        dirty = true;
        const raw = (te.rawText && te.rawText!==""?te.rawText:te.text); //this is for compatibility with drawings created before the rawText change on ExcalidrawTextElement
        this.textElements.set(id,{raw: raw, parsed: null});
        this.parseasync(id,raw);
      }
    }
    if(dirty) { //reload scene json in case it has changed
      this.scene = JSON.parse(jsonString);
    }

    return dirty;
  }

  /**
   * update text element map by deleting entries that are no long in the scene
   * and updating the textElement map based on the text updated in the scene
   */
  private async updateTextElementsFromScene() {
    for(const key of this.textElements.keys()){
      //find text element in the scene
      const el = this.scene.elements?.filter((el:any)=> el.type=="text" && el.id==key);
      if(el.length==0) {
        this.textElements.delete(key); //if no longer in the scene, delete the text element
      } else {
        const text = await this.getText(key); 
        if(text != el[0].text) {
          this.textElements.set(key,{raw: el[0].text,parsed: await this.parse(el[0].text)});
        }
      }
    }
  }

  private async parseasync(key:string, raw:string) {
    this.textElements.set(key,{raw:raw,parsed: await this.parse(raw)});
  }

  private parseLinks(text:string, position:number, parts:any):string {
    return text.substring(position,parts.value.index) + 
           (this.showLinkBrackets ? "[[" : "") +
           REGEX_LINK.getAliasOrLink(parts) +
           (this.showLinkBrackets ? "]]" : "");
  }

  /**
   * 
   * @param text 
   * @returns [string,number] - the transcluded text, and the line number for the location of the text
   */
  public async getTransclusion (text:string):Promise<[string,number]> {
    //file-name#^blockref
    //1         2 3
    const REG_FILE_BLOCKREF = /(.*)#(\^)?(.*)/g;
    const parts=text.matchAll(REG_FILE_BLOCKREF).next();
    if(!parts.done && !parts.value[1]) return [text,0]; //filename not found
    const filename = parts.done ? text : parts.value[1];
    const file = this.app.metadataCache.getFirstLinkpathDest(filename,this.file.path);
    if(!file || !(file instanceof TFile)) return [text,0];
    const contents = await this.app.vault.cachedRead(file);
    if(parts.done) { //no blockreference
      return([contents.substr(0,this.plugin.settings.pageTransclusionCharLimit),0]);
    }
    const isParagraphRef = parts.value[2] ? true : false; //does the reference contain a ^ character?
    const id = parts.value[3]; //the block ID or heading text
    const blocks = (await this.app.metadataCache.blockCache.getForFile({isCancelled: ()=>false},file)).blocks.filter((block:any)=>block.node.type!="comment");
    if(!blocks) return [text,0];
    if(isParagraphRef) {
      let para = blocks.filter((block:any)=>block.node.id == id)[0]?.node;
      if(!para) return [text,0];
      if(["blockquote","listItem"].includes(para.type)) para = para.children[0]; //blockquotes are special, they have one child, which has the paragraph
      const startPos = para.position.start.offset;
      const lineNum = para.position.start.line;
      const endPos = para.children[para.children.length-1]?.position.start.offset-1; //alternative: filter((c:any)=>c.type=="blockid")[0]
      return [contents.substr(startPos,endPos-startPos),lineNum]
    
    } else {
      const headings = blocks.filter((block:any)=>block.display.startsWith("#"));
      let startPos:number = null; 
      let lineNum:number = 0;
      let endPos:number = null;
      for(let i=0;i<headings.length;i++) {
        if(startPos && !endPos) {
          endPos = headings[i].node.position.start.offset-1;
          return [contents.substr(startPos,endPos-startPos),lineNum];
        }
        if(!startPos && headings[i].node.children[0]?.value == id) {
          startPos = headings[i].node.children[0]?.position.start.offset; //
          lineNum = headings[i].node.children[0]?.position.start.line; //
        }
      }
      if(startPos) return [contents.substr(startPos),lineNum];
      return [text,0];
    }
  }

  /**
   * Process aliases and block embeds
   * @param text 
   * @returns 
   */
  private async parse(text:string):Promise<string>{
    let outString = "";
    let position = 0;
    const res = REGEX_LINK.getRes(text);
    let linkIcon = false;
    let urlIcon = false;
    let parts;
    while(!(parts=res.next()).done) {
      if (REGEX_LINK.isTransclusion(parts)) { //transclusion //parts.value[1] || parts.value[4]
        const [contents,lineNum] = await this.getTransclusion(REGEX_LINK.getLink(parts));
        outString += text.substring(position,parts.value.index) + 
                     wrapText(contents,REGEX_LINK.getWrapLength(parts),this.plugin.settings.forceWrap);
      } else {
        const parsedLink = this.parseLinks(text,position,parts);
        if(parsedLink) {
          outString += parsedLink;
          if(!(urlIcon || linkIcon))
            if(REGEX_LINK.getLink(parts).match(REG_LINKINDEX_HYPERLINK)) urlIcon = true;  
            else linkIcon = true;
        }
      } 
      position = parts.value.index + parts.value[0].length;
    }
    outString += text.substring(position,text.length);
    if (linkIcon) {
      outString = this.linkPrefix + outString;
    }
    if (urlIcon) {
      outString = this.urlPrefix + outString;
    }

    return outString;
  }

  /**
   * Does a quick parse of the raw text. Returns the parsed string if raw text does not include a transclusion.
   * Return null if raw text includes a transclusion.
   * This is implemented in a separate function, because by nature resolving a transclusion is an asynchronious
   * activity. Quick parse gets the job done synchronously if possible.
   * @param text 
   */
  private quickParse(text:string):string {
    const hasTransclusion = (text:string):boolean => {
      const res = REGEX_LINK.getRes(text);
      let parts;
      while(!(parts=res.next()).done) {
        if (REGEX_LINK.isTransclusion(parts)) return true; 
      }
      return false;
    }
    if (hasTransclusion(text)) return null;

    let outString = "";
    let position = 0;
    const res = REGEX_LINK.getRes(text);
    let linkIcon = false;
    let urlIcon = false;
    let parts;
    while(!(parts=res.next()).done) {
      const parsedLink = this.parseLinks(text,position,parts);
      if(parsedLink) {
        outString += parsedLink;
        if(!(urlIcon || linkIcon))
          if(REGEX_LINK.getLink(parts).match(REG_LINKINDEX_HYPERLINK)) urlIcon = true;  
          else linkIcon = true;
      }
      position = parts.value.index + parts.value[0].length;
    }
    outString += text.substring(position,text.length);
    if (linkIcon) {
      outString = this.linkPrefix + outString;
    }
    if (urlIcon) {
      outString = this.urlPrefix + outString;
    }
    return outString;
  }


  /**
   * Generate markdown file representation of excalidraw drawing
   * @returns markdown string
   */
  generateMD():string {
    let outString = '# Text Elements\n';
    for(const key of this.textElements.keys()){
      outString += this.textElements.get(key).raw+' ^'+key+'\n\n';
    }

    outString += (this.equations.size>0 || this.files.size>0) ? '\n# Embedded files\n' : '';    
    if(this.equations.size>0) {      
      for(const key of this.equations.keys()) {
        outString += key +': $$'+this.equations.get(key) + '$$\n';
      }
    }
    if(this.files.size>0) {
      for(const key of this.files.keys()) {
        outString += key +': [['+this.files.get(key) + ']]\n';
      }
    }
    outString += (this.equations.size>0 || this.files.size>0) ? '\n' : '';


    const sceneJSONstring = JSON.stringify(this.scene,null,"\t"); 
    return outString + getMarkdownDrawingSection(sceneJSONstring,this.svgSnapshot);
  }

  private async syncFiles(scene:SceneDataWithFiles):Promise<boolean> {
    let dirty = false;

    //remove files and equations that no longer have a corresponding image element
    const fileIds = (scene.elements.filter((e)=>e.type==="image") as ExcalidrawImageElement[]).map((e)=>e.fileId);
    this.files.forEach((value,key)=>{
      if(!fileIds.contains(key)) {
        this.files.delete(key);
        dirty = true;
      }
    });

    this.equations.forEach((value,key)=>{
      if(!fileIds.contains(key)) {
        this.equations.delete(key);
        dirty = true;
      }
    });

    //check if there are any images that need to be processed in the new scene
    if(!scene.files || scene.files == {}) return false;
    
    for(const key of Object.keys(scene.files)) {
      if(!(this.files.has(key as FileId) || this.equations.has(key as FileId))) {
        dirty = true;
        let fname = "Pasted Image "+window.moment().format("YYYYMMDDHHmmss_SSS");
        switch(scene.files[key].mimeType) {
          case "image/png": fname += ".png"; break;
          case "image/jpeg": fname += ".jpg"; break;
          case "image/svg+xml": fname += ".svg"; break;
          case "image/gif": fname += ".gif"; break;
          default: fname += ".png"; 
        }
        const [folder,filepath] = await getAttachmentsFolderAndFilePath(this.app,this.file.path,fname);
        await this.app.vault.createBinary(filepath,getBinaryFileFromDataURL(scene.files[key].dataURL));
        this.files.set(key as FileId,filepath);
      }
    }    
    return dirty;
  }

  public async syncElements(newScene:any):Promise<boolean> {
    this.scene = newScene;
    let result = false;
    if(!this.compatibilityMode) {
      result = await this.syncFiles(newScene);
      this.scene.files = {};
    }
    result = result || this.setLinkPrefix() || this.setUrlPrefix() || this.setShowLinkBrackets();
    await this.updateTextElementsFromScene();
    return result || this.findNewTextElementsInScene();
  }

  public async updateScene(newScene:any){
    //console.log("Excalidraw.Data.updateScene()");
    this.scene = JSON_parse(newScene);
    const result = this.setLinkPrefix() || this.setUrlPrefix() || this.setShowLinkBrackets();
    await this.updateTextElementsFromScene();
    if(result || this.findNewTextElementsInScene()) {
      await this.updateSceneTextElements();
      return true;
    };
    return false;
  }

  public getRawText(id:string) {  
    return this.textElements.get(id)?.raw;
  }
  
  public getParsedText(id:string):string {
    return this.textElements.get(id)?.parsed;
  }

  public setTextElement(elementID:string, rawText:string, updateScene:Function):string {
    const parseResult = this.quickParse(rawText); //will return the parsed result if raw text does not include transclusion
    if(parseResult) { //No transclusion
      this.textElements.set(elementID,{raw: rawText,parsed: parseResult});
      return parseResult;
    }
    //transclusion needs to be resolved asynchornously
    this.parse(rawText).then((parsedText:string)=> {
      this.textElements.set(elementID,{raw: rawText,parsed: parsedText});
      if(parsedText) updateScene(parsedText);
    });
    return null;
  }

  public async addTextElement(elementID:string, rawText:string):Promise<string> {
    const parseResult = await this.parse(rawText);
    this.textElements.set(elementID,{raw: rawText,parsed: parseResult});
    return parseResult;
  }

  public deleteTextElement(id:string) {
    this.textElements.delete(id);
  }

  private setLinkPrefix():boolean {
    const linkPrefix = this.linkPrefix;
    const fileCache = this.app.metadataCache.getFileCache(this.file);
    if (fileCache?.frontmatter && fileCache.frontmatter[FRONTMATTER_KEY_CUSTOM_PREFIX]!=null) {
      this.linkPrefix=fileCache.frontmatter[FRONTMATTER_KEY_CUSTOM_PREFIX];
    } else {
      this.linkPrefix = this.plugin.settings.linkPrefix;
    }
    return linkPrefix != this.linkPrefix;
  }

  private setUrlPrefix():boolean {
    const urlPrefix = this.urlPrefix;
    const fileCache = this.app.metadataCache.getFileCache(this.file);
    if (fileCache?.frontmatter && fileCache.frontmatter[FRONTMATTER_KEY_CUSTOM_URL_PREFIX]!=null) {
      this.urlPrefix=fileCache.frontmatter[FRONTMATTER_KEY_CUSTOM_URL_PREFIX];
    } else {
      this.urlPrefix = this.plugin.settings.urlPrefix;
    }
    return urlPrefix != this.urlPrefix;
  }

  private setShowLinkBrackets():boolean {
    const showLinkBrackets = this.showLinkBrackets;
    const fileCache = this.app.metadataCache.getFileCache(this.file);
    if (fileCache?.frontmatter && fileCache.frontmatter[FRONTMATTER_KEY_CUSTOM_LINK_BRACKETS]!=null) {
      this.showLinkBrackets=fileCache.frontmatter[FRONTMATTER_KEY_CUSTOM_LINK_BRACKETS]!=false;
    } else {
      this.showLinkBrackets = this.plugin.settings.showLinkBrackets;
    }
    return showLinkBrackets != this.showLinkBrackets;
  }

}