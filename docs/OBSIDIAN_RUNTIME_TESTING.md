# Obsidian runtime testing on macOS and Windows

This desktop lane builds the real plugin, deploys its exact artifacts to the named
`excalidraw-test` vault, opens a disposable drawing, and checks that the Excalidraw
API and editor mount in the main application document. It supplements source
tests and change-specific manual checks.

## Prepare the test vault

1. Look for an existing vault named `excalidraw-test` in Obsidian's vault switcher
   or registry (`~/Library/Application Support/obsidian/obsidian.json` on macOS;
   `%APPDATA%\obsidian\obsidian.json` on Windows). Confirm its absolute path.
2. If it is missing, ask the user to create it and install and enable Excalidraw
   through **Settings → Community plugins**. A fresh empty vault is sufficient
   for this smoke. Agents need consent to create or download a replacement vault.
3. Open the vault in Obsidian. For a downloaded/copied vault, complete any
   first-open trust prompt, then close and reopen that vault. Finish plugin
   onboarding before automated testing.
4. Use an Obsidian installer with CLI support and enable **Settings → General →
   Command line interface**. Follow its registration prompt; see the official
   [CLI installation and troubleshooting guide](https://obsidian.md/help/cli).
5. Keep Obsidian running and select the test vault's main window. Ensure its
   Excalidraw drawing template does not open a chooser. Avoid simultaneous edits
   or another CLI runner in that vault during testing.
6. Use Node.js 22 or newer and install this repository's dependencies with
   `npm install`. Check `node --version` in the same terminal used for testing.

The runner requires all three environment variables below. It accepts only the
name `excalidraw-test`, checks canonical vault and configuration paths against the
running app, requires the initial enabled Community plugin installation, and
rejects symlinked plugin directories/artifacts. There is no default-vault fallback.
Use the actual configuration directory if it differs from `.obsidian`.

## Run on Windows

From this plugin checkout in PowerShell, substitute your actual vault path:

```powershell
$env:EXCALIDRAW_TEST_VAULT_NAME = 'excalidraw-test'
$env:EXCALIDRAW_TEST_VAULT_PATH = 'C:\Obsidian\excalidraw-test'
$env:EXCALIDRAW_TEST_CONFIG_DIR = 'C:\Obsidian\excalidraw-test\.obsidian'
npm.cmd run test:obsidian:runner
npm.cmd run verify:obsidian:plugin
```

The launcher discovers `Obsidian.com` under `%LOCALAPPDATA%\Obsidian`,
`%PROGRAMFILES%\Obsidian`, or `%PROGRAMFILES(X86)%\Obsidian`, then falls back to
`obsidian` on PATH. For another installation, set an executable path:

```powershell
$env:EXCALIDRAW_OBSIDIAN_CLI = 'C:\Program Files\Obsidian\Obsidian.com'
```

Use the console launcher `.com` to capture output. The driver passes argument
arrays directly to native processes. It launches npm/Yarn JavaScript entries
through the current Node binary, avoiding `.cmd` shims and shell quoting.
PowerShell environment assignments apply to the current terminal session. Use
`npm.cmd` in PowerShell if its execution policy blocks `npm.ps1`; no global policy
change is necessary. The same applies to `npm.cmd install` and the fork lane's
`npm.cmd run verify:obsidian`.

For additional eval probes, import `spawnNativeSync` from
`scripts/testing/host/processTools.mjs` in a Node script and pass
`['vault=excalidraw-test', 'eval', 'code=' + code]`. Windows PowerShell can alter
embedded native quotes, and large/multiline inline evals can corrupt Obsidian's
console IPC JSON. The helper moves those payloads to an owned UTF-8 script in the
system temporary directory, sends a short file-reading eval, and removes the
directory after success or failure. This local file bridge exists only in test
tooling; no production plugin feature reads external test scripts.

## Run on macOS

From this plugin checkout in a shell, substitute your actual vault path:

```bash
export EXCALIDRAW_TEST_VAULT_NAME=excalidraw-test
export EXCALIDRAW_TEST_VAULT_PATH="$HOME/Obsidian/excalidraw-test"
export EXCALIDRAW_TEST_CONFIG_DIR="$EXCALIDRAW_TEST_VAULT_PATH/.obsidian"
npm run test:obsidian:runner
npm run verify:obsidian:plugin
```

The launcher discovers `/Applications/Obsidian.app/Contents/MacOS/obsidian-cli`,
then the application binary `/Applications/Obsidian.app/Contents/MacOS/Obsidian`,
then `obsidian` on PATH. Set `EXCALIDRAW_OBSIDIAN_CLI` to an executable path for a
nonstandard installation. Do not include command arguments in the override.
macOS evals use native argument arrays without the Windows temporary-file bridge.

## Choose the build

| Command | Component input | Prerequisites |
| --- | --- | --- |
| `npm run test:obsidian:runner` | Fake host fixtures | Node; no Obsidian required |
| `npm run verify:obsidian:plugin` | Installed `@zsviczian/excalidraw` artifacts | Plugin dependencies and prepared test vault |
| `npm run verify:obsidian` | Fresh sibling fork build | Both repositories' dependencies, Yarn, prepared test vault |

The plugin-only lane checks the installed component version against the exact
declared dependency, hashes its four Obsidian artifacts, and runs the real
production `npm run build`. It does not require the sibling fork checkout. If you
previously copied unpublished fork artifacts into `node_modules`, this lane uses
those bytes; version equality alone does not prove published provenance. Run
`npm install` to restore the published dependency before a release smoke.

For a fork integration check, use `npm run verify:obsidian`. It runs
`yarn build:obsidian` in `../excalidraw/packages/excalidraw`, copies only the four
generated Obsidian JavaScript/CSS files into the ignored installed package,
checks their hashes, then builds the plugin. Set `EXCALIDRAW_FORK_ROOT` to an
absolute checkout path when the fork is elsewhere. This temporary handoff does
not change dependencies or lockfiles and remains in `node_modules` afterward.

Windows resolves Yarn's JavaScript entry from the Node installation, the user's
global npm installation, or Corepack. For a different installation, set
`EXCALIDRAW_YARN_CLI` to the absolute `yarn.js` path. Use the fork's declared Yarn
version. npm must be discoverable through its `npm_execpath` or a standard Node
installation; launching through `npm run` supplies that entry automatically.

## Assertions, deployment and cleanup

After CLI capability and target checks, the runner:

1. Builds the selected inputs and validates the plugin manifest ID.
2. Disables Excalidraw in the test vault, copies `dist/main.js`, `styles.css` and
   `manifest.json`, checks deployed SHA-256 hashes, and enables the plugin.
3. Waits for the live plugin instance and stable drawing command registration.
4. Creates a UUID-named `__excalidraw_cli_smoke_*` drawing in the vault root through
   the plugin, opens it in a new tab, and waits for an API and editor wrapper with
   the correct owning document.
5. Rejects captured JavaScript errors, closes/deletes its own drawing, removes its
   temporary controller, and writes `report.json`. Cleanup failure fails the run.

Every CLI call explicitly starts with `vault=excalidraw-test`. A CLI `Error:`
payload is failure even when the process exits zero. Internal plugin access via
CLI eval belongs only in these host scripts, never in production modules.

Deployment replaces the test vault's installed plugin build and leaves it enabled;
it does not restore the Community release afterward. The runner does not overwrite
`data.json`, existing notes, or other plugins. Normal plugin startup/drawing
creation may persist its own settings. Opening the temporary tab can change focus
and workspace history; use a disposable test vault. It clears the test vault's
developer error buffer to attribute errors to this run.

The printed report path is in a unique temporary directory unless you set
`EXCALIDRAW_TEST_REPORT_DIR`. Reports include source revisions/dirty flags, build
mode, component version, Node/platform/Obsidian versions, component and deployed
plugin hashes, bundle size, scenarios, the exact temporary drawing path, and
cleanup. The runner awaits an empty view transition before deleting its drawing
so a pending close/save cannot recreate it. Inspect both `status` and
`cleanup`; keep reports outside the checkout and review local paths before sharing.

## Troubleshooting and further coverage

For Markdown embed changes, run the focused tests and the native regression for
issue #2953:

```bash
npm run test:markdown-embeds
npm run verify:obsidian:plugin -- --embed-recovery
```

Use `npm.cmd` in PowerShell. `--embed-recovery` also works with `verify:obsidian`
and can be combined with `--text-undo` or `--grouped-link-click`. The offline tests exercise the real
postprocessor with deferred image generation, including failed renders, temporary
detachment, overlapping attribute updates, repeated callbacks, loader cancellation,
and permanent context unload. They require no Obsidian process or extra DOM package.

The native scenario creates four UUID-named Markdown files (including a hybrid
drawing), one tiny PNG, and adds text to the parent runner's disposable drawing.
A long embedded note uses a collapsed callout
so three repeated drawing embeds stay in the viewport. It temporarily defers the
test plugin's `awaitInit()`, detaches the owned note's content for longer than the
loader's cancellation interval, and verifies rendering and decoding after
reattachment. SVG image, PNG, and inline SVG are checked in Live Preview, Reading
mode, warm reopen, and width updates; an additional popout checks detachment and
width updates in its own document. Closing a context with a pending render must
stop insertion. The hybrid fixture uses `excalidraw-open-md: true`, a relative
`![[#^as-image]]`, a nested drawing, and a native PNG. Live Preview and Reading mode
must show all three, both directly and inside another note's Markdown transclusion;
a filename-qualified `#^as-image` must still force the drawing side. These checks
run in the popout and require a Markdown drawing for the parent smoke fixture.
The scenario restores the temporary method override and preview
setting, closes its own leaves, deletes only its recorded fixture paths, and
removes its controller in `finally`. The parent runner still checks deployed
hashes, JavaScript errors, and drawing cleanup.

This is a controlled lifecycle regression, not a reproduction of every reported
layout race. Separately check an expanded long embedded note and scrolling,
Hybrid Note PDF export, and cold application startup. Record live macOS and
physical mobile coverage separately; Windows results do not establish those gates.

For grouped Ctrl/Cmd-click selection and link navigation, run:

```bash
npm run verify:obsidian:plugin -- --grouped-link-click
```

This regression dispatches synthetic pointer events through the mounted editor.
It checks first-click selection, unlinked members, second-click navigation with
Shift/Alt, nested groups, bound labels, and unchanged ungrouped link behavior.
It observes the real link resolver and intercepts its final navigation hook to
keep the test in its disposable drawing. Settings and hooks are restored afterward.
This establishes desktop event routing, not physical mouse/touch input.

For text-edit/history changes, run the repeatable regression for issue #2976:

```bash
npm run verify:obsidian:plugin -- --text-undo
```

Use `npm.cmd` in PowerShell. The same `--text-undo` option works with
`verify:obsidian` for a fork integration build. The complete #2976 fix also needs
the component's unchanged-text history fix, included in the paired source
checkpoint but pending package publication. Until the next component package and plugin dependency update,
use `verify:obsidian` with the matching sibling source to test the complete pair;
the declared `0.18.140` package does not include that component fix. The scenario
uses native CDP
keyboard input and the **Undo**/**Redo** toolbar buttons in the runner's
temporary drawing. It checks raw and parsed text modes, reopening after undo and
redo, submitting without changes, editing after undo, Markdown source preservation,
and legacy/empty source handling. The matrix includes plain text, `[[link]]`,
`[[link]]]` with an extra closing bracket, and `[[link|alias]]`. It writes a
`text-undo-2976` result to the report; the parent runner still owns drawing cleanup
and JavaScript error checks. The scenario uses the toolbar's stable test IDs, so
labels may be localized. Physical mobile and popout checks remain separate.

For the native Excalidraw authoring protocol, run:

```sh
node --test scripts/testing/cli.test.mjs
npm run verify:obsidian:plugin -- --native-cli
```

The native scenario uses real registered commands and owned fixtures for file
input, construction, template prose, read/apply/save/reopen, replay/stale/busy
receipts, delayed text preparation, save failure, SVG/PNG, vault image metadata,
and trusted script context/source changes/prompt refusal. Its temporary hooks and
files are restored/deleted in `finally`. It records actual artifact dimensions
and bytes. The separate text-undo scenario still requires the component fix
described above. Run one driver at a time; UI/CDP input also needs the intended
vault window to retain focus.

For LaTeX dialog input and window ownership (#2970), run:

```bash
npm run verify:obsidian:plugin -- --latex-input
```

Use `npm.cmd` in PowerShell. This option also works with `verify:obsidian`.
Close any existing LaTeX dialog in the test vault first. The scenario exercises
the real plugin prompt and CodeMirror in the main window, a direct popout, and
a tab moved to a popout. Native CDP input checks click placement, arrows,
Backspace, selection replacement, undo, Mod-Enter, formula save/reopen, cancel
and editor destruction. Popout input attaches only to the single new page target
created by the scenario. It restores its temporary gateway override, detaches
its CDP session, closes its popouts, and removes its controller in `finally`;
the parent runner owns the disposable drawing and final JavaScript-error check.

This input regression supplies a deterministic local SVG renderer through the
MathJax gateway. It requires no Extras installation or network access and does
not test MathJax rendering, its activation flow, or Latex Suite extensions.
For real Extras formula rendering and Latex Suite preview positioning, install
and enable both companions in the test vault, enable Extras MathJax-to-SVG and
Latex Suite math previews, then run:

```bash
npm run verify:obsidian:plugin -- --latex-preview
```

Use `npm.cmd` in PowerShell. This gate uses the real renderer without a gateway
override and repeats the input/save/cancel checks in all three window cases. It
also requires a visible, successfully rendered preview in each owning window.
The paired Extras fix registers tooltip positioning in existing and newly opened
popouts; testing only the main plugin cannot establish that companion gate.

Obsidian 1.14.0's Temml renderer rejects Latex Suite's `\class` cursor and
bracket markers with “Function \class is not trusted.” This is separate from
CodeMirror window ownership and Extras tooltip positioning. A vault with a
pre-existing global MathJax may render successfully despite identical plugin
versions. [Obsidian 1.14.1 switched to MathJax 4.1.3](https://obsidian.md/changelog/2026-09-08-desktop-v1.14.1/).
Update Obsidian to 1.14.1 or newer, or temporarily clear Latex Suite's **Cursor
symbol** and disable **Highlight brackets in preview** when testing 1.14.0.
Do not weaken renderer trust or install a global MathJax as a test workaround.

On Windows, the real-preview gate passed after upgrading the test host to
Obsidian 1.14.4 with the original Latex Suite settings. Main-window, direct-popout
and moved-tab input, rendered previews, save/reopen, cancel, JavaScript error
checks and fixture cleanup all passed without disabling cursor decorations.

Separately validate modal
dragging outside the editor, macOS/Linux popouts, restored windows and physical
mobile input. Windows CDP results do not establish these platform/extension gates.

If CLI access is disabled, enable it in Obsidian first. If the app is running but
the CLI cannot reach it, check host permissions: a sandbox may lack access to the
macOS CLI socket or Windows IPC. Retry with authorized host access instead of
opening a second instance or choosing another vault.

If a call times out, inspect pending trust, onboarding, or native error dialogs.
On Windows, malformed inline eval transport can produce a main-process JSON
parse error dialog that blocks later commands. Dismiss it and retry through the
Node helper. If necessary, ask the user to save work and restart Obsidian; do not
force-close the application while other vaults are open. After interrupted cleanup,
review the report/controller's exact drawing path before removing leftovers; never
delete notes by prefix alone.

The default smoke covers one newly created main-window drawing. It does not validate
saved scenes, clipboard, text editing, fonts/images, export, custom pens, popout
migration, offline assets, or physical mobile touch. For affected features, follow
the fork's [native validation procedure](https://github.com/zsviczian/excalidraw/blob/master/dev-docs/Obsidian/OBSIDIAN_RUNTIME_TESTING.md)
and its V03–V11 gates (also available in the sibling checkout). Record macOS and
Windows live results separately, along with artifact identity and unavailable
gates. A test of platform argument construction is not a live macOS smoke.
