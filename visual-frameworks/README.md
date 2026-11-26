# Thinking Frameworks

The catalog ships 21 original editable drawings for learning, understanding problems, making decisions, planning, and communicating. The plugin downloads the catalog from this directory and installs libraries in the vault's configured Thinking Frameworks folder. Installed libraries work offline.

## Maintain the catalog

- Keep library files in standard Excalidraw library version 2 format. Keep each published filename and item ID stable so existing favorites and playlists can resolve after an update.
- Use editable scene elements and include a short guiding question. Preview each item at thumbnail size and open it as a drawing before publishing.
- Add each filename to `directory-info.json` as an `{ "fname": "...", "mtime": 1795651200000 }` entry. Set `mtime` to the UTC epoch in milliseconds when a library changes. Keep existing values for unchanged libraries.
- The picker checks for newer revisions when opened, using the plugin's existing update setting. Installation and replacement each begin with an explicit user action. A modified local copy requires confirmation before replacement.

The layouts and instructional copy use this repository's license. The Empathy map draws on Dave Gray and XPLANE's empathy-mapping technique. Lean planning canvas and Decision perspectives use original prompts and layouts for testing assumptions and considering viewpoints. The latter two names also avoid using the source methods' branding. [XPLANE Empathy Map](https://xplane.com/worksheet/empathy-map-worksheet/), [LEANSTACK](https://academy.leanstack.com/), [Edward de Bono Limited terms](https://www.six-thinking-hats.com/legal).
