import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createArtifactManifest,fileHash} from '../contracts.mjs';
import {stageExtras} from './combination.mjs';
function fixture(){
  const output=mkdtempSync(join(tmpdir(),'excalidraw-combination-')),root=join(output,'extras');mkdirSync(join(root,'dist'),{recursive:true});
  const entries=['main.js','manifest.json','styles.css','index.d.ts'];
  entries.forEach(name=>writeFileSync(join(root,'dist',name),name==='manifest.json'?JSON.stringify({id:'excalidraw-extras'}):'owned '+name));
  const manifest=createArtifactManifest({root,kind:'extras',repository:'zsviczian/obsidian-excalidraw-extras',buildCommand:'synthetic producer fixture',identity:{commit:'a'.repeat(40),dirty:false,diffHash:'b'.repeat(64),lockfileHash:'c'.repeat(64)},artifacts:entries.map((name,i)=>({role:['main','manifest','styles','declarations'][i],relativePath:'dist/'+name}))});
  const config=join(output,'vault/.obsidian');mkdirSync(config,{recursive:true});return{combination:{output,manifests:{extras:manifest}},target:{config},root,discoverPlugin:async()=>({discovery:'test-adapter'})};
}
test('corrupt frozen Extras bytes fail before the first native call',async()=>{
  const input=fixture();writeFileSync(join(input.root,'dist/main.js'),'corrupted');let calls=0;
  await assert.rejects(stageExtras({...input,cli:()=>{calls++;}}),/mismatch/);assert.equal(calls,0);
});
test('redirected companion destination fails before disable or deployment',async()=>{
  const input=fixture(),outside=join(input.combination.output,'outside');mkdirSync(outside);mkdirSync(join(input.target.config,'plugins'));
  symlinkSync(outside,join(input.target.config,'plugins/excalidraw-extras'),process.platform==='win32'?'junction':'dir');let calls=0;
  await assert.rejects(stageExtras({...input,cli:()=>{calls++;}}),/Redirected/);assert.equal(calls,0);
});
test('companion staging proves installed bytes and restores prior disabled state',async()=>{
  const input=fixture(),calls=[];
  const result=await stageExtras({...input,cli:(command,...args)=>{calls.push([command,...args]);if(command==='eval')return args[0].includes('loaded:')?'{"loaded":false}':'true';return'';}});
  assert.equal(result.evidence.installedHashes.main,fileHash(join(input.target.config,'plugins/excalidraw-extras/main.js')));
  assert.equal(JSON.parse(readFileSync(join(input.target.config,'plugins/excalidraw-extras/manifest.json'))).id,'excalidraw-extras');
  assert.equal(calls.filter(call=>call[0]==='plugin:disable').length,0);result.cleanup();
  assert.equal(calls.filter(call=>call[0]==='plugin:disable').length,1);
});
