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
  let abortController = new AbortController();

  port.on('message', () => {

    for (let i = 0; i < 100000000; i++) {}

    port.postMessage(Math.random());
  });

  port.on('messageerror', () => {
    // stop pending fetch
  })

  port.on('close', () => {
    // stop pending fetch
  })

}
