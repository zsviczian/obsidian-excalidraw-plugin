/** Run only against the guarded runner's disposable drawing. */
async function exerciseGroupedLinkClicks(view, link, modifier) {
  const api = view.excalidrawAPI;
  const ownerWindow = view.ownerWindow;
  const originalLinkClick = view.linkClick;
  const originalHook = view.handleLinkHookCall;
  const originalAllow = view.plugin.settings.allowCtrlClick;
  const calls = [];
  const navigation = [];
  const assertions = [];
  const next = () => new Promise(resolve => ownerWindow.setTimeout(resolve, 100));
  const check = (ok, label) => {
    if (!ok) throw Error(`${label}: ${JSON.stringify({ calls, navigation, selected: api.getAppState().selectedElementIds })}`);
    assertions.push(label);
  };
  const rectangle = (id, x, extra = {}) => ({
    type: 'rectangle', id, x, y: 100, width: 150, height: 100,
    backgroundColor: '#ffffff', fillStyle: 'solid', ...extra,
  });
  const fixture = () => [
    rectangle('linked', 100, { groupIds: ['inner', 'outer'], link }),
    rectangle('plain', 300, { groupIds: ['inner', 'outer'] }),
    rectangle('other-link', 500, { groupIds: ['inner', 'outer'], link }),
  ];
  const set = async (elements, appState = {}) => {
    api.updateScene({
      elements: view.packages.excalidrawLib.restoreElements(elements, null),
      appState: {
        viewModeEnabled: false, scrollX: 0, scrollY: 0, zoom: { value: 1 },
        selectedElementIds: {}, selectedGroupIds: {}, editingGroupId: null,
        contextMenu: null, ...appState,
      },
      captureUpdate: 'NEVER', forceFlushSync: true,
    });
    api.setActiveTool({ type: 'selection' });
    await next();
    calls.length = 0;
    navigation.length = 0;
  };
  const click = async (x, extra = {}) => {
    const state = api.getAppState();
    for (const type of ['pointerdown', 'pointerup']) {
      view.containerEl.querySelector('canvas.interactive').dispatchEvent(
        new ownerWindow.PointerEvent(type, {
          bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse',
          button: 0, buttons: type === 'pointerup' ? 0 : 1,
          clientX: (x + state.scrollX) * state.zoom.value + state.offsetLeft,
          clientY: (150 + state.scrollY) * state.zoom.value + state.offsetTop,
          ...modifier, ...extra,
        }),
      );
      await next();
    }
  };
  // Observe the real resolver, then intercept its final navigation hook so the
  // test cannot leave its owned drawing or open a native/external destination.
  view.linkClick = (...args) => {
    calls.push({ text: args[1]?.id, image: args[2]?.id, link: args[3]?.id });
    return originalLinkClick.apply(view, args);
  };
  view.handleLinkHookCall = (element, linkText, event) => {
    navigation.push({ id: element?.id, linkText, shift: event?.shiftKey, alt: event?.altKey });
    return true;
  };
  view.plugin.settings.allowCtrlClick = true;
  try {
    await set(fixture());
    await click(360);
    check(calls.length === 0 && api.getAppState().selectedElementIds.plain,
      'unlinked first click selects without navigation');
    await click(360);
    check(calls.length === 0, 'unlinked second click never inherits sibling link');

    await set(fixture(), {
      selectedElementIds: { linked: true, plain: true, 'other-link': true },
      selectedGroupIds: { outer: true },
    });
    await click(160);
    check(calls.length === 0 && Object.keys(api.getAppState().selectedElementIds).join(',') === 'linked',
      'linked first click drills into selected group');
    await click(160);
    check(navigation.length === 1 && navigation[0].id === 'linked',
      'linked second click navigates exact member');
    calls.length = 0;
    navigation.length = 0;
    await click(560);
    check(calls.length === 0 && api.getAppState().selectedElementIds['other-link'],
      'switching grouped member selects without navigation');
    await click(560, { shiftKey: true });
    check(navigation.length === 1 && navigation[0].id === 'other-link' && navigation[0].shift,
      'second click preserves Shift navigation modifier');

    await set(fixture());
    await click(160);
    check(calls.length === 0, 'unselected linked group member gets selection first');
    await click(160, { altKey: true });
    check(navigation.length === 1 && navigation[0].id === 'linked' && navigation[0].alt,
      'selected grouped member preserves Alt navigation modifier');
    calls.length = 0;
    navigation.length = 0;
    await click(360, { altKey: true });
    check(calls.length === 0, 'Alt click on different unlinked member cannot navigate stale selection');

    await set([rectangle('ungrouped', 100, { link })]);
    await click(160);
    check(navigation.length === 1 && navigation[0].id === 'ungrouped',
      'ungrouped link still navigates on first modifier click');

    await set([
      rectangle('container', 100, { groupIds: ['group'], boundElements: [{ type: 'text', id: 'label' }] }),
      { type: 'text', id: 'label', x: 130, y: 125, width: 70, height: 30,
        text: 'label', originalText: 'label', rawText: 'label', containerId: 'container',
        groupIds: ['group'], link },
      rectangle('plain', 300, { groupIds: ['group'] }),
    ]);
    await click(120);
    check(calls.length === 0, 'grouped bound label gets selection first');
    await click(120);
    check(navigation.length === 1 && navigation[0].id === 'label',
      'second click follows bound label link');
    return assertions;
  } finally {
    view.linkClick = originalLinkClick;
    view.handleLinkHookCall = originalHook;
    view.plugin.settings.allowCtrlClick = originalAllow;
  }
}

/** Synthetic input through the mounted editor; the parent owns deployment and cleanup. */
export async function runGroupedLinkClickScenario({ cli, drawingPath }) {
  const evaluate = code => JSON.parse(cli('eval', `code=${code}`).trim().replace(/^=>\s*/, ''));
  const controller = '__excalidrawGroupedLinkClick';
  const viewCode = `app.workspace.getLeavesOfType('excalidraw').find(l=>l.view.file?.path===${JSON.stringify(drawingPath)})?.view`;
  const modifier = process.platform === 'darwin' ? { metaKey: true } : { ctrlKey: true };
  evaluate(`(()=>{if(globalThis.${controller})throw Error('Controller already present');const c={state:'pending'};globalThis.${controller}=c;(${exerciseGroupedLinkClicks.toString()})(${viewCode},${JSON.stringify(`[[${drawingPath}]]`)},${JSON.stringify(modifier)}).then(assertions=>{c.assertions=assertions;c.state='passed'},error=>{c.error=String(error.stack||error);c.state='failed'});return JSON.stringify({started:true})})()`);
  try {
    for (let i = 0; i < 120; i++) {
      await new Promise(resolve => setTimeout(resolve, 250));
      const state = evaluate(`JSON.stringify(globalThis.${controller})`);
      if (state.state === 'failed') throw Error(state.error);
      if (state.state === 'passed') return {
        id: 'grouped-link-click', status: 'passed',
        input: 'owner-window synthetic pointer events', assertions: state.assertions,
      };
    }
    throw Error('Grouped link click scenario timed out');
  } finally {
    evaluate(`(()=>{delete globalThis.${controller};return JSON.stringify({clean:true})})()`);
  }
}
