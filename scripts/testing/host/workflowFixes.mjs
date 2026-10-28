/** Native #3020 checks, confined to the guarded parent's UUID-owned fixtures. */
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {runInAppTask} from './inAppTask.mjs';

export async function runWorkflowFixesScenario({cli,drawingPath,reportDir}) {
  const prefix=drawingPath.replace(/\.excalidraw\.md$/,'')+'_workflows';
  assert.ok(prefix.startsWith('__excalidraw_cli_smoke_'));
  const baseline=process.env.EXCALIDRAW_WORKFLOW_BASELINE==='1';
  const result=await runInAppTask({cli,execute:probeWorkflows,args:[prefix,drawingPath,baseline],timeoutMs:180000,cleanupMs:60000,onRequest:request=>{
    if(request.method!=='screenshot'||!/^[a-zA-Z0-9-]+$/.test(request.params.name))throw Error('Unexpected workflow screenshot request');
    cli('dev:screenshot','path='+join(reportDir,(baseline?'before-':'after-')+request.params.name+'.png'));return {captured:true};
  }});
  return {id:'workflow-fixes-3020',status:'passed',baseline,...result};
}

async function probeWorkflows(c,prefix,drawingPath,baseline) {
  const p=app.plugins.plugins['obsidian-excalidraw-plugin'];
  const originalLayout=app.workspace.getLayout(),leaves=[],doc=app.workspace.containerEl.ownerDocument;
  const settings=Object.fromEntries(['templateFilePath','previewImageType','canvasImmersiveEmbed','folder','embedUseExcalidrawFolder','compatibilityMode'].map(key=>[key,p.settings[key]]));
  const check=(condition,message)=>{if(!condition)throw Error(message);};
  const ownedPrompts=new Set();
  const wait=async(predicate,message)=>{await c.waitFor(predicate,message,25000);if(message.includes('chooser')){const prompt=doc.querySelector('.prompt');if(prompt)ownedPrompts.add(prompt);}};
  const settle=()=>new Promise(r=>setTimeout(r,250));
  const capture=name=>c.requestHost('screenshot',{name});
  const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
  check(!doc.querySelector('.prompt'),'Close existing prompts before the workflow scenario');
  let fullscreenView;
  c.defer(async()=>{const folder=app.vault.getFolderByPath(prefix);if(folder){check(folder.path===prefix&&prefix.startsWith('__excalidraw_cli_smoke_'),'unowned cleanup');await app.vault.delete(folder,true);}});
  c.defer(()=>Object.assign(p.settings,settings));
  c.defer(async()=>{await app.workspace.changeLayout(originalLayout);await c.waitForCleanup(()=>app.workspace.getLeavesOfType('excalidraw').some(l=>l.view.file?.path===drawingPath&&l.view.isLoaded&&l.view.excalidrawAPI&&!l.view.semaphores.justLoaded),'restored parent drawing first commit');});
  c.defer(async()=>{const errors=[];for(const leaf of leaves){try{if(leaf.view.containerEl.isConnected){await leaf.setViewState({type:'empty',state:{}});leaf.detach();}}catch(error){errors.push(error);}}if(errors.length)throw new AggregateError(errors,'Workflow leaf cleanup failed');});
  c.defer(()=>fullscreenView?.exitFullscreen());
  c.defer(async()=>{for(const prompt of ownedPrompts){if(prompt.isConnected){doc.dispatchEvent(new doc.defaultView.KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true,cancelable:true}));await c.waitForCleanup(()=>!prompt.isConnected,'owned chooser cancellation');}}});


    await app.vault.createFolder(prefix);
    const note=await app.vault.create(prefix+'/Note.md','Workflow fixture.'),draw=app.vault.getFileByPath(drawingPath);
    const uid=()=>crypto.randomUUID().replace(/-/g,'').slice(0,16),drawingId=uid();
    const tabs=(file,type,id=uid())=>({id:uid(),type:'tabs',children:[{id,type:'leaf',state:{type,state:{file}}}]});
    await app.workspace.changeLayout({...originalLayout,main:{id:uid(),type:'split',direction:'vertical',children:[tabs(note.path,'markdown'),{id:uid(),type:'split',direction:'horizontal',children:[tabs(note.path,'markdown'),tabs(draw.path,'excalidraw',drawingId)]}]},active:drawingId});
    await wait(()=>app.workspace.getLeavesOfType('excalidraw').some(l=>l.id===drawingId&&l.view.excalidrawAPI&&l.view.isLoaded),'nested drawing');
    fullscreenView=app.workspace.getLeavesOfType('excalidraw').find(l=>l.id===drawingId).view;
    await settle();const original=rect(fullscreenView.contentEl);await capture('nested-layout');
    fullscreenView.gotoFullscreen();await settle();
    const fullscreen=rect(fullscreenView.contentEl),hiddenAncestors=[];
    for(let el=fullscreenView.contentEl;el;el=el.parentElement)if(el.hasClass('excalidraw-hidden'))hiddenAncestors.push(el.className);
    await capture('fullscreen');fullscreenView.exitFullscreen();await settle();
    const restored=rect(fullscreenView.contentEl);
    c.observations={fullscreen:{original,fullscreen,restored,hiddenAncestors}};
    if(!baseline) {check(hiddenAncestors.length===0&&fullscreen.width>original.width,'fullscreen hidden/small');check(Math.abs(original.width-restored.width)<2&&Math.abs(original.height-restored.height)<2,'layout not restored');}

    const ea=p.ea.getAPI();
    try {ea.addRect(0,0,100,600);await ea.create({exactPath:prefix+'/Tall.excalidraw.md',silent:true});}finally{ea.destroy();}
    const fullscreenVariants=[];
    if(!baseline) {
      const exercise=async(view,name)=>{
        const before=rect(view.contentEl),scene=JSON.stringify(view.excalidrawAPI.getSceneElements());
        view.gotoFullscreen();view.gotoFullscreen();await settle();
        const full=rect(view.contentEl);check(full.width>0&&full.height>0,name+' blank');
        check(view.excalidrawAPI.getAppState().width>0,name+' editor unavailable');
        view.exitFullscreen();view.exitFullscreen();await settle();
        const after=rect(view.contentEl);check(Math.abs(before.width-after.width)<2&&Math.abs(before.height-after.height)<2,name+' geometry not restored');
        check(JSON.stringify(view.excalidrawAPI.getSceneElements())===scene,name+' changed drawing');
        fullscreenVariants.push({name,before,full,after});
      };
      const deep=app.workspace.createLeafBySplit(fullscreenView.leaf,'vertical',true);await deep.openFile(note);
      app.workspace.setActiveLeaf(fullscreenView.leaf,{focus:true});await settle();await exercise(fullscreenView,'eighth split');
      await capture('eighth-layout');
      const second=app.workspace.createLeafBySplit(fullscreenView.leaf,'horizontal',true);
      await second.openFile(draw);await wait(()=>second.view.excalidrawAPI&&second.view.isLoaded,'second drawing');
      fullscreenView.gotoFullscreen();second.view.gotoFullscreen();
      check(!fullscreenView.isFullscreen()&&second.view.isFullscreen(),'fullscreen ownership did not transfer');
      await second.setViewState({type:'empty',state:{}});second.detach();
      check(!doc.body.querySelector('.excalidraw-fullscreen-content'),'close retained fullscreen');
      const popout=app.workspace.openPopoutLeaf();
      try {
        await wait(()=>popout.view.containerEl.ownerDocument!==doc,'empty popout migration');
        await popout.openFile(draw);await wait(()=>popout.view.excalidrawAPI&&popout.view.isLoaded&&!popout.view.isClosingOrMigrating(),'popout drawing');
        const count=doc.body.querySelectorAll('.excalidraw-hidden').length;
        await exercise(popout.view,'popout');check(doc.body.querySelectorAll('.excalidraw-hidden').length===count,'popout changed main document');
      } finally {await popout.setViewState({type:'empty',state:{}});popout.detach();}
    }
    c.observations.fullscreen.variants=fullscreenVariants;
    // A fitted three-node Canvas in an eighth-width pane uses Obsidian's
    // far-zoom placeholders. Measure actual previews in a normal-sized pane.
    await app.workspace.changeLayout({...originalLayout,main:{id:uid(),type:'split',direction:'vertical',children:[tabs(note.path,'markdown')]}});
    fullscreenView=null;
    const canvasResults=[];
    for(const mode of ['SVG','SVGIMG','PNG'])for(const immersive of [false,true]) {
      const canvasPath=prefix+'/Preview-'+mode+'-'+immersive+'.canvas';
      await app.vault.create(canvasPath,JSON.stringify({nodes:[{id:'small',type:'file',file:draw.path,x:0,y:0,width:320,height:240},{id:'large',type:'file',file:draw.path,x:420,y:0,width:640,height:480},{id:'tall',type:'file',file:prefix+'/Tall.excalidraw.md',x:1150,y:0,width:320,height:480}],edges:[]}));
      p.settings.previewImageType=mode;p.settings.canvasImmersiveEmbed=immersive;
      const canvasLeaf=app.workspace.getLeaf('tab');leaves.push(canvasLeaf);await canvasLeaf.openFile(app.vault.getFileByPath(canvasPath));
      await wait(()=>canvasLeaf.view.canvas?.nodes?.size===3,'Canvas nodes');
      const canvas=canvasLeaf.view.canvas;
      canvas.zoomToFit?.();await settle();
      const selector=mode==='SVG'?'.excalidraw-embedded-img svg':'img.excalidraw-embedded-img';
      try {await wait(()=>canvasLeaf.view.containerEl.querySelectorAll(selector).length===3&&[...canvasLeaf.view.containerEl.querySelectorAll(selector)].every(el=>mode==='SVG'||el.complete&&el.naturalWidth>0),'Canvas '+mode+' previews');}
      catch(error){throw Error(error.message+' '+JSON.stringify([...canvas.nodes.values()].map(n=>({id:n.id,connected:n.nodeEl.isConnected,svg:n.nodeEl.querySelectorAll(selector).length,html:n.nodeEl.innerHTML.slice(-1100)}))));}
      await settle();
      const measurements=()=>[...canvas.nodes.values()].map(node=>({id:node.id,node:rect(node.nodeEl),preview:rect(node.nodeEl.querySelector(selector)),svgWidth:node.nodeEl.querySelector(selector).getAttribute('width')}));
      const small=canvas.nodes.get('small'),beforeResize=measurements();
      if(mode==='SVG')await capture('canvas-'+immersive+'-two-nodes');
      const resize=small.resize??small.setSize;
      check(typeof resize==='function','Canvas resize API missing');resize.call(small,{width:640,height:360});await settle();
      const afterResize=measurements();
      if(mode==='SVG')await capture('canvas-'+immersive+'-resized');
      const scale=afterResize.find(n=>n.id==='small').preview.width/beforeResize.find(n=>n.id==='small').preview.width;
      canvasResults.push({mode,immersive,beforeResize,afterResize,scale});c.observations.canvas=canvasResults;
      if(!baseline)check(scale>1.5,'Canvas '+mode+'/'+immersive+' did not grow');
      check(Math.abs(beforeResize.find(n=>n.id==='large').preview.width-afterResize.find(n=>n.id==='large').preview.width)<1,'one node changed another');
      await canvasLeaf.setViewState({type:'empty',state:{}});canvasLeaf.detach();leaves.pop();
    }

    const source=await app.vault.read(draw);
    for(const name of ['Alpha','Beta']) {
      await app.vault.createFolder(prefix+'/'+name);
      await app.vault.create(prefix+'/'+name+'/Same.excalidraw.md',source.replace(/^---\r?\n/,'---\nworkflow-template: '+name+'\n'));
    }
    await wait(()=>['Alpha','Beta'].every(name=>p.isExcalidrawFile(app.vault.getFileByPath(prefix+'/'+name+'/Same.excalidraw.md'))),'template metadata');
    p.settings.templateFilePath=prefix;
    const destination=prefix+'/Cancelled/Drawing.excalidraw.md';
    let completed=false,output,error;
    p.createAndOpenDrawing('Drawing.excalidraw.md','new-tab',prefix+'/Cancelled').then(value=>{output=value;completed=true;}).catch(e=>{error=String(e);completed=true;});
    await wait(()=>doc.querySelector('.prompt'),'template chooser');
    const labels=[...doc.querySelectorAll('.prompt .suggestion-item')].map(el=>el.textContent);await capture('template-chooser');
    doc.dispatchEvent(new doc.defaultView.KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true,cancelable:true}));
    await wait(()=>completed,'cancel completion');await settle();
    const created=!!app.vault.getFileByPath(destination),folderCreated=!!app.vault.getFolderByPath(prefix+'/Cancelled');
    if(baseline)check(created,'cancellation already fixed');
    else {check(!created&&!folderCreated&&!error,'cancel created file/folder/error');check(labels.some(s=>s.includes('Alpha'))&&labels.some(s=>s.includes('Beta')),'folder labels missing');}
    const extra={};
    if(!baseline) {
      const ready=async path=>{
        // createAndOpenDrawing returns the path before the view's first React commit.
        await wait(()=>app.workspace.getLeavesOfType('excalidraw').some(l=>l.view.file?.path===path&&l.view.isLoaded&&l.view.excalidrawAPI&&!l.view.isClosingOrMigrating()&&!l.view.semaphores.justLoaded),'new drawing first commit');
      };
      const choose=async (operation,choice)=>{
        let done=false,result,failure,prompt;
        c.defer(async()=>{if(!done){if(prompt?.isConnected)doc.dispatchEvent(new doc.defaultView.KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true,cancelable:true}));await c.waitForCleanup(()=>done,'pending owned drawing creation');}});
        Promise.resolve(operation()).then(value=>{done=true;result=value;}).catch(error=>{done=true;failure=String(error);});
        await wait(()=>doc.querySelector('.prompt'),'chooser '+choice);prompt=doc.querySelector('.prompt');
        const input=doc.querySelector('.prompt input'),items=()=>[...doc.querySelectorAll('.prompt .suggestion-item')];
        if(choice==='blank') {
          check(items()[0].textContent===p.getLabel('PROMPT_BLANK_DRAWING'),'blank is not first');
          check(doc.querySelector('.prompt .suggestion-item.is-selected')?.textContent===p.getLabel('PROMPT_BLANK_DRAWING'),'blank not selected initially');
          doc.dispatchEvent(new doc.defaultView.KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true,cancelable:true}));
        } else if(choice==='outside') {
          const background=doc.querySelector('.modal-container .modal-bg');check(background,'modal backdrop missing');background.click();
        } else {
          input.value=choice;input.dispatchEvent(new doc.defaultView.Event('input',{bubbles:true}));
          await wait(()=>items().length===1&&items()[0].textContent.includes(choice),'filtered template');items()[0].click();
        }
        await wait(()=>done,'chooser outcome '+choice);check(!failure,failure);if(result)await ready(result);return result;
      };
      const blank=await choose(()=>p.createAndOpenDrawing('Blank.excalidraw.md','new-tab',prefix),'blank');
      check(blank===prefix+'/Blank.excalidraw.md'&&p.isExcalidrawFile(app.vault.getFileByPath(blank)),'blank creation');
      const chosen=await choose(()=>p.createAndOpenDrawing('Chosen.excalidraw.md','new-tab',prefix),'Beta');
      check((await app.vault.read(app.vault.getFileByPath(chosen))).includes('workflow-template: Beta'),'wrong duplicate-basename template');
      const dismissed=await choose(()=>p.createAndOpenDrawing('Outside.excalidraw.md','new-tab',prefix+'/Outside'),'outside');
      check(dismissed===''&&!app.vault.getFolderByPath(prefix+'/Outside'),'outside dismissal wrote data');
      const noteLeaf=app.workspace.getLeaf('tab');leaves.push(noteLeaf);await noteLeaf.openFile(note);
      const beforeText=await app.vault.read(note),beforeFiles=app.vault.getFiles().length,beforeFolders=app.vault.getAllLoadedFiles().length;
      p.settings.folder=prefix+'/EmbedCancelled';p.settings.embedUseExcalidrawFolder=true;
      check(app.commands.executeCommandById('obsidian-excalidraw-plugin:excalidraw-autocreate-and-embed'),'embed command absent');
      await wait(()=>doc.querySelector('.prompt'),'embed chooser');
      doc.dispatchEvent(new doc.defaultView.KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true,cancelable:true}));await settle();
      check(app.vault.getFiles().length===beforeFiles&&app.vault.getAllLoadedFiles().length===beforeFolders,'embed cancellation created data');
      check((await app.vault.read(note))===beforeText&&noteLeaf.view.editor.getValue()===beforeText,'embed cancellation edited note');
      check(app.commands.executeCommandById('obsidian-excalidraw-plugin:convert-to-excalidraw'),'conversion command absent');
      await wait(()=>doc.querySelector('.prompt'),'convert chooser');
      doc.dispatchEvent(new doc.defaultView.KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true,cancelable:true}));await settle();
      check((await app.vault.read(note))===beforeText&&noteLeaf.view.getViewType()==='markdown','cancelled conversion changed note/view');
      const menu=new p.ea.obsidian.Menu();
      app.workspace.trigger('file-menu',menu,app.vault.getFolderByPath(prefix),'file-explorer');menu.showAtPosition({x:80,y:180});
      const title=[...doc.querySelectorAll('.menu-item-title')].find(el=>el.textContent===p.getLabel('CREATE_NEW'));
      check(title,'file-explorer new drawing action missing');title.click();
      await wait(()=>doc.querySelector('.prompt'),'file-explorer chooser');
      doc.dispatchEvent(new doc.defaultView.KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true,cancelable:true}));await settle();menu.hide();
      check(app.vault.getFiles().length===beforeFiles&&app.vault.getAllLoadedFiles().length===beforeFolders,'file-explorer cancel created data');
      p.settings.templateFilePath=prefix+'/Alpha/Same.excalidraw.md';
      const single=await p.createAndOpenDrawing('Single.excalidraw.md','new-tab',prefix);
      await ready(single);
      check((await app.vault.read(app.vault.getFileByPath(single))).includes('workflow-template: Alpha')&&!doc.querySelector('.prompt'),'single template prompted/wrong');
      p.settings.templateFilePath=prefix+'/Missing';
      const zero=await p.createAndOpenDrawing('Zero.excalidraw.md','new-tab',prefix);
      await ready(zero);
      check(p.isExcalidrawFile(app.vault.getFileByPath(zero))&&!doc.querySelector('.prompt'),'zero template failed');
      p.settings.compatibilityMode=true;
      const legacy=await p.createAndOpenDrawing('Legacy.excalidraw','new-tab',prefix);
      await ready(legacy);
      check(Array.isArray(JSON.parse(await app.vault.read(app.vault.getFileByPath(legacy))).elements),'legacy blank failed');
      p.settings.compatibilityMode=false;p.settings.templateFilePath=prefix;
      const explicit=await p.createAndOpenDrawing('Explicit.excalidraw.md','new-tab',prefix,source);
      await ready(explicit);
      check(explicit===prefix+'/Explicit.excalidraw.md'&&!doc.querySelector('.prompt'),'explicit data opened chooser');
      Object.assign(extra,{blank:true,filteredDuplicateSelection:true,outsideDismissal:true,embedCancelNoChanges:true,conversionCancelNoChanges:true,fileExplorerCancelNoChanges:true,singleTemplateAutomatic:true,zeroTemplateAutomatic:true,legacy:true,explicitDataNoPrompt:true});
    }
    return {fullscreen:{original,fullscreen,restored,hiddenAncestors,variants:fullscreenVariants},canvas:canvasResults,templates:{labels,created,folderCreated,output:output??null,error:error??null,...extra}};

}
