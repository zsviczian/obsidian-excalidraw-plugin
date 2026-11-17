import assert from "node:assert/strict";
import test,{after} from "node:test";
import {sourceHarness} from "./sourceHarness.mjs";
const requests=[],notices=[];
const graph=sourceHarness({
  obsidian:{Notice:class{constructor(value){notices.push(value);}},requestUrl:async request=>{requests.push(request);return {status:200,json:{records:[{text:"recognized"}]}};}},
  "src/lang/helpers":{t:key=>key},"src/shared/Frontmatter":{default:class{}},"../EmbeddedFileLoader":{EmbeddedFilesLoader:class{}},
  "src/utils/fileUtils":{blobToBase64:async()=>"fake-image"},"src/core":{getEA:()=>{}},"src/utils/debugHelper":{log:()=>{}},
});
after(()=>graph.close());
const {default:Taskbone}=await graph.importModule("src/shared/OCR/Taskbone.ts");
test("Taskbone resolves selected secrets for OCR and does not create or sync replacement keys",async()=>{
  requests.length=0;let secret="fake-ocr-secret";
  const plugin={app:{secretStorage:{getSecret:()=>secret}},settings:{taskboneAPIkey:"fake-stale",taskboneAPIKeySource:"secret",taskboneAPIKeySecret:"ocr"}};
  const taskbone=new Taskbone(plugin);
  await taskbone.initialize();assert.equal(requests.length,0);
  assert.equal(await taskbone.getTextForImage(new Blob()),"recognized");assert.equal(requests[0].headers.authorization,"Bearer fake-ocr-secret");
  secret="rotated";assert.equal(taskbone.apiKey,"rotated");assert.equal(plugin.settings.taskboneAPIkey,"fake-stale");
  secret=null;requests.length=0;assert.equal(await taskbone.getTextForImage(new Blob()),undefined);assert.equal(requests.length,0);assert.equal(notices.at(-1),"API_KEY_MISSING");
  taskbone.destroy();
});
