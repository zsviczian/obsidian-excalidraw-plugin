/** Combined fresh-build coverage through the real element-link and Markdown editors. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInAppTask } from "./inAppTask.mjs";
import { behaviorEnvironment } from "./behaviorEnvironment.mjs";
import { behaviorInputDriver } from "./behaviorMatrix.mjs";
import { completeConsoleErrors } from "./debuggerSession.mjs";
import { settleBrowserDiagnostics, splitWindowErrors } from "./browserDiagnostics.mjs";

const casesFor = ids => ids.flatMap(id => [
  "native:kplex-ontology-passive:" + id,
  "native:kplex-ontology-links:" + id,
  "native:kplex-ontology-configuration:" + id,
  "native:kplex-ontology-provider:" + id,
  "native:kplex-ontology-markdown:" + id,
]);
export const kplexOntologyCaseIds = casesFor(["main", "popout"]);
export const kplexOntologyDeviceCaseIds = casesFor(["phone", "tablet"]);

/** The caller owns staging, hashes, the shared application lock and outer error capture. */
export async function runKplexOntologyScenario({ cli, drawingPath, contexts=["main", "popout"], inputMode="mouse", viewportScale=1 }) {
  const template = readFileSync(new URL("../../../tests/vault/Drawings/Uncompressed.excalidraw.md", import.meta.url), "utf8");
  const tests = [], consoleErrors = [], windowErrors = [], browserIdle = [];
  for (const id of contexts) {
    const execute = new Function(`return async function(c,path,context,template,modifier){
      const env=await (${behaviorEnvironment.toString()})(c,path,context,template,${completeConsoleErrors.toString()},${settleBrowserDiagnostics.toString()});
      const runCase=c.case.bind(c);c.case=async (...args)=>{c.phase=args[0];return runCase(...args);};
      try { await (${exerciseKplexOntology.toString()})(c,env,modifier); }
      catch(error){c.observations={...c.observations,diagnostics:env.diagnostics()};throw error;}
      return {tests:c.tests,consoleErrors:c.externalConsoleErrors||[],windowErrors:env.windowErrors,browserIdle:env.browserIdle};
    }`)();
    const result = await runInAppTask({cli, execute,
      args: [drawingPath, {id, input:inputMode}, template, process.platform === "darwin" ? 4 : 2],
      timeoutMs: 300000, cleanupMs: 60000, onRequest: request => {
        if (request.method !== "kplex-lifecycle") return behaviorInputDriver(cli,viewportScale)(request);
        assert.ok(["disable","enable"].includes(request.params.command),"Bounded companion lifecycle command required");
        cli("plugin:" + request.params.command,"id=k-plex");return {completed:true};
      },
      onProgress: phase => process.stdout.write("ontology " + id + ": " + phase + "\n"),
    }).catch(error => {error.evidence = [...tests, ...(error.evidence || [])]; throw error;});
    tests.push(...result.tests); consoleErrors.push(...result.consoleErrors);
    windowErrors.push(...result.windowErrors); browserIdle.push(...result.browserIdle);
  }
  assert.equal(consoleErrors.length, 0, "Ontology emitted console errors");
  assert.equal(splitWindowErrors(windowErrors).unexpected.length, 0, "Ontology emitted window errors");
  assert.ok(browserIdle.every(result => result.status === "passed"), "Ontology did not settle");
  return {id:"kplex-ontology", status:"passed", tests, consoleErrors, windowErrors, browserIdle};
}

/** Trusted input and actual React submission/persistence, with test-owned settings restoration. */
async function exerciseKplexOntology(c, env, modifier) {
  const {p,doc,win,check,openDrawing,saveReopen,key,input,click,geometry,create,leaf} = env;
  let host = app.plugins.plugins["k-plex"];
  check(host && window.kplexApi?.v1?.completeOntology, "Combined K-Plex completion build unavailable");
  const settings = structuredClone(host.settings);
  c.defer(async () => {
    if (!app.plugins.plugins["k-plex"]) await app.plugins.enablePlugin("k-plex");
    const current=app.plugins.plugins["k-plex"];check(current,"Companion did not return during cleanup");
    Object.assign(current.settings, settings);await current.saveSettings(false,false);
  });
  const type = text => input("Input.insertText", {text});
  let view, elementId;
  const current = () => view.excalidrawAPI.getSceneElements().find(e => e.id === elementId);
  const popup = () => doc.querySelector(".excalidraw-hyperlinkContainer-input");
  const rows = () => [...doc.querySelectorAll(".excalidraw-ontology-suggestion")];
  const open = async text => {
    view.excalidrawAPI.updateScene({appState:{selectedElementIds:{[elementId]:true}}});
    view.containerEl.querySelector(".excalidraw").focus();
    await key("k","KeyK",75,modifier);
    let field;
    await c.waitFor(() => field = popup(), "actual element-link input");
    await click(popup); field = popup(); await key("a","KeyA",65,modifier); await type(text);
    c.observations = {context:geometry().requested.id, value:field.value,caret:field.selectionStart};
    return field;
  };
  const choose = async (field,name,method="click") => {
    let row;
    await c.waitFor(() => row = rows().find(row => row.querySelector(".suggestion-title")?.textContent === name || row.firstElementChild?.textContent === name), "ontology row " + name);
    check(!row.querySelector("b"), "Ontology annotation became markup");
    if (method === "click") await click(row);
    else {
      for (let step=0;step<rows().length && !row.classList.contains("is-selected");step++) await key("ArrowDown","ArrowDown",40);
      check(row.classList.contains("is-selected"),"Keyboard navigation did not select the intended field");
      await key(method,method,method === "Enter" ? 13 : 9);
      check(popup() === field,"Ontology selection submitted the link editor");
    }
    return field;
  };
  const close = async () => {await key("Escape","Escape",27);await c.waitFor(() => !popup(), "link editor closes");};
  await c.case("native:kplex-ontology-passive:" + geometry().requested.id,["P04","P11"],async () => {
    const restore=[],calls=[];
    const forbid=(owner,name)=>{
      if(typeof owner?.[name]!=="function")return;
      const previous=Object.getOwnPropertyDescriptor(owner,name);
      Object.defineProperty(owner,name,{configurable:true,writable:true,value:()=>{calls.push(name);throw Error("Completion acquired forbidden capability: "+name);}});
      restore.push(()=>{if(previous)Object.defineProperty(owner,name,previous);else Reflect.deleteProperty(owner,name);});
    };
    try {
      for(const name of ["read","cachedRead","readBinary","getFiles","getMarkdownFiles","modify","create"])forbid(app.vault,name);
      for(const name of ["read","readBinary","list","write","writeBinary"])forbid(app.vault.adapter,name);
      for(const name of ["saveData","saveSettings"])forbid(host,name);
      for(const owner of new Set([window,win]))for(const name of ["fetch","setTimeout","setInterval"])forbid(owner,name);
      const index=host.index;
      for(const name of new Set([...Object.getOwnPropertyNames(index),...Object.getOwnPropertyNames(Object.getPrototypeOf(index))])) {
        if(name!=="constructor"&&name!=="getSemanticRevision")forbid(index,name);
      }
      for(const text of [":::friend","::ppar","::c","::f","::r","::s","::n","Prose (:::parent) suffix"]){
        const cursor=text.includes(")")?text.indexOf(")"):text.length,result=window.kplexApi.v1.completeOntology({text,cursor});
        check(result.ok && result.coverage.scope === "configuration" && result.coverage.complete,"Settings-only native completion acquired another owner");
      }
      check(calls.length===0,"Completion performed forbidden work: "+calls.join(","));
    } finally {for(const reset of restore.reverse())reset();}
    return {assertions:["real loaded API with all roles and inline prefix","no graph/index work, Markdown reads, vault enumeration, writes, timers or fetch during synchronous completion"]};
  });
  await c.case("native:kplex-ontology-links:" + geometry().requested.id,["P02","P04"],async () => {
    view = await openDrawing("ontology-links");
    const ea = p.ea.getAPI(view);
    try {ea.reset();elementId = ea.addRect(0,0,220,100);await ea.addElementsToView(false,true,true);}
    finally {ea.destroy();}
    view.excalidrawAPI.zoomToFit([current()],1,0.1);
    const variants = [
      [":::","friend","friend::",8],
      ["::p","parent","parent::",8],
      ["(:::","parent","(parent:: )",10],
      ["(::p)","parent","(parent:: )",10,4],
      ["[:::","friend","[friend:: ]",10],
      ["[:::]","friend","[friend:: ]",10,4],
      [":::par","Parent Exact","Parent Exact::",14],
    ];
    for (const [index,[source,name,expected,caret,cursor]] of variants.entries()) {
      const field = await open(source);
      if (cursor !== undefined) {field.setSelectionRange(cursor,cursor);field.dispatchEvent(new win.Event("input",{bubbles:true}));}
      await choose(field,name,index === 1 ? "Enter" : index === 2 ? "Tab" : "click");
      check(field.value === expected && field.selectionStart === caret && field.selectionEnd === caret,"Ontology replacement/caret mismatch: " + JSON.stringify({source,value:field.value,caret:field.selectionStart,expected}));
      if (index === 1) {
        await key("z","KeyZ",90,modifier);await c.waitFor(() => field.value === source,"native input Undo restores the trigger");
        await key("z","KeyZ",90,modifier|8);await c.waitFor(() => field.value === expected,"native input Redo restores completion");
      }
      await close();
      check(current().link === expected,"React element-link submission ignored completed value");
    }
    const note = await create("Note [draft].md","Ontology completion target.");
    for (const opener of ["(","["]) {
      const field = await open(opener + ":::"), closer = opener === "(" ? ")" : "]";
      await choose(field,"parent");
      await type("[[Note [draft]");
      let row;
      await c.waitFor(() => row = [...doc.querySelectorAll(".suggestion-item")].find(row => row.textContent.includes("Note [draft]")), "existing bracket-filename note completion");
      await click(row);
      check(field.value.includes("[[" + note.basename + "]]"), "Existing note completion was not preserved");
      check(field.value.endsWith(closer),"Ontology wrapper closer was lost");
      const expected = field.value;
      await close();
      check(current().link === expected,"Element link differs after note completion");
      view = await saveReopen(view);
      check(current().link === expected,"Completed element link differs after physical save/reopen");
    }
    return {assertions:["seven actual link replacements and collapsed carets","click, Enter, Tab and keyboard navigation","native input Undo/Redo","bracket-filename note continuation in both wrappers","actual React submission and physical save/reopen"]};
  });
  await c.case("native:kplex-ontology-configuration:" + geometry().requested.id,["P04","P06","P11"],async () => {
    const field = await open("::p");
    await c.waitFor(() => rows().length, "initial live ontology rows");
    host.settings.ontologySuggesterParentTrigger = "@@";
    await host.saveSettings(false,false);
    const stale = rows().find(row => row.textContent.includes("parent"));
    check(stale,"Missing captured stale row");
    await click(stale);
    check(field.value === "::p","Stale configuration selection mutated input");
    await key("a","KeyA",65,modifier);await type("@@");
    await choose(field,"parent");check(field.value === "parent::","Custom live trigger was ignored");
    await close();
    host.settings.allowOntologySuggester = false;await host.saveSettings(false,false);
    const disabled = await open(":::");
    check(rows().length === 0,"Disabled K-Plex retained ontology rows");
    await close();
    host.settings.allowOntologySuggester = true;Object.assign(host.settings,settings);await host.saveSettings(false,false);
    const enabled = await open("::p");await choose(enabled,"parent");check(enabled.value === "parent::","Re-enabled K-Plex not reacquired");await close();
    const composing = await open("::p");
    composing.dispatchEvent(new win.CompositionEvent("compositionstart",{bubbles:true}));
    await key("Enter","Enter",13);check(popup() === composing,"IME Enter submitted the link editor");
    check(rows().length === 0,"IME retained an ontology popup");
    composing.dispatchEvent(new win.CompositionEvent("compositionend",{bubbles:true}));
    await choose(composing,"parent");await close();
    return {assertions:["live custom trigger","stale configuration row rejected","disable/re-enable reacquires public completion","scripted composition fences Enter without submitting"]};
  });
  await c.case("native:kplex-ontology-provider:" + geometry().requested.id,["P03","P04","P11"],async () => {
    const field=await open("::p");await c.waitFor(()=>rows().length,"provider lifecycle rows");
    const old=window.kplexApi;
    await c.requestHost("kplex-lifecycle",{command:"disable"});
    await c.waitFor(()=>!app.plugins.plugins["k-plex"]&&!window.kplexApi&&!win.kplexApi,"public aliases retire on disable");
    check(old.v1.completeOntology({text:"::p",cursor:3}).error?.code==="API_UNAVAILABLE","Retired public API remained available");
    const stale=rows().find(row=>row.querySelector(".suggestion-title")?.textContent==="parent");
    check(stale,"Provider retirement unexpectedly consumed its offered UI row");await click(stale);
    check(field.value==="::p","Retired provider selection mutated the link");
    await key("a","KeyA",65,modifier);await type("[[Note");
    let noteRow;
    await c.waitFor(()=>noteRow=[...doc.querySelectorAll(".suggestion-item")].find(row=>row.textContent.includes("Note [draft]")),"note completion without K-Plex");
    await click(noteRow);check(field.value.includes("[[Note [draft]]]"),"Missing K-Plex broke ordinary note selection");await close();
    await c.requestHost("kplex-lifecycle",{command:"enable"});
    await c.waitFor(()=>window.kplexApi&&window.kplexApi!==old&&win.kplexApi===window.kplexApi,"reloaded public API in the owning window");
    host=app.plugins.plugins["k-plex"];
    const reloaded=await open("::p");await choose(reloaded,"parent");check(reloaded.value==="parent::","Reloaded provider was not reacquired");await close();
    const incompatible=await open("::p");await c.waitFor(()=>rows().length,"missing-capability baseline");
    const aliases=[...new Set([window,win])].map(owner=>[owner,Object.getOwnPropertyDescriptor(owner,"kplexApi")]);
    try {
      for(const [owner]of aliases)Object.defineProperty(owner,"kplexApi",{configurable:true,value:{version:1,v1:{version:1,capabilities:()=>({ok:true,value:{operations:[]}})}}});
      const row=rows().find(row=>row.querySelector(".suggestion-title")?.textContent==="parent");await click(row);
      check(incompatible.value==="::p","Missing capability accepted a stale selection");
      await key("a","KeyA",65,modifier);await type(":::");check(rows().length===0,"Missing capability retained ontology completion");await close();
    } finally {for(const [owner,descriptor]of aliases){if(descriptor)Object.defineProperty(owner,"kplexApi",descriptor);else Reflect.deleteProperty(owner,"kplexApi");}}
    return {assertions:["actual plugin disable/enable and retired API refusal","stale provider row rejected","ordinary bracket-filename completion without K-Plex","new provider reacquired in the input realm","missing capability degrades without changing text"]};
  });
  await c.case("native:kplex-ontology-markdown:" + geometry().requested.id,["P04"],async () => {
    const file = await create("Native-ontology.md","");
    await leaf.openFile(file);app.workspace.setActiveLeaf(leaf,{focus:true});
    const editor = leaf.view.editor;check(editor,"Actual Markdown editor unavailable");editor.focus();
    const expected="**parent**:: ";let metadataComplete=false;
    const changed=app.metadataCache.on("changed",(changedFile,data)=>{if(changedFile===file&&data===expected)metadataComplete=true;});
    c.defer(()=>app.metadataCache.offref(changed));
    await type("::p");
    let row;
    await c.waitFor(() => row = [...doc.querySelectorAll(".suggestion-item")].find(row => row.querySelector("b")?.textContent === "parent"),"native Markdown ontology row");
    await click(row);
    check(editor.getValue() === expected,"Native Markdown bold/trailing-space insertion changed: " + editor.getValue());
    await leaf.view.save();
    await c.waitFor(()=>metadataComplete,"native Markdown save and metadata completion");
    check(await app.vault.read(file)===expected,"Native Markdown insertion was not physically persisted");
    await leaf.setViewState({type:"empty",state:{}});
    return {assertions:["real Markdown editor and native OntologySuggester","exact physical field with native bold and trailing space","physical Markdown save and completed metadata read before cleanup"]};
  });
}
