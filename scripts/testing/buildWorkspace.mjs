/** Hosted/native producers share the same immutable three-repository handoff. */
import {randomUUID} from 'node:crypto';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {produceCombination} from './host/combination.mjs';
const pluginRoot=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const combination=produceCombination({pluginRoot,
  forkRoot:resolve(process.env.EXCALIDRAW_FORK_ROOT||join(pluginRoot,'../excalidraw')),
  extrasRoot:resolve(process.env.EXCALIDRAW_EXTRAS_ROOT||join(pluginRoot,'../obsidian-excalidraw-extras')),
  output:resolve(process.env.EXCALIDRAW_TEST_COMBINATION_OUTPUT||join(pluginRoot,'.test-work/frozen/combination-'+randomUUID()))});
process.stdout.write(`Frozen three-repository workspace: ${combination.output}\n`);
