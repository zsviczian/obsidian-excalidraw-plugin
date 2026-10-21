/** Explicit native beyond-string-limit identity stress without large bitmap decoding. */
import assert from 'node:assert/strict';

export async function runCLILargeIdentity({ evaluate, viewCode, path, out, requestId }) {
  const control = '__excalidrawLargeCLIIdentity';
  const result = evaluate(`(async()=>{
    if(globalThis.${control})throw Error('large identity controller exists');
    const v=${viewCode},a=v.excalidrawAPI,m=v.excalidrawData,p=app.plugins.plugins['obsidian-excalidraw-plugin'];
    const c={api:a,model:m,getFiles:a.getFiles,exportData:m.exportPreparedSaveData};globalThis.${control}=c;
    try {
      const original=a.getFiles(),files={...original},body='A'.repeat(2*1024*1024),metadata=c.exportData.call(m);
      const keys=Object.keys(original);while(keys.length<387)keys.push('stress'+String(keys.length).padStart(4,'0'));
      const descriptors=new Map(metadata.files);
      for(let i=0;i<keys.length;i++){const id=keys[i],url='data:image/png;base64,'+body+String(i).padStart(8,'0');files[id]={...(files[id]||{id,mimeType:'image/png',created:1}),dataURL:url};descriptors.set(id,{...(descriptors.get(id)||{}),img:url,imgInverted:url})}
      a.getFiles=()=>files;m.exportPreparedSaveData=()=>({...metadata,files:descriptors});
      const samples=[],read=async detail=>{const start=performance.now();const r=await p.executeCLI({apiVersion:1,command:'read',path:${JSON.stringify(path)},source:'live',...(detail?{detail}: {})});samples.push({detail:detail||'summary',ms:performance.now()-start,heapBytes:performance.memory?.usedJSHeapSize??null});if(!r.ok)throw Error(JSON.stringify(r));return r};
      const first=await read(),second=await read(),inventory=await read('images'),page=await read('elements');
      if(first.data.revision!==second.data.revision||first.data.revision!==inventory.data.revision||first.data.revision!==page.data.revision)throw Error('unstable unchanged identity');
      const id=keys[0],s=files[id].dataURL;files[id].dataURL=s.slice(0,-1)+(s.endsWith('0')?'1':'0');
      const changed=await read();if(changed.data.revision===first.data.revision)throw Error('last-byte content edit did not invalidate revision');
      const stale=await p.executeCLI({apiVersion:1,command:'apply',requestId:${JSON.stringify(requestId + '-stale')},path:${JSON.stringify(path)},expectedRevision:first.data.revision,operations:[{op:'imageMetadata',id:a.getSceneElements().find(e=>e.type==='image').id,label:'Must not publish'}]});
      const preview=await p.executeCLI({apiVersion:1,command:'export',requestId:${JSON.stringify(requestId + '-export')},path:${JSON.stringify(path)},source:'live',out:${JSON.stringify(out)},imagePolicy:{default:'placeholder'},maxWidth:900,maxHeight:700,maxPixels:500000});
      return JSON.stringify({files:keys.length,logicalPayloadCharacters:Object.values(files).reduce((n,f)=>n+f.dataURL.length,0),maxStringLength:require('buffer').constants.MAX_STRING_LENGTH,samples,stableRevision:true,lastByteInvalidated:true,staleCode:stale.error?.code,preview});
    } finally {a.getFiles=c.getFiles;m.exportPreparedSaveData=c.exportData;delete globalThis.${control}}
  })()`);
  assert.equal(result.files, 387);
  assert.ok(result.logicalPayloadCharacters > result.maxStringLength);
  assert.equal(result.staleCode, 'STALE_REVISION');
  assert.equal(result.preview.ok, true, JSON.stringify(result.preview));
  assert.equal(result.preview.data.imageSummary.original, 0);
  return { status: 'passed', kind: 'synthetic identity stress; shared immutable string backing, no large bitmap decoding or real-workload peak-memory claim', ...result };
}
