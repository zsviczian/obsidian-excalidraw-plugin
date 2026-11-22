/** Invocation identity stays with the one-shot EA, never a shared current-script flag. */
import type { ExcalidrawAutomate } from "src/shared/ExcalidrawAutomate";

const cliScripts = new WeakSet<ExcalidrawAutomate>();

/** Whether an EA belongs to a currently executing native CLI script. */
export const isCLIScript = (ea: ExcalidrawAutomate): boolean => cliScripts.has(ea);

/** Releases the invocation marker even when execution or result serialization fails. */
export async function withCLIScriptContext<T>(ea: ExcalidrawAutomate, run: () => Promise<T>): Promise<T> {
  cliScripts.add(ea);
  try { return await run(); }
  finally { cliScripts.delete(ea); }
}
