export interface CacheContainer<T> {
  obj: T;
  counter: number;
}

export interface CacheQueueEntry<T> {
  resolve: (obj: T) => void;
  reject: (error: unknown) => void;
}

export type CacheLoadFunc<L> = (fileName: string) => Promise<L>;
export type CacheProcessFunc<T, L> = (loadedObj: L) => T;

/* remove() calls destroy() on the cached object unconditionally */
interface Destroyable {
  destroy(): void;
}

class Cache<T, L = unknown> {
  cache: { [fileName: string]: CacheContainer<T> | null };
  queueForLoad: { [fileName: string]: CacheQueueEntry<T>[] | null };
  load: CacheLoadFunc<L>;
  process: CacheProcessFunc<T, L>;

  constructor(load: CacheLoadFunc<L>, process: CacheProcessFunc<T, L>) {
    this.cache = {};
    this.queueForLoad = {};

    this.load = load;
    this.process = process;
  }

  /*
   * Queue load functions
   */
  get(fileName: string): Promise<T> {
    return new Promise((resolve, reject) => {
      // 1. Return the promise immediately if object is already in cache
      const obj = this.getCached(fileName);
      if (obj) {
        resolve(obj);
        return;
      }

      // 2. Otherwise, add this promise’s resolve/reject to the queue
      let queue = this.queueForLoad[fileName] || [];
      // If nothing is queued yet for this file, trigger the load process.
      if (queue.length === 0) {
        this.load(fileName)
          .then((loadedObj) => {
            const finalObject = this.process(loadedObj);
            this.put(fileName, finalObject);
            this._resolveQueue(fileName, finalObject);
          })
          .catch((error) => {
            this._rejectQueue(fileName, error);
          });
      }
      queue.push({ resolve, reject });
      this.queueForLoad[fileName] = queue;
    });
  }

  _resolveQueue(fileName: string, obj: T): void {
    const queue = this.queueForLoad[fileName] || [];
    for (let i = 0; i < queue.length; i++) {
      queue[i].resolve(obj);
    }
    this.queueForLoad[fileName] = null;
  }

  _rejectQueue(fileName: string, err: unknown): void {
    const queue = this.queueForLoad[fileName] || [];
    for (let i = 0; i < queue.length; i++) {
      queue[i].reject(err);
    }
    this.queueForLoad[fileName] = null;
  }

  /*
   * Cache storage functions
   */
  put(fileName: string, obj: T): void {
    const container: CacheContainer<T> = {
      obj: obj,
      counter: 1,
    };
    this.cache[fileName] = container;
  }

  getCached(fileName: string): T | null {
    const container = this.cache[fileName];
    if (!container) {
      return null;
    }
    container.counter += 1;
    return container.obj;
  }

  remove(fileName: string): void {
    const container = this.cache[fileName];
    if (!container) {
      // TODO: Log the message if needed.
      return;
    }
    // Decrease usage counter
    container.counter -= 1;
    if (container.counter <= 0) {
      this.cache[fileName] = null;
      (container.obj as T & Destroyable).destroy();
    }
  }
}

export type { Cache };

export default function<T, L>(load: CacheLoadFunc<L>, process: CacheProcessFunc<T, L>): Cache<T, L> {
  return new Cache(load, process);
}
