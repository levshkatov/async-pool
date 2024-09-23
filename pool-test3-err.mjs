function log(...args) {
  console.log(new Date().toISOString().split("T")[1], ...args);
}

class Pool {
  #clients = [];
  #pool = [];
  #queue = [];
  constructor() {}

  add(client) {
    if (this.#clients.includes(client)) return;
    this.#clients.push(client);
    this.#pool.push(client);
  }

  #genTraceId() {
    return Math.random().toString(36).substring(2, 5);
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
      if (this.#queue.length) this.#queue.shift()();
      return res;
    }

    log(traceId, `no clients, pending ${this.#queue.length + 1}`);
    await new Promise((res) => this.#queue.push(res));
    log(traceId, `client ready, pending ${this.#queue.length}`);
    return this.do(traceId, method, ...args);
  }
}

class Test {
  constructor(name) {
    this.name = name;
  }

  randomErr() {
    return Math.random() > 0.5 ? null : new Error("random error");
  }

  async sleep(delay) {
    return new Promise((res, rej) =>
      setTimeout(() => {
        const err = this.randomErr();
        if (err) rej(err);
        res();
      }, delay)
    );
  }
}

async function test() {
  const pool = new Pool();
  const clients = new Array(5)
    .fill(null)
    .map((_, i) => new Test(`client${i + 1}`));
  clients.forEach((client) => pool.add(client));

  const tasks = new Array(10).fill(
    pool.do.bind(pool, undefined, "sleep", 1000)
  );

  await Promise.all(tasks.map((task) => task()));
  log(`tasks: ${tasks.length}`, `clients: ${clients.length}`);
}

console.time("test");
await test();
console.timeEnd("test");
