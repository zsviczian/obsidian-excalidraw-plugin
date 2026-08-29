# Excalidraw Automate scripting support plan

Status: active as of 2026-08-29.

This plan tracks the modernization of ExcalidrawAutomate AI support material while preserving compatibility with the long-lived training entrypoint.

Scope summary:
- Keep [docs/AITrainingData](docs/AITrainingData) as the canonical output location.
- Keep [docs/AITrainingData/ExcalidrawAutomate full library for LLM training.md](docs/AITrainingData/ExcalidrawAutomate%20full%20library%20for%20LLM%20training.md) as a stable entrypoint, but curate it as a router to skill-first references.
- Use one unified generator behind `npm run doc`.
- Keep [ea-scripts/index-new.md](ea-scripts/index-new.md) manually curated.
- Keep skill generation manually triggered by maintainer workflows (no automatic watcher/CI updates in this phase).
- Add strict naming rules for script preview images under [images](images).

## Decisions captured

1. Unified generation command
- `npm run doc` is the single maintainer command for documentation generation.
- If a script-template repository is present in the current VS Code workspace, `npm run doc` should also refresh template-project references/artifacts.

2. Legacy entrypoint behavior
- The legacy training file remains the stable public entrypoint.
- It must warn AI tools that generated code quality may fail if linked skill/reference URLs are inaccessible (for example: URL access disabled in some chat tools).

3. Script library publishing guidance
- `index-new.md` remains manual.
- Agents should be guided to open a proper PR for publishing scripts in this repository instead of trying to bypass the normal contribution workflow.
- Every publishing PR (new script or script update) must update [ea-scripts/directory-info.json](ea-scripts/directory-info.json).
- For updates, the `mtime` value for the updated script file must be refreshed so the plugin can detect local update availability.

4. Template repository direction
- A separate repository will be created first.
- Proposed name: `ea-script-template`.
- Once added to this workspace, the unified generator can optionally update it.
- Repository availability status: present and accessible at [../ea-script-template](../ea-script-template).

5. Image naming
- Adopt strict naming convention for script preview images, aligned to current patterns but enforceable.

6. Experimental script policy
- Scripts under [ea-scripts](ea-scripts) are treated as validated examples.
- No experimental bucket is introduced in this phase.
- Very large scripts (for example Mindmap Builder) are still valid; they should be tagged as "advanced/large-reference" rather than experimental.

7. Skill generation trigger
- Keep manual generation trigger. No automated regeneration in this phase.

## Progress tracking

Target branch: `improved-scripting-skills`.

| Phase | Status | Current outcome |
| --- | --- | --- |
| Baseline audit and constraints capture | Complete | Existing generators, outputs, and maintainer decisions captured in this plan |
| Create planning artifact in repository | Complete | Added [ScriptSupportPlan.md](ScriptSupportPlan.md) with phases, decisions, and action log |
| Unify generator implementation behind `npm run doc` | Complete | Added shared generator core at [scripts/excalidraw-docs-generator-core.mjs](scripts/excalidraw-docs-generator-core.mjs); both [scripts/generate-script-library.mjs](scripts/generate-script-library.mjs) and [scripts/skill-builder.mjs](scripts/skill-builder.mjs) are thin wrappers over one code path |
| Ensure canonical pen type completeness in generated docs | Complete | Generated references now include canonical Obsidian pen stroke type definitions plus the full public `src/types` and `lib/types` declaration surface |
| Curate legacy training entrypoint warning and routing | Complete | Legacy training entrypoint now warns about inaccessible references, names the master repository, and routes agents to the curated skill/reference set with absolute GitHub URLs |
| Add PR publishing workflow guidance for scripting agents | Complete | Generated skill guidance now directs script publishing through PRs, keeps `index-new.md` manual, and requires `directory-info.json` mtime updates |
| Add strict image naming and validation | Complete | Generator now warns on non-conforming preview filenames and documents the `scripts-{slug}.{ext}` rule in generated publishing guidance |
| Optional template-repo sync from `npm run doc` | Complete | `npm run doc` now refreshes a co-located `ea-script-template` bootstrap under `.ai/excalidraw-automate/` when the sibling repo is present |

## Implementation checkpoints

### Checkpoint 1: Shared generator core and single command
Objective:
- Introduce a shared generator module and keep lightweight wrappers for backward command compatibility.

Planned changes:
- Consolidate duplicated logic currently split between:
  - [scripts/generate-script-library.mjs](scripts/generate-script-library.mjs)
  - [scripts/skill-builder.mjs](scripts/skill-builder.mjs)
- Keep `npm run doc` as the single entrypoint command for maintainers.
- Keep manual run model. Do not add auto-run hooks in this phase.

Acceptance:
- One command (`npm run doc`) generates both legacy and skill outputs exactly once.
- Output files stay under [docs/AITrainingData](docs/AITrainingData).

### Checkpoint 2: Fix type-definition completeness regression
Objective:
- Ensure generated type references remain concrete after alias migrations.

Problem to solve:
- `lib/types/penTypes.d.ts` now aliases fork-owned types, and top import stripping can hide canonical shapes in generated docs.

Planned changes:
- Include canonical Obsidian type declarations from the fork type surface in generated reference outputs.
- Add a post-generation guard that fails if `ObsidianPenStrokeOptions` shape is missing.

Acceptance:
- Both:
  - [docs/AITrainingData/Excalidraw Automate library and related type definitions.md](docs/AITrainingData/Excalidraw%20Automate%20library%20and%20related%20type%20definitions.md)
  - [docs/AITrainingData/ExcalidrawAutomate full library for LLM training.md](docs/AITrainingData/ExcalidrawAutomate%20full%20library%20for%20LLM%20training.md)
  include concrete stroke option structure, not alias-only references.

Status:
- Complete.
- The generator now includes all declaration files under [src/types](src/types) and [lib/types](lib/types), plus the canonical fork-owned `obsidianTypes.d.ts` source for `ObsidianPenStrokeOptions`.

### Checkpoint 3: Curated legacy entrypoint messaging
Objective:
- Keep stable legacy entrypoint while steering agents to curated skill references.

Planned changes:
- Add a prominent warning that script generation can fail if linked references are not accessible.
- Include concrete note about environments requiring explicit URL enablement.
- Add short routing section pointing to curated skill/reference materials.

Acceptance:
- Legacy file remains backward compatible as an entrypoint.
- Warning is clear and placed before the main usage workflow.

Status:
- Complete.
- The generated legacy entrypoint now includes a top-level routing warning, the master repository URL, and direct absolute links to the curated skill and reference files.

### Checkpoint 4: Script publishing workflow guidance for agents
Objective:
- Teach agents to publish scripts through normal repository contribution workflow.

Planned changes:
- Add concise maintainer-approved workflow guidance in skill docs:
  - add script to [ea-scripts](ea-scripts)
  - add image to [images](images)
  - update [ea-scripts/index-new.md](ea-scripts/index-new.md) manually
  - update [ea-scripts/directory-info.json](ea-scripts/directory-info.json) in the same PR
  - for script updates, refresh the target script `mtime` entry in [ea-scripts/directory-info.json](ea-scripts/directory-info.json)
  - keep AI training material updates out of script publishing PRs
  - open PR with focused diff and validation notes
- Explicitly avoid automating `index-new.md`.

Acceptance:
- Publishing workflow appears in generated skill material.
- Guidance is PR-centric and does not suggest direct pushes.

Status:
- Complete.
- The generated skill file now includes a dedicated publishing workflow section with absolute repository links, PR-only guidance, manual `index-new.md` curation, and `directory-info.json` update requirements.

### Checkpoint 5: Strict image naming convention and validator
Objective:
- Keep existing style while making naming consistent and enforceable.

Proposed naming rule:
- `scripts-{slug}.{ext}` where:
  - `slug` = lowercase words joined by hyphen
  - only `a-z`, `0-9`, `-`
  - extensions allowed: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`

Examples:
- `scripts-add-link-to-existing-file-and-open.jpg`
- `scripts-boolean-operations-showcase.png`

Planned changes:
- Add validation in generator flow with clear error output.
- Keep compatibility mode for pre-existing files during initial rollout (warn-only first, strict fail in follow-up if desired).

Acceptance:
- New/updated script previews follow the naming contract.
- Validation output is actionable for contributors.

Status:
- Complete.
- The generator now warns on non-conforming preview filenames and surfaces the naming rule in the generated publishing workflow guidance.

### Checkpoint 6: Optional template repository sync
Objective:
- Allow `npm run doc` to refresh a co-located script-template repo if present.

Planned behavior:
- Detect a workspace folder named `ea-script-template` (or configurable path).
- If found, update agreed generated reference artifacts in that repo.
- If absent, continue without failure.

Current status:
- Repository now exists and is readable at [../ea-script-template](../ea-script-template).
- Checkpoint is considered unblocked and ready for scoped implementation once approved.

Design note: AI support files in template repo
- Preferred default: synchronized local snapshot under `.ai/excalidraw-automate/`, copied from canonical generated references in this repository.
- Routing note: keep canonical GitHub links in SKILL content, but ensure local references and script examples are present for environments without URL access.
- Reasoning: local snapshot gives immediate offline usability while preserving canonical source of truth in plugin-generated outputs.

Design note: template usage model
- Recommended model: single `ea-script-template` repository used as a multi-script workspace (one folder per script project) with shared utilities.
- Why: easier maintenance of common helpers, lint/build rules, and shared abstractions across scripts like Mindmap Builder, Slideshow, and Shade Master.
- Alternative supported pattern: per-script clones for strict isolation (useful for publishing independent repos), but this should be optional rather than the default path.

Acceptance:
- `npm run doc` succeeds in both cases:
  - template repo present
  - template repo absent

Status:
- Complete.
- `npm run doc` now refreshes a full local skill snapshot in the sibling `ea-script-template` workspace under `.ai/excalidraw-automate/` when the repo is available.

## Validation approach

For each implementation checkpoint:
- Run `npm run doc` from repository root.
- Verify generated files changed only in intended outputs.
- For script/reference changes, inspect key generated artifacts manually.
- Keep [ea-scripts/index-new.md](ea-scripts/index-new.md) untouched unless explicitly edited by maintainer.

## Risks and mitigations

Risk: duplicate logic drifts again across scripts.
- Mitigation: one shared generator core and wrapper entrypoints.

Risk: type aliasing hides critical concrete structures again.
- Mitigation: required-symbol guard (`ObsidianPenStrokeOptions`) and explicit canonical-source inclusion.

Risk: stricter image naming breaks existing contributions.
- Mitigation: staged rollout (warn-first) and clear remediation examples.

Risk: template sync introduces hard dependency on external repo.
- Mitigation: optional detection; never fail when repo is absent.

## Action log

| Date | Action | Outcome | Validation |
| --- | --- | --- | --- |
| 2026-08-29 | Captured maintainer decisions for scripting support modernization | Decisions documented for unified generator, manual index curation, PR workflow guidance, strict image naming, and optional template sync | Plan file created at [ScriptSupportPlan.md](ScriptSupportPlan.md) |
| 2026-08-29 | Confirmed template repository workspace availability and expanded publishing requirements | Verified [../ea-script-template](../ea-script-template) is present and readable; added mandatory [ea-scripts/directory-info.json](ea-scripts/directory-info.json) update rules to publishing workflow and checkpoint details | Directory listing succeeded for [../ea-script-template](../ea-script-template); plan updated |
| 2026-08-29 | Implemented checkpoint 1 unified generator | Consolidated duplicated generation logic into [scripts/excalidraw-docs-generator-core.mjs](scripts/excalidraw-docs-generator-core.mjs), with wrapper entrypoints preserved at [scripts/generate-script-library.mjs](scripts/generate-script-library.mjs) and [scripts/skill-builder.mjs](scripts/skill-builder.mjs) | `npm run doc` completed successfully and regenerated legacy + skill outputs from one code path |
| 2026-08-29 | Implemented checkpoint 5 image naming validator | Added warning-only preview filename validation and surfaced the `scripts-{slug}.{ext}` rule in generated publishing guidance | `npm run doc` completed successfully and emitted the expected warning for legacy preview names |
| 2026-08-29 | Implemented checkpoint 6 template bootstrap sync | `npm run doc` now refreshes a link-first bootstrap in the sibling `ea-script-template` workspace under `.ai/excalidraw-automate/` | `npm run doc` completed successfully and refreshed the sibling template bootstrap files |
| 2026-08-29 | Hardened checkpoint 6 for offline and advanced script authoring | Template sync now mirrors full generated references and script examples instead of only link stubs | `npm run doc` and `npm run sync-refs` now produce local skill + references + scripts snapshot in `.ai/excalidraw-automate/` |
| 2026-08-29 | Aligned template script extensions and build output | Template-only reference snapshots now use `.js` filenames with rewritten local links; the template build emits executable `.md` scripts with purpose metadata and editable configuration constants before the bundle | `npm run doc` preserves `.js` reference filenames; template `npm run build`, `npm run check`, and package validation pass on Node 22 |
