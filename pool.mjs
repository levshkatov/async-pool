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

  async do(method, ...args) {
    const client = this.#pool.pop();
    if (client != null) {
      const res = await client[method](...args).catch((err) => {
        console.log(err);
        return null;
      });

      this.#pool.push(client);
      if (this.#queue.length) this.#queue.shift()();
      return res;
    }

    await new Promise((res) => this.#queue.push(res));
    return this.do(method, ...args);
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

const pool = new Pool();
const clients = new Array(5)
  .fill(null)
  .map((_, i) => new Test(`client${i + 1}`));
clients.forEach((client) => pool.add(client));

const tasks = new Array(5).fill(pool.do.bind(pool, "sleep", 1000));

await Promise.all(tasks.map((task) => task()));
