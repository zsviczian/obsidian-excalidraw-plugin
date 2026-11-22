/** Recover only the exact native write receipt after lost stdout; never replay the write. */
export function createNativeCLIActions(cli) {
  const recoveries = [];
  const action = (command, request = {}, inputPath) => {
    try {
      return JSON.parse(cli(`obsidian-excalidraw-plugin:${command}`, inputPath ? `input=${inputPath}` : `json=${JSON.stringify({ apiVersion: 1, ...request })}`));
    } catch (error) {
      if (!request.requestId || !/\bETIMEDOUT\b/.test(error.message)) throw error;
      let receipt;
      try { receipt = JSON.parse(cli('obsidian-excalidraw-plugin:result', `requestId=${request.requestId}`)); }
      catch { throw error; }
      if (receipt.command !== command || receipt.requestId !== request.requestId || !['completed', 'failed'].includes(receipt.status)) throw error;
      recoveries.push({ command, requestId: request.requestId, session: receipt.session, transportError: error.message });
      return receipt;
    }
  };
  return { action, recoveries };
}
