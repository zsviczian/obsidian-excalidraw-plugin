/** Direct public EA workflows on an owned editor, independent of user scripts. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInAppTask} from './inAppTask.mjs';
export async function runAutomateScenario({cli,drawingPath}){
  assert.ok(drawingPath.startsWith('__excalidraw_cli_smoke_'));
  const png=readFileSync(new URL('../../../tests/vault/Assets/Transparency.png',import.meta.url)).toString('base64');
  const svg=readFileSync(new URL('../../../tests/vault/Assets/Layers.svg',import.meta.url),'utf8');
  const result=await runInAppTask({cli,execute:exerciseAutomate,args:[drawingPath,png,svg],timeoutMs:150000});
  return {id:'core-excalidraw-automate',status:'passed',...result};
}
async function exerciseAutomate(c,drawingPath,png,svgSource){
  const p=app.plugins.plugins['obsidian-excalidraw-plugin'],view=app.workspace.getLeavesOfType('excalidraw').find(l=>l.view.file?.path===drawingPath)?.view;
  const check=(value,label)=>{if(!value)throw Error(label);};
  check(view?.excalidrawAPI,'Owned EA target missing');
  const ea=p.ea.getAPI(view),other=p.ea.getAPI(view);let cleanups=0;
  c.defer(()=>{ea.destroy();other.destroy();check(ea.targetView===null&&Object.keys(ea.elementsDict).length===0&&Object.keys(ea.imagesDict).length===0,'EA retained target/scene resources');check(cleanups===1,'EA cleanup did not run exactly once');});
  ea.registerCleanup(()=>cleanups++);
  let left,right,arrow,frame,label,group;
  await c.case('native:ea-shapes-bindings-and-isolation',['P07','P10'],async()=>{
    ea.setStyle({backgroundColor:'#ff0000',fillStyle:'solid',strokeColor:'#1e1e1e',roughness:0});
    left=ea.addRect(0,0,160,90);right=ea.addDiamond(300,0,180,100);
    label=ea.addText(20,150,'Owned EA label',{box:'box',boxPadding:12});
    arrow=ea.connectObjects(left,'right',right,'left',{endArrowHead:'arrow'});
    check(arrow&&ea.getElement(arrow).startBinding?.elementId===left&&ea.getElement(arrow).endBinding?.elementId===right,'EA arrow bindings differ');
    group=ea.addToGroup([left,right]);check(ea.getElement(left).groupIds.includes(group)&&ea.getElement(right).groupIds.includes(group),'EA grouping missing');
    frame=ea.addFrame(-40,-40,600,350,'Owned frame');
    for(const element of ea.getElements())if(element.id!==frame)element.frameId=frame;
    ea.getElement(left).customData={ownedEA:{retained:'metadata'}};
    check(other.getElements().length===0&&other.style.backgroundColor!==ea.style.backgroundColor,'EA instances share staged state');
    const count=ea.getElements().length;
    check(ea.connectObjects('missing-owned-id','right',right,'left')===undefined&&ea.getElements().length===count,'Invalid connection partially staged an arrow');
    check(await ea.addElementsToView(false,true,true),'EA publish failed');
    await c.waitFor(()=>view.excalidrawAPI.getSceneElements().some(e=>e.id===frame),'EA scene publication');
    check((await view.saveWithOutcome()).status==='persisted','EA publication did not receive physical save acknowledgement');
    const scene=await p.ea.getSceneFromFile(view.file);
    check(scene.elements.some(e=>e.id===left&&e.customData?.ownedEA?.retained==='metadata'),'EA metadata did not reach disk');
    // addText with a box returns its container ID, as the public EA API defines.
    const box=scene.elements.find(e=>e.id===label),text=scene.elements.find(e=>e.type==='text'&&e.containerId===label);
    check(text?.text==='Owned EA label'&&box?.boundElements.some(e=>e.id===text.id),'Bound text/container relation missing');
    return {assertions:['independent EA styles and staged scenes','shape/arrow bindings, group, frame and bound text','invalid connection has no partial mutation','published custom metadata reaches physical drawing']};
  });
  await c.case('native:ea-edit-image-and-decoded-export',['P05','P09','P10'],async()=>{
    ea.clear();const original=view.excalidrawAPI.getSceneElements().find(e=>e.id===left),x=original.x;
    ea.copyViewElementsToEAforEditing([original]);ea.getElement(left).x=42;
    check(original.x===x,'EA edit mutated live source before publication');
    const image=await ea.addImage(10,400,'data:image/png;base64,'+png,false,false);
    check(ea.getElement(image).width===4&&ea.getElement(image).height===2,'EA image geometry differs');
    check(await ea.addElementsToView(false,true,true),'EA image/edit publication failed');
    const updated=view.excalidrawAPI.getSceneElements();check(updated.filter(e=>e.id===left).length===1&&updated.find(e=>e.id===left).x===42,'EA edit duplicated or lost an element');
    ea.clear();ea.copyViewElementsToEAforEditing(updated,true);
    check(Object.keys(ea.imagesDict).length>0,'EA copy lost image data');
    const svg=await ea.createSVG(undefined,false,undefined,undefined,'light',10);
    check(svg.tagName.toLowerCase()==='svg'&&svg.querySelector('image')&&svg.querySelector('path,rect'),'EA SVG omitted content');
    const blob=await ea.createPNG(undefined,1,undefined,undefined,'light',10);
    check(blob.type==='image/png'&&blob.size>100,'EA PNG missing');
    const url=URL.createObjectURL(blob),decoded=new Image();
    try{decoded.src=url;await decoded.decode();check(decoded.naturalWidth>300&&decoded.naturalHeight>200,'EA PNG dimensions missing');
      const canvas=createFragment().createEl('canvas');canvas.width=96;canvas.height=64;const context=canvas.getContext('2d');context.drawImage(decoded,0,0,96,64);const pixels=context.getImageData(0,0,96,64).data;
      let red=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]>160&&pixels[i+1]<120&&pixels[i+2]<120&&pixels[i+3]>0)red++;
      check(red>10,'EA PNG lacks the red shape');
    }finally{URL.revokeObjectURL(url);}
    return {assertions:['copy-for-editing isolates live elements until publication','image data and natural dimensions preserved','existing ID updated once','actual SVG content and decoded PNG pixels']};
  });
  await c.case('native:ea-svg-import-and-disposal',['P09','P10','P11'],async()=>{
    other.clear();check(other.importSVG(svgSource),'EA portable SVG conversion failed');
    const elements=other.getElements();check(elements.length>=3&&elements.some(e=>e.opacity===50),'EA SVG layers/opacity missing');
    check(elements.some(e=>e.type==='line'||e.type==='freedraw'),'EA SVG open stroke missing');
    ea.destroy();ea.destroy();check(cleanups===1,'Repeated destroy reran cleanup');
    check(view.excalidrawAPI&&view.isLoaded,'EA disposal retired its editor');
    return {assertions:['public EA imports the portable SVG fixture','opacity and open strokes retained','idempotent cleanup leaves editor usable']};
  });
  return {tests:c.tests};
}
