import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {recordCLIResult,createAcknowledgedCLI} from './acknowledgedCLI.mjs';

test('renderer receipt records an actual async result once before acknowledging it',async()=>{
  const context=vm.createContext({calls:0});
  const execute=vm.runInContext(`(${recordCLIResult.toString()})`,context);
  assert.equal(await execute('owned',1,'(async()=>{calls++;await Promise.resolve();return JSON.stringify({saved:true})})()'),'{"saved":true}');
  assert.equal(context.calls,1);assert.equal(context.owned.state,'done');assert.equal(context.owned.value,'{"saved":true}');
  await assert.rejects(execute('owned',2,'throw Error("actual failure")'),/actual failure/);
  assert.equal(context.owned.state,'done');assert.match(context.owned.error,/actual failure/);
});

test('renderer receipt refuses to overwrite pending or foreign work',async()=>{
  const context=vm.createContext({owned:{owner:'owned',id:1,state:'pending'},calls:0});
  const execute=vm.runInContext(`(${recordCLIResult.toString()})`,context);
  await assert.rejects(execute('owned',2,'calls++'),/Unsettled or unowned/);
  assert.equal(context.calls,0);assert.equal(context.owned.id,1);
  context.owned={owner:'foreign',state:'done'};
  await assert.rejects(execute('owned',3,'calls++'),/Unsettled or unowned/);
});

function harness({state='done',foreign=false,actualError,disposeLost=false}={}) {
  const key='__excalidrawCLIReceipt_fixture';
  let calls=0,removed=false;
  const run=(name,...args)=>{
    assert.equal(name,'eval');const code=args[0].slice(5);
    if(code.startsWith('JSON.stringify'))return '=> '+JSON.stringify(removed?null:{owner:foreign?'foreign':key,id:1,state,kind:'string',value:'{"saved":true}',error:actualError});
    if(code.startsWith('(()=>')){removed=true;if(disposeLost)throw Error('ETIMEDOUT');return '=> {"disposed":true}';}
    calls++;throw Error('ETIMEDOUT');
  };
  let clock=0;
  const transport=createAcknowledgedCLI(run,{token:'fixture',now:()=>clock,wait:ms=>clock+=ms,timeoutMs:200});
  return {transport,calls:()=>calls,removed:()=>removed};
}

test('a lost response adopts the exact completed receipt without replaying the mutation',()=>{
  const h=harness();assert.equal(h.transport.cli('eval','code=JSON.stringify({saved:true})'),'=> {"saved":true}');
  assert.equal(h.calls(),1);assert.equal(h.transport.diagnostics.length,1);
  h.transport.dispose();assert.equal(h.removed(),true);h.transport.dispose();
});

test('pending and mismatched receipts remain failures and preserve native work',()=>{
  for(const options of [{state:'pending'},{foreign:true}]){
    const h=harness(options);assert.throws(()=>h.transport.cli('eval','code=1'),error=>error.cleanupFailed===true);
    assert.equal(h.calls(),1);assert.equal(h.removed(),false);
  }
});

test('a failed operation remains a failure even if its response was lost',()=>{
  const h=harness({actualError:'write refused'});
  assert.throws(()=>h.transport.cli('eval','code=1'),/write refused/);assert.equal(h.calls(),1);
});

test('a lost cleanup response is accepted only after confirming the receipt is absent',()=>{
  const h=harness({disposeLost:true});h.transport.cli('eval','code=1');h.transport.dispose();
  assert.equal(h.removed(),true);assert.equal(h.transport.diagnostics.at(-1).recovered,'confirmed absent');
});

test('native commands still use the real CLI and normal protocol results preserve its JSON format',()=>{
  const calls=[];const t=createAcknowledgedCLI((name,...args)=>{calls.push({name,args});return name==='eval'?'=> {}':'{"ok":true}';},{token:'normal'});
  assert.equal(t.cli('obsidian-excalidraw-plugin:apply','json={}'),'{"ok":true}');
  assert.equal(calls[0].name,'obsidian-excalidraw-plugin:apply');
  assert.equal(t.cli('dev:cdp','method=Input.dispatchTouchEvent','params={"type":"touchEnd","touchPoints":[]}'),'{}');
  assert.match(calls[1].args[0],/getCurrentWebContents/);
});

test('an owned operation may finish after its response deadline without being restarted',()=>{
  let clock=0,executions=0,reads=0;
  const key='__excalidrawCLIReceipt_pending';
  const transport=createAcknowledgedCLI((name,...args)=>{
    if(args[0].startsWith('code=JSON.stringify')){
      reads++;return '=> '+JSON.stringify({owner:key,id:1,state:reads<3?'pending':'done',kind:'string',value:'{"saved":true}'});
    }
    executions++;throw Error('ETIMEDOUT');
  },{token:'pending',now:()=>clock,wait:ms=>clock+=ms,timeoutMs:500});
  assert.equal(transport.cli('eval','code=1'),'=> {"saved":true}');
  assert.equal(executions,1);assert.equal(reads,3);assert.equal(clock,100);
});

test('clearing errors never repeats the mutation or discards newly captured diagnostics',()=>{
  for(const captured of ['No errors captured.','ResizeObserver loop']){
    let clears=0;
    const transport=createAcknowledgedCLI((name,...args)=>{
      assert.equal(name,'dev:errors');if(args[0]==='clear'){clears++;throw Error('ETIMEDOUT');}return captured;
    });
    if(captured==='No errors captured.')assert.equal(transport.cli('dev:errors','clear'),'');
    else assert.throws(()=>transport.cli('dev:errors','clear'),/ETIMEDOUT/);
    assert.equal(clears,1);
  }
});

test('response transport deadlines remain shorter than the native operation deadline',()=>{
  let recorded;
  const transport=createAcknowledgedCLI(()=>{throw Error('Unexpected default path');},{invoke:(name,args,timeout)=>{recorded=timeout;return '=> true';},responseTimeoutMs:1000,timeoutMs:60000});
  transport.cli('eval','code=JSON.stringify(true)');assert.equal(recorded,1000);
});

test('a lost screenshot reply adopts only a fresh decoded artifact without taking another capture',async()=>{
  const {mkdtempSync,writeFileSync,rmSync}=await import('node:fs');
  const {tmpdir}=await import('node:os');const {join}=await import('node:path');
  const root=mkdtempSync(join(tmpdir(),'screenshot-receipt-'));const file=join(root,'owned.png');let captures=0;
  try {
    const transport=createAcknowledgedCLI((name,...args)=>{
      if(name==='dev:screenshot'){captures++;writeFileSync(file,'owned');throw Error('ETIMEDOUT');}
      assert.equal(name,'eval');return '=> {"empty":false,"width":390,"height":844}';
    },{screenshotRoot:root});
    transport.cli('dev:screenshot','path='+file);assert.equal(captures,1);
    assert.equal(transport.diagnostics.at(-1).recovered,'decoded fresh screenshot');
    // Existing artifacts cannot prove this invocation completed.
    assert.throws(()=>transport.cli('dev:screenshot','path='+file),/ETIMEDOUT/);
    assert.equal(captures,2);
    assert.throws(()=>transport.cli('dev:screenshot','path='+join(root,'..','outside.png')),/Unowned/);
  }finally{rmSync(root,{recursive:true,force:true});}
});
