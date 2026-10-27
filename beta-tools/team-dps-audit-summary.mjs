import fs from 'node:fs';
import assert from 'node:assert/strict';
import {jobs,allSets} from './team-dps-full-audit.mjs';
import {weapons,chars,sets} from './interface-audit-7108.mjs';
const dir='.build-target/team-dps-full-audit',roles=['Skirk','Furina','Escoffier','Vodyanitsa'];
const locale=JSON.parse(fs.readFileSync('src/i18n/generated/zh-cn.json','utf8')),setData=Object.fromEntries(Object.values(sets).map(s=>[s.name2,s]));
const name=(data,key)=>locale[data[key].nameLocale],num=n=>Number(n.toFixed(2)).toLocaleString('en-US',{maximumFractionDigits:2,useGrouping:false});
const samples=JSON.parse(fs.readFileSync(`${dir}/numerical-samples.json`,'utf8'));
let markdown='# 全装备数值抽样明细\n\n2026-10-26，合成输入，R1、零命。220个角色武器组合各抽一套，轮换覆盖63套圣遗物；每行展示该角色轴内最后一段角色伤害。各行圣遗物配置不同，按输入逐项核对。原生输入、面板和乘区保存在 `numerical-samples.json`；[完整测试报告](team-dps-full-equipment-test-20261026.md)列出机制问题及修复方向。\n\n';
for(const role of roles){markdown+=`## ${name(chars,role)}\n\n| 武器 | 套装 | 时刻（秒） | 期望 | 暴击 | 非暴击 |\n| --- | --- | ---: | ---: | ---: | ---: |\n`;for(const row of samples.filter(s=>s.role===role))markdown+=`| ${name(weapons,row.weapon)} | ${name(setData,row.set)} | ${row.error?'—':num(row.time)} | ${row.error?'发布内核参数报错':num(row.expectation)} | ${row.error?'—':num(row.critical)} | ${row.error?'—':num(row.non_critical)} |\n`;markdown+='\n';}
fs.writeFileSync('docs/team-dps-full-equipment-samples-20261026.md',markdown);
if(process.argv.includes('--samples-only'))process.exit(0);
const rows=fs.readFileSync(`${dir}/final-matrix.jsonl`,'utf8').trim().split('\n').map(s=>JSON.parse(s));
const key=r=>[r.role,r.weapon,r.refine,r.cons,r.mode,r.set].join('/'),actual=new Set(rows.map(key));
let planned=0;for(const job of jobs())for(const set of job.setNames){planned++;assert.ok(actual.has(key({...job,role:roles[job.role],set})));}
assert.equal(rows.length,planned);assert.equal(actual.size,planned);
const failures=rows.filter(r=>r.error||r.issues?.length),byWeapon={};for(const f of failures)byWeapon[f.weapon]=(byWeapon[f.weapon]||0)+1;
const summary={matrixCases:rows.length,matrixPassed:rows.length-failures.length,matrixFailures:failures.length,failureWeapons:byWeapon,hits:rows.reduce((n,r)=>n+(r.hits||0),0),roleWeaponPairs:new Set(rows.map(r=>r.role+'/'+r.weapon)).size,weaponNames:new Set(rows.map(r=>r.weapon)).size,sets:new Set(rows.map(r=>r.set)).size,roleWeaponSetPairs:new Set(rows.map(r=>r.role+'/'+r.weapon+'/'+r.set)).size,mixed:JSON.parse(fs.readFileSync(`${dir}/mixed-summary.json`,'utf8')),outside:JSON.parse(fs.readFileSync(`${dir}/outside-summary.json`,'utf8')),samples:samples.length,author:JSON.parse(fs.readFileSync(`${dir}/search-and-author.json`,'utf8')).author};
fs.writeFileSync(`${dir}/coverage-summary.json`,JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));
