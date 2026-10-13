# Issue labels and triage

The central issue tracker for Obsidian Excalidraw and its related projects is [obsidian-excalidraw-plugin/issues](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues). Direct users here by default, including reports concerning the [Excalidraw fork](https://github.com/zsviczian/excalidraw), [Excalidraw Extras](https://github.com/zsviczian/obsidian-excalidraw-extras), and [EA Scripts](https://github.com/zsviczian/ea-scripts). Separate repositories may occasionally have their own issues, but this tracker is the main triage hub.

Use a small set of independent label dimensions. Do not infer severity solely from type, area, or report completeness. Prefer existing labels and preserve useful historical labels until a deliberate migration. The names and colors below are the **target convention**, not a claim that all labels have already been created.

## Label dimensions

| Dimension | Label | Meaning | Suggested color |
| --- | --- | --- | --- |
| Type | `type: regression` | Previously working behavior broke | `#1D4ED8` |
| Type | `type: bug` | Incorrect existing behavior | `#2563EB` |
| Type | `type: enhancement` | Improve existing behavior | `#60A5FA` |
| Type | `type: feature` | New capability | `#93C5FD` |
| Type | `type: documentation` | Documentation change | `#DBEAFE` |
| Area | `area: plugin` | Main Obsidian plugin | `#6D28D9` |
| Area | `area: fork` | Customized Excalidraw component | `#7C3AED` |
| Area | `area: extras` | Excalidraw Extras | `#A78BFA` |
| Area | `area: script` | Excalidraw Automate / EA Scripts | `#DDD6FE` |
| Status | `status: confirmed` | Behavior verified or sufficiently established | `#15803D` |
| Status | `status: blocked` | Waiting on a dependency or decision | `#4D7C0F` |
| Status | `status: incomplete` | Report lacks required details, such as Obsidian debug information | `#A3A3A3` |
| Status | `status: needs-info` | Specific clarification requested from reporter | `#86EFAC` |
| Status | `status: cannot-reproduce` | Reproduction attempted without success | `#D4D4D4` |
| Criticality | `critical` | Credible urgent risk of data loss, security/privacy exposure, or serious compliance/distribution consequences | `#D1242F` |

The order within type and area indicates typical triage attention, **not automatic priority**. Status labels describe evidence or workflow, not severity. In particular, `status: confirmed` can coexist with `status: incomplete`: a report may lack debug details while describing a bug the maintainer can reproduce. Other status labels may also coexist when they express distinct facts; avoid redundant combinations.

## Triage rules

- Reserve **`critical`** for exceptional risks requiring prompt investigation; it does not imply an immediate fix or require proof before investigating a credible data-loss/security report. It is independent of `type: regression` and `type: bug`.
- Prefer one primary type and one primary area. Apply status labels only when informative; do not label every issue with a status merely to fill the dimension.
- Keep existing special-purpose labels such as `one day maybe` (deferred ideas) and `transfer to Excalidraw` (candidate upstream work). They are not part of the four dimensions.
- Avoid adding generic high/medium/low priority labels or labels for individual scripts without demonstrated need.
- For missing Obsidian debug information, use `status: incomplete`; request specific information with `status: needs-info` when appropriate. A confirmed bug may still be fixed despite an incomplete report.
- Use brief, clear issue replies. When an agent comments, identify itself as **Zsolt's Codex Agent**.
- Before changing repository labels, inventory the current set. Rename existing labels where possible so historical issue/PR assignments survive. Do not delete or merge labels without reviewing affected issues. Match each GitHub label description to its meaning here.

## Examples

- Reproducible plugin data-loss regression: `type: regression`, `area: plugin`, `status: confirmed`, `critical`.
- MindMap Builder subtree attachment request: `type: enhancement`, `area: script`; add `status: needs-info` if waiting for the reporter's script.
- Fork behavior best fixed upstream: relevant type, `area: fork`, and `transfer to Excalidraw`.
