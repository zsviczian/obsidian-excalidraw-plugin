async function compress () {
  ea = ExcalidrawAutomate;
  const f = app.workspace.activeLeaf.view.file;
  const data = await app.vault.read(f);
  const compressed = ea.compressToBase64(data);
  let result = '';
  const chunkSize = 256;
  for (let i = 0; i < compressed.length; i += chunkSize) {
    result += compressed.slice(i, i + chunkSize) + '\n\n';
  }

  await app.vault.modify(f,`/*
\`\`\`js*/
if (!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("2.19.0")) {
new Notice("Please update the Excalidraw Plugin to version 2.19.0 or higher.");
return;
}

const existingTab = ea.checkForActiveSidepanelTabForScript();
if (existingTab) {
  const hostEA = existingTab.getHostEA();
  if (hostEA && hostEA !== ea) {
    hostEA.activateMindmap = true;
    hostEA.setView(ea.targetView);
    existingTab.open();
    return;
  }
};

const mmbSource = \`${result}\`;
const script = ea.decompressFromBase64(mmbSource.replaceAll("\\n", "").trim())
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
await new AsyncFunction("ea", "utils", script)(ea, utils);
`);
}
