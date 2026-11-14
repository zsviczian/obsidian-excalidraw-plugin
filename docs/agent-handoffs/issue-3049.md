# Temporary implementation plan

This file is temporary and will be removed before the implementation PR is finalized.

Baseline: plugin master `78674a39ccf046b93b5de4155edcc871d82602cf`.

Maintainer-authorized scope:

- [#3049](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/3049): restore authoritative table embed controls and keep phone Reading-view controls reachable.
- [#3047](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/3047): independent ribbon visibility (default on) and empty-tab creation action (default off), reusing existing drawing creation behavior.
- [#3048](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/3048): investigate embedded-video fullscreen; use a narrow fork fix only if necessary, with fingerprints and a linked companion PR.
- [#3051](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/3051): investigate startup and Extras compatibility; distinguish verified failures from the incomplete reporter environment.
- [#3044](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/3044): implement pen-key toggling only if a small plugin-only integration preserves other keyboard workflows.

Validate focused source regressions, production packaging, native main/popout and responsive cases in the repository-owned test vault. Preserve failed baseline evidence, settings and lifecycle safeguards. Keep versions unchanged and leave the PR open for review.
