declare const consoleLog: (...args: unknown[]) => void;
export const durationTreshold = 0; //0.05; //ms

export const DEBUGGING = false;
export const log = (...args: unknown[]) => consoleLog(...args);
export const debug = (
  fn: (...args: unknown[]) => unknown,
  fnName: string,
  ...messages: unknown[]
) => {
  log(fnName, ...messages);
};

let timestamp: number[] = [];
let tsOrigin: number = 0;

export function tsInit(msg: string) {
  tsOrigin = Date.now();
  timestamp = [tsOrigin, tsOrigin, tsOrigin, tsOrigin, tsOrigin]; // Initialize timestamps for L0 to L4
  log(`0ms: ${msg}`);
}

export function ts(msg: string, level: number) {
  if (level < 0 || level > 4) {
    console.error("Invalid level. Please use level 0, 1, 2, 3, or 4.");
    return;
  }

  const now = Date.now();
  const diff = now - timestamp[level];
  timestamp[level] = now;

  const elapsedFromOrigin = now - tsOrigin;
  log(`L${level} (${elapsedFromOrigin}ms) ${diff}ms: ${msg}`);
}

export class CustomMutationObserver {
  private originalCallback: MutationCallback;
  private observer: MutationObserver | null;
  private name: string;

  constructor(callback: MutationCallback, name: string) {
    this.originalCallback = callback;
    this.observer = null;
    this.name = name;
  }

  observe(target: Node, options: MutationObserverInit) {
    const wrappedCallback: MutationCallback = (mutationsList, observer) => {
      const startTime = performance.now(); // Get start time
      this.originalCallback(mutationsList, observer); // Invoke the original callback
      const endTime = performance.now(); // Get end time
      const executionTime = endTime - startTime;
      if (executionTime > durationTreshold) {
        const message = `Excalidraw ${this.name} MutationObserver callback took ${executionTime}ms to execute`;
        log(message, observer);
      }
    };

    this.observer = new MutationObserver(wrappedCallback);

    // Start observing with the modified callback
    this.observer.observe(target, options);
  }

  disconnect() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}
