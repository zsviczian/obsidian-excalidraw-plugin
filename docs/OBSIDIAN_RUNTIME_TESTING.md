# Obsidian runtime testing

The canonical Excalidraw fork and plugin CLI procedure is [Testing the fork inside Obsidian](https://github.com/zsviczian/excalidraw/blob/master/dev-docs/Obsidian/OBSIDIAN_RUNTIME_TESTING.md) (local sibling path: `../excalidraw/dev-docs/Obsidian/OBSIDIAN_RUNTIME_TESTING.md`). Read its vault guards, exact-build deployment steps, report contract, and feature-gate guidance before running the host lane.

From this plugin checkout, with the dedicated `excalidraw-test` vault open and the three `EXCALIDRAW_TEST_VAULT_*` variables set as described there:

```bash
npm run test:obsidian:runner
npm run verify:obsidian
```

The first command tests the runner without Obsidian. The second builds the sibling fork and this plugin, deploys only to the explicitly checked test vault, exercises one drawing, and writes a report. It is a desktop smoke, so run the change-specific scenarios from the canonical guide as well.
