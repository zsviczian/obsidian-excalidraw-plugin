/* eslint-disable no-console */
// to run: node skill-builder.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Reconstruct __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, '..');
const EA_SCRIPTS_DIR = path.join(ROOT, 'ea-scripts');
const OUT_DIR = path.join(ROOT, 'docs', 'AITrainingData');

// Agent Skills Specific Definitions
const SKILL_NAME = 'excalidraw-automate';
const SKILL_DIR = path.join(OUT_DIR, SKILL_NAME);
const SKILL_REFERENCES_DIR = path.join(SKILL_DIR, 'references');
const SKILL_SCRIPTS_DIR = path.join(SKILL_REFERENCES_DIR, 'scripts');

const AI_TRAINING_INTRO = `**ExcalidrawAutomate full library for LLM training**

Excalidraw-Obsidian is an Obsidian.md plugin that is built on the open source Excalidraw component. Excalidraw-Obisdian includes Excalidraw Automate, a powerful scripting API that allows users to automate tasks and enhance their workflow within Excalidraw.

Read the information below to understand the capabilities. The user will prompt for an ExcalidrawAutomate script to be created. Use the examples, the ExcalidrawAutomate documentation, and the various type definitions to generate the script based on the user's requirements.

In addition to ExcalidrawAutomate, you can also use two other sources of functions:
- The Excalidraw API available via \`ea.getExcalidrawAPI()\`. Note: the API is only available if \`ea.targetView\` is set. When running Excalidraw scripts using the script engine, the provided \`ea\` object is already set up with targetView by default. Otherwise you need to first run \`ea.setView()\`.
- \`window.ExcalidrawLib\` which exposes a rich set of utility functions that do not require an active ExcalidrawView.

**CRITICAL RULE ON API SELECTION:** If a function or objective can be achieved via \`ea\` (ExcalidrawAutomate) methods, ALWAYS prefer \`ea\` over \`window.ExcalidrawLib\`. \`ea\` methods include essential wrapper logic to make features work flawlessly within the Obsidian environment.

- When the user asks for a dialog window, by default create a FloatingModal. Do not extend the FloatingModal class. Instead, define the modal's behavior by creating a new instance (e.g., \`const modal = new ea.FloatingModal(...)\`) and then assigning functions directly to the \`onOpen\` and \`onClose\` properties of that instance.
- Elements have a \`customData\` property that can be used to store arbitrary data. To ensure the data the script adds to elements use the \`ea.addAppendUpdateCustomData\` function. This function ensures that existing customData is preserved when adding new data.
- Elements can be hidden by setting their opacity to 0. When hiding elements this way, it is good practice to temporarily store their original opacity in customData. This allows for easy restoration of the original opacity later.
- Elements can be deleted from the scene by setting their isDeleted property to true.
- The Obsidian.md module is available on \`ea.obsidian\`.

**Sidepanels and multi-view tooling:**
- Sidepanels are for scripts that must stay open while users hop between multiple Excalidraw views. They should implement the SidepanelTab hooks (\`onOpen\`, \`onFocus(view)\`, \`onClose\`, \`onExcalidrawViewClosed\`) and manage their own \`ea.targetView\` explicitly.
- Persisted sidepanel scripts are launched during plugin startup (e.g., Obsidian restart, plugin update) with \`ea.targetView === null\`. Scripts must handle this by deferring view-bound work until \`onFocus\` delivers a view; call \`ea.setView(view)\` when you decide to bind.
- Each \`ea\` instance may host a single \`sidepanelTab\`. Create the tab with \`ea.createSidepanelTab(title, persist=false, reveal=true)\`; the returned \`ea.sidepanelTab\` exposes \`contentEl\`, \`setContent\`, \`setTitle\`, \`setDisabled\`, \`setCloseCallback\`, \`open/close\`, and focus lifecycle hooks.
- Use \`checkForActiveSidepanelTabForScript\` to avoid creating duplicate tabs for the same script name.

#### **1. The Core Workflow: Handling Element Immutability**

*   **Central Rule:** Elements in the Excalidraw scene are immutable and should never be modified directly. Always use the ExcalidrawAutomate (EA) "workbench" pattern for modifications.
*   **The Workflow:**
    1.  Get elements from the current view using \`ea.getViewElements()\` or \`ea.getViewSelectedElements()\`.
    2.  Copy these elements into the EA workbench for editing using \`ea.copyViewElementsToEAforEditing(elements)\`.
    3.  Modify the properties of the element copies that are now in the EA workbench (e.g., \`ea.getElement(id).locked = true;\`).
    4.  Commit the changes back to the scene using \`await ea.addElementsToView()\`.
*   **Deletion:** To delete an element, set its \`isDeleted\` property to \`true\` on the workbench copy (\`ea.getElement(id).isDeleted = true;\`) and then commit with \`await ea.addElementsToView()\`.

#### **2. User Interaction: Prompts and Dialogs**

*   **Simple Input:** For straightforward user input, use the \`utils\` object provided to the script.
    *   \`await utils.inputPrompt()\`: To get a string or number from the user.
    *   \`await utils.suggester()\`: To let the user select from a predefined list of options.
*   **Complex Dialogs:** When a more complex UI with multiple controls is needed, create a floating dialog window.
    *   **Use \`FloatingModal\`:** Always create a new instance: \`const modal = new ea.FloatingModal(ea.plugin.app);\`.

#### **3. Data Persistence and Customization**

*   **Storing Custom Data:** Elements have a \`customData\` property for arbitrary data.
    *   **Always Use \`ea.addAppendUpdateCustomData(id, newData)\`:** This is crucial. It safely adds or updates your key-value pairs without overwriting data that might have been stored by other scripts or the Excalidraw plugin itself.
*   **Creating Configurable Scripts:** To make your script's behavior customizable by the user:
    *   Use \`ea.getScriptSettings()\` to retrieve saved settings.
    *   Use \`await ea.setScriptSettings(settings)\` to save any changes.

#### **4. Best Practices and Advanced Techniques**

*   **Script Overview Block (MANDATORY):** Create, and consistently maintain with each update, a comprehensive comment block at the very beginning of the script. This block must explain the purpose of the script, its key features, and the high-level solution logic or architecture.
*   **Strictly Modular Architecture (NO LOOSE CODE):** Avoid creating large monolithic blocks of code or leaving logic loose at the root level of the script. Instead, organize *everything* into relatively small, atomic functions. This includes UI components as well.
*   **Evergreen JSDoc Headers and Comments:** Every function must have a proper JSDoc/Javadoc-style header containing parameter names, types, and a clear description of the function's purpose.
*   **Isolate Constants and User-Facing Strings:** *Do not embed hardcoded magic values, config parameters, or UI strings deep inside the logic.* You must separate all constants and language strings and collect them at the very top of the file.
*   **Icons:** Obsidian uses https://lucide.dev icons. These icons are available for scripts via \`ea.obsidian.getIcon("Icon Name")\`.
*   **Omit Version Verification:** *Do not add a version verification section* when generating a new script unless explicitly instructed to do so.
*   **Embrace \`await\`:** Many EA functions are asynchronous and return a \`Promise\` (e.g., \`ea.addElementsToView()\`, \`ea.createSVG()\`, \`utils.inputPrompt()\`). **Always** use \`await\` when calling these functions to ensure your script executes in the correct order.
`;

const EXCALIDRAW_STARTUP_MESSAGE = `# Excalidraw Startup Script

ExcalidrawStartup Script can be configured in Plugin Settings under 'Excalidraw Automate'. When defined this script runs automatically when the Excalidraw plugin is loaded to Obsidian. The user can add automation tasks here that they want to run on every startup of Excalidraw in Obsidian such as defining Excalidraw event handlers (also known as hooks).
`;
const EXCALIDRAW_STARTUP_TEMPLATE = "src/constants/assets/startupScript.md";
const EXCALIDRAW_STARTUP_EXAMPLE = "docs/AITrainingData/ExcalidrawStartupExample.md";

const TYPE_DEF_WHITELIST = [
  "lib/shared/ExcalidrawAutomate.d.ts",
  "lib/types/excalidrawAutomateTypes.d.ts",
  "lib/types/sidepanelTabTypes.d.ts",
  "lib/types/penTypes.d.ts",
  "lib/types/utilTypes.d.ts",
  "lib/types/exportUtilTypes.d.ts",
  "lib/types/embeddedFileLoaderTypes.d.ts",
  "lib/types/AIUtilTypes.d.ts",
  "node_modules/@zsviczian/excalidraw/types/element/src/types.d.ts",
  "node_modules/@zsviczian/excalidraw/types/excalidraw/types.d.ts",
  "node_modules/@zsviczian/excalidraw/types/element/src/bounds.d.ts",
  "node_modules/@zsviczian/excalidraw/types/excalidraw/components/App.d.ts",
];

/**
 * Returns true if content contains at least one line starting with ```
 * and has an odd number of fences (unbalanced).
 */
function needsClosingFence(content) {
  const fenceCount = (content.match(/^```/gm) || []).length;
  return fenceCount > 0 && fenceCount % 2 === 1;
}

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
        continue;
      }
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

function makeSectionHeader(relPath) {
  const stars = '*'.repeat(Math.max(6, Math.min(38, relPath.length + 6)));
  return [
    `/* ${stars} */`,
    `/* ${relPath} */`,
    `/* ${stars} */`,
  ].join('\n') + '\n';
}

function buildTypeDefMarkdown() {
  const entries = TYPE_DEF_WHITELIST.map((rel) => ({
    rel,
    abs: path.join(ROOT, ...rel.split('/')),
  }));

  let body = '# ExcalidrawAutomate library and related type definitions\n\n```js\n';
  for (const { rel, abs } of entries) {
    if (!fs.existsSync(abs)) {
      console.warn('[skill-builder] Whitelist file missing:', rel);
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

function resolveExcalModulePath(spec, excalIndexAbs) {
  const baseTypesRoot = path.join(ROOT, 'node_modules', '@zsviczian', 'excalidraw', 'types');
  if (spec.startsWith('@excalidraw/')) {
    const sub = spec.slice('@excalidraw/'.length);
    const parts = sub.split('/');
    const pkg = parts.shift();
    const rest = parts;
    if (!pkg) return null;
    const base = path.join(baseTypesRoot, pkg);
    if (rest.length === 0) {
      return path.join(base, 'src', 'index.d.ts');
    }
    return path.join(base, 'src', ...rest) + '.d.ts';
  }
  if (spec.startsWith('.')) {
    const dir = path.dirname(excalIndexAbs);
    return path.resolve(dir, spec) + '.d.ts';
  }
  return null;
}

function extractFunctionSignaturesFromModule(absPath, names) {
  const out = {};
  if (!absPath || !fs.existsSync(absPath)) {
    return out;
  }
  const content = fs.readFileSync(absPath, 'utf8');

  for (const rawName of names) {
    const name = rawName.trim();
    if (!name) continue;

    let m = content.match(new RegExp(`export\\s+declare\\s+function\\s+${name}[\\s\\S]*?;`, 'm'));
    if (m) {
      out[name] = m[0].trim();
      continue;
    }
    m = content.match(new RegExp(`(^|\\n)declare\\s+function\\s+${name}[\\s\\S]*?;`, 'm'));
    if (m) {
      out[name] = m[0].replace(/^\s*declare\s+/, 'export declare ').trim();
      continue;
    }
    m = content.match(new RegExp(`export\\s+declare\\s+const\\s+${name}\\s*:\\s*[\\s\\S]*?=>[\\s\\S]*?;`, 'm'));
    if (m) {
      out[name] = m[0].trim();
      continue;
    }
    m = content.match(new RegExp(`export\\s+declare\\s+(?:var|let|const)\\s+${name}\\s*:\\s*[\\s\\S]*?;`, 'm'));
    if (m && /=>/.test(m[0])) {
      out[name] = m[0].trim();
      continue;
    }
  }
  return out;
}

function buildExcalidrawLibFunctionsSection() {
  const excalIndexRel = 'node_modules/@zsviczian/excalidraw/types/excalidraw/index.d.ts';
  const excalIndexAbs = path.join(ROOT, ...excalIndexRel.split('/'));
  if (!fs.existsSync(excalIndexAbs)) {
    console.warn('[skill-builder] Missing Excalidraw index.d.ts:', excalIndexRel);
    return '';
  }

  const content = fs.readFileSync(excalIndexAbs, 'utf8');
  const reExport = /export\s*\{\s*([\s\S]*?)\s*\}\s*from\s*["']([^"']+)["'];/g;

  const moduleToNames = new Map();
  for (const match of content.matchAll(reExport)) {
    const namesChunk = match[1];
    const spec = match[2];
    const names = namesChunk
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!names.length) continue;
    const abs = resolveExcalModulePath(spec, excalIndexAbs);
    if (!abs) continue;
    const key = spec;
    const curr = moduleToNames.get(key) || { abs, names: new Set() };
    for (const n of names) curr.names.add(n);
    moduleToNames.set(key, curr);
  }

  const seen = new Set();
  const sections = [];

  for (const [spec, { abs, names }] of moduleToNames) {
    const sigs = extractFunctionSignaturesFromModule(abs, Array.from(names));
    const sigEntries = Object.entries(sigs)
      .filter(([name]) => {
        if (seen.has(name)) return false;
        seen.add(name);
        return true;
      })
      .sort(([a], [b]) => a.localeCompare(b, 'en', { sensitivity: 'base' }));

    if (!sigEntries.length) continue;

    const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
    const header = makeSectionHeader(`${spec} -> ${rel}`).replace(/\*\/\n\/\*/g, '*\/\n/*');
    sections.push(header + sigEntries.map(([, s]) => s).join('\n') + '\n');
  }

  return '# ExcalidrawLib module functions\n\n' +
    'The following functions are exposed via window.ExcalidrawLib. Signatures are extracted from TypeScript declarations.\n\n' +
    '```ts\n' +
    sections.join('\n') +
    '```\n';
}

function main() {
  console.log('[skill-builder] Generating Excalidraw Agent Skill...');
  if (!fs.existsSync(EA_SCRIPTS_DIR)) {
    console.error('ea-scripts directory not found:', EA_SCRIPTS_DIR);
    process.exit(1);
  }

  // Ensure directories exist
  fs.mkdirSync(SKILL_DIR, { recursive: true });
  fs.mkdirSync(SKILL_REFERENCES_DIR, { recursive: true });

  // Create or clean the scripts directory
  if (fs.existsSync(SKILL_SCRIPTS_DIR)) {
    fs.rmSync(SKILL_SCRIPTS_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(SKILL_SCRIPTS_DIR, { recursive: true });

  // Read exclusions
  const args = process.argv.slice(2);
  const cmdLineExcludes = args.map(arg => arg.toLowerCase());
  const defaultExcludes = ['index-new.md', 'mindmap builder.md', 'color scheme manager.md', 'comic strip director.md'];
  const exclusions = new Set([...defaultExcludes, ...cmdLineExcludes]);

  // Collect scripts
  const files = fs
    .readdirSync(EA_SCRIPTS_DIR, { withFileTypes: true })
    .filter(
      (d) =>
        d.isFile() &&
        (d.name.endsWith('.md') || d.name.toLowerCase() === "mindmap builder.js") &&
        !exclusions.has(d.name.toLowerCase())
    )
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));

  // Prepare API Index Map
  const apiIndex = {
    ExcalidrawAutomate: {},
    ExcalidrawAPI: {},
    ExcalidrawLib: {}
  };

  function addUsage(category, method, scriptName) {
    // Filter out obvious noise or generic javascript attributes
    const ignoreList = ['length', 'push', 'map', 'filter', 'forEach', 'includes', 'join', 'toString', 'toLowerCase'];
    if (ignoreList.includes(method)) return;
    if (method.length < 2) return;

    if (!apiIndex[category][method]) {
      apiIndex[category][method] = new Set();
    }
    apiIndex[category][method].add(scriptName);
  }

  console.log('[skill-builder] Processing scripts and building API Index...');
  for (const file of files) {
    const full = path.join(EA_SCRIPTS_DIR, file);
    let content = fs.readFileSync(full, 'utf8').replace(/\r\n/g, '\n');

    // Fix missing fences
    if (needsClosingFence(content)) {
      content += '\n```\n';
    }

    // Write individual script to references/scripts/
    fs.writeFileSync(path.join(SKILL_SCRIPTS_DIR, file), content, 'utf8');

    // Parse API Usage
    // 1. ExcalidrawAutomate: ea.functionName
    const eaMatches = [...content.matchAll(/ea\.([a-zA-Z0-9_]+)/g)];
    eaMatches.forEach(m => addUsage('ExcalidrawAutomate', m[1], file));

    // 2. ExcalidrawAPI: api.functionName or ea.getExcalidrawAPI().functionName
    const apiMatches = [...content.matchAll(/(?:getExcalidrawAPI\(\)|api)\.([a-zA-Z0-9_]+)/g)];
    apiMatches.forEach(m => addUsage('ExcalidrawAPI', m[1], file));

    // 3. ExcalidrawLib: ExcalidrawLib.functionName or window.ExcalidrawLib.functionName
    const libMatches = [...content.matchAll(/(?:window\.)?ExcalidrawLib\.([a-zA-Z0-9_]+)/g)];
    libMatches.forEach(m => addUsage('ExcalidrawLib', m[1], file));
  }

  // Generate API Usage Index Markdown
  console.log('[skill-builder] Writing api-usage-index.md...');
  let apiIndexContent = `# Excalidraw API Usage Index\n\n`;
  apiIndexContent += `This index maps methods and properties from ExcalidrawAutomate (\`ea\`), ExcalidrawAPI, and ExcalidrawLib to the example scripts that use them. Use this to find real-world examples of how to implement specific features.\n\n`;

  for (const [category, methods] of Object.entries(apiIndex)) {
    apiIndexContent += `## ${category}\n\n`;
    const sortedMethods = Object.keys(methods).sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));

    if (sortedMethods.length === 0) {
      apiIndexContent += `*No usages found.*\n\n`;
      continue;
    }

    for (const method of sortedMethods) {
      const scriptLinks = Array.from(methods[method])
        .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
        .map(script => `[${script}](scripts/${script.replace(/ /g, '%20')})`)
        .join(', ');

      apiIndexContent += `- **${method}**: ${scriptLinks}\n`;
    }
    apiIndexContent += `\n`;
  }

  fs.writeFileSync(path.join(SKILL_REFERENCES_DIR, 'api-usage-index.md'), apiIndexContent, 'utf8');

  // Write Type Definitions
  console.log('[skill-builder] Writing type-definitions.md...');
  fs.writeFileSync(path.join(SKILL_REFERENCES_DIR, 'type-definitions.md'), buildTypeDefMarkdown(), 'utf8');

  // Write ExcalidrawLib Functions
  console.log('[skill-builder] Writing excalidraw-lib-functions.md...');
  fs.writeFileSync(path.join(SKILL_REFERENCES_DIR, 'excalidraw-lib-functions.md'), buildExcalidrawLibFunctionsSection(), 'utf8');

  // Write Startup Scripts template
  console.log('[skill-builder] Writing startup-scripts.md...');
  const startupTemplatePath = path.join(ROOT, ...EXCALIDRAW_STARTUP_TEMPLATE.split('/'));
  const startupExamplePath = path.join(ROOT, ...EXCALIDRAW_STARTUP_EXAMPLE.split('/'));
  const startupTemplate = fs.existsSync(startupTemplatePath)
    ? fs.readFileSync(startupTemplatePath, 'utf8').replace(/\r\n/g, '\n').trim()
    : '';
  const startupExample = fs.existsSync(startupExamplePath)
    ? fs.readFileSync(startupExamplePath, 'utf8').replace(/\r\n/g, '\n').trim()
    : '';

  const startupSection = EXCALIDRAW_STARTUP_MESSAGE + '\n\n' +
    (startupTemplate ? `### Template\n\`\`\`js\n${startupTemplate}\n\`\`\`\n\n` : '') +
    (startupExample ? `### Example\n\`\`\`js\n${startupExample}\n\`\`\`\n` : '');

  fs.writeFileSync(path.join(SKILL_REFERENCES_DIR, 'startup-scripts.md'), startupSection, 'utf8');

  // Write SKILL.md
  console.log('[skill-builder] Writing SKILL.md...');
  const skillMdPath = path.join(SKILL_DIR, 'SKILL.md');
  const skillFrontmatter = `---
name: ${SKILL_NAME}
description: Write and manipulate ExcalidrawAutomate scripts for Obsidian.md. Use when the user wants to create, modify, or understand an Excalidraw script.
---

`;

  let skillIntro = AI_TRAINING_INTRO
    .replaceAll("https://youtu.be/", "YouTube: ")
    .replaceAll("https://www.youtube.com/watch?v=", "YouTube: ")
    .replaceAll("https://www.youtube.com/", "YouTube: ");

  skillIntro += `
## References
The \`references/\` directory contains supporting documentation necessary for writing scripts:
- \`references/type-definitions.md\`: Core type definitions for ExcalidrawAutomate.
- \`references/excalidraw-lib-functions.md\`: Function signatures for \`window.ExcalidrawLib\`.
- \`references/startup-scripts.md\`: ExcalidrawStartup script template and examples.
- \`references/api-usage-index.md\`: A highly useful index mapping every API method (ea.*, api.*, ExcalidrawLib.*) to the specific example scripts that utilize them.
- \`references/scripts/\`: A folder containing all the raw, real-world example scripts.

### How to use the Script Examples
If you need to implement a specific function (e.g., \`ea.addElementsToView\`), do NOT guess its implementation context. Instead:
1. Open \`references/api-usage-index.md\`.
2. Find the function name.
3. Note the scripts listed next to it.
4. Read the corresponding script inside the \`references/scripts/\` directory to see a complete, working example of how the function is used in context.
`;

  fs.writeFileSync(skillMdPath, skillFrontmatter + skillIntro, 'utf8');
  console.log('[skill-builder] Done.');
}

// ESM equivalent of `if (require.main === module)`
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (e) {
    console.error('[skill-builder] Failed:', e);
    process.exit(1);
  }
}