function log(...args) {
  console.log(new Date().toISOString().split("T")[1], ...args);
}

class Pool {
  #clients = [];
  #pool = [];
  #queue = [];
  #queueStart = 0;
  #pending = 0;

  constructor() {}

  add(client) {
    if (this.#clients.includes(client)) return;
    this.#clients.push(client);
    this.#pool.push(client);
  }

  #genTraceId() {
    return Math.random().toString(36).substring(2, 5);
  }

  #resolveFromQueue() {
    if (this.#queue.length > this.#queueStart) {
      this.#queue[this.#queueStart++]();
      if (this.#queueStart > 1000) {
        this.#queue = this.#queue.slice(this.#queueStart);
        this.#queueStart = 0;
      }
    }
  }

  async do(traceId = this.#genTraceId(), method, ...args) {
    const client = this.#pool.pop();
    if (client != null) {
      log(traceId, `do ${method} ${client.name}`);
      const res = await client[method](...args).catch((err) => {
        log(traceId, err);
        return null;
      });

      this.#pool.push(client);
      this.#resolveFromQueue();
      return res;
    }

    this.#pending++;
    log(traceId, `no clients, pending ${this.#pending}`);
    await new Promise((res) => this.#queue.push(res));
    this.#pending--;
    log(traceId, `client ready, pending ${this.#pending}`);
    return this.do(traceId, method, ...args);
  }
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

  const tasks = new Array(50).fill(
    pool.do.bind(pool, undefined, "sleep", 1000)
  );

  await Promise.all(tasks.map((task) => task()));
  log(`tasks: ${tasks.length}`, `clients: ${clients.length}`);
}

console.time("test");
await test();
console.timeEnd("test");
