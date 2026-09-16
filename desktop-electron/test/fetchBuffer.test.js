'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { fetchBuffer } = require('../src/fetchBuffer');
let server, base;
before(async () => {
  server = http.createServer((req, res) => {
    if (req.url === '/missing') { res.writeHead(404); res.end(); return; }
    if (req.url === '/slow') return;
    if (req.url === '/large') { res.end('x'.repeat(200)); return; }
    if (req.url === '/truncated') { res.writeHead(200, { 'Content-Length': 200 }); res.write('x'); setTimeout(() => res.destroy(), 10); return; }
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ features: { moments: false } }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = 'http://127.0.0.1:' + server.address().port;
});
after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
test('HTTP custom server returns actual feature settings', async () => {
  const config = JSON.parse((await fetchBuffer(base + '/api/config', { allowHttp: true })).toString());
  assert.equal(config.features.moments, false);
});
test('update-feed default rejects HTTP downgrade and unsupported protocols', async () => {
  await assert.rejects(fetchBuffer(base), /HTTPS/);
  await assert.rejects(fetchBuffer('file:///tmp/example', { allowHttp: true }), /HTTPS/);
});
test('missing resources only resolve null when explicitly optional', async () => {
  await assert.rejects(fetchBuffer(base + '/missing', { allowHttp: true }), /HTTP 404/);
  assert.equal(await fetchBuffer(base + '/missing', { allowHttp: true, allowMissing: true }), null);
});
test('oversized responses reject instead of consuming unbounded memory', async () => {
  await assert.rejects(fetchBuffer(base + '/large', { allowHttp: true, maxBytes: 100 }), /上限|中断|aborted/);
});
test('stalled requests time out', async () => {
  await assert.rejects(fetchBuffer(base + '/slow', { allowHttp: true, timeout: 30 }), /超时/);
});
test('truncated responses settle with an error', async () => {
  await assert.rejects(fetchBuffer(base + '/truncated', { allowHttp: true }), /中断|aborted/);
});
