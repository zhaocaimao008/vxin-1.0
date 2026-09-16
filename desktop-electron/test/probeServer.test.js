'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { probeServer } = require('../src/probeServer');

test('server health probe rejects invalid addresses, errors, HTML, redirects and oversized bodies', async t => {
  let requests = 0;
  const server = http.createServer((req, res) => {
    requests++;
    assert.equal(req.headers.authorization, undefined);
    assert.equal(req.headers.cookie, undefined);
    if (req.url === '/missing/health') { res.writeHead(404); res.end(); }
    else if (req.url === '/redirect/health') { res.writeHead(302, { Location: '/health' }); res.end(); }
    else if (req.url === '/html/health') res.end('<html>homepage</html>');
    else if (req.url === '/large/health') res.end('x'.repeat(70000));
    else if (req.url === '/broken/health') res.end(JSON.stringify({ ok: true, db: 'error' }));
    else res.end(JSON.stringify({ ok: true, db: 'ok' }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const value of [null, 'httpx://localhost', 'file:///tmp/test', base + '?token=secret', base.replace('://', '://user:password@')]) {
    assert.equal((await probeServer(value)).ok, false);
  }
  assert.equal(requests, 0);
  assert.equal((await probeServer(base + '/')).ok, true);
  assert.deepEqual(await probeServer(base + '/missing'), { ok: false, msg: '服务器返回 404' });
  for (const path of ['/redirect', '/html', '/large', '/broken']) assert.equal((await probeServer(base + path)).ok, false);
  assert.equal(requests, 6); // Redirects never reach the target.
});
