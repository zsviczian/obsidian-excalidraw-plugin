import { parseCLIJSON } from "./inAppTask.mjs";
/** Mode changes reload the host, briefly removing its CLI command registry. */
export async function waitForNativeReady(cli, { timeoutMs = 60_000, now = () => Date.now(), wait = ms => new Promise(resolve => setTimeout(resolve, ms)), diagnostics = [] } = {}) {
  const end = now() + timeoutMs;
  for (;;) {
    try {
      const result = parseCLIJSON(cli("eval", 'code=JSON.stringify((()=>{const p=app.plugins?.plugins?.["obsidian-excalidraw-plugin"];return p?.isReady?{ready:true,runtime:!!p.getCLIRuntime(),mobile:app.isMobile===true}:{ready:false};})())'));
      if (result.ready && result.runtime) return result;
    } catch (error) {
      if (!/Command "eval" not found|Execution context was destroyed|Cannot find context with specified id/.test(error.message)) throw error;
      if (!diagnostics.includes(error.message)) diagnostics.push(error.message);
    }
    if (now() >= end) throw Error("Native host did not restore CLI/plugin readiness after reload");
    await wait(100);
  }
}
