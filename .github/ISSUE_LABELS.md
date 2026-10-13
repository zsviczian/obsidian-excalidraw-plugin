# Issue labels and triage

The central issue tracker for Obsidian Excalidraw and its related projects is [obsidian-excalidraw-plugin/issues](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues). Direct users here by default, including reports concerning the [Excalidraw fork](https://github.com/zsviczian/excalidraw), [Excalidraw Extras](https://github.com/zsviczian/obsidian-excalidraw-extras), and [EA Scripts](https://github.com/zsviczian/ea-scripts). Separate repositories may occasionally have their own issues, but this tracker is the main triage hub.

## Existing labels are authoritative

**Use only labels already present in the repository's [GitHub label list](https://github.com/zsviczian/obsidian-excalidraw-plugin/labels).** The live labels, their descriptions, and their configured colors are the source of truth, not a proposed label taxonomy in this document.

- **Do not create, rename, recolor, or delete labels during issue triage.** Repository label administration is a separate, explicitly authorized activity.
- **Do not use naming prefixes** such as `type:`, `area:`, or `status:`. The repository uses label **colors** to distinguish type, affected area, and status; the label names themselves are short and unprefixed.
- If the appropriate existing label is missing, leave that dimension unlabeled. Do not invent a substitute, apply a misleading label, or create a new one.
- Labels with such prefixes introduced in earlier triage do not define the desired convention. Do not assign them to additional issues. Any removal or migration of those labels and their existing assignments requires a separate reviewed cleanup.

## How to triage

Use the existing label names and their configured colors/descriptions to classify an issue, where applicable:

| Dimension | What to identify | Guidance |
| --- | --- | --- |
| Type | Bug, regression, enhancement, feature, documentation, or other existing category | Prefer one primary **existing** type label. Do not infer criticality from the type. |
| Area | Plugin, customized Excalidraw fork, Extras, EA Scripts/automation, or a more specific area | Use an existing area label only when the repository provides an accurate match. The main plugin need not receive a generic area label. |
| Status | Confirmed, missing information, cannot reproduce, blocked, or other existing workflow status | Apply only when supported by evidence and when an appropriate label already exists; status is not severity. |
| Criticality | Credible urgent data-loss, security/privacy, or serious compliance/distribution risk | Use an existing criticality label only for exceptional risks. A bug is not automatically critical. |

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
