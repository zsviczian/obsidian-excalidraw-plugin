/** One coordinator-owned debugger. Never detach an existing user's attachment. */
import { randomUUID } from "node:crypto";
import { parseCLIJSON } from "./inAppTask.mjs";

export function acquireDebuggerSession(cli) {
  const evaluate = code => parseCLIJSON(cli("eval", "code=" + code));
  const attached = evaluate('JSON.stringify(require("@electron/remote").getCurrentWebContents().debugger.isAttached())');
  if (attached !== false) throw Error("Native debugger is already attached; close the existing DevTools/debugger before this owned run");
  const key = "__excalidrawTestConsole_" + randomUUID().replaceAll("-", "");
  let attachedByUs = false, installed = false, disposed = false;
  try {
    cli("dev:debug", "on"); attachedByUs = true;
    cli("dev:cdp", "method=Runtime.discardConsoleEntries", "params={}");
    evaluate(`(()=>{if(globalThis[${JSON.stringify(key)}])throw Error('Console controller collision');const c={errors:[]};c.debugger=require('@electron/remote').getCurrentWebContents().debugger;c.listener=(_event,method,params)=>{if(method==='Runtime.consoleAPICalled'&&params.type==='error')c.errors.push({kind:'console',messages:params.args.map(arg=>String(arg.description??arg.value??arg.type)+(arg.preview?.properties?' '+JSON.stringify(arg.preview.properties):''))});if(method==='Runtime.exceptionThrown')c.errors.push({kind:'exception',messages:[String(params.exceptionDetails.exception?.description??params.exceptionDetails.text)]});};c.debugger.on('message',c.listener);globalThis[${JSON.stringify(key)}]=c;return JSON.stringify({installed:true});})()`);
    installed = true;
    cli("dev:cdp", "method=Runtime.enable", "params={}");
  } catch (error) {
    if (installed) evaluate(`(()=>{const c=globalThis[${JSON.stringify(key)}];c.debugger.removeListener('message',c.listener);delete globalThis[${JSON.stringify(key)}];return JSON.stringify(true);})()`);
    if (attachedByUs) cli("dev:debug", "off");
    throw error;
  }
  return {
    read: () => evaluate(`JSON.stringify(globalThis[${JSON.stringify(key)}].errors)`),
    dispose() {
      if (disposed) return;
      evaluate(`(()=>{const c=globalThis[${JSON.stringify(key)}];if(!c)throw Error('Owned console controller disappeared');c.debugger.removeListener('message',c.listener);delete globalThis[${JSON.stringify(key)}];return JSON.stringify(true);})()`);
      cli("dev:debug", "off"); disposed = true;
    },
  };
}

export function unexpectedConsoleErrors(errors, expected = []) {
  const counts = expected.map(() => 0), unexpected = [];
  for (const error of errors) {
    const message = error.messages.join("\n");
    const index = expected.findIndex(item => error.kind === (item.kind || "console") && message.includes(item.contains));
    if (index < 0) unexpected.push(error); else counts[index]++;
  }
  expected.forEach((item, index) => { if (counts[index] < item.min || counts[index] > item.max) unexpected.push({ kind: "expected-error-count", messages: [`${item.contains}: observed ${counts[index]}, expected ${item.min}–${item.max}`] }); });
  return unexpected;
}
