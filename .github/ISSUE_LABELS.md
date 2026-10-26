# Issue labels and triage

The central issue tracker for Obsidian Excalidraw and its related projects is [obsidian-excalidraw-plugin/issues](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues). Direct users here by default, including reports concerning the [Excalidraw fork](https://github.com/zsviczian/excalidraw), [Excalidraw Extras](https://github.com/zsviczian/obsidian-excalidraw-extras), and [EA Scripts](https://github.com/zsviczian/ea-scripts). Separate repositories may occasionally have their own issues, but this tracker is the main triage hub.

## Existing labels are authoritative

**Use only labels already present in the repository's [GitHub label list](https://github.com/zsviczian/obsidian-excalidraw-plugin/labels).** The live labels, their descriptions, and their configured colors are the source of truth, not a proposed label taxonomy in this document.

- **Do not create, rename, recolor, or delete labels during issue triage.** Repository label administration is a separate, explicitly authorized activity.
- **Do not use naming prefixes** such as `type:`, `area:`, or `status:`. The repository uses label **colors** to distinguish type, affected area, and status; the label names themselves are short and unprefixed.
- If the appropriate existing label is missing, leave that dimension unlabeled. Do not invent a substitute, apply a misleading label, or create a new one.

## Label dimensions

This table retains the label meanings and **suggested color convention**. During issue triage, apply only labels that **already exist** in GitHub with these exact unprefixed names. The table is not permission to create or recolor labels; if a listed label is unavailable, leave that dimension blank.

| Dimension | Label | Meaning | Suggested color |
| --- | --- | --- | --- |
| Type | `regression` | Previously working behavior broke | `#1D4ED8` |
| Type | `bug` | Incorrect existing behavior | `#2563EB` |
| Type | `enhancement` | Improve existing behavior | `#60A5FA` |
| Type | `feature` | New capability | `#93C5FD` |
| Type | `documentation` | Documentation change | `#DBEAFE` |
| Area | `plugin` | Main Obsidian plugin | `#6D28D9` |
| Area | `fork` | Customized Excalidraw component | `#7C3AED` |
| Area | `extras` | Excalidraw Extras | `#A78BFA` |
| Area | `script` | Excalidraw Automate / EA Scripts | `#DDD6FE` |
| Status | `confirmed` | Behavior verified or sufficiently established | `#15803D` |
| Status | `blocked` | Waiting on a dependency or decision | `#4D7C0F` |
| Status | `incomplete` | Report lacks required details, such as Obsidian debug information | `#A3A3A3` |
| Status | `needs-info` | Specific clarification requested from reporter | `#86EFAC` |
| Status | `cannot-reproduce` | Reproduction attempted without success | `#D4D4D4` |
| Criticality | `critical` | Confirmed bug causing data loss (potentially affecting many users), a serious information-security breach, or a violation of law (e.g. data privacy) | `#D1242F` |

Prefer one primary type and one primary area when an accurate existing label is available. Status labels describe evidence or workflow, not severity; they need not be assigned merely to fill a dimension. `confirmed` and `incomplete` may coexist when a verified behavior has an incomplete report. Use `critical` only after investigation establishes the impact through testing, code verification, or other substantiated evidence. A reporter's claim alone is not sufficient.

A dimension may remain blank. Avoid adding labels merely to fill a table. Keep useful special-purpose/historical labels such as `one day maybe`, `Solved with Excalidraw Script`, or `transfer to excalidraw.com` where relevant and already present. These are not automatically replacements for type, area, or status.

For an incomplete report, use the existing incomplete-report label if appropriate; if a specific answer is needed, use an existing question/needs-information label where available. Reproduction attempts and maintainer confirmations must be distinguished from a reporter's claim that a bug exists. Do not mark a suspected root cause as confirmed simply because the issue has a detailed explanation.

## Applying labels safely

1. Read the current [label list](https://github.com/zsviczian/obsidian-excalidraw-plugin/labels) and the issue's existing labels before editing. Use exact existing names and the repository's assigned colors; **do not attempt to synthesize label names from a dimension**.
2. Read the issue body and relevant discussion. Consider related fixes or PRs when they materially affect status. Handle the requested date range in **newest-to-oldest** order and stop at the specified cutoff.
3. Add only applicable, existing labels. Prefer additive label actions to replacing the entire label set. Preserve useful historical or special-purpose labels unless explicitly authorized to migrate them.
4. Read the issue back and verify the intended labels were applied. Do not silently alter the title, body, issue state, or other metadata.
5. Keep replies brief, and identify agent-authored comments as **Zsolt's Codex Agent**. Label-only triage normally does not need a comment.

**Examples using actual label names, only when those labels exist:**

- An ordinary verified bug: `bug` and an applicable existing status label; add an area label only if there is a specific matching one.
- An EA Scripts enhancement: `enhancement` and `ExcalidrawAutomate` or another appropriate existing script label, if available.
- An upstream-only issue: the applicable existing type and `transfer to excalidraw.com`, if appropriate.

Do not assign priorities with generic high/medium/low labels unless the maintainer has separately approved such a taxonomy. Issue priority can be assessed in discussion without inventing labels.
