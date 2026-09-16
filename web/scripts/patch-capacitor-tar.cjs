// Capacitor 4 uses a synthetic default import; tar 7 exposes named CommonJS exports.
// Keep the existing native wrapper generation compatible while using the patched extractor.
const fs = require('node:fs');
const file = require.resolve('@capacitor/cli/dist/util/template');
const source = fs.readFileSync(file, 'utf8');
const oldImport = 'tslib_1.__importDefault(require("tar"))';
const compatibleImport = '({ default: require("tar") })';
if (source.includes(oldImport)) fs.writeFileSync(file, source.replace(oldImport, compatibleImport));
else if (!source.includes(compatibleImport)) throw new Error('Capacitor template import changed; review the tar compatibility adapter.');
