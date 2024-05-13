import { EXCALIDRAW_PLUGIN } from "src/constants/constants";


export const durationTreshold = 0; //0.05; //ms
export const isDebugMode = () => EXCALIDRAW_PLUGIN && EXCALIDRAW_PLUGIN.settings?.isDebugMode;

export const log = console.log.bind(window.console);
export const debug = (...messages: unknown[]) => {
  if(isDebugMode()) {
    console.log(...messages);
  }
};

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
        console.log(`Excalidraw ${this.name} MutationObserver callback took ${executionTime}ms to execute`);
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