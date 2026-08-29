/* eslint-disable no-console */
// to run: node skill-builder.mjs
import { fileURLToPath } from 'url';
import { runUnifiedGeneration } from './excalidraw-docs-generator-core.mjs';

function main() {
  console.log('[skill-builder] Running unified documentation generator (full mode)...');
  const result = runUnifiedGeneration({
    mode: 'full',
    args: process.argv.slice(2),
  });
  console.log('[skill-builder] Wrote outputs:', result.generated);
  console.log('[skill-builder] Processed scripts:', result.scriptsProcessed);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (e) {
    console.error('[skill-builder] Failed:', e);
    process.exit(1);
  }
}
