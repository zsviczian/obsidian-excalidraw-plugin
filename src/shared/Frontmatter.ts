// alternative https://github.com/OPD-libs/OPD-libs

export default class FrontmatterEditor {
  private frontmatterStr:string;
  private dataWOfrontmatter: string;
  private initialized:boolean = false;

  constructor (data:string) {
    this.dataWOfrontmatter = data;

    data = data.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
    const tmp = data.split(/^---(?:.|\n)*(?:^---\n)/gm);
    if(tmp.length!==2) return;
    this.dataWOfrontmatter = tmp[1];
    this.frontmatterStr = data.match(/^---((?:.|\n)*)(?:^---\n)/gm)[0].replaceAll(/(^---\n|^\n)/gm,"").trim()+"\n";
    this.initialized = true;
  }
  
  public hasKey(key:string):boolean {
    if(!this.initialized) return false;
    const reg = new RegExp(`^${key}:`,"gm");
    return Boolean(this.frontmatterStr.match(reg));
  }

  public setKey(key:string, value:string) {
    if(!this.initialized) return;
    value = value.replaceAll("\r\n", "\n").replaceAll("\r", "\n").replaceAll(":",";").trim().split("\n").join(" ");
    if(this.hasKey(key)) {
      const reg = new RegExp(`^${key}:.*\\n(?:\\s\\s.*\\n)*`,"gm");
      this.frontmatterStr = 
        this.frontmatterStr.split(reg).join("\n").trim() +
        `\n${key}: ${value}`;
      return;
    }
    this.frontmatterStr = this.frontmatterStr.trim()+`\n${key}: ${value}`;
  }

  get data() {
    if(!this.initialized) return this.dataWOfrontmatter;
    return ["---",this.frontmatterStr,"---",this.dataWOfrontmatter].join("\n");
  }
}