const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { extractTemplate } = require('@capacitor/cli/dist/util/template');
const tar = require(require.resolve('tar', { paths: [path.dirname(require.resolve('@capacitor/cli/package.json'))] }));
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vxin-cap-template-'));
  try {
    fs.mkdirSync(path.join(dir, 'input'));
    fs.writeFileSync(path.join(dir, 'input/manifest.json'), '{"template":"verified"}');
    await tar.create({ file: path.join(dir, 'template.tgz'), cwd: path.join(dir, 'input'), gzip: true }, ['manifest.json']);
    await extractTemplate(path.join(dir, 'template.tgz'), path.join(dir, 'output'));
    assert.equal(fs.readFileSync(path.join(dir, 'output/manifest.json'), 'utf8'), '{"template":"verified"}');
    console.log('Capacitor template extraction passed with patched tar.');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
