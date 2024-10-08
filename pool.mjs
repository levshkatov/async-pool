import { DoublyLinkedList } from "./doubly-linked-list.mjs";

class Pool {
  #clients = [];
  #pool = [];
  #queue = new DoublyLinkedList();
  #pending = 0;

  constructor() {}

  add(client) {
    if (this.#clients.includes(client)) return;
    this.#clients.push(client);
    this.#pool.push(client);
  }

  get pending() {
    return this.#pending;
  }

  #genTraceId() {
    return Math.random().toString(36).substring(2, 5);
  }

  async #execute(traceId = this.#genTraceId(), method, args, queueMethod) {
    const client = this.#pool.pop();
    if (client != null) {
      log(traceId, `do ${method} ${client.name}`);
      const res = await client[method](...args).catch((err) => {
        console.log(err);
        return null;
      });

      this.#pool.push(client);
      this.#queue.shift()?.();
      return res;
    }

    this.#pending++;
    log(traceId, `no client, pending ${this.#pending}`);
    await new Promise((res) => this.#queue[queueMethod](res));
    this.#pending--;
    log(traceId, `client ready, pending ${this.#pending}`);
    return this.#execute(traceId, method, args, queueMethod);
  }

  async do(method, ...args) {
    return this.#execute(undefined, method, args, "push");
  }

  async doInstant(method, ...args) {
    return this.#execute(undefined, method, args, "unshift");
  }
}

function log(...args) {
  console.log(new Date().toISOString().split("T")[1], ...args);
}

class Test {
  constructor(name) {
    this.name = name;
  }

  async sleep(delay) {
    return new Promise((res) => setTimeout(res, delay));
  }
}

async function test() {
  const pool = new Pool();
  const clients = new Array(10)
    .fill(null)
    .map((_, i) => new Test(`client${i + 1}`));
  clients.forEach((client) => pool.add(client));

  const tasks = new Array(25).fill(pool.do.bind(pool, "sleep", 1000));

  await Promise.all(tasks.map((task) => task()));
  log(`tasks: ${tasks.length}`, `clients: ${clients.length}`);
}

console.time("test");
await test();
console.timeEnd("test");
