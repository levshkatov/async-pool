import { parentPort, MessagePort } from 'node:worker_threads';

/**
 * @type {MessageChannel['port2']}
  */
let port = undefined;

parentPort.once('message', (event) => {
  if ('port' in event && event.port instanceof MessagePort) {
    port = event.port;

    main();
  }
});

function main() {
  async function getPokemon(task) {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${task.name}`);
    port.postMessage(await res.json())
  }

  port.on('message', (event) => {
    // for (let i = 0; i < 100000000; i++) {}

    getPokemon(event);
  });

  port.on('messageerror', () => {
    // stop pending fetch
  })

  port.on('close', () => {
    // stop pending fetch
  })
}
