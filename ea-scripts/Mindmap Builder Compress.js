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
# Mind Map Builder: Technical Specification & User Guide

## Overview
**Mind Map Builder** transforms the Obsidian-Excalidraw canvas into a rapid brainstorming environment, allowing users to build complex, structured, and visually organized mind maps using primarily keyboard shortcuts.

The script balances **automation** (auto-layout, recursive grouping, and contrast-aware coloring) with **explicit flexibility** (node pinning and redirection logic), ensuring that the mind map stays organized even as it grows to hundreds of nodes. It leverages the Excalidraw Sidepanel API to provide a persistent control interface utilizing the Obsidian sidepanel, that can also be undocked into a floating modal.

> [!Note]
> Mindmap Builder is Minified for reasons of size and performance. You can find the source here: [Mindmap Builder.js](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Mindmap%20Builder.js)

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
