import { nanoid } from "./constants";
import { measureText } from "./ExcalidrawAutomate";

const FIND_JSON:RegExp = /\n# Drawing\n(.*)/gm;
const FIND_ID:RegExp = /\s\^(.{8})\n/g;
const GAP_LEN:number = " ^12345678\n\n".length;
const TEXTELEMENTS_HEADER_LEN:number = "# Text Elements\n".length;

/**
 * 1.2 Migration only!!!!
 * Extracts the text elements from an Excalidraw scene into a string of ids as headers followed by the text contents
 * @param {string} data - Excalidraw scene JSON string
 * @returns {string} - Text starting with the "# Text Elements" header and followed by each "## id-value" and text
 */
 export function exportSceneToMD(data:string): string {
  if(!data) return "";
  const excalidrawData = JSON.parse(data);
  const textElements = excalidrawData.elements?.filter((el:any)=> el.type=="text")
  let outString = '# Text Elements\n';
  let id:string;
  for (const te of textElements) {
    id = te.id;
    //replacing Excalidraw text IDs with my own, because default IDs may contain 
    //characters not recognized by Obsidian block references
    //also Excalidraw IDs are inconveniently long
    if(te.id.length>8) {  
      id=nanoid();
      data = data.replaceAll(te.id,id); //brute force approach to replace all occurances.
    }
    outString += te.text+' ^'+id+'\n\n';
  }
  return outString + '# Drawing\n'+ data;
}


export function getJSON(data:string):string {
  const findJSON = /\n# Drawing\n(.*)/gm
  const res = data.matchAll(findJSON);
  const parts = res.next();
  if(parts.value && parts.value.length>1) {
    return parts.value[1];
  }
  return data;
}

export class ExcalidrawData {
  private textElements:Map<string,string> = null; 
  public scene:any = null;

  constructor() {
  }  

  /**
   * Loads a new drawing
   * @param {TFile} file - the MD file containing the Excalidraw drawing
   * @returns {boolean} - true if file was loaded, false if there was an error
   */
  public loadData(data: string):boolean {
    this.textElements = new Map<string,string>();
    
    //Read the JSON string after "# Drawing" and trim the tail of the string
    this.scene = null;
    let res = data.matchAll(FIND_JSON);
    let parts = res.next();
    if(!(parts.value && parts.value.length>1)) return false;    

    this.scene = JSON.parse(parts.value[1]);
    data = data.substring(0,parts.value.index);

    //Read the text elements into the textElements Map
    let position = data.search("# Text Elements");
    if(position==-1) return true; 
    position += TEXTELEMENTS_HEADER_LEN;

    res = data.matchAll(FIND_ID);
    while(!(parts = res.next()).done) {
      this.textElements.set(parts.value[1],data.substring(position,parts.value.index));
      position = parts.value.index + GAP_LEN;  
    }

    this.findNewTextElementsInScene();

    //get scene text elements
    const texts = this.scene.elements?.filter((el:any)=> el.type=="text")
    //update text in scene based on textElements Map
    for (const te of texts) {
      this.updateSceneTextElement(te,this.parse(this.textElements.get(te.id)));
    }
    return true;
  }

  /**
   * update a single text element in the scene if the newText is different
   * @param sceneTextElement 
   * @param newText 
   */
  private updateSceneTextElement(sceneTextElement:any, newText:string) {
    if(newText!=sceneTextElement.text) {
      const measure = measureText(newText,sceneTextElement.fontSize,sceneTextElement.fontFamily);
      sceneTextElement.text = newText;
      sceneTextElement.width = measure.w;
      sceneTextElement.height = measure.h;
      sceneTextElement.baseline = measure.baseline;
    }
  }

  /**
   * check for textElements in Scene missing from textElements Map
   * @returns {boolean} - true if there were changes
   */
  private findNewTextElementsInScene():boolean {
    let idList = [];
    //get scene text elements
    const texts = this.scene.elements?.filter((el:any)=> el.type=="text")

    let jsonString = JSON.stringify(this.scene);

    let dirty:boolean = false;
    let id:string;
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
        this.textElements.set(id,te.text)
        idList.push(id);
      }
    }
    if(dirty) { //reload scene json
      this.scene = JSON.parse(jsonString);
    }

    //parse text for newly added text and update scene accordingly
    //i.e. if [[link|alias]] was added, it should read just "alias"   
    idList.forEach((id)=>{
      const el = this.scene.elements?.filter((el:any)=> (el.type=="text" && el.id==id));
      this.updateSceneTextElement(el[0],this.parse(this.textElements.get(id)));
    });
    return dirty;
  }

  /**
   * update text element map by deleting entries that are no long in the scene
   * and updating the textElement map based on the text updated in the scene
   * @returns {boolean} - if scene changes return true;
   */
  private updateTextElementsFromScene():boolean {
    let dirty = false;
    let idList = [];
    for(const key of this.textElements.keys()){
      const el = this.scene.elements?.filter((el:any)=> el.type=="text" && el.id==key);
      if(el.length==0) {
        this.textElements.delete(key);
      } else {
        this.textElements.set(key,el[0].text);
        idList.push(key);
      }
    }

    //parse text for newly added text and update scene accordingly
    //i.e. if [[link|alias]] was added, it should read just "alias"   
    idList.forEach((id)=>{
      const el = this.scene.elements?.filter((el:any)=> el.type=="text" && el.id==id);
      if(el.length==0) return;
      this.updateSceneTextElement(el[0],this.parse(this.textElements.get(id)));
    });
    return dirty;
  }

  /**
   * Process aliases and block embeds
   * @param text 
   * @returns 
   */
  private parse(text:string):string{
    return text;
  }

  /**
   * Generate markdown file representation of excalidraw drawing
   * @returns markdown string
   */
  generateMD():string {
    let outString = '# Text Elements\n';
    for(const key of this.textElements.keys()){
      outString += this.textElements.get(key)+' ^'+key+'\n\n';
    }
    return outString + '# Drawing\n' + JSON.stringify(this.scene);
  }

  public updateScene(newScene:any){
    this.scene = JSON.parse(newScene);
    return this.findNewTextElementsInScene() || this.updateTextElementsFromScene();
  }

}