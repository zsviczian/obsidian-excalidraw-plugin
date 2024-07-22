export class WeakArray<T extends object> {
  private weakArray: WeakRef<T>[] = [];

  constructor() {}

  push(obj: T) {
    this.weakArray.push(new WeakRef(obj));
  }

  forEach(callback: (obj: T, index: number) => void) {
    this.weakArray.forEach((ref, index) => {
      const obj = ref.deref();
      if (obj) {
        callback(obj, index);
      }
    });
  }

  removeObjects(objectsToRemove: Set<T>) {
    this.weakArray = this.weakArray.filter((ref) => {
      const obj = ref.deref();
      return obj && !objectsToRemove.has(obj);
    });
  }

  clear() {
    this.weakArray = [];
  }
}