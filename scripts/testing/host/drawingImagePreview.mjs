/** Trusted in-scene controls, shared-source scope and persisted link/geometry behavior. */
export async function exerciseDrawingImagePreview(c, env, template, drawing, context, modifier) {
  const { p, leaf, doc, check, click, key } = env;
  let view = await env.openDrawing("Image-host", {}, template);
  const ea = p.ea.getAPI(view); let first, variant;
  try {
    first = await ea.addImage(0, 500, drawing, false, false);
    variant = await ea.addImage(500, 500, drawing.path + "#^frame=frame-marker,padding=20|100%", false, true);
    await ea.addElementsToView(false, true, true);
  } finally { ea.destroy(); }
  const get = id => view.getViewElements().find(el => el.id === id);
  const duplicate = { ...structuredClone(get(first)), id: "shared-copy", x: 300, width: get(first).width/2, height: get(first).height/2, index: null };
  view.updateScene({ elements: [...view.getViewElements(), duplicate], captureUpdate: "IMMEDIATELY" });
  const originalId = get(first).fileId;
  const link = id => view.excalidrawData.getFile(get(id).fileId).linkParts.original;
  const center = id => { const el=get(id); return [el.x+el.width/2,el.y+el.height/2]; };
  const oldCenters = [first, "shared-copy", variant].map(center);
  const oldAreas = [first,"shared-copy"].map(id=>get(id).width*get(id).height);
  const open = async () => {
    await view.zoomToElementId(first, false);
    await c.waitFor(() => view.containerEl.querySelector('[data-excalidraw-element-action="configure-drawing-preview"]'), "drawing image settings action");
    await click(view.containerEl.querySelector('[data-excalidraw-element-action="configure-drawing-preview"]'));
    await c.waitFor(() => doc.querySelector(".excalidraw-drawing-preview-popover select"), "drawing preview popover opens in owner document");
    return doc.querySelector(".excalidraw-drawing-preview-popover");
  };
  const chooseFrame = async popup => {
    const select = popup.querySelector("select"), index = [...select.options].findIndex(option => option.value === "frame:frame-marker");
    check(index>=0,"marker frame missing from image settings"); select.focus(); await key("Home","Home",36);
    for(let i=0;i<index;i++) await key("ArrowDown","ArrowDown",40);
    await key("Enter","Enter",13); check(select.value==="frame:frame-marker","native frame selection failed");
  };
  const choosePadding = async (popup, steps) => {
    const slider=popup.querySelector('input[type="range"]'); slider.focus(); await key("Home","Home",36);
    for(let i=0;i<steps;i++) await key("ArrowRight","ArrowRight",39);
    check(Number(slider.value)===steps*10,"native padding selection failed");
  };
  const apply = async (popup, all) => {
    c.caseTrace = { ...c.caseTrace, imageSettings: { all, html: popup.outerHTML, links: [first,"shared-copy",variant].map(link) } };
    await click([...popup.querySelectorAll("button")].find(button=>button.textContent==="Apply"));
    await c.waitFor(()=> {
      c.caseTrace.imageSettings.after = { popover: popup.isConnected, disabled: popup.querySelector(".mod-cta")?.disabled,
        currentLink: link(first), prompt: doc.querySelector(".modal-container")?.textContent };
      return doc.querySelector(".excalidraw-multiOptionConfirmationPrompt-buttonContainer");
    },"shared drawing scope prompt");
    const buttons=[...doc.querySelectorAll(".excalidraw-multiOptionConfirmationPrompt-buttonContainer button")];
    const body=doc.querySelector(".excalidraw-multiOptionConfirmationPrompt-message").textContent;
    check(body.includes("3 images")&&!/fileId|file id/.test(body),"scope explanation exposes internal references or misses distinct-view copies");
    await click(buttons.find(button=>all?button.textContent.startsWith("All 3"):button.textContent==="Only this image"));
    await c.waitFor(()=>!doc.querySelector(".excalidraw-drawing-preview-popover"),"image settings commit closes popover");
  };
  let popup=await open(); await chooseFrame(popup); await choosePadding(popup,3); await apply(popup,false);
  check(get(first).fileId!==originalId && get("shared-copy").fileId===originalId,"only-this-image changed a shared copy");
  check(link(first).includes("#^frame=frame-marker,padding=30"),"image settings not persisted to embedded link");
  check(link(variant).includes("padding=20|100%"),"only-this-image changed a distinct view");
  check(Math.abs(get(first).width*get(first).height-oldAreas[0])<.01,"frame change did not retain image area");
  check(JSON.stringify(center(first))===JSON.stringify(oldCenters[0]),"frame change moved image center");
  view.containerEl.querySelector(".excalidraw").focus(); await key("z","KeyZ",90,modifier);
  await c.waitFor(()=>get(first).fileId===originalId,"one undo restores old preview reference");
  await key("z","KeyZ",90,modifier|8);
  await c.waitFor(()=>link(first).includes("padding=30"),"redo restores preview reference");
  popup=await open(); await choosePadding(popup,5); await apply(popup,true);
  check(link(first).includes("frame=frame-marker,padding=50"),"apply-all lost chosen frame");
  check(link("shared-copy").includes("as-image,padding=50"),"apply-all pinned a default-thumbnail copy");
  check(link(variant).includes("frame=frame-marker,padding=50|100%"),"apply-all lost another copy's anchor or frame");
  for(let i=0;i<3;i++)check(JSON.stringify(center([first,"shared-copy",variant][i]))===JSON.stringify(oldCenters[i]),"apply-all changed a copy's center");
  popup=await open(); await click(popup.querySelector(".checkbox-container")); await apply(popup,true);
  for(const id of [first,"shared-copy",variant]){
    const el=get(id), source=view.excalidrawData.getFile(el.fileId);
    check(link(id).endsWith("|100%")&&el.customData.isAnchored,"100% state absent from link or derived canvas flag");
    check(Math.abs(el.width-source.size.width)<.01&&Math.abs(el.height-source.size.height)<.01,"anchored copy does not use intrinsic size");
  }
  const before=JSON.stringify(view.getViewElements()), beforeLinks=[first,"shared-copy",variant].map(link);
  const savedLinks=beforeLinks.map(value=>value.replace(/^[^#|]*/,app.metadataCache.fileToLinktext(drawing,view.file.path)));
  popup=await open(); await choosePadding(popup,9); await key("Escape","Escape",27);
  check(!doc.querySelector(".excalidraw-drawing-preview-popover")&&JSON.stringify(view.getViewElements())===before,"Escape wrote draft image settings");
  view=await env.saveReopen(view);
  c.caseTrace.imageLinks = { expected: savedLinks, after: [first,"shared-copy",variant].map(link) };
  check(JSON.stringify([first,"shared-copy",variant].map(link))===JSON.stringify(savedLinks),"reopen lost image preview links or anchoring");
  for(const id of [first,"shared-copy",variant])check(view.excalidrawData.getFile(get(id).fileId).file===drawing&&get(id).customData.isAnchored,"reopen changed image source or anchoring");
  check(view.getViewElements().filter(el=>el.type==='image').length===3,"settings created duplicate image elements");
  return { assertions: ["selected drawing image opens owner-window configuration", "native frame/padding controls prompt once for all three source copies", "only-this-image isolates its link and preserves image area/center", "one native undo/redo restores references and geometry", "apply-all changes only edited fields across shared and distinct references", "100% persists in links and uses intrinsic dimensions", "Escape cancels drafts", "save/reopen preserves all links and three scene elements"] };
}
