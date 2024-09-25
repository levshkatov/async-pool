import { performance } from 'node:perf_hooks';
import { EventEmitter } from 'node:events'
import path from 'node:path';
import { Worker as NodeWorker, MessageChannel } from 'node:worker_threads';
import { availableParallelism } from 'node:os';

import { ProcessError, TimeoutError } from './errors.mjs';

class Task {
  constructor(name, metadata) {
    this.name = name;
    this.metadata = metadata;
  }
}

class Pool extends EventEmitter {
  constructor() {
    super();
    this.queue = [];
  }

  add(name, metadata) {
    const task = new Task(name, metadata);
    this.queue.push(task);

    this.emit('task', task);
  }

  pop() {
    return this.queue.shift();
  }
}

class Worker {
  /**
   * @type {NodeWorker}
   */
  #worker = undefined;
  /**
   * @type {MessageChannel}
   */
  #channel = undefined;

  #timeout = 3000;
  #concurrency = 5;
  #count = 0;

  constructor(file, { name, concurrency = 5, timeout = 3000 }) {
    this.name = name;
    this.#channel = new MessageChannel();
    this.#worker = new NodeWorker(file, { name });
    this.#timeout = timeout;
    this.#concurrency = concurrency;

    this.#worker.postMessage({ port: this.#channel.port2 }, [this.#channel.port2])
  }

  #inc() {
    this.#count += 1;
  }

  #dec() {
    this.#count -= 1;
  }

  isIdle() {
    return this.#count < this.#concurrency;
  }

  stop() {
    this.#worker.unref();
    return this.#worker.terminate();
  }

  /**
   * @argument {Task} task
   */
  run(task) {
    this.#inc();

    const { promise, resolve, reject } = Promise.withResolvers();

    this.#channel.port1.postMessage(task);

    const handleMessage = (event) => resolve(event);
    const handleMessageError = event => reject(new ProcessError(task, event))

    this.#channel.port1.on('message', handleMessage);

    this.#channel.port1.on('messageerror', handleMessageError);

    setTimeout(() => {
      reject(new TimeoutError())
    }, this.#timeout);


    return promise.finally(() => {
      this.#dec();
      this.#channel.port1.off('message', handleMessage)
      this.#channel.port1.off('messageerror', handleMessageError)
    });
  }
}


class WorkerPool extends EventEmitter {
  #concurrency = 3;
  #count = 0;
  #taskPool = [];
  /**
   * @type {Array<Worker>}
   */
  #workerPool = [];
  #workerFile = '';

  constructor(pool, { workerFile, concurrency = availableParallelism() }) {
    super();
    this.#taskPool = pool;
    this.#workerFile = workerFile;
    this.#concurrency = concurrency;

    this.#createWorkerPool();
    this.#taskPool.on('task', this.process.bind(this));
  }

  #inc() {
    this.#count += 1;
  }

  #dec() {
    this.#count -= 1;
  }

  async #run(task) {
    this.#inc();

    try {
      const worker = this.#getIdleWorker()

      const result = await worker.run(task);

      this.emit('result', { result, name: worker.name });
    } catch (error) {
      this.emit('error', { task, error });
    } finally {
      this.#dec();
      this.process();
    }
  }

  process() {
    if (this.#concurrency <= this.#count) return;

    if (!this.#getIdleWorker()) return;

    const task = this.#taskPool.pop();

    if (!task) {
      if (this.#count === 0) {
        this.emit('idle');
      }

      return;
    }

    this.#run(task);
  }

  async stop() {
    return Promise.all(this.#workerPool.map(w => w.stop()))
  }

  #getIdleWorker() {
    return this.#workerPool.find(w => w.isIdle());
  }

  #createWorkerPool() {
    this.#workerPool = Array.from({ length: this.#concurrency })
      .map((_v, i) => new Worker(this.#workerFile, { name: `worker #${i}` }));
  }
}


const pool = new Pool();
const worker = new WorkerPool(pool, { workerFile: path.resolve(import.meta.dirname, './worker.mjs') });

const start = performance.now();
// worker.on('result', (data) => console.log('complete', data));
// worker.on('error', (data) => console.log('error', data));
worker.on('idle', () => {
  const end = performance.now();
  console.log(`[WORKER] ${end - start}ms.`);

  worker.stop()
});

const POKEMON_LIST = [
  'pikachu',
  "charmander",
  "charmeleon",
  "charizard",
  "sunkern",
  "sunflora",
  "tropius",
  "helioptile",
  "heliolisk",
  "houndoom-mega",
  "charizard-gmax"
]

Array.from({ length: 1000 }).forEach((v, i) => pool.add(POKEMON_LIST[i % POKEMON_LIST.length]))
