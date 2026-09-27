// Reuse the audited literal-data extractor against the published branch.
// Downloaded page scripts are parsed as data and never executed.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const original = path.join(__dirname, 'extract-limited-weapons.cjs');
let source = fs.readFileSync(original, 'utf8');
source = source.replaceAll('sources-limited-71', 'sources-release-71')
    .replaceAll('weapons-limited-71.json', 'weapons-release-71.json')
    .replaceAll('/beta?lang=chs', '/release?lang=chs')
    .replace('Public beta data snapshot; source currently identifies itself as 7.0.54, not an official 7.1 release.', 'Published 7.1 release branch data.');
const mod = new Module(original, module);
mod.filename = original;
mod.paths = Module._nodeModulePaths(__dirname);
mod._compile(source, original);
