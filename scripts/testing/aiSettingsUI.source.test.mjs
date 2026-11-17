import assert from "node:assert/strict";
import test, { after } from "node:test";
import { sourceHarness } from "./sourceHarness.mjs";

const notices=[];
class Element {
  children=[]; controls=[]; visible=true;
  ownerDocument={addEventListener(){},removeEventListener(){}};
  empty(){this.children=[];this.controls=[];}
  createDiv(){const child=new Element();this.children.push(child);return child;}
  createEl(){return this.createDiv();}
  addEventListener(){} removeEventListener(){}
}
class Control {
  options={};inputEl={addEventListener(){}};
  addOption(key,value){this.options[key]=value;return this;}
  setValue(value){this.value=value;return this;}
  onChange(callback){this.change=callback;return this;}
  onClick(callback){this.click=callback;return this;}
  setPlaceholder(){return this;} setDisabled(value){this.disabled=value;return this;}
  setButtonText(){return this;} setCta(){return this;}
}
class Setting {
  constructor(container){this.settingEl=new Element();container.children.push(this.settingEl);container.controls.push(this);}
  setName(name){this.name=name;return this;} setDesc(){return this;}
  addDropdown(cb){this.dropdown=new Control();cb(this.dropdown);return this;}
  addText(cb){this.text=new Control();cb(this.text);return this;}
  addToggle(cb){this.toggle=new Control();cb(this.toggle);return this;}
  addButton(cb){cb(new Control());return this;}
}
class Modal {
  constructor(app){this.app=app;this.contentEl=new Element();this.containerEl=new Element();}
  close(){this.closed=true;}
}
const graph=sourceHarness({
  obsidian:{Setting,Modal,Notice:class{constructor(value){notices.push(value);}}},
  "src/lang/helpers":{t:key=>key},
  "src/utils/modifierkeyHelper":{isWinCTRLorMacCMD:()=>false},
  "src/utils/styleUtils":{hideElement:el=>{el.visible=false;},showElement:el=>{el.visible=true;}},
});
after(()=>graph.close());
const {AIModelConfigModal}=await graph.importModule("src/shared/Dialogs/AIModelConfigModal.ts");
const {AIProviderProfileModal}=await graph.importModule("src/shared/Dialogs/AIProviderProfileModal.ts");
const {renderAPIKeySettings}=await graph.importModule("src/shared/components/apiKeySettings.ts");
function find(root,name){for(const control of root.controls)if(control.name===name)return control;for(const child of root.children){const value=find(child,name);if(value)return value;}}

test("reasoning dropdown filters models, preserves edits across provider changes and blocks invalid saves",async()=>{
  const saves=[],modal=new AIModelConfigModal({},[],(...args)=>saves.push(args),{kind:"text",providerIds:["openai","google"],providerProfiles:{openai:{provider:"openai"},google:{provider:"google"}},initialModelId:"test",initialConfig:{providerId:"openai",model:"gpt-6.1-sol",reasoningEffort:"low",futureField:42}});
  modal.onOpen();
  let reasoning=find(modal.contentEl,"AI_REASONING_NAME");assert.deepEqual(Object.keys(reasoning.dropdown.options),["","low","medium","high","xhigh","max"]);
  find(modal.contentEl,"AI_MODEL_CONFIG_MODAL_PROVIDER_NAME").dropdown.change("google");assert.equal(find(modal.contentEl,"AI_REASONING_NAME"),undefined);
  find(modal.contentEl,"AI_MODEL_CONFIG_MODAL_PROVIDER_NAME").dropdown.change("openai");
  assert.equal(find(modal.contentEl,"AI_REASONING_NAME").dropdown.value,"low");
  find(modal.contentEl,"AI_MODEL_CONFIG_MODAL_MODEL_NAME").text.change("gpt-6.1-terra");
  reasoning=find(modal.contentEl,"AI_REASONING_NAME");assert.ok("none" in reasoning.dropdown.options);reasoning.dropdown.change("none");
  find(modal.contentEl,"AI_MODEL_CONFIG_MODAL_MODEL_NAME").text.change("gpt-6.1-sol");
  await modal.save();assert.equal(saves.length,0);assert.equal(notices.at(-1),"AI_REASONING_INVALID");
  find(modal.contentEl,"AI_REASONING_NAME").dropdown.change("");await modal.save();
  assert.equal(saves[0][1].reasoningEffort,undefined);assert.equal(saves[0][1].futureField,42);modal.onClose();
});
test("unknown model names offer only API default and image models do not gain a text control",()=>{
  for(const [kind,model] of [["text","custom"],["image","gpt-image-2.6-flare"]]){
    const modal=new AIModelConfigModal({},[],()=>{}, {kind,providerIds:["openai"],providerProfiles:{openai:{provider:"openai"}},initialConfig:{providerId:"openai",model}});
    modal.onOpen();const control=find(modal.contentEl,"AI_REASONING_NAME");
    if(kind==="text")assert.deepEqual(Object.keys(control.dropdown.options),[""]);else assert.equal(control,undefined);
    modal.onClose();
  }
});
test("credential source changes remove the synced key and store only the selected reference",()=>{
  const root=new Element(),config={apiKey:"fake-original"};let changes=0;
  renderAPIKeySettings({secretStorage:{listSecrets:()=>["fake-secret"]}},root,config,()=>changes++,{name:"key",description:"description"});
  find(root,"API_KEY_SOURCE_NAME").dropdown.change("secret");
  assert.equal(config.apiKey,"");assert.equal(find(root,"key").settingEl.visible,false);
  find(root,"API_KEY_SECRET_NAME").dropdown.change("fake-secret");assert.equal(config.apiKeySecret,"fake-secret");assert.equal(changes,2);
  find(root,"API_KEY_SOURCE_NAME").dropdown.change("settings");assert.equal(find(root,"key").settingEl.visible,true);
  assert.equal(find(root,"key").text.value,"");
});
test("old hosts keep manual keys usable and retain an unavailable stored secret choice",()=>{
  for(const source of ["settings","secret"]){const root=new Element(),config={apiKey:"manual",apiKeySource:source,apiKeySecret:"missing"};
    renderAPIKeySettings({},root,config,()=>{}, {name:"key",description:"description"});
    const dropdown=find(root,"API_KEY_SOURCE_NAME").dropdown;assert.equal("secret" in dropdown.options,source==="secret");
    assert.equal(find(root,"API_KEY_SECRET_NAME").dropdown.disabled,true);assert.equal(config.apiKeySource,source);
  }
});
test("profile edits preserve unknown fields and require a secret reference before saving",async()=>{
  const saved=[],modal=new AIProviderProfileModal({},[],(...args)=>saved.push(args),{initialProfileId:"profile",initialProfile:{provider:"openai",apiKey:"fake",baseURL:"custom",future:99}});
  modal.onOpen();find(modal.contentEl,"API_KEY_SOURCE_NAME").dropdown.change("secret");await modal.save();assert.equal(saved.length,0);assert.equal(notices.at(-1),"API_KEY_SECRET_SELECT");
  find(modal.contentEl,"API_KEY_SECRET_NAME").dropdown.change("selected");await modal.save();assert.equal(saved[0][1].future,99);assert.equal(saved[0][1].apiKey,"");modal.onClose();
});
