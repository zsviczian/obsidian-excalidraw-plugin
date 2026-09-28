// Exercises host selection and CanvasNodeFactory lifecycle behavior. The factory
// dependencies are aliased to the local stub module for this Node process.
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

const here = path.dirname(fileURLToPath(import.meta.url));
const stubs = path.join(here, "check-embeddable-mount-plan.stubs.mjs");
const jiti = createJiti(import.meta.url, {
  alias: { obsidian: stubs, "../../utils/obsidianUtils": stubs },
});

//The factory reads this global to tell a main-window split from a popout one.
globalThis.mainDocument = {};

const {
  CANVAS_NODE_HOST_WAIT_TIMEOUT_MS,
  awaitCanvasNodeHost,
  mountEmbeddableHost,
  requiresCanvasNodeHost,
} = await jiti.import("../src/utils/embeddableMountPlan.ts");
const { CanvasNodeFactory } = await jiti.import(
  "../src/view/managers/CanvasNodeFactory.ts",
);

const log = (message) => process.stdout.write(`${message}\n`);

//The module defaults its wait to Obsidian's `sleep` global, absent here.
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

//The wait's poll delay, with hooks keyed by poll number. A hook runs once that
//poll has been entered, so an event lands at a known point of the wait, and a
//wait that outlives every hook fails the script.
const polling = (hooks = {}, limit = 50) => {
  const polls = {
    count: 0,
    delay: (ms) => {
      polls.count += 1;
      if (polls.count > limit) {
        return Promise.reject(new Error(`still polling after ${limit} polls`));
      }
      hooks[polls.count]?.();
      return delay(ms);
    },
  };
  return polls;
};

//Cancellation is live at setup, cancelled on the cleanup read, then live again
//when the refs are populated.
const cancelledOnRead = (read) => {
  let reads = 0;
  return () => {
    reads += 1;
    return reads === read;
  };
};

const hostReadyOnRead = (read) => {
  const host = {
    reads: 0,
    isInitialized: () => {
      host.reads += 1;
      return host.reads >= read;
    },
  };
  return host;
};

const unreadyHost = { isInitialized: () => false };

//A host that reports its lifecycle, as `CanvasNodeFactory` does.
const lifecycleHost = () => {
  let settle;
  const host = {
    initialized: false,
    isInitialized: () => host.initialized,
    whenInitialized: new Promise((resolve) => {
      settle = resolve;
    }),
    ready: () => {
      host.initialized = true;
      settle(true);
    },
    //initialize() threw, or destroy() ran: it will never host a node.
    givesUp: () => {
      host.initialized = false;
      settle(false);
    },
  };
  return host;
};

const neverSettlingHost = () => ({
  isInitialized: () => false,
  whenInitialized: new Promise(() => {}),
});

const mountRecorder = (overrides = {}) => {
  const calls = { canvasNodes: 0, workspaceLeaves: 0 };
  return {
    calls,
    options: {
      subpath: "#Section",
      fileExtension: "md",
      getHost: () => ({ isInitialized: () => true }),
      createCanvasNode: () => {
        calls.canvasNodes += 1;
      },
      createWorkspaceLeaf: () => {
        calls.workspaceLeaves += 1;
      },
      timeoutMs: 200,
      intervalMs: 1,
      delay,
      ...overrides,
    },
  };
};

//Minimal `ExcalidrawView` stand-in: the members `initialize()` reaches.
const fakeView = ({ loadMs = 0, loadThrows = false } = {}) => ({
  ownerDocument: {},
  app: {
    internalPlugins: {
      plugins: {
        canvas: {
          _loaded: false,
          load: async () => {
            await delay(loadMs);
            if (loadThrows) {
              throw new Error("canvas plugin failed to load");
            }
          },
          views: { canvas: () => ({ canvas: { createFileNode: () => ({}) } }) },
        },
      },
    },
    workspace: {
      rootSplit: {},
      floatingSplit: {},
    },
  },
});

//Resolves to the promise's value, or to `PENDING` if it has not settled.
const PENDING = Symbol("pending");
const settleWithin = (promise, ms = 50) =>
  Promise.race([promise, delay(ms).then(() => PENDING)]);

//Blocks run independently.
const blocks = [];
const block = (name, fn) => blocks.push([name, fn]);

//--------------------------------------------------------------------------------
//requiresCanvasNodeHost: which embeds can only be rendered by a Canvas node
//--------------------------------------------------------------------------------

block("only a markdown subpath embed requires a canvas node host", () => {
  for (const [subpath, extension, required] of [
    ["#Section", "md", true],
    ["#Section", "MD", true],
    ["#^blockid", "md", true],
    ["#", "md", true],
    [null, "md", false],
    ["", "md", false],
    [undefined, "md", false],
    ["#page=2", "pdf", false],
    ["#Section", undefined, false],
    ["#Section", null, false],
    ["#Section", "", false],
  ]) {
    assert.equal(
      requiresCanvasNodeHost(subpath, extension),
      required,
      `subpath ${JSON.stringify(subpath)} on ${JSON.stringify(extension)}`,
    );
  }
});

//--------------------------------------------------------------------------------
//awaitCanvasNodeHost on a host that reports no lifecycle: the bounded poll
//--------------------------------------------------------------------------------

block(
  "a factory is accepted on the read that finds it initialized",
  async () => {
    for (const readyOnRead of [1, 4]) {
      const host = hostReadyOnRead(readyOnRead);
      assert.equal(
        await awaitCanvasNodeHost(
          () => host,
          () => false,
          1000,
          1,
          delay,
        ),
        true,
      );
      assert.equal(host.reads, readyOnRead);
    }
  },
);

block(
  "a factory is re-read on every poll and never dereferenced blindly",
  async () => {
    for (const [name, sequence, timeoutMs, expected] of [
      ["absent, then present", [null, null, hostReadyOnRead(1)], 1000, true],
      ["never present", [null], 20, false],
      ["present, then torn down", [unreadyHost, unreadyHost, null], 30, false],
      ["present, never initialized", [unreadyHost], 20, false],
    ]) {
      let reads = 0;
      const getHost = () => {
        reads += 1;
        return sequence[Math.min(reads, sequence.length) - 1];
      };
      assert.equal(
        await awaitCanvasNodeHost(getHost, () => false, timeoutMs, 1, delay),
        expected,
        name,
      );
    }
  },
);

block("an unmounted embeddable stops the wait", async () => {
  const host = hostReadyOnRead(1);
  assert.equal(
    await awaitCanvasNodeHost(
      () => host,
      () => true,
      1000,
      1,
      delay,
    ),
    false,
    "already unmounted",
  );
  assert.equal(host.reads, 0, "already unmounted: the factory is never read");
  assert.equal(
    await awaitCanvasNodeHost(
      () => unreadyHost,
      cancelledOnRead(3),
      5000,
      1,
      delay,
    ),
    false,
    "unmounted while waiting",
  );
});

block("a zero timeout allows exactly one read", async () => {
  //timeoutMs = 0 is falsy but valid; `Date.now() >= deadline`, not `>`, is what
  //makes it terminate.
  for (const [readyOnRead, expected] of [
    [1, true],
    [Number.MAX_SAFE_INTEGER, false],
  ]) {
    const host = hostReadyOnRead(readyOnRead);
    const polls = polling();
    assert.equal(
      await awaitCanvasNodeHost(
        () => host,
        () => false,
        0,
        25,
        polls.delay,
      ),
      expected,
    );
    assert.equal(host.reads, 1);
    assert.equal(polls.count, 0, "it returned without waiting out a poll");
  }
});

//--------------------------------------------------------------------------------
// mountEmbeddableHost
//--------------------------------------------------------------------------------

block(
  "a subpath embed mounting before the factory is ready gets a node",
  async () => {
    //Three embeddables at once, each with its own factory readiness, so a shared
    //wait state would show as a wrong host on one of them.
    const recorders = [
      ["#Section", 5],
      ["#^blockid", 2],
      ["#Section", 7],
    ].map(([subpath, readyOnRead]) => {
      const host = hostReadyOnRead(readyOnRead);
      return mountRecorder({ subpath, getHost: () => host, timeoutMs: 500 });
    });
    const hosts = await Promise.all(
      recorders.map(({ options }) => mountEmbeddableHost(options)),
    );
    assert.deepEqual(hosts, ["canvas-node", "canvas-node", "canvas-node"]);
    for (const { calls } of recorders) {
      assert.deepEqual(calls, { canvasNodes: 1, workspaceLeaves: 0 });
    }
  },
);

block(
  "a subpath embed whose factory appears only after mount gets a node",
  async () => {
    let reads = 0;
    const { options, calls } = mountRecorder({
      getHost: () => {
        reads += 1;
        return reads < 3 ? null : { isInitialized: () => true };
      },
    });
    assert.equal(await mountEmbeddableHost(options), "canvas-node");
    assert.deepEqual(calls, { canvasNodes: 1, workspaceLeaves: 0 });
  },
);

block("a ready factory mounts its host before the effect returns", async () => {
  //The mount effect is synchronous up to its first await, so neither fast path
  //may become deferred: the effect's cleanup runs against whatever these calls
  //have already created. A whole-file embed does not read the factory at all.
  for (const [subpath, fileExtension, expected, reads] of [
    ["#Section", "md", "canvas-node", 1],
    [null, "md", "workspace-leaf", 0],
    ["#page=2", "pdf", "workspace-leaf", 0],
  ]) {
    const host = lifecycleHost();
    host.ready();
    let hostReads = 0;
    const polls = polling();
    const order = [];
    const pending = mountEmbeddableHost({
      subpath,
      fileExtension,
      getHost: () => {
        hostReads += 1;
        return host;
      },
      createCanvasNode: () => order.push("canvas-node"),
      createWorkspaceLeaf: () => order.push("workspace-leaf"),
      intervalMs: 1000,
      delay: polls.delay,
    });
    order.push("effect-returned");
    assert.equal(await pending, expected, `${subpath} on ${fileExtension}`);
    assert.deepEqual(order, [expected, "effect-returned"]);
    assert.equal(hostReads, reads, `${fileExtension}: factory reads`);
    assert.equal(polls.count, 0, "it did not wait out a poll interval");
  }
});

block("a factory reporting no lifecycle falls back at the cap", async () => {
  const { options, calls } = mountRecorder({
    getHost: () => unreadyHost,
    timeoutMs: 20,
  });
  assert.equal(await mountEmbeddableHost(options), "workspace-leaf");
  assert.deepEqual(calls, { canvasNodes: 0, workspaceLeaves: 1 });
});

block(
  "an embeddable unmounted before or during its wait mounts nothing",
  async () => {
    //A cancellation observed before readiness remains effective even if later
    //reads are live and the factory becomes usable.
    const cancelledThenReadies = (host, read) => {
      const cancelled = cancelledOnRead(read);
      let reads = 0;
      return () => {
        reads += 1;
        const value = cancelled();
        if (reads >= read) {
          host.ready();
        }
        return value;
      };
    };
    const readyAsTornDown = () => {
      const host = { isInitialized: () => host.torndown, torndown: false };
      return {
        host,
        isCancelled: () => {
          host.torndown = true;
          return true;
        },
      };
    };
    const lifecycle = lifecycleHost();
    const asReadies = readyAsTornDown();
    for (const [name, overrides] of [
      [
        "already unmounted, whole-file",
        { subpath: null, isCancelled: () => true },
      ],
      [
        "unmounted while polling",
        { getHost: () => unreadyHost, isCancelled: cancelledOnRead(3) },
      ],
      [
        "unmounted on the poll that saw the cleanup, refs live again after",
        { getHost: () => unreadyHost, isCancelled: cancelledOnRead(2) },
      ],
      [
        "unmounted as the factory readies",
        { getHost: () => asReadies.host, isCancelled: asReadies.isCancelled },
      ],
      [
        "unmounted, then the factory readies",
        {
          getHost: () => lifecycle,
          isCancelled: cancelledThenReadies(lifecycle, 2),
        },
      ],
      [
        "unmounted while waiting on a lifecycle",
        { getHost: () => lifecycleHost(), isCancelled: cancelledOnRead(3) },
      ],
    ]) {
      const { options, calls } = mountRecorder({
        timeoutMs: 5000,
        ...overrides,
      });
      assert.equal(await mountEmbeddableHost(options), "none", name);
      assert.deepEqual(calls, { canvasNodes: 0, workspaceLeaves: 0 }, name);
    }
  },
);

block("only the current link is mounted when it changes mid-wait", async () => {
  //The first wait observes cancellation while polling. The second mount sees a
  //ready factory and completes without polling.
  const host = lifecycleHost();
  const mounted = [];
  let nextMount;
  const cancelled = cancelledOnRead(2);
  const first = mountEmbeddableHost({
    subpath: "#A",
    fileExtension: "md",
    getHost: () => host,
    isCancelled: () => {
      const value = cancelled();
      if (value && nextMount === undefined) {
        host.ready();
        nextMount = mountEmbeddableHost({
          subpath: "#B",
          fileExtension: "md",
          getHost: () => host,
          createCanvasNode: () => mounted.push("#B"),
          createWorkspaceLeaf: () => mounted.push("#B-leaf"),
          intervalMs: 1,
          delay,
        });
      }
      return value;
    },
    createCanvasNode: () => mounted.push("#A"),
    createWorkspaceLeaf: () => mounted.push("#A-leaf"),
    timeoutMs: 5000,
    intervalMs: 1,
    delay,
  });
  assert.equal(await first, "none", "the cancelled mount created no host");
  assert.equal(
    await nextMount,
    "canvas-node",
    "the ready mount completed without polling",
  );
  assert.deepEqual(mounted, ["#B"]);
});

//--------------------------------------------------------------------------------
//The factory's lifecycle, not the clock, decides how long a subpath embed waits.
//Startup can legitimately outrun any fixed cap: layout ready polls up to
//50 x 50 ms before initialize() is called, and initialize() then awaits the core
//canvas plugin's load. A host reporting whenInitialized is waited on through
//that signal; the cap applies only while no such host is visible.
//--------------------------------------------------------------------------------

block("an expired cap does not end a wait on a starting factory", async () => {
  //Readiness lands on the third poll, 20 ms in, past every cap below.
  for (const timeoutMs of [5, 0, -1]) {
    const host = lifecycleHost();
    const polls = polling({ 3: () => host.ready() });
    const { options, calls } = mountRecorder({
      getHost: () => host,
      timeoutMs,
      intervalMs: 10,
      delay: polls.delay,
    });
    assert.equal(
      await mountEmbeddableHost(options),
      "canvas-node",
      `cap ${timeoutMs}`,
    );
    assert.deepEqual(
      calls,
      { canvasNodes: 1, workspaceLeaves: 0 },
      `cap ${timeoutMs}`,
    );
    assert.equal(polls.count, 3, `cap ${timeoutMs}: readiness ended the wait`);
  }
});

block(
  "a factory that reports it will not initialize falls back on that signal",
  async () => {
    //A false lifecycle result, or a ready result with no usable node, ends the
    //wait on the poll that observes that result.
    for (const [name, settle] of [
      ["gives up", (host) => host.givesUp()],
      [
        "destroyed as it settled",
        (host) => {
          host.ready();
          host.initialized = false;
        },
      ],
    ]) {
      const host = lifecycleHost();
      const polls = polling({ 1: () => settle(host) });
      const { options, calls } = mountRecorder({
        getHost: () => host,
        delay: polls.delay,
      });
      assert.equal(await mountEmbeddableHost(options), "workspace-leaf", name);
      assert.deepEqual(calls, { canvasNodes: 0, workspaceLeaves: 1 }, name);
      assert.equal(
        polls.count,
        1,
        `${name}: decided on the signal, not the cap`,
      );
    }
  },
);

block(
  "a lifecycle that never settles is waited on until the embeddable unmounts",
  async () => {
    //With a lifecycle present the cap is not consulted, so the wait outlives an
    //already expired cap and ends on the teardown instead.
    const polls = polling();
    const { options, calls } = mountRecorder({
      getHost: neverSettlingHost,
      isCancelled: cancelledOnRead(4),
      timeoutMs: 0,
      delay: polls.delay,
    });
    assert.equal(await mountEmbeddableHost(options), "none");
    assert.deepEqual(calls, { canvasNodes: 0, workspaceLeaves: 0 });
    assert.equal(
      polls.count,
      3,
      "it polled past the expired cap until the unmount",
    );
  },
);

block(
  "a view that drops its factory ends even a never-settling wait",
  async () => {
    //`ExcalidrawView.onClose` sets `canvasNodeFactory = null`, and `getHost()`
    //is re-read on every poll, so the expired cap applies again once no factory
    //is visible even if the embeddable itself never unmounts.
    let factory = neverSettlingHost();
    const polls = polling({
      2: () => {
        factory = null;
      },
    });
    const { options, calls } = mountRecorder({
      getHost: () => factory,
      timeoutMs: 0,
      delay: polls.delay,
    });
    assert.equal(await mountEmbeddableHost(options), "workspace-leaf");
    assert.deepEqual(calls, { canvasNodes: 0, workspaceLeaves: 1 });
    assert.equal(
      polls.count,
      2,
      "the wait ended on the poll that found no factory",
    );
  },
);

//--------------------------------------------------------------------------------
// CanvasNodeFactory.whenInitialized
//--------------------------------------------------------------------------------

block("initialize() settles the lifecycle true once it succeeds", async () => {
  const factory = new CanvasNodeFactory(fakeView({ loadMs: 10 }));
  assert.equal(await settleWithin(factory.whenInitialized, 5), PENDING);
  await factory.initialize();
  assert.equal(factory.isInitialized(), true);
  assert.equal(await settleWithin(factory.whenInitialized), true);
});

block("initialize() that throws settles false and rethrows", async () => {
  const factory = new CanvasNodeFactory(fakeView({ loadThrows: true }));
  await assert.rejects(
    () => factory.initialize(),
    /canvas plugin failed to load/,
  );
  assert.equal(factory.isInitialized(), false);
  assert.equal(await settleWithin(factory.whenInitialized), false);
});

block(
  "destroy() settles the lifecycle false and cannot revise a settled one",
  async () => {
    const destroyedFirst = new CanvasNodeFactory(fakeView({ loadMs: 1000 }));
    destroyedFirst.destroy();
    assert.equal(await settleWithin(destroyedFirst.whenInitialized), false);

    const initializedFirst = new CanvasNodeFactory(fakeView());
    await initializedFirst.initialize();
    initializedFirst.destroy();
    assert.equal(
      await settleWithin(initializedFirst.whenInitialized),
      true,
      "the first terminal state wins",
    );
    assert.equal(
      initializedFirst.isInitialized(),
      false,
      "the flag the consumer re-reads after the signal is cleared",
    );
  },
);

block("a slow real factory still gets its canvas node", async () => {
  //A cold vault start: the core canvas plugin's load outlasts the default cap.
  //Elapsed time is the subject here, so this one block runs against the clock.
  const factory = new CanvasNodeFactory(
    fakeView({ loadMs: CANVAS_NODE_HOST_WAIT_TIMEOUT_MS + 150 }),
  );
  const { options, calls } = mountRecorder({
    getHost: () => factory,
    timeoutMs: undefined,
    intervalMs: 25,
  });
  const started = Date.now();
  const [host] = await Promise.all([
    mountEmbeddableHost(options),
    factory.initialize(),
  ]);
  assert.equal(host, "canvas-node");
  assert.deepEqual(calls, { canvasNodes: 1, workspaceLeaves: 0 });
  assert.ok(
    Date.now() - started >= CANVAS_NODE_HOST_WAIT_TIMEOUT_MS,
    "the wait outlasted the cap",
  );
});

block(
  "a real factory that failed to initialize falls back within one poll",
  async () => {
    const factory = new CanvasNodeFactory(fakeView({ loadThrows: true }));
    await factory.initialize().catch(() => undefined);
    const polls = polling();
    const { options, calls } = mountRecorder({
      getHost: () => factory,
      delay: polls.delay,
    });
    assert.equal(await mountEmbeddableHost(options), "workspace-leaf");
    assert.deepEqual(calls, { canvasNodes: 0, workspaceLeaves: 1 });
    assert.equal(polls.count, 1);
  },
);

block("a real factory destroyed mid-wait falls back on that poll", async () => {
  const factory = new CanvasNodeFactory(fakeView({ loadMs: 10_000 }));
  const polls = polling({ 2: () => factory.destroy() });
  const { options, calls } = mountRecorder({
    getHost: () => factory,
    delay: polls.delay,
  });
  assert.equal(await mountEmbeddableHost(options), "workspace-leaf");
  assert.deepEqual(calls, { canvasNodes: 0, workspaceLeaves: 1 });
  assert.equal(polls.count, 2);
});

let failed = 0;
for (const [name, fn] of blocks) {
  try {
    await fn();
    log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    log(`FAIL ${name}: ${error.message.split("\n")[0]}`);
  }
}
if (failed > 0) {
  process.exitCode = 1;
  log(`${failed} of ${blocks.length} embeddable mount plan checks failed`);
} else {
  log("embeddable mount plan checks passed");
}
