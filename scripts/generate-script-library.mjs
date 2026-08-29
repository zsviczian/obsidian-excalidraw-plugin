/* eslint-disable no-console */
// to run: node generate-script-library.mjs
import { fileURLToPath } from 'url';
import { runUnifiedGeneration } from './excalidraw-docs-generator-core.mjs';

function main() {
  console.log('[script-library] Running unified documentation generator (full mode)...');
  const result = runUnifiedGeneration({
    mode: 'full',
    args: process.argv.slice(2),
  });
  console.log('[script-library] Wrote outputs:', result.generated);
  console.log('[script-library] Processed scripts:', result.scriptsProcessed);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (e) {
    console.error('[script-library] Failed:', e);
    process.exit(1);
  }
}
