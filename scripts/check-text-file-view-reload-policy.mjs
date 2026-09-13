import assert from "node:assert/strict";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { shouldRetainLoadedFileAfterReload } = await jiti.import(
  "../src/view/textFileViewReloadPolicy.ts",
);

assert.equal(
  shouldRetainLoadedFileAfterReload(false, true),
  true,
  "a same-file Markdown-envelope refresh must suppress the duplicate TextFileView delivery",
);
assert.equal(
  shouldRetainLoadedFileAfterReload(true, true),
  false,
  "a full reload retains the established marker-reset policy",
);
assert.equal(
  shouldRetainLoadedFileAfterReload(false, false),
  false,
  "a non-modify reload retains the established marker-reset policy",
);

process.stdout.write("text-file-view reload policy checks passed\n");

