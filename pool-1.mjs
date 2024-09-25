import { EventEmitter } from 'node:events'
import { performance } from 'node:perf_hooks';

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
  #concurrency = 10;
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
    // for (let i = 0; i < 100000000; i++) {}

    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${task.name}`);

    return res.json();
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
      if (this.#count === 0) {
        this.emit('idle');
      }
      return;
    }

    this.run(task);
  }
}

const pool = new Pool();
const worker = new Worker(pool);

const start = performance.now();
// worker.on('result', (data) => console.log('complete', data));
// worker.on('error', (data) => console.log('error', data));
worker.on('idle', (data) => {
  const end = performance.now();
  console.log(`[EVENT-DRIVEN] ${end - start}ms.`);
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
