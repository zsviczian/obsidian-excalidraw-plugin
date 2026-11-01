import assert from "node:assert/strict";
import test from "node:test";
import {retryReadOnly} from "./readOnlyTransport.mjs";
test("a lost preparatory read response is retried and retained as transport evidence",()=>{
  let calls=0;const diagnostics=[];
  assert.equal(retryReadOnly(()=>{if(++calls===1)throw Error("CLI ETIMEDOUT");return 42;},{diagnostics}),42);
  assert.equal(calls,2);assert.equal(diagnostics.length,1);
});
test("persistent timeouts, expired deadlines and functional errors remain failures",()=>{
  let calls=0;assert.throws(()=>retryReadOnly(()=>{calls++;throw Error("CLI ETIMEDOUT")}),/ETIMEDOUT/);assert.equal(calls,3);
  calls=0;assert.throws(()=>retryReadOnly(()=>{calls++;throw Error("CLI ETIMEDOUT")},{deadline:10,now:()=>10}),/ETIMEDOUT/);assert.equal(calls,1);
  calls=0;assert.throws(()=>retryReadOnly(()=>{calls++;throw Error("wrong actual state")}));assert.equal(calls,1);
});
