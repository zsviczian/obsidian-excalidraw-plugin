/** Actual Obsidian mobile mode reloads the vault. Own state in Node across those reloads. */
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { validateTarget } from "./runner.mjs";
import { parseCLIJSON, runInAppTask } from "./inAppTask.mjs";
import {
  acquireDebuggerSession,
  unexpectedConsoleErrors,
} from "./debuggerSession.mjs";
import { deviceProfiles } from "./deviceProfiles.mjs";
import { writeReportFiles } from "../reportFiles.mjs";
import { waitForNativeReady } from "./hostReadiness.mjs";
import { mainWindowExpression, restoreDeviceState } from "./deviceRecovery.mjs";
import { runBehaviorMatrix } from "./behaviorMatrix.mjs";
import { runKplexOntologyScenario } from "./kplexOntology.mjs";
import { runEmbedControlsScenario } from "./embedControls.mjs";
import {acquireBrowserDiagnostics,classifyCLIErrorText,splitWindowErrors} from './browserDiagnostics.mjs';
import { constrainedViewportMetrics, viewportInput } from "./deviceViewport.mjs";
import { retryReadOnly } from "./readOnlyTransport.mjs";

/** The caller owns the application-session lock and exact build staging. */
export async function runDeviceMatrix({
  cli,
  reportDir,
  vaultName,
  vaultPath,
  configDir,
  automationRoot,
  profiles = deviceProfiles(),
  featureWorkflows = false,
  featureCases,
  kplexOntology = false,
  embedControls = false,
}) {
  reportDir = resolve(reportDir);
  const target = validateTarget({
    vaultName,
    vaultPath,
    configDir,
    automationRoot,
  });
  assert.equal(
    realpathSync(cli("vault", "info=path").trim()),
    target.vault,
    "Device CLI selected another vault",
  );
  const evaluate = (code) => parseCLIJSON(cli("eval", "code=" + code));
  const transportDiagnostics=[];
  const read=code=>retryReadOnly(()=>evaluate(code),{operation:"device window snapshot",diagnostics:transportDiagnostics});
  const owner = mainWindowExpression;
  const original = read(
    `JSON.stringify((()=>{const w=${owner};if(w.webContents.debugger.isAttached())throw Error('Existing debugger owner');return{mobile:app.isMobile===true,theme:app.vault.getConfig('theme'),layout:app.workspace.getLayout(),desktopMode:localStorage.getItem('excalidraw.desktopUIMode'),id:w.id,bounds:w.getBounds(),normalBounds:w.getNormalBounds(),minimum:w.getMinimumSize(),maximized:w.isMaximized(),fullscreen:w.isFullScreen(),zoom:w.webContents.getZoomFactor(),touch:{maxTouchPoints:navigator.maxTouchPoints,coarse:matchMedia('(pointer: coarse)').matches,hover:matchMedia('(hover: hover)').matches}};})())`,
  );
  const path = `__excalidraw_cli_smoke_devices_${randomUUID()}.excalidraw.md`;
  const fixture = readFileSync(
    new URL(
      "../../../tests/vault/Drawings/Uncompressed.excalidraw.md",
      import.meta.url,
    ),
    "utf8",
  );
  const report = {
    schemaVersion: 2,
    suiteId: "native-devices",
    status: "failed",
    cleanup: "not-started",
    tests: [],
    transportDiagnostics,
    requestedProfile: "devices",
    actualProfile: profiles.map((profile) => profile.id),
    limitations: [
      "Desktop Obsidian mobile emulation with trusted CDP touch input; no physical Android/iOS, WebView, stylus or OS-permission claim",
    ],
  };
  report.environment = {
    cliVersion: cli("version").trim(),
    ...evaluate(
      "JSON.stringify({versions:require('process').versions,platform:require('process').platform,userAgent:navigator.userAgent})",
    ),
  };
  report.fixture = {
    id: "Drawings/Uncompressed.excalidraw.md",
    sha256: createHash("sha256").update(fixture).digest("hex"),
  };
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(
    join(reportDir, "recovery.json"),
    JSON.stringify({ vaultName, path, original }, null, 2),
  );
  let debuggerSession, browserSession, viewportMetrics,
    currentMobile = original.mobile,
    created = false;
  report.reloadDiagnostics = [];
  const ready = () =>
    waitForNativeReady(cli, { diagnostics: report.reloadDiagnostics });
  try {
    evaluate(
      `(()=>{const w=${owner};if(w.id!==${original.id})throw Error('Main owner changed');w.setFullScreen(false);w.unmaximize();w.setMinimumSize(200,200);w.webContents.setZoomFactor(1);return JSON.stringify(true);})()`,
    );
    await runInAppTask({
      cli,
      args: [path, fixture],
      execute: async (_c, path, fixture) => {
        if (app.vault.getFileByPath(path))
          throw Error("Device fixture collision");
        await app.vault.create(path, fixture);
        return { created: true };
      },
    });
    created = true;
    for (const profile of profiles) {
      report.activeProfile = profile.id;
      // Resize the actual main owner, rather than merely changing CSS width.
      evaluate(
        `(()=>{const w=${owner};if(w.id!==${original.id})throw Error('Main owner changed');w.setContentSize(${profile.width},${profile.height});w.show();w.focus();w.webContents.focus();return JSON.stringify(true);})()`,
      );
      if (currentMobile !== profile.mobile) {
        cli("dev:mobile", profile.mobile ? "on" : "off");
        currentMobile = profile.mobile;
        await ready();
      }
      evaluate(
        `(()=>{const theme=${JSON.stringify(profile.theme === "dark" ? "obsidian" : "moonstone")};if(app.vault.getConfig('theme')!==theme)app.changeTheme(theme);return JSON.stringify(true);})()`,
      );
      debuggerSession = acquireDebuggerSession(cli);
      const nativeViewport = read(`JSON.stringify((()=>{const w=${owner},win=app.workspace.containerEl.ownerDocument.defaultView;return {width:win.innerWidth,height:win.innerHeight,workArea:win.require('@electron/remote').screen.getDisplayMatching(w.getBounds()).workArea}})())`);
      viewportMetrics = constrainedViewportMetrics(profile, nativeViewport);
      const viewportEmulated = viewportMetrics !== null;
      if (viewportMetrics) cli("dev:cdp", "method=Emulation.setDeviceMetricsOverride", "params="+JSON.stringify(viewportMetrics));
      browserSession=acquireBrowserDiagnostics(cli,profile.id);
      cli("dev:errors", "clear");
      const expectedConsoleErrors = [];
      cli(
        "dev:cdp",
        "method=Emulation.setTouchEmulationEnabled",
        `params=${JSON.stringify({ enabled: profile.input === "touch", maxTouchPoints: profile.input === "touch" ? 5 : 1 })}`,
      );
      const result = await runInAppTask({
        cli,
        execute: exerciseDevice,
        args: [path, fixture, profile],
        timeoutMs: 60_000,
        onRequest: (request) => {
          if (
            request.method === "resize-editor" &&
            Number.isSafeInteger(request.params.delta) &&
            Math.abs(request.params.delta) <= 32
          ) {
            if (viewportMetrics) {
              viewportMetrics = {...viewportMetrics, width: viewportMetrics.width + request.params.delta};
              cli("dev:cdp", "method=Emulation.setDeviceMetricsOverride", "params="+JSON.stringify(viewportMetrics));
            } else evaluate(
              `(()=>{const w=${owner};if(w.id!==${original.id})throw Error('Main owner changed');const [width,height]=w.getContentSize();w.setContentSize(width+${request.params.delta},height);return JSON.stringify(true);})()`,
            );
            return { resized: true };
          }
          if (
            request.method === "screenshot" &&
            request.params.id === profile.id
          ) {
            cli(
              "dev:screenshot",
              "path=" + join(reportDir, profile.id + ".png"),
            );
            return { captured: true };
          }
          if (
            request.method !== "cdp" ||
            !["Input.dispatchMouseEvent", "Input.dispatchTouchEvent"].includes(
              request.params.method,
            )
          )
            throw Error("Unexpected device input request");
          cli(
            "dev:cdp",
            "method=" + request.params.method,
            "params=" + JSON.stringify(viewportInput(request.params.method,request.params.params,viewportMetrics?.scale ?? 1)),
          );
          return { dispatched: true };
        },
      });
      let workflows;
      if (
        featureWorkflows &&
        ["phone-portrait-light", "tablet-portrait-full-light"].includes(
          profile.id,
        )
      ) {
        workflows = await runBehaviorMatrix({
          cli,
          drawingPath: path,
          contexts: [profile.id.startsWith("phone-") ? "phone" : "tablet"],
          input: "touch",
          viewportScale: viewportMetrics?.scale ?? 1,
          reportDir,
          ...(featureCases ? {caseIds:featureCases} : {}),
        });
        report.tests.push(...workflows.tests);
        if(workflows.transportDiagnostics?.length)(report.transportDiagnostics||=[]).push(...workflows.transportDiagnostics);
        expectedConsoleErrors.push(...(workflows.expectedConsoleErrors || []));
      }
      let ontology;
      if(kplexOntology && ["phone-portrait-light","tablet-portrait-full-light"].includes(profile.id)) {
        ontology=await runKplexOntologyScenario({cli,drawingPath:path,contexts:[profile.id.startsWith("phone-")?"phone":"tablet"],inputMode:"touch",viewportScale:viewportMetrics?.scale??1});
        report.tests.push(...ontology.tests);
      }
      let embeds;
      if (embedControls && ["phone-portrait-light", "tablet-portrait-full-light"].includes(profile.id)) {
        embeds = await runEmbedControlsScenario({ cli, drawingPath: path, contexts: [profile.id.startsWith("phone-") ? "phone" : "tablet"], inputMode: "touch", viewportScale: viewportMetrics?.scale ?? 1 });
        report.tests.push(...embeds.tests);
      }
      // Clearing viewport emulation resizes the real host again. Include that
      // teardown in the quiet/error gate before starting the next profile.
      if (viewportMetrics) {cli("dev:cdp", "method=Emulation.clearDeviceMetricsOverride", "params={}");viewportMetrics=null;}
      const browserIdle=await browserSession.settle();
      const errors = [
        ...debuggerSession.read(),
        ...(workflows?.consoleErrors || []),
        ...(ontology?.consoleErrors || []),
        ...(embeds?.consoleErrors || []),
      ];
      const unexpected = unexpectedConsoleErrors(errors, expectedConsoleErrors),
        windowErrorText = cli("dev:errors").trim();
      const windowEvents=browserSession.read(),classified=splitWindowErrors(windowEvents),cliErrors=classifyCLIErrorText(windowErrorText);
      const errorGatePassed =
        unexpected.length === 0 &&
        classified.unexpected.length===0 && cliErrors.unexpected.length===0 && browserIdle.status==='passed' && (!workflows||workflows.status==='passed') && (!ontology||ontology.status==='passed') && (!embeds||embeds.status==='passed');
      browserSession.dispose();browserSession=null;
      if(debuggerSession.transportDiagnostics?.length)report.transportDiagnostics.push(...debuggerSession.transportDiagnostics.map(item=>({profile:profile.id,...item})));
      debuggerSession.dispose();
      debuggerSession = null;
      report.tests.push({
        testId: "native:device:" + profile.id,
        featureIds: ["P07", "P08"],
        ...result,
        viewportTransport: viewportEmulated ? "CDP viewport fitted to constrained display" : "native window",
        nativeViewport,
        status: errorGatePassed ? "passed" : "failed",
        windowEvents,browserDiagnostics:classified.diagnostics,cliErrors,browserIdle,
        ...(errorGatePassed
          ? {}
          : {
              reason: workflows?.status==='failed'?"Required native device workflow failed":"Unexpected native device errors",
              failedWorkflowTests:workflows?.tests.filter(test=>test.status!=='passed').map(test=>test.testId),
              unexpectedConsoleErrors: unexpected,
              windowErrorText,
              windowErrors: workflows?.windowErrors || [],
            }),
      });
    }
    report.status = report.tests.every((test) => test.status === "passed")
      ? "passed"
      : "failed";
  } catch (error) {
    report.error = String(error.stack || error);
    if(error.observations)report.observations=error.observations;
    report.tests.push(...(error.evidence || []));
    report.tests.push({
      testId: "native:device:" + (report.activeProfile || "setup"),
      featureIds: ["P07", "P08"],
      status: "failed",
      reason: report.error,
    });
    if (error.cleanupFailed) report.unsettledTask = true;
  } finally {
    try {
      let debuggerError;
      if(browserSession){
        try{report.failedWindowEvents=browserSession.read();}
        catch(error){debuggerError=error;}
        finally{try{browserSession.dispose();}catch(error){debuggerError||=error;}browserSession=null;}
      }
      if (debuggerSession) {
        try {
          if (viewportMetrics) {cli("dev:cdp", "method=Emulation.clearDeviceMetricsOverride", "params={}");viewportMetrics=null;}
          debuggerSession.dispose();
        } catch (error) {
          debuggerError = error;
        } finally {
          debuggerSession = null;
        }
      }
      if (report.unsettledTask)
        throw Error(
          "Unsettled native work: preserve its drawing, windows and recovery.json; do not reload or delete fixtures",
        );
      report.restoration = await restoreDeviceState({
        cli,
        original,
        path,
        created,
      });
      if (debuggerError) throw debuggerError;
      report.cleanup = report.unsettledTask ? "failed" : "passed";
    } catch (error) {
      report.cleanup = "failed";
      report.cleanupError = String(error.stack || error);
    }
    if (report.cleanup !== "passed") report.status = "failed";
    writeFileSync(
      join(reportDir, "report.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    writeReportFiles(report, reportDir);
  }
  return report;
}

async function exerciseDevice(c, path, fixture, profile) {
  const p = app.plugins.plugins["obsidian-excalidraw-plugin"],
    doc = app.workspace.containerEl.ownerDocument;
  await c.waitFor(
    () => {
      c.observations = {...c.observations, viewport:{requested:[profile.width,profile.height],actual:[innerWidth,innerHeight]}};
      return innerWidth === profile.width && innerHeight === profile.height;
    },
    "actual requested viewport",
  );
  const check = (condition, message) => {
    if (!condition) throw Error(message);
  };
  const settings = Object.fromEntries(
    [
      "desktopUIMode",
      "tabletUIMode",
      "phoneUIMode",
      "penModeSingleFingerPanning",
      "pasteCodeBlockAs",
    ].map((key) => [key, p.settings[key]]),
  );
  const desktopMode = localStorage.getItem("excalidraw.desktopUIMode");
  c.defer(() => {
    Object.assign(p.settings, settings);
    if (desktopMode === null)
      localStorage.removeItem("excalidraw.desktopUIMode");
    else localStorage.setItem("excalidraw.desktopUIMode", desktopMode);
  });
  let anchor;
  app.workspace.iterateAllLeaves((leaf) => {
    if (!anchor && leaf.getRoot() === app.workspace.rootSplit) anchor = leaf;
  });
  check(anchor, "Main workspace anchor missing");
  app.workspace.setActiveLeaf(anchor, { focus: true });
  doc.defaultView.focus();
  // A mode reload can restore the previous debounced workspace snapshot. Retire
  // only this task's restored drawing before resetting its owned file; otherwise
  // that live editor can reconcile old link IDs into the fresh seed.
  const restoredOwned = [];
  app.workspace.iterateAllLeaves((leaf) => {
    if (
      leaf.view.file?.path === path &&
      ["excalidraw", "markdown"].includes(leaf.view.getViewType())
    )
      restoredOwned.push(leaf);
  });
  for (const leaf of restoredOwned) {
    check(
      leaf.view.containerEl.ownerDocument === doc,
      "Restored device drawing unexpectedly belongs to a popout",
    );
    await leaf.setViewState({ type: "empty", state: {} });
    leaf.detach();
  }
  const file = app.vault.getFileByPath(path);
  check(file, "Owned device fixture missing");
  await app.vault.modify(file, fixture);
  p.settings.desktopUIMode = profile.mode === "mobile" ? "tray" : profile.mode;
  p.settings.tabletUIMode =
    profile.mode === "mobile" ? "compact" : profile.mode;
  p.settings.phoneUIMode = profile.boundary ? "mobile" : profile.mode;
  p.settings.penModeSingleFingerPanning = false;
  const leaf = app.workspace.getLeaf("tab");
  c.defer(async () => {
    await leaf.setViewState({ type: "empty", state: {} });
    leaf.detach();
  });
  await leaf.openFile(file);
  await c.waitFor(
    () =>
      leaf.view.excalidrawAPI &&
      !leaf.view.semaphores.justLoaded &&
      !leaf.view.isClosingOrMigrating(),
    "device editor first commit",
  );
  const view = leaf.view,
    api = view.excalidrawAPI;
  check(view.ownerDocument === doc, "Device drawing opened in a popout");
  check(
    api.getSceneElements().length === 2,
    "Device seed did not reset to exactly two elements",
  );
  const paneBefore = view.containerEl.getBoundingClientRect().toJSON();
  if (profile.pane === "fullscreen") {
    view.gotoFullscreen();
    c.defer(() => {
      view.exitFullscreen();
      check(!view.isFullscreen(), "Owned fullscreen did not restore");
    });
    await c.waitFor(
      () =>
        view.isFullscreen() &&
        view.containerEl
          .querySelector("canvas.interactive")
          .getBoundingClientRect().width >=
          innerWidth - 100,
      "owned fullscreen viewport",
    );
  }
  if (profile.editorWidth !== undefined) {
    const width = view.containerEl
      .querySelector(".excalidraw")
      .getBoundingClientRect().width;
    if (width !== profile.editorWidth)
      await c.requestHost("resize-editor", {
        delta: Math.round(profile.editorWidth - width),
      });
    await c.waitFor(
      () =>
        view.containerEl.querySelector(".excalidraw").getBoundingClientRect()
          .width === profile.editorWidth,
      "exact editor breakpoint width",
    );
  }
  view.setUIMode(profile.mode === "mobile" ? "tray" : profile.mode);
  view.setTheme(profile.theme);
  api.updateScene({
    appState: { penMode: false, viewModeEnabled: false },
    captureUpdate: "NEVER",
  });
  await c.waitFor(
    () =>
      doc.body.hasClass(
        profile.theme === "dark" ? "theme-dark" : "theme-light",
      ) && api.getAppState().theme === profile.theme,
    "actual host and drawing themes",
  );
  try {
    await c.waitFor(
      () => api.getEditorInterface().formFactor === profile.formFactor,
      "measured device classification",
    );
  } catch (error) {
    throw Error(
      error.message +
        ": " +
        JSON.stringify({
          viewport: { width: innerWidth, height: innerHeight },
          editor: api.getEditorInterface(),
          device: p.getObsidianDevice(),
        }),
    );
  }
  if (profile.canFitSidebar !== undefined)
    check(
      api.getEditorInterface().canFitSidebar === profile.canFitSidebar,
      "Sidebar breakpoint differs",
    );
  const rect = (element) => {
    const r = element.getBoundingClientRect();
    return {
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height,
      right: r.right,
      bottom: r.bottom,
    };
  };
  const button = [
    ...view.containerEl.querySelectorAll('[data-testid="toolbar-rectangle"]'),
  ].find(
    (element) =>
      !element.closest(".tool-popover-content") &&
      element.getBoundingClientRect().width > 0,
  );
  check(button, "Rectangle tool is not reachable");
  const bounds = rect(button),
    x = bounds.x + bounds.width / 2,
    y = bounds.y + bounds.height / 2;
  check(
    bounds.x >= 0 &&
      bounds.y >= 0 &&
      bounds.right <= innerWidth &&
      bounds.bottom <= innerHeight,
    "Rectangle tool is clipped",
  );
  check(
    doc.elementFromPoint(x, y)?.closest("button") === button,
    "Rectangle tool is covered",
  );
  c.observations={...c.observations,toolbarTap:{requested:{x,y},bounds,events:[]}};
  const observeTap=event=>c.observations.toolbarTap.events.push({type:event.type,x:event.clientX,y:event.clientY,trusted:event.isTrusted,pointerType:event.pointerType,target:event.target?.outerHTML?.slice(0,500),pointerId:event.pointerId,captured:event.target?.hasPointerCapture?.(event.pointerId),newElement:api.getAppState().newElement?.type});
  doc.addEventListener('pointerdown',observeTap,true);
  c.defer(()=>doc.removeEventListener('pointerdown',observeTap,true));
  const input = async (type, x, y) => {
    if (profile.input === "touch")
      await c.requestHost("cdp", {
        method: "Input.dispatchTouchEvent",
        params: {
          type,
          touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }],
        },
      });
    else
      await c.requestHost("cdp", {
        method: "Input.dispatchMouseEvent",
        params: {
          type,
          x,
          y,
          button: "left",
          buttons: type === "mouseReleased" ? 0 : 1,
          clickCount: 1,
        },
      });
  };
  await input(profile.input === "touch" ? "touchStart" : "mousePressed", x, y);
  await input(profile.input === "touch" ? "touchEnd" : "mouseReleased", x, y);
  await c.waitFor(
    () => api.getAppState().activeTool.type === "rectangle",
    "trusted toolbar selection",
  );
  const deliveredTap=c.observations.toolbarTap.events.find(event=>event.pointerType===profile.input);
  check(deliveredTap && Math.abs(deliveredTap.x-x)<2 && Math.abs(deliveredTap.y-y)<2,"Trusted input missed the CSS hit-test coordinates");
  if (!profile.boundary)
    await c.waitFor(() => {
      const root = view.containerEl.querySelector(".excalidraw"),
        compact = view.containerEl.querySelector(".compact-shape-actions");
      if (profile.mode === "mobile")
        return root.classList.contains("excalidraw--mobile");
      if (profile.mode === "tray")
        return (
          root.classList.contains("excalidraw--tray") &&
          !!view.containerEl.querySelector(".App-top-bar")
        );
      if (profile.mode === "compact")
        return !!compact && compact.getBoundingClientRect().width > 0;
      return (
        !compact &&
        !root.classList.contains("excalidraw--tray") &&
        !!view.containerEl.querySelector(".selected-shape-actions")
      );
    }, "actual requested layout");
  const canvas = view.containerEl.querySelector("canvas.interactive"),
    canvasBounds = rect(canvas),
    events = [];
  await c.requestHost("screenshot", { id: profile.id });
  const listener = (event) => {
    if (event.target === canvas)
      events.push({ trusted: event.isTrusted, pointerType: event.pointerType });
  };
  doc.addEventListener("pointerdown", listener, true);
  c.defer(() => doc.removeEventListener("pointerdown", listener, true));
  let start, end;
  try {
    await c.waitFor(() => {
      for (const [x, y] of [
        [0.65, 0.5],
        [0.6, 0.4],
        [0.7, 0.6],
      ]) {
        const a = {
          x: canvasBounds.x + canvasBounds.width * x,
          y: canvasBounds.y + canvasBounds.height * y,
        };
        const b = {
          x: a.x + Math.min(80, canvasBounds.width * 0.2),
          y: a.y + Math.min(60, canvasBounds.height * 0.18),
        };
        if (
          doc.elementFromPoint(a.x, a.y) === canvas &&
          doc.elementFromPoint(b.x, b.y) === canvas
        ) {
          start = a;
          end = b;
          return true;
        }
      }
      return false;
    }, "uncovered canvas drawing area");
  } catch (error) {
    throw Error(
      error.message +
        ": " +
        JSON.stringify({
          canvas: canvasBounds,
          hits: [
            [0.65, 0.5],
            [0.6, 0.4],
            [0.7, 0.6],
          ].map(([x, y]) =>
            doc
              .elementFromPoint(
                canvasBounds.x + canvasBounds.width * x,
                canvasBounds.y + canvasBounds.height * y,
              )
              ?.outerHTML.slice(0, 180),
          ),
        }),
    );
  }
  if (profile.input === "mouse") await input("mouseMoved", start.x, start.y);
  await input(
    profile.input === "touch" ? "touchStart" : "mousePressed",
    start.x,
    start.y,
  );
  await input(
    profile.input === "touch" ? "touchMove" : "mouseMoved",
    end.x,
    end.y,
  );
  await input(
    profile.input === "touch" ? "touchEnd" : "mouseReleased",
    end.x,
    end.y,
  );
  try {
    await c.waitFor(
      () => api.getSceneElements().length === 3,
      "trusted drawing input",
    );
  } catch (error) {
    throw Error(
      error.message +
        ": " +
        JSON.stringify({
          count: api.getSceneElements().length,
          events,
          activeTool: api.getAppState().activeTool,
          newElement: api.getAppState().newElement?.type,
          penMode: api.getAppState().penMode,
          focused: doc.hasFocus(),
          start,
          end,
        }),
    );
  }
  check(
    events.some(
      (event) => event.trusted && event.pointerType === profile.input,
    ),
    "Input was not trusted or had the wrong pointer type",
  );
  await c.waitFor(() => view.isDirty(), "device edit dirty state");
  check(
    (await view.saveWithOutcome()).status === "persisted",
    "Device edit did not save",
  );
  check(
    (await p.ea.getSceneFromFile(file)).elements.length === 3,
    "Device disk round trip lost elements",
  );
  check(
    (app.isMobile === true) === profile.mobile,
    "Narrow desktop/mobile mode confused",
  );
  // #3000: full/compact footer controls also run on applicable tablet layouts.
  // Phone/tray chrome does not render this footer; its existing tool checks above
  // remain required rather than treating it as a physical mobile Zen test.
  let zenControls = { footer: false };
  if (profile.mode !== "tray" && api.getEditorInterface().formFactor !== "phone") {
    const root = view.containerEl.querySelector(".excalidraw");
    const originalRootDirection = root.getAttribute("dir"), originalDocumentDirection = doc.documentElement.getAttribute("dir");
    const variants = [];
    try {
      for (const direction of ["ltr", "rtl"]) {
        doc.documentElement.setAttribute("dir", direction); root.setAttribute("dir", direction);
        api.updateScene({ appState: { zenModeEnabled: true, zoom: { value: 1.7 } }, captureUpdate: "NEVER" });
        await c.waitFor(() => {
          const exit = view.containerEl.querySelector(".disable-zen-mode--visible");
          return exit && doc.defaultView.getComputedStyle(exit).visibility === "visible" && Number(doc.defaultView.getComputedStyle(exit).opacity) > 0.99;
        }, "device Zen exit control");
        const exit = view.containerEl.querySelector(".disable-zen-mode--visible"), zoom = view.containerEl.querySelector(".reset-zoom-button");
        check(zoom, "Device Zen zoom indicator missing");
        const a = rect(exit), b = rect(zoom), editor = rect(root);
        check(!(Math.min(a.right, b.right) - Math.max(a.x, b.x) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) > 1), "Device Zen controls overlap");
        for (const button of [exit, zoom]) {
          const bounds = rect(button);
          check(bounds.width > 0 && bounds.height > 0 && bounds.x >= editor.x && bounds.right <= editor.right &&
            bounds.y >= editor.y && bounds.bottom <= editor.bottom && bounds.x >= 0 && bounds.right <= innerWidth &&
            doc.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)?.closest("button") === button,
            "Device Zen control clipped or covered");
        }
        const tap = async button => {
          const bounds = rect(button), x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2;
          if (profile.input === "mouse") await input("mouseMoved", x, y);
          c.observations.zenTap = { bounds, hit: doc.elementFromPoint(x, y)?.outerHTML.slice(0, 500) };
          await input(profile.input === "touch" ? "touchStart" : "mousePressed", x, y);
          await input(profile.input === "touch" ? "touchEnd" : "mouseReleased", x, y);
        };
        await tap(zoom); await c.waitFor(() => { c.observations.zenZoom = { zoom: api.getAppState().zoom.value, constraints: api.getAppState().scrollConstraints }; return api.getAppState().zoom.value === 1; }, "device Zen zoom action");
        await tap(exit); await c.waitFor(() => !api.getAppState().zenModeEnabled, "device Zen exit action");
        variants.push({ direction, exit: a, zoom: b });
      }
      zenControls = { footer: true, exit: variants[0].exit, zoom: variants[0].zoom, trustedInput: profile.input, variants };
    } finally {
      if (originalRootDirection === null) root.removeAttribute("dir"); else root.setAttribute("dir", originalRootDirection);
      if (originalDocumentDirection === null) doc.documentElement.removeAttribute("dir"); else doc.documentElement.setAttribute("dir", originalDocumentDirection);
      api.updateScene({ appState: { zenModeEnabled: false }, captureUpdate: "NEVER" });
    }
  }
  // The shared chooser must wrap and remain tappable in each actual host mode.
  p.settings.pasteCodeBlockAs = "ask";
  const codeSource = "```js\nconsole.log('device code');\n```";
  const insertion = view.pasteCodeBlock(codeSource);
  let codeModal;
  c.defer(() => { if (codeModal?.isConnected) codeModal.querySelector(".modal-close-button")?.click(); });
  let lastGeometry, stableSince;
  await c.waitFor(() => {
    codeModal = [...doc.querySelectorAll(".modal")].find(modal => modal.querySelector(".excalidraw-multiOptionConfirmationPrompt-message")?.textContent.includes("Insert this code block"));
    if (!codeModal) return false;
    const geometry = JSON.stringify([...codeModal.querySelectorAll("button,.checkbox-container")].map(element => rect(element)));
    if (geometry !== lastGeometry) { lastGeometry = geometry; stableSince = Date.now(); }
    return Date.now() - stableSince > 150;
  }, "stable code format chooser");
  const codeControls = [...codeModal.querySelectorAll("button,.checkbox-container")];
  const tapCodeControl = async element => {
    const bounds = rect(element), x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2;
    check(bounds.width > 0 && bounds.height > 0 && bounds.x >= 0 && bounds.right <= innerWidth && bounds.y >= 0 && bounds.bottom <= innerHeight && element.contains(doc.elementFromPoint(x, y)), "Code format control clipped or covered");
    if (profile.input === "mouse") await input("mouseMoved", x, y);
    await input(profile.input === "touch" ? "touchStart" : "mousePressed", x, y);
    await input(profile.input === "touch" ? "touchEnd" : "mouseReleased", x, y);
  };
  for (const control of codeControls) {
    const bounds = rect(control), x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2;
    check(bounds.width > 0 && bounds.height > 0 && bounds.x >= 0 && bounds.right <= innerWidth && bounds.y >= 0 && bounds.bottom <= innerHeight && control.contains(doc.elementFromPoint(x, y)), "Code format option or remember toggle is unusable");
  }
  const toggle = codeModal.querySelector(".checkbox-container");
  await tapCodeControl(toggle); check(toggle.classList.contains("is-enabled"), "Code format remember toggle did not enable");
  await tapCodeControl(toggle); check(!toggle.classList.contains("is-enabled"), "Code format remember toggle did not disable");
  const markdownButton = [...codeModal.querySelectorAll("button")].find(button => button.textContent === "Markdown image");
  const codeFormat = { bounds: rect(codeModal), controls: codeControls.map(element => ({ text: element.textContent, bounds: rect(element) })), trustedInput: profile.input };
  await tapCodeControl(markdownButton); await insertion;
  const codeImage = api.getSceneElements().find(element => element.type === "image" && element.customData?.markdownImage?.source === "local");
  check(codeImage && view.excalidrawData.getMarkdownImage(codeImage.fileId)?.markdown === codeSource, "Device code choice did not insert an editable Markdown image");
  check((await view.saveWithOutcome()).status === "persisted", "Device code image did not save");
  check((await p.ea.getSceneFromFile(file)).elements.some(element => element.id === codeImage.id), "Device code image missing from disk");
  await c.requestHost("screenshot", { id: profile.id });
  return {
    assertions: [
      "actual Obsidian mobile/desktop mode",
      "measured editor classification",
      "actual host and drawing theme",
      "visible uncovered tool",
      "trusted pointer selects and draws",
      "device edit saves to disk",
      "applicable Zen footer controls do not overlap and accept trusted input",
      "code format options and remember toggle fit and accept trusted input",
      "chosen code image preserves editable source and saves",
    ],
    requested: profile,
    actual: {
      viewport: { width: innerWidth, height: innerHeight },
      retiredRestoredOwnedEditors: restoredOwned.length,
      paneBefore,
      fullscreen: view.isFullscreen(),
      editorBounds: rect(view.containerEl.querySelector(".excalidraw")),
      canvas: canvasBounds,
      tool: bounds,
      editorInterface: api.getEditorInterface(),
      hostDevice: p.getObsidianDevice(),
      mobile: app.isMobile === true,
      maxTouchPoints: navigator.maxTouchPoints,
      coarsePointer: matchMedia("(pointer: coarse)").matches,
      events,
      zenControls,
      codeFormat,
    },
  };
}
