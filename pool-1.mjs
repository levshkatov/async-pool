import { EventEmitter } from 'node:events'

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

  // TODO
  // prioritise
  // make a queue as linked list
  // do not remove from queue until it is fully processed
}

class Worker extends EventEmitter {
  #concurrency = 3;
  #count = 0;

  constructor(pool) {
    super();
    this.pool = pool;

    this.pool.on('task', this.process.bind(this));
  }

  inc() {
    this.#count += 1;
  }

  dec() {
    this.#count -= 1;
  }

  // this method should be overriden while creating new worker
  async handler(task) {
    if (task.name % 2 === 0) {
      throw new Error(task.name)
    }

    await new Promise((resolve) => setTimeout(resolve, 1000))
    return task.name;
  }

  async run(task) {
    this.inc();

    try {
      const result = await this.handler(task);

      this.emit('result', result);
    } catch (error) {
      this.emit('error', { task, error });
    } finally {
      this.dec();
      this.process();
    }
  }

  process() {
    if (this.#concurrency <= this.#count) return;

    const task = this.pool.pop();

    if (!task) {
      this.emit('idle');
      return;
    }

    this.run(task);
  }
}

const pool = new Pool();
const worker = new Worker(pool);

worker.on('result', (data) => console.log('complete', data));
worker.on('error', (data) => console.log('error', data));
worker.on('idle', (data) => console.log('idle', data));

[1, 2, 3, 4, 5, 6, 7].forEach(v => pool.add(v))
