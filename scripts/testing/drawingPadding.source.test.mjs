import assert from "node:assert/strict";
import test from "node:test";
import LZString from "lz-string";
import { sourceHarness } from "./sourceHarness.mjs";

const constants = { JSON_parse: value => JSON.parse(value.replaceAll("&#91;", "[")), MD_MARKDOWN_IMAGES: "Markdown Images" };
const graph = sourceHarness({
  "src/constants/constants": constants, "../constants/constants": constants,
  "../utils/sceneDataUtils": { compress() {}, compressAsync() {}, updateFrontmatterInString() {}, decompress: value => LZString.decompressFromBase64(value.replace(/\s/g, "")) },
  "../utils/obsidianUtils": { isObsidianThemeDark: false },
});
const { getDrawingPaddingMax } = await graph.importModule("src/utils/drawingPadding.ts");
const { readDrawingPreviewElements } = await graph.importModule("src/utils/drawingPreviewScene.ts");
test.after(() => graph.close());
const bounds = elements => ({ minX: Math.min(...elements.map(el => el.x)), minY: Math.min(...elements.map(el => el.y)),
  maxX: Math.max(...elements.map(el => el.x + el.width)), maxY: Math.max(...elements.map(el => el.y + el.height)) });
const rect = (id, x, y, width, height, extra = {}) => ({ id, type: "rectangle", x, y, width, height, ...extra });

test("area range covers off-center scene edges beyond 2000 and ignores deleted elements", () => {
  const elements = [rect("area",200,50,100,100),rect("left",-900,-500,20,20),rect("far",6000,4000,200,200),rect("deleted",1e9,1e9,1,1,{isDeleted:true})];
  assert.equal(getDrawingPaddingMax(elements,"Draw#^area=area,padding=0",bounds),6000);
  assert.equal(getDrawingPaddingMax(elements,"Draw#^area=area,padding=999",bounds),6000,"current padding must not affect the limit");
  assert.equal(getDrawingPaddingMax(elements,"Draw#^frame=area",bounds),100);
  assert.equal(getDrawingPaddingMax(elements,"Draw",bounds),100);
  assert.equal(getDrawingPaddingMax(elements,"Draw#^area=missing",bounds),100);
  const withText = [rect("box",-100,-100,400,300),rect("text",0,0,20,20,{type:"text",containerId:"box"}),rect("far",1000,0,10,10)];
  assert.equal(getDrawingPaddingMax(withText,"Draw#^area=text",bounds),810,"bound text uses the same container as the zero-padding crop");
});

test("padding geometry reads plain, compressed and legacy saved scenes without resolving embeds", async () => {
  const scene={elements:[rect("area",0,0,100,100),rect("saved-text",300,0,23,20,{type:"text",text:"Saved text"}),rect("deleted",999,0,1,1,{isDeleted:true})]};
  const json=JSON.stringify(scene), sources=[
    `# Text Elements\nA changed embedded note ^saved-text\n\n## Drawing\n\x60\x60\x60json\n${json}\n\x60\x60\x60\n`,
    `\n## Drawing\n\x60\x60\x60compressed-json\n${LZString.compressToBase64(json)}\n\x60\x60\x60\n`,json,
  ];
  let reads=0;
  for(let index=0;index<sources.length;index++){
    const vault={cachedRead:async()=>{reads++;return sources[index];}};
    const elements=await readDrawingPreviewElements(vault,{extension:index===2?"excalidraw":"md"});
    assert.equal(elements.length,2);assert.equal(elements[1].text,"Saved text");assert.equal(elements[1].width,23);
  }
  assert.equal(reads,3);
  await assert.rejects(readDrawingPreviewElements({cachedRead:async()=>'{"elements":null}'},{extension:"excalidraw"}));
});
