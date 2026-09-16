const { readdirSync } = require('node:fs');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : entry.name.endsWith('.js') ? [join(dir, entry.name)] : []);
}
const files = walk(join(__dirname, '../src'));
let failed = 0;
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) { failed++; process.stderr.write(result.stderr || String(result.error)); }
}
console.log(`Backend syntax: ${files.length - failed}/${files.length} passed`);
process.exitCode = failed ? 1 : 0;
