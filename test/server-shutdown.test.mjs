import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createConnection } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';
import { startServer } from '../app/server.mjs';

test('shutdown closes a browser preconnection that has not sent an HTTP request', async () => {
  const app = await startServer({}, { port: 0 });
  const socket = createConnection({ host: '127.0.0.1', port: new URL(app.origin).port });
  try {
    await once(socket, 'connect');
    const stopped = app.close();
    await Promise.race([stopped, delay(500).then(() => { throw new Error('An unused TCP connection kept the server open.'); })]);
  } finally { socket.destroy(); await app.close(); }
});

test('shutdown lets an active HTTP request finish and can be called twice', async () => {
  let release, entered;
  const gate = new Promise((resolve) => { release = resolve; });
  const started = new Promise((resolve) => { entered = resolve; });
  const app = await startServer({ async state() { entered(); await gate; return { mode: 'shutdown-fixture' }; } }, { port: 0 });
  try {
    const request = fetch(`${app.origin}/api/state`);
    await started;
    const stopped = app.close();
    release();
    const response = await request;
    assert.equal(response.status, 200); assert.equal((await response.json()).mode, 'shutdown-fixture');
    await stopped; await app.close();
  } finally { release(); await app.close(); }
});
