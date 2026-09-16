const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { execFileSync, spawn } = require('node:child_process');
const release = path.join(__dirname, 'release.sh');

for (const failure of ['none', 'install', 'restart', 'health', 'revision']) {
  test(`release transaction: ${failure}`, async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vxin-release-test-'));
    const repo = path.join(root, 'repo'), web = path.join(root, 'public'), bin = path.join(root, 'bin');
    const write = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, value); };
    const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    const prepare = version => {
      write(path.join(repo, 'backend-v2/src/server.js'), version);
      write(path.join(repo, 'backend-v2/package-lock.json'), JSON.stringify({ version }));
      write(path.join(repo, 'web/version'), version);
      git('add', '.'); git('commit', '-qm', version); return git('rev-parse', 'HEAD');
    };
    const shim = (name, body) => { write(path.join(bin, name), '#!/usr/bin/env bash\nset -euo pipefail\n' + body); fs.chmodSync(path.join(bin, name), 0o755); };
    fs.mkdirSync(repo);
    git('init', '-q'); git('config', 'user.email', 'release-test@example.invalid'); git('config', 'user.name', 'Release Test');
    write(path.join(repo, '.gitignore'), 'node_modules/\n.env\n*.db\nuploads/\n');
    const old = prepare('old'), next = prepare('new');
    git('reset', '--hard', old);
    write(path.join(repo, 'backend-v2/node_modules/version'), 'old');
    write(path.join(repo, 'backend-v2/.env'), 'preserved-secret');
    write(path.join(repo, 'backend-v2/wechat.db'), 'preserved-database');
    write(path.join(web, 'index.html'), 'old');
    write(path.join(web, 'old-only.js'), 'old asset');
    shim('npm', `
if [[ "$PWD" == */backend-v2 ]]; then
  [[ "$FAILURE" != install ]] || exit 33
  mkdir -p node_modules; cat src/server.js > node_modules/version
elif [[ "$*" == 'run build' ]]; then
  mkdir -p dist; cp version dist/index.html; cp version dist/new-only.js
fi
`);
    shim('pm2', `
if [[ "$1" == restart && "$FAILURE" == restart && $(cat src/server.js) == new ]]; then exit 34; fi
`);
    const server = http.createServer((req, res) => {
      const source = fs.readFileSync(path.join(repo, 'backend-v2/src/server.js'), 'utf8');
      const deps = fs.readFileSync(path.join(repo, 'backend-v2/node_modules/version'), 'utf8');
      const lock = JSON.parse(fs.readFileSync(path.join(repo, 'backend-v2/package-lock.json'))).version;
      const html = fs.readFileSync(path.join(web, 'index.html'), 'utf8');
      const ok = source === deps && deps === lock && html === source && !(failure === 'health' && source === 'new');
      // HTTP 200 + false JSON must fail the gate, too.
      res.end(JSON.stringify({ ok, db: ok ? 'ok' : 'failed', revision: failure === 'revision' && source === 'new' ? old : git('rev-parse', 'HEAD') }));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const child = spawn('bash', [release, next], { env: {
        ...process.env, PATH: bin + ':' + process.env.PATH, REPO_DIR: repo, WEB_ROOT: web,
        STATE_ROOT: path.join(root, 'releases'), FAILURE: failure, HEALTH_ATTEMPTS: '1', HEALTH_INTERVAL: '0',
        HEALTH_URL: `http://127.0.0.1:${server.address().port}/health`,
      }, stdio: ['ignore', 'pipe', 'pipe'] });
      let logs = ''; child.stdout.on('data', d => logs += d); child.stderr.on('data', d => logs += d);
      const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', resolve); });
      assert.equal(code === 0, failure === 'none', logs);
      const expected = failure === 'none' ? 'new' : 'old';
      assert.equal(git('rev-parse', 'HEAD'), failure === 'none' ? next : old);
      for (const f of ['backend-v2/src/server.js', 'backend-v2/node_modules/version']) assert.equal(fs.readFileSync(path.join(repo, f), 'utf8'), expected);
      assert.equal(JSON.parse(fs.readFileSync(path.join(repo, 'backend-v2/package-lock.json'))).version, expected);
      assert.equal(fs.readFileSync(path.join(web, 'index.html'), 'utf8'), expected);
      assert.equal(fs.existsSync(path.join(web, 'old-only.js')), failure !== 'none');
      assert.equal(fs.existsSync(path.join(web, 'new-only.js')), failure === 'none');
      assert.equal(fs.readFileSync(path.join(repo, 'backend-v2/.env'), 'utf8'), 'preserved-secret');
      assert.equal(fs.readFileSync(path.join(repo, 'backend-v2/wechat.db'), 'utf8'), 'preserved-database');
      if (['restart', 'health', 'revision'].includes(failure)) assert.match(logs, /Rollback health passed/);
    } finally {
      await new Promise(resolve => server.close(resolve));
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
}
