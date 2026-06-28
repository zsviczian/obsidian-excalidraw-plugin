import ExcalidrawPlugin from "src/core/main";

export class GlobalTaskQueue {
  private queue: {
    task: () => Promise<void>;
    resolve: (value: void | PromiseLike<void>) => void;
    reject: (err: unknown) => void;
  }[] = [];
  private activeCount = 0;

  constructor(private plugin: ExcalidrawPlugin) {}

  public async addTask(task: () => Promise<void>): Promise<void> {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      void this.processNext();
    });
  }

  private async processNext() {
    const concurrencyLimit = this.plugin?.settings?.renderingConcurrency ?? 4;
    if (this.activeCount >= concurrencyLimit || this.queue.length === 0) {
      return;
    }

    this.activeCount++;
    const { task, resolve, reject } = this.queue.shift();

    try {
      await task();
      resolve();
    } catch (error) {
      reject(error);
    } finally {
      this.activeCount--;
      void this.processNext();
    }
  }
}

let globalTaskQueue: GlobalTaskQueue = null;

export const getGlobalTaskQueue = (
  plugin: ExcalidrawPlugin,
): GlobalTaskQueue => {
  if (!globalTaskQueue) {
    globalTaskQueue = new GlobalTaskQueue(plugin);
  }
  return globalTaskQueue;
};
