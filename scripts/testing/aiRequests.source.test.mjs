import assert from "node:assert/strict";
import test, { after } from "node:test";
import { sourceHarness } from "./sourceHarness.mjs";

const requests = [];
let providerResponse = { choices: [{message: {content: "```mermaid\ngraph TD; A-->B\n```"}, finish_reason: "stop"}], usage: {prompt_tokens: 12, completion_tokens: 20} };
const graph = sourceHarness({
  obsidian: {
    Notice: class {},
    arrayBufferToBase64: value => Buffer.from(value).toString("base64"),
    base64ToArrayBuffer: value => Uint8Array.from(Buffer.from(value,"base64")).buffer,
    requestUrl: async request => {
      requests.push(request);
      return {status:200,headers:{},json:providerResponse,text:JSON.stringify(providerResponse),arrayBuffer:new ArrayBuffer(0)};
    },
  },
  "./obsidianUtils": {strictArrayBuffer: value => value.buffer ?? value},
  "./debugHelper": {log: () => {}},
  "src/lang/helpers": {t: key => key},
});
after(() => graph.close());
const ai = await graph.importModule(process.env.AI_BASELINE_MODULE || "src/utils/AIUtils.ts");
const {encryptPersistedAPIKeys, decryptPersistedAPIKeys} = await graph.importModule("src/utils/settingsKeyObfuscation.ts");
const {resolveStoredAPIKey} = await graph.importModule("src/utils/apiKeyStorage.ts");
function plugin(provider = "openai", model = "gpt-6.1-sol", extra = {}) {
  return {app: {secretStorage: {getSecret: id => id === "test-secret" ? "fake-device-key" : null}}, settings: {
    aiEnabled:true, aiProviderProfiles:{profile:{provider,apiKey:"fake-manual-key",baseURL:"https://example.invalid/v1"}},
    aiTextModelConfigs:{text:{providerId:"profile",model,multimodalSupport:true,...extra}},
    aiImageModelConfigs:{image:{providerId:"profile",model:"gpt-image-2.6-flare",supportedSizes:["1024x1024"],supportsPromptImageTransforms:true,supportsMaskImageEdits:true}},
    aiDefaultTextModel:"text",aiDefaultMultimodalModel:"text",aiDefaultImageGenerationModel:"image",aiDefaultMaxResponseTokens:4096,aiDefaultMaxOutgoingTokens:0,
  }};
}
test("OpenAI text and multimodal requests inherit configured reasoning and use completion token limits", async () => {
  for(const image of [undefined,{dataURL:"data:image/png;base64,AA=="}]) {
    requests.length=0;
    const result = await ai.generateAIText({text:"Convert sketch to Mermaid",image,temperature:0.7}, {plugin:plugin("openai","gpt-6.1-sol",{reasoningEffort:"low"})});
    assert.equal(result.response.status,200);assert.match(result.content,/mermaid/);
    const body=JSON.parse(requests.at(-1).body);
    assert.equal(body.reasoning_effort,"low");assert.equal(body.max_completion_tokens,4096);
    assert.equal("max_tokens" in body,false);assert.equal("temperature" in body,false);
    assert.equal(Array.isArray(body.messages.at(-1).content),Boolean(image));
  }
});
test("Default omits effort; explicit none permits sampling; null resets a model preference", async () => {
  for(const [config,override,expected,sampling] of [
    [{}, {}, undefined,false], [{reasoningEffort:"low"},{reasoningEffort:null},undefined,false],
    [{},{reasoningEffort:"none"},"none",true],
  ]) {
    requests.length=0;
    await ai.generateAIText({text:"Hello",temperature:0.5,...override},{plugin:plugin("openai","gpt-6.1-terra",config)});
    const body=JSON.parse(requests.at(-1).body);
    assert.equal(body.reasoning_effort,expected);assert.equal("temperature" in body,sampling);
  }
});
test("unsupported efforts fail before transport and a raw model override cannot inherit another model's effort", async () => {
  requests.length=0;
  const result=await ai.generateAIText({text:"Hello"},{plugin:plugin("openai","gpt-6.1-sol",{reasoningEffort:"none"})});
  assert.equal(result.response.status,400);assert.equal(requests.length,0);
  await ai.generateAIText({text:"Hello",model:"gpt-4o"},{plugin:plugin("openai","gpt-6.1-sol",{reasoningEffort:"low"})});
  assert.equal("reasoning_effort" in JSON.parse(requests.at(-1).body),false);
});
test("all provider text pipelines normalize responses without OpenAI reasoning fields leaking", async () => {
  for(const [provider,model,json] of [
    ["anthropic","claude-sonnet-5-5",{content:[{type:"text",text:"done"}],usage:{input_tokens:2,output_tokens:3}}],
    ["google","gemini-3.8-flash",{candidates:[{content:{parts:[{text:"done"}]}}]}],
    ["xai","grok-4.7",{choices:[{message:{content:"done"}}]}],
    ["openai-compatible","custom-model",{choices:[{message:{content:"done"}}]}],
  ]) {
    providerResponse=json;requests.length=0;
    const result=await ai.generateAIText({text:"Hi",reasoningEffort:"low"},{plugin:plugin(provider,model,{reasoningEffort:"high"})});
    assert.equal(result.content,"done",provider);
    assert.equal("reasoning_effort" in JSON.parse(requests.at(-1).body),false,provider);
  }
});
test("keys are resolved live; a missing secret never falls back or sends a request; snapshots reveal no keys", async () => {
  const p=plugin();Object.assign(p.settings.aiProviderProfiles.profile,{apiKeySource:"secret",apiKeySecret:"test-secret"});
  providerResponse={choices:[{message:{content:"done"}}]};requests.length=0;
  await ai.generateAIText({text:"Hi"},{plugin:p});
  assert.equal(requests.at(-1).headers.Authorization,"Bearer fake-device-key");
  assert.equal(p.settings.aiProviderProfiles.profile.apiKey,"fake-manual-key");
  const snapshot=ai.getAISettings(p);assert.equal(snapshot.providerProfiles.profile.hasApiKey,true);
  assert.doesNotMatch(JSON.stringify(snapshot),/fake-device-key|fake-manual-key|test-secret/);
  p.app.secretStorage.getSecret=()=>null;requests.length=0;
  const result=await ai.generateAIText({text:"Hi"},{plugin:p});assert.equal(result.response.status,401);assert.equal(requests.length,0);
  assert.equal(ai.getAISettings(p).providerProfiles.profile.hasApiKey,false);
  assert.equal(resolveStoredAPIKey({},p.settings.aiProviderProfiles.profile),"");
});
test("persisted secret references contain no key values while manual keys round-trip obfuscated", () => {
  const settings={future:{unknown:0},aiProviderProfiles:{manual:{provider:"openai",apiKey:"fake-manual",baseURL:"custom"},secret:{provider:"openai",apiKey:"must-remove",baseURL:"custom",apiKeySource:"secret",apiKeySecret:"test-secret"}},taskboneAPIkey:"must-remove-too",taskboneAPIKeySource:"secret",taskboneAPIKeySecret:"ocr-secret"};
  const disk=encryptPersistedAPIKeys(settings);
  assert.match(disk.aiProviderProfiles.manual.apiKey,/^ex-obf:v1:/);assert.equal(disk.aiProviderProfiles.secret.apiKey,"");assert.equal(disk.taskboneAPIkey,"");
  assert.equal(disk.aiProviderProfiles.secret.apiKeySecret,"test-secret");assert.deepEqual(disk.future,{unknown:0});
  assert.equal(decryptPersistedAPIKeys(disk).aiProviderProfiles.manual.apiKey,"fake-manual");
  assert.equal(settings.aiProviderProfiles.secret.apiKey,"must-remove");
});

test("current image providers generate and edit through their actual payload and response adapters",async()=>{
  const dataURL="data:image/png;base64,AA==";
  for(const [provider,model,json] of [
    ["openai","gpt-image-2.6-flare",{data:[{b64_json:"AA=="}]}],
    ["openai","gpt-image-2.6-sunburst",{data:[{b64_json:"AA=="}]}],
    ["google","gemini-3.1-flash-image",{candidates:[{content:{parts:[{inlineData:{mimeType:"image/png",data:"AA=="}}]}}]}],
    ["google","gemini-3.1-flash-lite-image",{candidates:[{content:{parts:[{inlineData:{mimeType:"image/png",data:"AA=="}}]}}]}],
    ["google","gemini-3-pro-image",{candidates:[{content:{parts:[{inlineData:{mimeType:"image/png",data:"AA=="}}]}}]}],
    ["xai","grok-imagine-image-2.0",{data:[{url:"https://example.invalid/output.png"}]}],
  ]) {
    providerResponse=json;
    const p=plugin(provider);p.settings.aiImageModelConfigs.image.model=model;
    p.settings.aiImageModelConfigs.image.supportsMaskImageEdits=provider==="openai";
    for(const editing of [false,true]){
      requests.length=0;
      const result=await (editing?ai.transformAIImage:ai.generateAIImage)({text:"A blue rectangle",...(editing?{image:dataURL}:{}),imageGenerationProperties:{size:"1024x1024",n:1}},{plugin:p});
      assert.equal(result.response.status,200,model);assert.equal(result.images.length,1,model);assert.ok(result.firstImage.dataURL||result.firstImage.url,model);
      const request=requests.at(-1);
      if(provider==="google"){
        const body=JSON.parse(request.body);assert.ok(body.contents);assert.equal(body.generationConfig.imageConfig.aspectRatio,"1:1");
        assert.equal(body.generationConfig.imageConfig.imageSize,"1K");
      }else if(provider==="xai"){
        const body=JSON.parse(request.body);assert.equal(body.aspect_ratio,"1:1");assert.equal("size" in body,false);assert.equal(Boolean(body.image),editing);
      }else if(editing){
        assert.match(request.url,/images\/edits$/);assert.match(request.contentType,/multipart\/form-data/);
      }else{
        const body=JSON.parse(request.body);assert.equal(body.model,model);assert.equal(body.size,"1024x1024");assert.equal("response_format" in body,false);
      }
    }
    if(provider==="openai"){
      requests.length=0;const result=await ai.maskEditAIImage({text:"Change color",image:dataURL,imageGenerationProperties:{size:"1024x1024",mask:dataURL}},{plugin:p});
      assert.equal(result.response.status,200);const body=new TextDecoder().decode(requests.at(-1).body);assert.match(body,/name="mask"/);assert.match(body,/name="image"/);
    }
  }
});
