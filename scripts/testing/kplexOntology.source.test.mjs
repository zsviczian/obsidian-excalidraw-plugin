/** Whole production helpers: optional protocol refusal and HTML-only edits, without a matcher double. */
import assert from "node:assert/strict";
import test from "node:test";
import {sourceHarness} from "./sourceHarness.mjs";

async function fixture(t) {
  const prior=Object.getOwnPropertyDescriptor(globalThis,"window"),main={};
  globalThis.window=main;
  const graph=sourceHarness();
  t.after(()=>{graph.close();if(prior)Object.defineProperty(globalThis,"window",prior);else Reflect.deleteProperty(globalThis,"window");});
  const provider=await graph.importModule("src/shared/Suggesters/kplexOntologyProvider.ts");
  const edits=await graph.importModule("src/shared/Suggesters/ontologyLinkCompletion.ts");
  let calls=0;
  const result={ok:true,revision:{semantic:1,source:1,configuration:1},value:{state:"matched",context:{range:{start:1,end:4},trigger:":::",query:""},items:[{name:"Friend",partner:"Ally",description:"<b>literal</b>"}]}};
  const api={version:1,capabilities:()=>({ok:true,value:{operations:["completeOntology"]}}),completeOntology(request){calls++;assert.deepEqual(request,{text:"[:::]",cursor:4,limit:20});return result;}};
  const root={version:1,v1:api},owner={kplexApi:root};
  const input={value:"[:::]",selectionStart:4,selectionEnd:4,isConnected:true,ownerDocument:{defaultView:owner}};
  return {...provider,...edits,root,api,result,input,owner,main,calls:()=>calls};
}

test("optional completion reads only the public owning-window API and returns detached inert fields",async t=>{
  const h=await fixture(t),offer=h.readKplexOntologyCompletion(h.input);
  assert.equal(h.calls(),1);assert.equal(offer.provider,h.root);
  assert.deepEqual(offer.items,[{name:"Friend",partner:"Ally",description:"<b>literal</b>"}]);
  h.result.value.items[0].name="Changed";assert.equal(offer.items[0].name,"Friend");
  delete h.owner.kplexApi;h.main.kplexApi=h.root;assert(h.readKplexOntologyCompletion(h.input));
});

test("missing, incompatible and throwing optional providers never escape into editing",async t=>{
  const h=await fixture(t);
  for(const root of [undefined,{},[],{version:2,v1:h.api},{version:1,v1:{...h.api,version:2}},{version:1,v1:{version:1}},{version:1,v1:{...h.api,capabilities:()=>{throw Error("gone");}}},{version:1,v1:{...h.api,completeOntology:()=>{throw Error("gone");}}}]){
    h.owner.kplexApi=root;assert.equal(h.readKplexOntologyCompletion(h.input),null);
  }
});

test("bad ranges, oversized results and disabled/unavailable envelopes cannot become offers",async t=>{
  const h=await fixture(t),baseline=structuredClone(h.result);
  const changes=[
    result=>{result.ok=false;},result=>{result.revision.configuration=NaN;},result=>{result.value.state="disabled";},
    result=>{result.value.context.range.start=-1;},result=>{result.value.context.range.end=3;},
    result=>{result.value.context.trigger="@@";},result=>{result.value.context=null;},
    result=>{result.value.items=Array.from({length:21},()=>({name:"x"}));},
    result=>{result.value.items[0].name="";},result=>{result.value.items[0].partner={};},
    result=>{result.value.items[0].description="x".repeat(1048577);},
  ];
  for(const change of changes){Object.assign(h.result,structuredClone(baseline));change(h.result);assert.equal(h.readKplexOntologyCompletion(h.input),null);}
});

test("input bounds and noncollapsed or detached selections refuse before the optional call",async t=>{
  const h=await fixture(t);
  for(const change of [()=>{h.input.selectionEnd=3;},()=>{h.input.isConnected=false;},()=>{h.input.value="x".repeat(65537);}]){
    change();assert.equal(h.readKplexOntologyCompletion(h.input),null);h.input.selectionEnd=4;h.input.isConnected=true;h.input.value="[:::]";
  }
  for(const limit of [0,101,1.5])assert.equal(h.readKplexOntologyCompletion(h.input,limit),null);
  assert.equal(h.calls(),0);
});

test("selection fences provider, method, configuration and input while ignoring unrelated graph revisions",async t=>{
  const h=await fixture(t),offer=h.readKplexOntologyCompletion(h.input);
  h.result.revision.semantic++;h.result.revision.source++;assert(h.isKplexOntologyOfferCurrent(h.input,offer,"Friend"));
  h.result.revision.configuration++;assert.equal(h.isKplexOntologyOfferCurrent(h.input,offer,"Friend"),false);
  h.result.revision.configuration--;h.owner.kplexApi={...h.root};assert.equal(h.isKplexOntologyOfferCurrent(h.input,offer,"Friend"),false);
  h.owner.kplexApi=h.root;const method=h.api.completeOntology;h.api.completeOntology=function(request){return method.call(this,request);};assert.equal(h.isKplexOntologyOfferCurrent(h.input,offer,"Friend"),false);
  h.api.completeOntology=method;h.input.selectionStart=3;assert.equal(h.isKplexOntologyOfferCurrent(h.input,offer,"Friend"),false);
});

test("wrapper edits preserve suffixes and balanced closers with exact UTF-16 carets",async t=>{
  const h=await fixture(t);
  for(const [text,start,end,name,expected,caret]of [
    ["::: tail",0,3,"friend","friend:: tail",8],
    ["😀 (::: suffix",4,7,"PaRéNT","😀 (PaRéNT:: ) suffix",13],
    ["[::: [kept]] suffix",1,4,"Friend","[Friend::  [kept]] suffix",10],
    ["(::: (nested)) suffix",1,4,"Parent","(Parent::  (nested)) suffix",10],
  ]){const edit=h.ontologyLinkEdit(text,{start,end},name);assert.equal(edit.value,expected);assert.equal(edit.caret,caret);}
  for(const range of [{start:-1,end:3},{start:0,end:99},{start:2,end:1},{start:0.1,end:3}])assert.equal(h.ontologyLinkEdit(":::x",range,"Field"),null);
  assert.equal(h.ontologyLinkEdit(":::x",{start:0,end:3},""),null);
});
