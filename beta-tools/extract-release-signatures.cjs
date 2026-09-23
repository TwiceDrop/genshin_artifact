// Compare the two published signature weapons without regenerating Rust data.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const original = path.join(__dirname, 'extract-weapon-data.cjs');
let source = fs.readFileSync(original, 'utf8');
source = source.replaceAll('sources-beta3/', 'sources-release-71/')
    .replaceAll('/beta?lang=chs', '/release?lang=chs')
    .replaceAll('weapons-beta3.json', 'weapons-signature-release-71.json')
    .replace("revision:'7.0.54 D48100502'", "revision:'7.1.0 D48145775'");
source = source.slice(0, source.indexOf("let rust ="));
const mod = new Module(original, module);
mod.filename = original;
mod.paths = Module._nodeModulePaths(__dirname);
mod._compile(source, original);
