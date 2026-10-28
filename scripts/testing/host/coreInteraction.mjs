/** Trusted mouse/keyboard exercise the real toolbar, custom pen and laser. */
import assert from 'node:assert/strict';
import {runInAppTask} from './inAppTask.mjs';
export async function runCoreInteractionScenario({cli,drawingPath}){
  assert.ok(drawingPath.startsWith('__excalidraw_cli_smoke_'));
  const result=await runInAppTask({cli,execute:exerciseCore,args:[drawingPath,process.platform==='darwin'?4:2],timeoutMs:120000,
    onRequest:request=>{assert.equal(request.method,'cdp');assert.ok(['Input.dispatchMouseEvent','Input.dispatchKeyEvent'].includes(request.params.method));cli('dev:cdp','method='+request.params.method,'params='+JSON.stringify(request.params.params));return{dispatched:true};}});
  return{id:'core-trusted-interaction',status:'passed',...result};
}
async function exerciseCore(c,drawingPath,modifier){
  const p=app.plugins.plugins['obsidian-excalidraw-plugin'],view=app.workspace.getLeavesOfType('excalidraw').find(l=>l.view.file?.path===drawingPath)?.view,api=view?.excalidrawAPI;
  const check=(value,label)=>{if(!value)throw Error(label);};check(api,'Owned core editor missing');
  const doc=view.ownerDocument,oldPens=p.settings.customPens,oldCount=p.settings.numberOfCustomPens;
  const wasFullscreen=view.isFullscreen(),events=[];
  c.defer(()=>{p.settings.customPens=oldPens;p.settings.numberOfCustomPens=oldCount;if(view.excalidrawAPI)api.updateScene({appState:{customPens:oldPens.slice(0,oldCount),currentStrokeOptions:null,resetCustomPen:null},captureUpdate:'NEVER'});if(!wasFullscreen)view.exitFullscreen();});
  if(!wasFullscreen)view.gotoFullscreen();
  const canvas=view.containerEl.querySelector('canvas.interactive');check(canvas,'Interactive canvas missing');
  const listener=event=>{if(event.target===canvas)events.push({trusted:event.isTrusted,type:event.pointerType});};
  doc.addEventListener('pointerdown',listener,true);c.defer(()=>doc.removeEventListener('pointerdown',listener,true));
  const input=(type,x,y)=>c.requestHost('cdp',{method:'Input.dispatchMouseEvent',params:{type,x,y,button:'left',buttons:type==='mouseReleased'?0:1,clickCount:1}});
  const key=async(key,code,keyCode,modifiers=0)=>{for(const type of ['keyDown','keyUp'])await c.requestHost('cdp',{method:'Input.dispatchKeyEvent',params:{type,key,code,windowsVirtualKeyCode:keyCode,modifiers}});};
  const click=async element=>{
    element.scrollIntoView({block:'nearest',inline:'nearest'});let x,y;
    try{await c.waitFor(()=>{const r=element.getBoundingClientRect();x=r.x+r.width/2;y=r.y+r.height/2;return r.width>0&&r.height>0&&element.contains(doc.elementFromPoint(x,y));},'uncovered core control');}
    catch(error){throw Error(error.message+': '+JSON.stringify({rect:element.getBoundingClientRect().toJSON(),hit:doc.elementFromPoint(x,y)?.outerHTML.slice(0,250),viewport:[innerWidth,innerHeight]}));}
    await input('mousePressed',x,y);await input('mouseReleased',x,y);
  };
  const toolbar=async id=>{let button;await c.waitFor(()=>{button=[...view.containerEl.querySelectorAll('[data-testid="'+id+'"]')].find(el=>el.getBoundingClientRect().width>0&&!el.closest('.tool-popover-content'));return button;},id);await click(button);};
  const stroke=async()=>{
    let start,end;await c.waitFor(()=>{const r=canvas.getBoundingClientRect();for(const [x,y]of[[0.65,0.55],[0.55,0.65],[0.7,0.4]]){const a={x:r.x+r.width*x,y:r.y+r.height*y},b={x:a.x+70,y:a.y+45};if(doc.elementFromPoint(a.x,a.y)===canvas&&doc.elementFromPoint(b.x,b.y)===canvas){start=a;end=b;return true;}}},'uncovered core drawing area');
    await input('mouseMoved',start.x,start.y);await input('mousePressed',start.x,start.y);
    for(let step=1;step<=4;step++)await input('mouseMoved',start.x+(end.x-start.x)*step/4,start.y+(end.y-start.y)*step/4);
    await input('mouseReleased',end.x,end.y);
  };
  await c.case('native:core-toolbar-draw-history',['P04','P07'],async()=>{
    const count=api.getSceneElements().length;await toolbar('toolbar-rectangle');await c.waitFor(()=>api.getAppState().activeTool.type==='rectangle','rectangle selection');await stroke();
    await c.waitFor(()=>api.getSceneElements().length===count+1,'trusted rectangle');
    check(events.some(e=>e.trusted&&e.type==='mouse'),'Drawing input was not trusted');
    view.containerEl.querySelector('.excalidraw').focus();await key('z','KeyZ',90,modifier);await c.waitFor(()=>api.getSceneElements().length===count,'trusted undo');
    await key('z','KeyZ',90,modifier|8);await c.waitFor(()=>api.getSceneElements().length===count+1,'trusted redo');
    return{assertions:['visible uncovered toolbar control','trusted pointer produces a rectangle','actual keyboard undo and redo preserve scene count']};
  });
  await c.case('native:core-custom-highlighter',['P05','P07'],async()=>{
    const baseColor=api.getAppState().currentItemStrokeColor;
    const pen={type:'highlighter',freedrawOnly:true,strokeColor:'#FFC47C',backgroundColor:'#FFC47C',fillStyle:'solid',strokeWidth:2,roughness:0,
      penOptions:{highlighter:true,constantPressure:true,hasOutline:true,outlineWidth:4,options:{thinning:1,smoothing:0.5,streamline:0.5,easing:'linear',start:{cap:true,taper:0,easing:'linear'},end:{cap:true,taper:0,easing:'linear'}}}};
    p.settings.customPens=[pen];p.settings.numberOfCustomPens=1;
    api.updateScene({appState:{customPens:[pen],selectedElementIds:{}},captureUpdate:'NEVER'});
    let label;await c.waitFor(()=>{label=[...view.containerEl.querySelectorAll('.ToolIcon__icon[aria-label="highlighter"]')].map(el=>el.closest('label')).find(el=>el?.getBoundingClientRect().width>0);return label;},'custom highlighter control');await click(label);
    await c.waitFor(()=>api.getAppState().activeTool.type==='freedraw'&&api.getAppState().currentStrokeOptions?.highlighter,'highlighter activation');
    const before=api.getSceneElements().length;await stroke();await c.waitFor(()=>api.getSceneElements().length===before+1,'highlighter stroke');
    const line=api.getSceneElements().find(el=>el.type==='freedraw');check(line?.customData?.strokeOptions?.highlighter&&line.points.length>=2,'Custom pen options did not reach the drawn stroke');
    check(api.getSceneElements().indexOf(line)===0,'Highlighter was not placed below existing shapes');
    await toolbar('toolbar-rectangle');await c.waitFor(()=>api.getAppState().activeTool.type==='rectangle'&&api.getAppState().resetCustomPen===null&&api.getAppState().currentItemStrokeColor===baseColor,'freedraw-only pen restores base stroke outside freehand');
    await toolbar('toolbar-freedraw');await c.waitFor(()=>api.getAppState().resetCustomPen&&api.getAppState().currentStrokeOptions?.highlighter,'custom pen reapplies on return to freehand');
    await click(label);await c.waitFor(()=>!api.getAppState().currentStrokeOptions,'custom pen deselects');
    check((await view.saveWithOutcome()).status==='persisted','Highlighter did not save');
    check((await p.ea.getSceneFromFile(view.file)).elements.some(el=>el.id===line.id&&el.customData?.strokeOptions?.highlighter),'Highlighter metadata lost on disk');
    return{assertions:['trusted custom pen toolbar activation','freehand pressure/highlighter metadata','highlighter beneath ordinary shapes','freedraw-only pen restores base options','custom stroke reaches physical save']};
  });
  await c.case('native:core-laser-transient',['P07'],async()=>{
    api.setActiveTool({type:'laser'});await c.waitFor(()=>api.getAppState().activeTool.type==='laser','laser tool');
    const ids=api.getSceneElements().map(el=>el.id),eventCount=events.length;await stroke();
    check(events.length>eventCount&&events.at(-1).trusted,'Laser did not receive trusted input');
    check(JSON.stringify(api.getSceneElements().map(el=>el.id))===JSON.stringify(ids),'Laser created a persistent drawing element');
    api.setActiveTool({type:'selection'});
    return{assertions:['active laser receives trusted pointer input','laser stroke adds no persistent scene element','selection remains usable'],limitations:'Trail animation pixels have a separate renderer/browser oracle; this checks native interaction and persistence semantics.'};
  });
  return{tests:c.tests};
}
