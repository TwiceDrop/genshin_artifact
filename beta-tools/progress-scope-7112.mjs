import fs from 'node:fs';
import assert from 'node:assert/strict';
import {api,read} from './runtime-7106.mjs';
import {fixture} from './interface-audit-7108.mjs';
import {resultDamagePreview} from '../src/algorithms/optimization-results.mjs';
import {visibleDamageReactionKeys} from '../src/algorithms/reaction-labels.mjs';
const out='.build-target/progress-results-7112',chars=read('src/assets/_gen_character.js'),report={characters:[],failures:[]};
assert.equal(Object.keys(chars).length,141);assert.equal(chars.Mitya,undefined);assert.equal(chars.Valeriy,undefined);
for(const name of Object.keys(chars)){
 const x=fixture(name),before=JSON.stringify(x);
 try{const r=resultDamagePreview(api,x,x.artifacts,'None');const keys=visibleDamageReactionKeys(r.analysis);assert.ok(keys.length);for(const key of keys)for(const field of ['expectation','critical','non_critical'])assert.ok(Number.isFinite(r.analysis[key][field]));assert.ok(r.attributes.every(a=>Number.isFinite(a.value)));assert.equal(JSON.stringify(x),before);report.characters.push(name);}
 catch(e){report.failures.push({name,error:e.message});}
}
for(const name of ['src/assets/_gen_character.js','src/assets/_gen_weapon.js','src/assets/_gen_buff.js','src/assets/_gen_tf.js','src/assets/_gen_artifact.js','src/i18n/generated/zh-cn.json','package.json','mona_wasm/pkg/mona_wasm_bg.wasm','mona_wasm/pkg/mona_effect_bridge.wasm','mona_wasm/extension/mona_extension_bg.wasm'])assert.ok(fs.readFileSync(name).equals(fs.readFileSync(out+'/before/'+name)),name);
fs.writeFileSync(out+'/scope-preview.json',JSON.stringify(report,null,2));console.log(JSON.stringify({count:report.characters.length,failures:report.failures}));process.exitCode=report.failures.length?1:0;
