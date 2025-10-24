/* eslint-disable no-console */
// to run: npm run doc
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EA_SCRIPTS_DIR = path.join(ROOT, 'ea-scripts');
const INDEX_NEW = path.join(EA_SCRIPTS_DIR, 'index-new.md');
const OUT_DIR = path.join(path.join(ROOT, 'docs'), 'AITrainingData');
const SCRIPT_LIBRARY_OUT = path.join(OUT_DIR, 'Excalidraw Script Library.md');
const TYPE_DEF_OUT = path.join(OUT_DIR, 'Excalidraw Automate library and related type definitions.md');
const AI_TRAINING_OUT = path.join(OUT_DIR, 'ExcalidrawAutomate full library for LLM training.md');

const AI_TRAINING_INTRO = `**ExcalidrawAutomate full library for LLM training**

Excalidraw-Obsidian is an Obsidian.md plugins that is built on the open source Excalidraw component. Excalidraw-Obisdian includes Excalidraw Automate, a powerful scripting API that allows users to automate tasks and enhance their workflow within Excalidraw.

Read the information below and respond with I'm ready. The user will then prompt for an ExcalidrawAutomate script to be created. Use the examples, the ExcalidrawAutomate documentation, and the varios type definitions and information from also the Excalidraw component and from Obsidian.md to generate the script based on the user's requirements.

The Obsidian.md module is available on ea.obsidian.

`;

const SCRIPT_INTRO = `# Excalidraw Script Library Examples

This is an automatically generated knowledge base intended for Retrieval Augmented Generation (RAG) and other AI-assisted workflows (e.g. NotebookLM or local embeddings tools).  
Its purpose:
- Provide a single, query-friendly corpus of all Excalidraw Automate scripts.
- Serve as a practical pattern and snippet library for developers learning Excalidraw Automate.
- Preserve original source side by side with the higher-level index (index-new.md) to improve semantic recall.
- Enable AI tools to answer questions about how to manipulate the Excalidraw canvas, elements, styling, or integration features by referencing real, working examples.

Content structure:
1. SCRIPT_INTRO (this section)
2. The curated script overview (index-new.md)
3. Raw source of every *.md script in /ea-scripts (each fenced code block is auto-closed to ensure well-formed aggregation)

Generated on: ${new Date().toISOString()}

---

`;

const TYPE_DEF_INTRO = `# ExcalidrawAutomate library and related type definitions

`;

const ADDITIONAL_TYPE_DEFS_FOR_AI_TRAINING = [
  "node_modules/obsidian/obsidian.d.ts",
];

const TYPE_DEF_WHITELIST = [
  "lib/shared/ExcalidrawAutomate.d.ts",
  "lib/types/excalidrawAutomateTypes.d.ts",
  "lib/types/penTypes.d.ts",
  "lib/types/utilTypes.d.ts",
  "lib/types/exportUtilTypes.d.ts",
  "lib/types/embeddedFileLoaderTypes.d.ts",
  "lib/types/AIUtilTypes.d.ts",
  "node_modules/@zsviczian/excalidraw/types/element/src/types.d.ts",
  "node_modules/@zsviczian/excalidraw/types/excalidraw/types.d.ts",
];

/**
 * Returns true if content contains at least one line starting with ```
 * and has an odd number of fences (unbalanced).
 */
function needsClosingFence(content) {
  const fenceCount = (content.match(/^```/gm) || []).length;
  return fenceCount > 0 && fenceCount % 2 === 1;
}

// Add: helpers for type-def aggregation
function normalizeEOL(str) {
  return str.replace(/\r\n/g, '\n');
}

function stripBOM(str) {
  return str.replace(/^\uFEFF/, '');
}

/**
 * Remove top-of-file imports/references while preserving initial comments/blank lines.
 * Also removes bare "export {}" lines (module markers).
 */
function stripTopImports(content) {
  const lines = normalizeEOL(stripBOM(content)).split('\n');
  const out = [];
  let inTopRegion = true;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const isImport =
      /^\s*import\s+type\s+/.test(line) ||
      /^\s*import\s+/.test(line) ||
      /^\s*import\(/.test(line);

    const isTripleRef = /^\s*\/\/\/\s*<reference/.test(line);
    const isBareExportModule = /^\s*export\s*\{\s*\};?\s*$/.test(line);

    if (inTopRegion) {
      if (isImport || isTripleRef) {
        // drop
        continue;
      }
      // comments and blanks are kept, top-region continues until first code (non-comment/non-blank/non-import)
      const isBlank = /^\s*$/.test(line);
      const isLineComment = /^\s*\/\//.test(line);
      const isBlockCommentStart = /^\s*\/\*/.test(line);

      if (!isBlank && !isLineComment && !isBlockCommentStart) {
        inTopRegion = false;
      }
      if (!isBareExportModule) out.push(line);
      continue;
    }

    if (!isBareExportModule) out.push(line);
  }

  return out.join('\n').trim() + '\n';
}

/**
 * Create a nice section header for the concatenated file.
 */
function makeSectionHeader(relPath) {
  const stars = '*'.repeat(Math.max(6, Math.min(38, relPath.length + 6)));
  return [
    `/* ${stars} */`,
    `/* ${relPath} */`,
    `/* ${stars} */`,
  ].join('\n') + '\n';
}

/**
 * Build the concatenated types markdown body from the whitelist only.
 * - Removes top-of-file imports
 * - Adds section headers with relative paths
 * - Wraps all in one ```js code fence
 */
function buildTypeDefMarkdown() {
  const entries = TYPE_DEF_WHITELIST.map((rel) => ({
    rel,
    abs: path.join(ROOT, ...rel.split('/')),
  }));

  let body = '```js\n';
  for (const { rel, abs } of entries) {
    if (!fs.existsSync(abs)) {
      console.warn('[script-library] Whitelist file missing:', rel);
      continue;
    }
    let content = fs.readFileSync(abs, 'utf8');
    content = stripTopImports(content);

    body += makeSectionHeader(rel);
    body += content.trimEnd() + '\n\n';
  }
  body += '```\n';
  return body;
}

/**
 * Build additional type defs used only in AI_TRAINING_OUT (e.g. obsidian.d.ts).
 */
function buildAdditionalTypeDefsMarkdown() {
  const entries = ADDITIONAL_TYPE_DEFS_FOR_AI_TRAINING.map((rel) => ({
    rel,
    abs: path.join(ROOT, ...rel.split('/')),
  }));

  let body = '```js\n';
  for (const { rel, abs } of entries) {
    if (!fs.existsSync(abs)) {
      console.warn('[script-library] Additional type def missing:', rel);
      continue;
    }
    let content = fs.readFileSync(abs, 'utf8');
    content = stripTopImports(content);
    body += makeSectionHeader(rel);
    body += content.trimEnd() + '\n\n';
  }
  body += '```\n';
  return body;
}

function main() {
  console.log('[script-library] Generating Excalidraw Script Library...');
  if (!fs.existsSync(EA_SCRIPTS_DIR)) {
    console.error('ea-scripts directory not found:', EA_SCRIPTS_DIR);
    process.exit(1);
  }
  if (!fs.existsSync(INDEX_NEW)) {
    console.error('index-new.md not found:', INDEX_NEW);
    process.exit(1);
  }
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  let output = SCRIPT_INTRO;

  console.log('[script-library] Adding index-new.md');
  const indexNewContent = fs.readFileSync(INDEX_NEW, 'utf8');
  output += `<!-- BEGIN index-new.md -->\n${indexNewContent.trim()}\n<!-- END index-new.md -->\n\n`;
  output += `---\n\n# Script Sources\n`;

  // Collect *.md files (non-recursive) excluding index-new.md
  const files = fs
    .readdirSync(EA_SCRIPTS_DIR, { withFileTypes: true })
    .filter(
      (d) =>
        d.isFile() &&
        d.name.endsWith('.md') &&
        d.name.toLowerCase() !== 'index-new.md'
    )
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));

  for (const file of files) {
    const full = path.join(EA_SCRIPTS_DIR, file);
    let content = fs.readFileSync(full, 'utf8');

    output += `\n---\n\n## ${file}\n`;
    output += `<!-- Source: ea-scripts/${file} -->\n\n`;

    // Normalize line endings
    content = content.replace(/\r\n/g, '\n');

    output += content.trimEnd() + '\n';

    if (needsClosingFence(content)) {
      output += '```\n';
      console.log(`[script-library] Added missing closing fence to ${file}`);
    } else {
      console.log(`[script-library] Added ${file} (no fence fix needed)`);
    }
  }

  fs.writeFileSync(SCRIPT_LIBRARY_OUT, output, 'utf8');
  console.log('[script-library] Wrote:', SCRIPT_LIBRARY_OUT);

  // Generate TYPE_DEF_OUT from whitelist
  try {
    console.log('[script-library] Generating Type Definition Library...');
    const typeDefs = TYPE_DEF_INTRO + '\n' + buildTypeDefMarkdown();
    fs.writeFileSync(TYPE_DEF_OUT, typeDefs, 'utf8');
    console.log('[script-library] Wrote:', TYPE_DEF_OUT);
  } catch (e) {
    console.error('[script-library] Failed to generate TYPE_DEF_OUT:', e);
  }

  // NEW: Generate AI_TRAINING_OUT
  try {
    console.log('[script-library] Generating AI Training bundle...');
    const typeDefContent = fs.existsSync(TYPE_DEF_OUT)
      ? fs.readFileSync(TYPE_DEF_OUT, 'utf8')
      : (TYPE_DEF_INTRO + '\n' + buildTypeDefMarkdown());
    const additionalTypeDefs = buildAdditionalTypeDefsMarkdown();
    const scriptLibContent = fs.existsSync(SCRIPT_LIBRARY_OUT)
      ? fs.readFileSync(SCRIPT_LIBRARY_OUT, 'utf8')
      : '';
    const combined =
      AI_TRAINING_INTRO +
      '\n---\n\n' +
      typeDefContent.trim() +
      '\n\n---\n\n' +
      additionalTypeDefs +
      '\n\n---\n\n' +
      scriptLibContent.trim() +
      '\n';
    fs.writeFileSync(AI_TRAINING_OUT, combined, 'utf8');
    console.log('[script-library] Wrote:', AI_TRAINING_OUT);
  } catch (e) {
    console.error('[script-library] Failed to generate AI_TRAINING_OUT:', e);
  }

  console.log('[script-library] Done.');
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error('[script-library] Failed:', e);
    process.exit(1);
  }
}
