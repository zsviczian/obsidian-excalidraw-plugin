# Optional K-Plex ontology completion

Excalidraw's existing inline link suggester can use the optional
`window.kplexApi.v1.completeOntology` capability. K-Plex owns trigger matching,
role eligibility, inverse-aware filtering, ordering and field annotations.
Excalidraw reads no private K-Plex settings or editor instances and performs no
ontology matching of its own. No fork change or hard plugin dependency is needed.

The element-link editor, text inputs and ExcalidrawAutomate's existing
`attachInlineLinkSuggester()` share one input-owned popup and keyboard scope.
File, alias, heading, block, frame, clipped-frame and tag contexts take precedence.
The integration keeps K-Plex's exact physical spelling; annotations are inert text.

With `|` denoting the caret:

```text
:::|       → friend::|
::p|       → parent::|
(:::|      → (parent:: |)
(::p|)     → (parent:: |)
[:::|      → [friend:: |]
[:::|]     → [friend:: |]
```

Adjacent wrappers retain their opener and existing matching closer. Missing
closers are inserted before unrelated suffix text. Type `[[` after selection to
continue ordinary note completion, including bracket-containing filenames.
K-Plex's `boldFields` and Markdown trailing-space policy remain specific to its
native Markdown suggester; HTML link inputs use plain field names.

Every input update and selection reacquires the public provider. Selection checks
the provider/API/method identity, configuration revision, original text/caret,
replacement range and selected exact field. A stale row cannot edit the input.
Semantic/index revisions do not invalidate these configuration-only offers.
Missing, disabled, incompatible, retired or malformed providers leave ordinary
editing and existing completion available. Reload needs no plugin restart.

The consumer accepts at most 65,536 UTF-16 input units and requests 20 candidates
within K-Plex's advertised completion limits. It validates bounded detached
results before displaying them. Wrapper mutation, caret placement, input/change
events and browser Undo belong to Excalidraw's owning input document. Composition
temporarily closes suggestions and fences Enter until composition ends.

## Combined validation

`npm run test:kplex-ontology` builds the selected fork, Extras, K-Plex and plugin,
freezes their artifacts, verifies hashes, then stages the actual plugins in
`.test-work/vaults/excalidraw-auto-test/`. Set `EXCALIDRAW_KPLEX_ROOT` when K-Plex
is not the sibling `../kplex`. Fork and Extras retain their existing root overrides.
The test vault's small K-Plex fixture uses on-demand indexing on every device.
Preparation acknowledges only K-Plex's owned theme migration dialog through its
normal action; it verifies all declared settings before exercising the UI.

The focused command covers main/popout completion, exact carets, keyboard/mouse
selection, Undo/Redo, scripted composition, note continuation, physical drawing
save/reopen, native Markdown insertion, passive API reads, live configuration and
provider disable/re-enable/reload. Full native/regression profiles require these
cases and repeat them in responsive phone/tablet layouts. Desktop mobile
emulation does not establish physical touch, OS IME or native mobile WebView behavior.

A linked Git worktree shares only its verified primary checkout's marker-owned
native vault. Build/source roots remain worktree-local. Git common-directory and
reverse ownership checks reject copied or redirected metadata; arbitrary vault
overrides remain forbidden. The shared application-user-data lock still serializes
all staging, native cases and cleanup across repositories.

Release coordination: ship K-Plex's additive public capability before, or together
with, this plugin feature. Earlier K-Plex versions remain compatible but offer no
ontology completion. No release version or published package is changed here.
