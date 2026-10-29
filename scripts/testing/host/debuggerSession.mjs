/** One coordinator-owned debugger. Never detach an existing user's attachment. */
import { randomUUID } from "node:crypto";
import { parseCLIJSON } from "./inAppTask.mjs";

export function acquireDebuggerSession(cli) {
  const evaluate = (code) => parseCLIJSON(cli("eval", "code=" + code));
  const attached = evaluate(
    'JSON.stringify(require("@electron/remote").getCurrentWebContents().debugger.isAttached())',
  );
  if (attached !== false)
    throw Error(
      "Native debugger is already attached; close the existing DevTools/debugger before this owned run",
    );
  const originalBackgroundThrottling = evaluate(
    'JSON.stringify(require("@electron/remote").getCurrentWebContents().getBackgroundThrottling())',
  );
  if (typeof originalBackgroundThrottling !== "boolean")
    throw Error("Native scheduling identity unavailable");
  let schedulingOwned = false;
  const restoreScheduling = () => {
    if (schedulingOwned) {
      evaluate(
        `(()=>{require('@electron/remote').getCurrentWebContents().setBackgroundThrottling(${originalBackgroundThrottling});return JSON.stringify(true);})()`,
      );
      schedulingOwned = false;
    }
  };
  const key = "__excalidrawTestConsole_" + randomUUID().replaceAll("-", "");
  let attachedByUs = false,
    installed = false,
    disposed = false;
  try {
    // The real renderer can be occluded even while CLI reports a focused window.
    // Keep test input/render scheduling active, then restore the exact prior value.
    schedulingOwned = true;
    evaluate(
      "(()=>{require('@electron/remote').getCurrentWebContents().setBackgroundThrottling(false);return JSON.stringify(true);})()",
    );
    cli("dev:debug", "on");
    attachedByUs = true;
    cli("dev:cdp", "method=Runtime.disable", "params={}");
    cli("dev:cdp", "method=Runtime.discardConsoleEntries", "params={}");
    evaluate(
      `(()=>{if(globalThis[${JSON.stringify(key)}])throw Error('Console controller collision');const c={errors:[],contexts:{}};c.debugger=require('@electron/remote').getCurrentWebContents().debugger;c.listener=(_event,method,params)=>{if(method==='Runtime.executionContextCreated')c.contexts[params.context.id]=params.context;if(method==='Runtime.consoleAPICalled'&&params.type==='error')c.errors.push({kind:'console',overflowArgs:params.args.some(arg=>arg.preview?.overflow)?params.args:undefined,messages:params.args.map(arg=>String(arg.description??arg.value??arg.type)+(arg.preview?.properties?' '+JSON.stringify(arg.preview.properties):'')+(arg.preview?.overflow?' [preview truncated]':''))});if(method==='Runtime.exceptionThrown')c.errors.push({kind:'exception',timestamp:params.timestamp,context:c.contexts[params.exceptionDetails.executionContextId],tasks:Object.keys(globalThis).filter(key=>key.startsWith('__excalidrawTestTask_')).map(key=>({key,phase:globalThis[key].phase,activeCase:globalThis[key].activeCase,lastCase:globalThis[key].tests.at(-1)?.testId})),details:params.exceptionDetails,messages:[String(params.exceptionDetails.exception?.description??params.exceptionDetails.exception?.value??params.exceptionDetails.text)]});};c.debugger.on('message',c.listener);globalThis[${JSON.stringify(key)}]=c;return JSON.stringify({installed:true});})()`,
    );
    installed = true;
    cli("dev:cdp", "method=Runtime.enable", "params={}");
  } catch (error) {
    try {
      if (installed)
        evaluate(
          `(()=>{const c=globalThis[${JSON.stringify(key)}];c.debugger.removeListener('message',c.listener);delete globalThis[${JSON.stringify(key)}];return JSON.stringify(true);})()`,
        );
    } finally {
      try {
        restoreScheduling();
      } finally {
        if (attachedByUs) cli("dev:debug", "off");
      }
    }
    throw error;
  }
  return {
    scheduling: {
      originalBackgroundThrottling,
      scopedBackgroundThrottling: false,
    },
    read: () => {
      const errors = evaluate(
        `JSON.stringify(globalThis[${JSON.stringify(key)}].errors)`,
      );
      if (!errors.some((error) => error.overflowArgs)) return errors;
      // A CDP preview contains only a few fields. Read all own properties before
      // deciding that a missing-file diagnostic contains no additional error.
      return evaluate(
        `(${completeConsoleErrors.toString()})(globalThis[${JSON.stringify(key)}]).then(JSON.stringify)`,
      );
    },
    dispose() {
      if (disposed) return;
      try {
        evaluate(
          `(()=>{const c=globalThis[${JSON.stringify(key)}];if(!c)throw Error('Owned console controller disappeared');c.debugger.removeListener('message',c.listener);delete globalThis[${JSON.stringify(key)}];return JSON.stringify(true);})()`,
        );
      } finally {
        try {
          restoreScheduling();
        } finally {
          cli("dev:debug", "off");
          disposed = true;
        }
      }
    },
  };
}

export function unexpectedConsoleErrors(errors, expected = []) {
  const counts = expected.map(() => 0),
    unexpected = [];
  for (const error of errors) {
    const message = error.messages.join("\n");
    const index = expected.findIndex(
      (item) =>
        error.kind === (item.kind || "console") &&
        (item.contains
          ? message.includes(item.contains)
          : item.containsAll?.length > 0) &&
        (!item.containsAll ||
          item.containsAll.every((fragment) => message.includes(fragment))) &&
        (!item.excludes ||
          item.excludes.every((fragment) => !message.includes(fragment))),
    );
    if (index < 0) unexpected.push(error);
    else counts[index]++;
  }
  expected.forEach((item, index) => {
    if (counts[index] < item.min || counts[index] > item.max)
      unexpected.push({
        kind: "expected-error-count",
        messages: [
          `${item.contains}: observed ${counts[index]}, expected ${item.min}–${item.max}`,
        ],
      });
  });
  return unexpected;
}

/** Resolve truncated CDP objects without invoking accessors or trusting a preview. */
export async function completeConsoleErrors(controller) {
  const readObject = async (objectId, depth) => {
    const full = await controller.debugger.sendCommand(
      "Runtime.getProperties",
      { objectId, ownProperties: true },
    );
    let incomplete = !!full.exceptionDetails;
    const properties = [];
    for (const property of full.result || []) {
      const value = property.value;
      const item = {
        name: property.name,
        type: value?.type ?? "accessor",
        value: String(
          value?.value ?? value?.description ?? value?.type ?? "accessor",
        ),
      };
      if (!value || value.type === "function") incomplete = true;
      if (value?.objectId) {
        if (value.subtype === "error" && depth < 1) {
          const nested = await readObject(value.objectId, depth + 1);
          item.properties = nested.properties;
          incomplete ||= nested.incomplete;
        } else incomplete = true;
      }
      properties.push(item);
    }
    return { properties, incomplete };
  };
  for (const error of controller.errors) {
    if (!error.overflowArgs) continue;
    error.messages = await Promise.all(
      error.overflowArgs.map(async (arg) => {
        if (!arg.preview?.overflow)
          return (
            String(arg.description ?? arg.value ?? arg.type) +
            (arg.preview?.properties
              ? " " + JSON.stringify(arg.preview.properties)
              : "")
          );
        const full = await readObject(arg.objectId, 0);
        return (
          String(arg.description ?? arg.type) +
          " " +
          JSON.stringify(full.properties) +
          (full.incomplete ? " [preview truncated]" : "")
        );
      }),
    );
    delete error.overflowArgs;
  }
  return controller.errors;
}
