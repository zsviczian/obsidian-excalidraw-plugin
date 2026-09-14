/** Serializes asynchronous operations sharing the same key. */
export class KeyedAsyncLock {
  private readonly tails = new Map<string, Promise<void>>();

  public async run<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(key);
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const ready =
      previous?.catch((): void => undefined) ?? Promise.resolve();
    const tail = ready.then(() => gate);
    this.tails.set(key, tail);
    await ready;
    try {
      return await operation();
    } finally {
      release();
      void tail.then(() => {
        if (this.tails.get(key) === tail) {
          this.tails.delete(key);
        }
      });
    }
  }
}
