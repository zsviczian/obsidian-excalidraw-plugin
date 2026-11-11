/** Focused #3039/#3040 rendering and source-owned area padding, in real Obsidian. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInAppTask } from "./inAppTask.mjs";
import { behaviorEnvironment } from "./behaviorEnvironment.mjs";
import { behaviorInputDriver } from "./behaviorMatrix.mjs";
import { completeConsoleErrors } from "./debuggerSession.mjs";
import { settleBrowserDiagnostics, splitWindowErrors } from "./browserDiagnostics.mjs";

export const embedRegressionCaseIds = ["main", "popout"].flatMap(context => ["relative", "detached", "padding"].map(kind => `native:embed-regressions:${context}:${kind}`));

export async function runEmbedRegressionsScenario({ cli, drawingPath }) {
  const template = readFileSync(new URL("../../../tests/vault/Drawings/Uncompressed.excalidraw.md", import.meta.url), "utf8");
  const tests = [], consoleErrors = [], windowErrors = [], browserIdle = [];
  for (const id of ["main", "popout"]) {
    const execute = new Function(`return async function(c,path,context,template,modifier){
      const env=await (${behaviorEnvironment.toString()})(c,path,context,template,${completeConsoleErrors.toString()},${settleBrowserDiagnostics.toString()});
      const runCase=c.case.bind(c);c.case=async (...args)=>{c.phase=args[0];return runCase(...args);};
      await (${exercise.toString()})(c,env,template,modifier,context.id);
      return {tests:c.tests,consoleErrors:c.externalConsoleErrors||[],windowErrors:env.windowErrors,browserIdle:env.browserIdle};
    }`)();
    const result = await runInAppTask({ cli, execute, args: [drawingPath, { id, input: "mouse" }, template, process.platform === "darwin" ? 4 : 2],
      timeoutMs: 180000, cleanupMs: 60000, onRequest: behaviorInputDriver(cli),
      onProgress: phase => { if (phase) process.stdout.write("Embed regressions: " + phase + "\n"); },
    });
    tests.push(...result.tests); consoleErrors.push(...result.consoleErrors); windowErrors.push(...result.windowErrors); browserIdle.push(...result.browserIdle);
  }
  assert.equal(consoleErrors.length, 0); assert.equal(splitWindowErrors(windowErrors).unexpected.length, 0);
  assert.ok(browserIdle.every(item => item.status === "passed"));
  return { id: "drawing-embed-regressions", status: "passed", tests, consoleErrors, windowErrors, browserIdle };
}

async function exercise(c, env, template, modifier, context) {
  const { p, leaf, doc, win, create, check, click, key } = env;
  const nativeWindow = win.require("@electron/remote").getCurrentWindow();
  const minimized = nativeWindow.isMinimized();
  nativeWindow.restore(); nativeWindow.show(); nativeWindow.focus();
  if (minimized) c.defer(() => { if (!nativeWindow.isDestroyed()) nativeWindow.minimize(); });
  await app.vault.createFolder(env.prefix + "/assets/deep");
  await app.vault.createFolder(env.prefix + "/notes");
  const drawing = await create("assets/deep/Region.excalidraw.md", template);
  await c.waitFor(() => p.isExcalidrawFile(drawing), "relative drawing metadata");
  const bytes = await app.vault.read(drawing);
  const relative = "../assets/deep/Region.excalidraw.md";
  const note = await create("notes/Relative.md", `![[${relative}|200]]\n\n![[${drawing.path}|200]]\n\nEnd`);
  const root = () => leaf.view.contentEl.querySelector(leaf.view.getMode?.() === "preview" ? ".markdown-preview-view" : ".markdown-source-view");
  const images = () => [...root()?.querySelectorAll(".excalidraw-embedded-img") || []];
  const decoded = image => image.getBoundingClientRect().height > 0 && (image.tagName !== "IMG" || image.complete && image.naturalWidth > 0);
  const open = async (file, mode) => {
    await leaf.setViewState({ type: "markdown", state: { file: file.path, mode, source: false } });
    app.workspace.setActiveLeaf(leaf, { focus: true }); win.focus();
    if (mode === "source") leaf.view.editor.setCursor({ line: leaf.view.editor.lastLine(), ch: 0 });
  };
  await c.case(`native:embed-regressions:${context}:relative`, ["P05"], async () => {
    for (const type of ["SVG", "SVGIMG", "PNG"]) {
      p.settings.previewImageType = type;
      await leaf.setViewState({ type: "empty", state: {} }); await open(note, "source");
      await c.waitFor(() => images().length === 2 && images().every(decoded), "relative and vault-path embeds decode in Live Preview");
      check(images().every(image => image.getAttribute("fileSource") === drawing.path), "relative embed selected a different drawing");
      check(!root().querySelector(".markdown-embed-content"), "relative embed displayed raw drawing Markdown");
    }
    return { assertions: ["relative and vault-path Live Preview embeds decode in SVG, SVG image and PNG", "both images retain the canonical drawing identity", "no raw drawing Markdown remains"] };
  });
  await c.case(`native:embed-regressions:${context}:detached`, ["P05"], async () => {
    const { Component, MarkdownRenderer } = p.ea.obsidian;
    const markdown = ("A long paragraph about orbital mechanics. ".repeat(400) + "\n\n") + `![[${relative}|200]]\n\n`;
    for (const type of ["SVG", "SVGIMG", "PNG"]) {
      p.settings.previewImageType = type;
      const component = new Component(); component.load();
      const preview = doc.body.createDiv({ cls: "markdown-preview-view markdown-rendered" }); preview.remove();
      try {
        await MarkdownRenderer.render(app, markdown, preview, note.path, component);
        doc.body.append(preview);
        await c.waitFor(() => preview.querySelectorAll(".excalidraw-embedded-img").length === 1 && decoded(preview.querySelector(".excalidraw-embedded-img")), "claimed detached Reading section decodes after attachment");
        check(preview.querySelector("[fileSource]").getAttribute("fileSource") === drawing.path, "detached rendering changed the destination");
      } finally { component.unload(); preview.remove(); }
    }
    return { assertions: ["a long Reading section renders while detached in SVG, SVG image and PNG", "each image decodes after attachment with its original destination", "each render context is unloaded"] };
  });
  await c.case(`native:embed-regressions:${context}:padding`, ["P02", "P05"], async () => {
    p.settings.previewImageType = "SVG";
    const scene=JSON.parse(template.match(/```json\n([\s\S]*?)\n```/)[1]);
    scene.elements.push({...scene.elements[0],id:"distant",x:5000,y:1000,width:100,height:100,index:"a2"});
    const drawing=await create("assets/deep/Area.excalidraw.md",template.replace(/```json\n[\s\S]*?\n```/,"```json\n"+JSON.stringify(scene)+"\n```"));
    await c.waitFor(()=>p.isExcalidrawFile(drawing),"area drawing metadata");
    const bytes=await app.vault.read(drawing);
    const token = `![[${drawing.path}#^area=fixture-0,padding=0|200]]`;
    const source = token + "\n\n" + token + `\n\n![[${drawing.path}|200]]\n\nEnd`;
    const paddingNote = await create("notes/Padding.md", source);
    await leaf.setViewState({ type: "empty", state: {} }); await open(paddingNote, "source");
    await c.waitFor(() => images().length === 3 && images().every(decoded), "padding images decoded");
    const frames = () => [...root().querySelectorAll(".excalidraw-embed-controls-frame")];
    await c.waitFor(() => frames().length === 3, "padding toolbar bindings");
    check(frames()[2].querySelector('[data-excalidraw-embed-action="padding"] .lucide-box-select'), "whole drawing outer-padding icon absent");
    const launch = async () => {
      const frame = frames()[1]; frame.scrollIntoView({ block: "center" });
      const button = frame.querySelector('[data-excalidraw-embed-action="padding"]'); button.focus();
      await click(button);
      await c.waitFor(() => doc.querySelector(".excalidraw-embed-padding-popover input"), "padding slider opens");
      const popup=doc.querySelector(".excalidraw-embed-padding-popover"), row=popup.querySelector(".excalidraw-embed-padding-row"), help=popup.querySelector(".excalidraw-embed-padding-help");
      check(row&&help&&!popup.querySelector(".excalidraw-embed-padding-heading"),"padding popup should have controls and a description without a visible label");
      check(help.getBoundingClientRect().top>=row.getBoundingClientRect().bottom,"padding description is not below controls");
      check(popup.querySelector("input").step==="1","compact padding slider does not use unit steps");
      await c.waitFor(()=>!popup.querySelector("input").disabled,"saved-scene area range ready");
      check(popup.querySelector("input").max==="5100","area range must reach the distant scene edge plus 100");
      const readouts=[...popup.querySelectorAll("output,.slider-value")].filter(el=>el.getBoundingClientRect().width>0&&el.getBoundingClientRect().height>0);
      check(readouts.length===1,"compact slider displays duplicate values");
      check(readouts[0].getBoundingClientRect().top>=row.getBoundingClientRect().bottom,"compact value must be below the fixed slider row");
    };
    await launch();
    const active=doc.querySelector(".excalidraw-embed-padding-popover input"), track=active.getBoundingClientRect(), y=track.top+track.height/2;
    await env.input("Input.dispatchMouseEvent",{type:"mousePressed",x:track.left+track.width*.2,y,button:"left",buttons:1,clickCount:1});
    for(const fraction of [.4,.6,.8]){
      await env.input("Input.dispatchMouseEvent",{type:"mouseMoved",x:track.left+track.width*fraction,y,button:"left",buttons:1});
      check(Math.abs(active.getBoundingClientRect().width-track.width)<.1,"dragging changed slider width");
      check(active.max==="5100","dragging changed the snapshot range");
    }
    await env.input("Input.dispatchMouseEvent",{type:"mouseReleased",x:track.left+track.width*.8,y,button:"left",buttons:0,clickCount:1});
    await key("Home", "Home", 36); await key("ArrowUp", "ArrowUp", 38); await key("ArrowUp", "ArrowUp", 38);
    await c.waitFor(() => frames()[1].querySelector(".excalidraw-embed-padding-preview svg"), "padding export preview");
    check(leaf.view.editor.getValue() === source, "padding preview wrote the note");
    await key("Enter", "Enter", 13);
    const changed = token + "\n\n" + token.replace("padding=0", "padding=2") + source.slice(2 * token.length + 2);
    await c.waitFor(() => leaf.view.editor.getValue() === changed, "padding changed only the second occurrence");
    leaf.view.editor.cm.focus(); await key("z", "KeyZ", 90, modifier);
    await c.waitFor(() => leaf.view.editor.getValue() === source, "padding single undo");
    await c.waitFor(() => frames().length === 3, "padding controls after undo");
    await launch(); await key("End", "End", 35); await key("Escape", "Escape", 27);
    check(leaf.view.editor.getValue() === source, "Escape changed padding source");
    check(!doc.querySelector(".excalidraw-embed-padding-popover"), "padding popup leaked after Escape");
    await leaf.view.save(); check(await app.vault.read(drawing) === bytes, "padding modified the destination drawing");
    const view=await env.openDrawing("Preview-controls",{},template), ea=p.ea.getAPI(view);let imageId,areaId;
    try{imageId=await ea.addImage(0,0,drawing.path+"#^frame=,padding=750",false,false);areaId=await ea.addImage(400,0,drawing.path+"#^area=fixture-0,padding=0",false,false);await ea.addElementsToView(false,true,true);}finally{ea.destroy();}
    const original=JSON.stringify(view.getViewElements());
    await view.drawingImagePreview.open(imageId);
    await c.waitFor(()=>doc.querySelector(".excalidraw-drawing-preview-popover img")?.naturalWidth>0,"drawing settings preview image decoded");
    const popup=doc.querySelector(".excalidraw-drawing-preview-popover"), preview=popup.querySelector("img"), slider=popup.querySelector('input[type="range"]');
    check(popup.textContent.includes("frames or marker frames")&&popup.textContent.includes("default")&&popup.textContent.includes("Frame"),"view guidance must explain naming frames");
    check(win.getComputedStyle(preview).borderTopStyle==="solid"&&parseFloat(win.getComputedStyle(preview).borderTopWidth)>0,"drawing preview outline absent");
    check(preview.getBoundingClientRect().height<=preview.parentElement.getBoundingClientRect().height+.5,"preview exceeds its reserved height");
    check(slider.step==="1","drawing settings padding slider does not use unit steps");
    check(slider.max==="100","outer padding must be capped at 100");
    const readouts=[...popup.querySelectorAll("output,.slider-value")].filter(el=>el.getBoundingClientRect().width>0&&el.getBoundingClientRect().height>0);
    check(readouts.length===1&&readouts[0].textContent==="750","legacy padding must remain visible without duplicate values");
    check(readouts[0].getBoundingClientRect().top>=slider.getBoundingClientRect().bottom,"drawing padding value must be below its slider");
    const width=slider.getBoundingClientRect().width;
    slider.focus();await key("Home","Home",36);await key("ArrowRight","ArrowRight",39);
    check(slider.value==="1","one padding keypress did not produce one unit");
    check(Math.abs(slider.getBoundingClientRect().width-width)<.1,"digit changes resized the drawing padding slider");
    await key("Escape","Escape",27);
    check(!doc.querySelector(".excalidraw-drawing-preview-popover")&&JSON.stringify(view.getViewElements())===original,"UI inspection changed the scene");
    await view.drawingImagePreview.open(areaId);
    await c.waitFor(()=>doc.querySelector('.excalidraw-drawing-preview-popover input[type="range"]')?.max==="5100","scene image area range");
    const areaPopup=doc.querySelector(".excalidraw-drawing-preview-popover"), select=areaPopup.querySelector("select");
    select.focus();await key("Home","Home",36);await key("ArrowDown","ArrowDown",40);await key("Enter","Enter",13);
    check(areaPopup.querySelector('input[type="range"]').max==="100","switching to whole scene did not restore outer-padding cap");
    select.focus();await key("End","End",35);await key("Enter","Enter",13);
    check(areaPopup.querySelector('input[type="range"]').max==="5100","returning to the area lost its snapshot range");
    await key("Escape","Escape",27);
    check(JSON.stringify(view.getViewElements())===original,"area range inspection changed the scene");
    return { assertions: ["whole drawing exposes the outer-padding icon", "one small readout below each slider keeps native drag geometry fixed", "area range uses saved scene bounds and stays at 5100 during dragging", "outer padding is capped at 100 and legacy 750 remains intact until edited", "both padding sliders use one-unit steps", "drawing settings explain named frames and outline the rendered image", "native slider keys create a live export preview without writing", "Enter changes only the second repeated area reference", "one native undo restores the complete original source", "Escape cancels and removes the popup", "the drawing bytes are unchanged"] };
  });
}
