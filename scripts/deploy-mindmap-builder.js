const path = require("path");
const fs = require("fs/promises");
const { minify } = require("uglify-js");
const LZString = require("lz-string");

const CHUNK_SIZE = 256;
const NEEDLE = "const removeKeydownHandlers";

const root = path.resolve(__dirname, "..");
const sourcePath = path.join(root, "ea-scripts", "Mindmap Builder.js");
const outputPath = path.join(root, "ea-scripts", "Mindmap Builder.md");

const HEADER = `/*

# Mind Map Builder

![](https://youtu.be/5G9QF-u9w0Q)

## Overview
**Mind Map Builder** transforms the Obsidian-Excalidraw canvas into a rapid brainstorming environment, allowing users to build complex, structured, and visually organized mind maps using primarily keyboard shortcuts.

The script balances **automation** (auto-layout, recursive grouping, and contrast-aware coloring) with **explicit flexibility** (node pinning and redirection logic), ensuring that the mind map stays organized even as it grows to hundreds of nodes. It leverages the Excalidraw Sidepanel API to provide a persistent control interface utilizing the Obsidian sidepanel, that can also be undocked into a floating modal.

> [!Tip]
> 🚀 Become a MindMap Builder Pro with the Official [MindMap Builder Course](https://www.visual-thinking-workshop.com/mindmap)!

> [!Info]
> Mindmap Builder is Minified and compressed to reduce size and improve performance. You can find the source here: [Mindmap Builder.js](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/Mindmap%20Builder.js)

## Show Your Love!

💖 **If you love MindMap Builder** say thank you, and [Buy me a Coffee](https://ko-fi.com/zsolt) 🍵

## The Script

\`\`\`js*/
`;

const FOOTER = `
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

const mmbSource = \`
`;

const FOOTER_TAIL = `\`;
const script = ea.decompressFromBase64(mmbSource.replaceAll("\\n", "").trim())
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
await new AsyncFunction("ea", "utils", script)(ea, utils);
`;

function chunkString(input, size) {
	const chunks = [];
	for (let i = 0; i < input.length; i += size) {
		chunks.push(input.slice(i, i + size));
	}
	return chunks;
}

function stripHeader(source) {
	const idx = source.indexOf(NEEDLE);
	if (idx === -1) {
		throw new Error(`Marker "${NEEDLE}" not found in Mindmap Builder.js`);
	}
	return source.slice(idx);
}

function wrapAsyncIIFE(body) {
	return `(async()=>{\n${body}\n})()`;
}

function minifyCode(source) {
	const result = minify(source, {
		compress: { passes: 3 },
		mangle: true,
		output: { ascii_only: true }
	});

	if (result.error) {
		throw result.error;
	}

	return result.code;
}

function unwrapAsyncIIFE(minified) {
	const match = minified.match(/^\(async\(\)=>\{([\s\S]*)\}\)\(\);?$/);
	if (!match) {
		throw new Error("Unable to strip async IIFE wrapper from minified output");
	}
	return match[1];
}

function compressBase64(text) {
	return LZString.compressToBase64(text);
}

function formatCompressed(compressed) {
	return chunkString(compressed, CHUNK_SIZE).join("\n\n");
}

async function generate() {
	const raw = await fs.readFile(sourcePath, "utf8");
	const body = stripHeader(raw).trim();
	const wrapped = wrapAsyncIIFE(body);
	const minified = minifyCode(wrapped);
	const unwrapped = unwrapAsyncIIFE(minified);
	const compressed = compressBase64(unwrapped);
	const formatted = formatCompressed(compressed);

	const output = `${HEADER}${FOOTER}${formatted}${FOOTER_TAIL}`;
	await fs.writeFile(outputPath, output, "utf8");
	console.log(`Mindmap Builder.md generated at ${outputPath}`);
}

generate().catch((err) => {
	console.error(err);
	process.exitCode = 1;
});
