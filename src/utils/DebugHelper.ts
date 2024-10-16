export const durationTreshold = 0; //0.05; //ms

export function setDebugging(value: boolean) {
  DEBUGGING = (process.env.NODE_ENV === 'development') 
  ? value
  : false;
}

export let DEBUGGING = false;

export const log = console.log.bind(window.console);
export const debug = (fn: Function, fnName: string, ...messages: unknown[]) => {
  //console.log(fnName,fn,...messages);
  console.log(fnName, ...messages);
};

let timestamp: number[] = [];
let tsOrigin: number = 0;

export function tsInit(msg: string) {
  tsOrigin = Date.now();
  timestamp = [tsOrigin, tsOrigin, tsOrigin, tsOrigin, tsOrigin]; // Initialize timestamps for L0 to L4
  console.log("0ms: " + msg);
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
  console.log(`L${level} (${elapsedFromOrigin}ms) ${diff}ms: ${msg}`);
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
    const wrappedCallback: MutationCallback = async (mutationsList, observer) => {
      const startTime = performance.now(); // Get start time
      await this.originalCallback(mutationsList, observer); // Invoke the original callback
      const endTime = performance.now(); // Get end time
      const executionTime = endTime - startTime;
      if (executionTime > durationTreshold) {
        console.log(`Excalidraw ${this.name} MutationObserver callback took ${executionTime}ms to execute`, observer);
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