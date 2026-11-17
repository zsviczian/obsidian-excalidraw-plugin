/** Native settings and interactive Markdown regressions; no real API credentials. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInAppTask } from "./inAppTask.mjs";
import { behaviorEnvironment } from "./behaviorEnvironment.mjs";
import { behaviorInputDriver } from "./behaviorMatrix.mjs";
import { completeConsoleErrors } from "./debuggerSession.mjs";
import { settleBrowserDiagnostics, splitWindowErrors } from "./browserDiagnostics.mjs";

export const aiAndEmbedsCaseIds = ["main", "popout"].flatMap(context => [
  "native:markdown-embed-scroll-3055:" + context,
  "native:ai-settings-preservation:" + context,
]);

export async function runAIAndEmbedsScenario({ cli, drawingPath }) {
  const template = readFileSync(new URL("../../../tests/vault/Drawings/Uncompressed.excalidraw.md", import.meta.url), "utf8");
  const tests = [], consoleErrors = [], windowErrors = [];
  for (const context of ["main", "popout"]) {
    const execute = new Function(`return async function(c,path,context,template){
      const env=await (${behaviorEnvironment.toString()})(c,path,{id:context,input:'mouse'},template,${completeConsoleErrors.toString()},${settleBrowserDiagnostics.toString()});
      await (${exerciseAIAndEmbeds.toString()})(c,env);
      return {tests:c.tests,consoleErrors:c.externalConsoleErrors||[],windowErrors:env.windowErrors};
    }`)();
    const result = await runInAppTask({ cli, execute, args:[drawingPath,context,template], timeoutMs:300000, cleanupMs:60000,
      onRequest:behaviorInputDriver(cli), onProgress:phase=>{if(phase)process.stdout.write("AI/embeds: "+phase+"\n");},
    }).catch(error=>{error.evidence=[...tests,...(error.evidence||[])];throw error;});
    tests.push(...result.tests); consoleErrors.push(...result.consoleErrors); windowErrors.push(...result.windowErrors);
  }
  assert.equal(consoleErrors.length,0,"AI/embed scenarios emitted console errors");
  assert.equal(splitWindowErrors(windowErrors).unexpected.length,0,"AI/embed scenarios emitted window errors");
  return {id:"ai-and-embeds",status:"passed",tests,consoleErrors,windowErrors};
}

async function exerciseAIAndEmbeds(c,env) {
  const {p,doc,win,check,openDrawing,create,geometry} = env;
  const context=geometry().requested.id;
  await c.case("native:markdown-embed-scroll-3055:"+context,["P03","P05"],async()=>{
    const note=await create("scroll-note.md",Array.from({length:100},(_,i)=>"## Section "+i+"\n\nParagraph "+i+" with enough text to require scrolling.\n").join("\n"));
    const view=await openDrawing("scroll-drawing"), api=view.excalidrawAPI;
    p.settings.markdownNodeOneClickEditing=false;
    const variants=[];
    for(const locked of [true,false]) for(const viewMode of [false,true]) {
      api.updateScene({elements:[],appState:{viewModeEnabled:viewMode},captureUpdate:"NEVER"});
      const ea=p.ea.getAPI(view);
      let id;
      try {
        id=ea.addEmbeddable(0,0,500,300,undefined,note);
        ea.getElement(id).customData={mdProps:{useObsidianDefaults:true,lockedReadingMode:locked}};
        await ea.addElementsToView(false,true,true);
      } finally {ea.destroy();}
      const element=api.getSceneElements().find(el=>el.id===id);api.zoomToFit([element],1,0.1);
      let preview;
      await c.waitFor(()=>{
        preview=view.containerEl.querySelector('#embed-'+id+' .markdown-preview-view');
        return preview?.clientHeight>0&&preview.scrollHeight>preview.clientHeight+100;
      },"long embedded Markdown preview");
      api.updateScene({appState:{activeEmbeddable:{element,state:"active"}},captureUpdate:"NEVER"});
      await c.waitFor(()=>api.getAppState().activeEmbeddable?.state==="active","active reading embed");
      c.observations={locked,viewMode,overflow:win.getComputedStyle(preview).overflowY,html:preview.outerHTML.slice(0,700),ancestors:[]};
      for(let parent=preview.parentElement;parent&&parent!==doc.body;parent=parent.parentElement)c.observations.ancestors.push(parent.className);
      let x,y;
      await c.waitFor(()=>{
        const r=preview.getBoundingClientRect();x=r.left+r.width/2;y=r.top+r.height/2;
        return preview.contains(doc.elementFromPoint(x,y));
      },"active preview receives wheel input after React renders the mode change");
      const state={locked,viewMode,overflow:win.getComputedStyle(preview).overflowY,height:preview.clientHeight,scrollHeight:preview.scrollHeight,html:preview.parentElement.outerHTML.slice(0,700)};
      c.observations={...c.observations,scroll:state};
      await env.input("Input.dispatchMouseEvent",{type:"mouseMoved",x,y});
      await env.input("Input.dispatchMouseEvent",{type:"mouseWheel",x,y,deltaX:0,deltaY:180});
      await c.waitFor(()=>preview.scrollTop>0,"mouse wheel scrolls reading-mode Markdown");
      check(api.getAppState().activeEmbeddable?.state==="active","scroll deactivated the embed");
      variants.push({...state,scrollTop:preview.scrollTop});
      api.updateScene({appState:{activeEmbeddable:null},captureUpdate:"NEVER"});
    }
    return {variants,assertions:["trusted wheel scrolls locked and unlocked Markdown without entering edit mode","drawing view mode does not prevent embedded scrolling"]};
  });
  await c.case("native:ai-settings-preservation:"+context,["P01","P07"],async()=>{
    const profileId="Test AI source", modelId="Test reasoning model";
    const originalSecret=app.secretStorage?.getSecret;
    if(app.secretStorage) {
      app.secretStorage.getSecret=function(id){return id==="excalidraw-native-fake-key"?"fake-device-key":originalSecret.call(this,id);};
      c.defer(()=>{app.secretStorage.getSecret=originalSecret;});
    }
    p.settings.aiProviderProfiles[profileId]={provider:"openai",baseURL:"https://example.invalid/v1",apiKey:"fake-synced-key",apiKeySource:"secret",apiKeySecret:"excalidraw-native-fake-key",futureProfileProperty:17};
    p.settings.aiTextModelConfigs[modelId]={providerId:profileId,model:"gpt-6.1-sol",reasoningEffort:"low",multimodalSupport:true,futureModelProperty:false};
    p.settings.aiDefaultTextModel=modelId;p.settings.aiDefaultMultimodalModel=modelId;
    p.settings.taskboneAPIKeySource="secret";p.settings.taskboneAPIKeySecret="excalidraw-native-fake-key";p.settings.taskboneAPIkey="fake-ocr-key";
    p.settings.__behaviorFutureSetting={zero:0,flag:false};
    await p.saveSettings();
    const disk=await p.loadData();
    check(disk.aiProviderProfiles[profileId].apiKey===""&&disk.taskboneAPIkey==="","secret source retained a synced key");
    check(!JSON.stringify(disk).includes("fake-device-key"),"resolved secret leaked into settings");
    const snapshot=p.ea.getAISettings();check(snapshot.providerProfiles[profileId].hasApiKey===!!app.secretStorage,"secret availability is wrong");
    check(snapshot.textModels[modelId].reasoningEffort==="low","EA snapshot lost reasoning preference");
    check(!JSON.stringify(snapshot).includes("fake-device-key"),"EA exposed a key");
    if(context==="popout") {
      check(disk.aiTextModelConfigs[modelId].reasoningEffort==="low"&&disk.aiTextModelConfigs[modelId].futureModelProperty===false,"popout save lost model settings");
      check(disk.aiProviderProfiles[profileId].apiKeySecret==="excalidraw-native-fake-key"&&disk.aiProviderProfiles[profileId].futureProfileProperty===17,"popout save lost provider settings");
      check(disk.taskboneAPIKeySecret==="excalidraw-native-fake-key"&&disk.__behaviorFutureSetting.zero===0,"popout save lost OCR or unknown settings");
      return {assertions:["popout uses the shared credential source and reasoning snapshot","popout saves references and unknown settings without secret values"],reloadCoverage:"separate main-window case"};
    }
    const views=app.workspace.getLeavesOfType("excalidraw").map(leaf=>leaf.view);
    for(const view of views)if(view.excalidrawAPI&&view.isDirty())check((await view.saveWithOutcome()).status==="persisted","pre-reload save failed");
    await c.waitFor(()=>views.every(view=>!view.isSaveInProgress()&&!view.isSynchronizing),"pre-reload writes settle");
    await app.plugins.disablePlugin("obsidian-excalidraw-plugin");
    await c.waitFor(()=>views.every(view=>!view.excalidrawAPI),"old drawing roots unmount before reload");
    await app.plugins.enablePlugin("obsidian-excalidraw-plugin");
    let live;
    await c.waitForCleanup(()=>(live=app.plugins.plugins["obsidian-excalidraw-plugin"])!==p&&live?.isReady,"fresh plugin instance becomes ready");
    check(live!==p,"reload reused the plugin instance");
    check(live.settings.aiDefaultTextModel===modelId&&live.settings.aiDefaultMultimodalModel===modelId,"reload changed defaults");
    check(live.settings.aiTextModelConfigs[modelId].reasoningEffort==="low"&&live.settings.aiTextModelConfigs[modelId].futureModelProperty===false,"reload lost model settings");
    check(live.settings.aiProviderProfiles[profileId].apiKeySecret==="excalidraw-native-fake-key"&&live.settings.aiProviderProfiles[profileId].futureProfileProperty===17,"reload lost provider settings");
    check(live.settings.taskboneAPIKeySource==="secret"&&live.settings.taskboneAPIKeySecret==="excalidraw-native-fake-key","reload lost OCR source");
    check(live.settings.__behaviorFutureSetting.zero===0&&live.settings.__behaviorFutureSetting.flag===false,"reload lost unknown keys");
    return {assertions:["secret references and reasoning effort survive real plugin unload/reload","synced settings contain neither secret values nor discarded manual keys","unknown profile, model and settings keys survive"]};
  });
}
