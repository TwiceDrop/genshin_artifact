import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as vue from 'vue';
import {read,api} from '../beta-tools/runtime-7106.mjs';
import {createMysConverter,mergeEquipped} from '../src/import/miyoushe.mjs';
import {characterSummary} from '../src/import/character-summary.mjs';
import {normalizeTalentName} from '../src/import/character-talents.mjs';
import * as importHistory from '../src/import/import-history.mjs';
import * as uidInventory from '../src/import/uid-inventory.mjs';
const characters=read('src/assets/_gen_character.js'),weapons=read('src/assets/_gen_weapon.js'),artifacts=read('src/assets/_gen_artifact.js'),targets=read('src/assets/_gen_tf.js'),locale=read('src/i18n/generated/zh-cn.json');
const converter=createMysConverter({characters,weapons,artifacts,targets,locale});
const report={date:'2026-10-01',targetedItems:5,catalogScope:'134 catalog rows / 402 names; metadata only',items:[]};
const evidence=(name,detail)=>report.items.push({name,status:'pass',detail});
after(()=>{fs.mkdirSync('.build-target/talent-import-20261001',{recursive:true});fs.writeFileSync('.build-target/talent-import-20261001/report.json',JSON.stringify(report,null,2));});
const uid='999999999';
function rawCharacter(name,levels=[6,9,12],dash){
 const meta=characters[name],weapon={Sword:'DullBlade',Claymore:'WasterGreatsword',Bow:'HuntersBow',Polearm:'BeginnersProtector',Catalyst:'ApprenticesNotes'}[meta.weapon];
 const skills=[1,2,3].map((i,j)=>({skill_type:1,name:locale[meta['skillName'+i]].replace(/^普通攻击·/,''),level:levels[j]}));
 const raw={base:{id:{Mona:10000041,KamisatoAyaka:10000002}[name]||99901001,name:locale[meta.nameLocale],element:meta.element,level:90,actived_constellation_num:0},weapon:{name:locale[weapons[weapon].nameLocale],level:90,promote_level:6,affix_level:1},skills:[skills[2],...(dash?[{skill_type:1,name:dash,level:1}]:[]),skills[0],skills[1],{skill_type:2,name:'合成被动',level:1}],relics:[]};
 return raw;
}
function summary(raw,preset){return characterSummary({label:raw.base.name,key:'synthetic'}, {raw,preset,characters,weapons,artifacts,locale,inventory:new Map()});}
function levels(c){return [c.skill1,c.skill2,c.skill3].map(v=>v+1);}
function storeHarness(){
 const inventory={artifacts:vue.ref(new Map()),addArtifact(a){const id=this.artifacts.value.size;this.artifacts.value.set(id,{...a,id});return id;}};
 const presets={presets:vue.ref({}),addOrOverwrite(name,item){this.presets.value[name]={name,item};},getPreset(name){return this.presets.value[name];}};
 const modules={vue,'@/import/import-history.mjs':importHistory,'@/import/uid-inventory.mjs':uidInventory,'./artifact':{useArtifactStore:()=>inventory},'./preset':{usePresetStore:()=>presets},'@/import/miyoushe.mjs':{mergeEquipped}},exports={};
 const source=fs.readFileSync('src/store/pinia/miyoushe.ts','utf8');
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ESNext}}).outputText,{exports,require:key=>modules[key]});
 return {store:exports.useMiyousheStore(),presets};
}
const snapshot=raw=>({version:1,source:'miyoushe',role:{uid},characters:[raw],importedAt:'2026-10-01T00:00:00Z'});

test('1 Mona: fourth active sprint, omitted Normal Attack prefix, reordered talents and raw roster summary',()=>{
 const raw=rawCharacter('Mona',[6,9,12],'虚实流动'),before=structuredClone(raw);
 const result=converter.character(raw,uid);
 assert.deepEqual(levels(result.preset.character),[6,9,12]);assert.deepEqual(raw,before);
 assert.equal(summary(raw).talents,'天赋：6、9、12');assert.equal(summary(raw,result.preset).talents,'天赋：6、9、12');
 evidence('Mona',{activeCount:4,displayedLevels:levels(result.preset.character),rawSummary:summary(raw).talents});
});
test('2 Ayaka: fourth active sprint and punctuation variations import into actual damage calculation',()=>{
 const raw=rawCharacter('KamisatoAyaka',[6,9,12],'神里流·霰步');
 raw.skills=raw.skills.map(s=>({...s,name:s.name.replaceAll('·',' ・ ')}));
 const result=converter.character(raw,uid);assert.deepEqual(levels(result.preset.character),[6,9,12]);assert.equal(summary(raw).talents,'天赋：6、9、12');
 const config={KamisatoAyaka:Object.fromEntries(characters.KamisatoAyaka.configSkill.map(c=>[c.name,c.default]))};
 const input={character:result.preset.character,weapon:result.preset.weapon,artifacts:[],buffs:[],artifact_config:null,enemy:null};
 const baseline={...input,character:{...input.character,skill1:0,skill2:0,skill3:0}};
 const rows=[];
 for(const [index,ratio]of [[0,.6646/.4573],[11,4.0664/2.392],[12,2.246/1.123]]){
  const get=x=>api.CalculatorInterface.get_damage_analysis({...x,skill:{index,config}},null).normal.expectation;
  const before=get(baseline),after=get(input);assert.ok(Math.abs(after/before-ratio)<1e-8);rows.push({index,before,after,expectedRatio:ratio});
 }
 evidence('KamisatoAyaka',{activeCount:4,displayedLevels:levels(result.preset.character),damage:rows});
});
test('3 Other representative characters: reordered active talents preserve distinct levels',()=>{
 const rows=[];
 for(const name of ['Amber','RaidenShogun','Vesna']){
  const raw=rawCharacter(name,[4,8,11]);const c=converter.character(raw,uid).preset.character;
  assert.deepEqual(levels(c),[4,8,11]);assert.equal(summary(raw).talents,'天赋：4、8、11');
  rows.push({name,displayedLevels:levels(c)});
 }
 evidence('Other representatives',rows);
});
test('4 Ambiguous/missing/invalid data reject with specifics and preserve the saved usable preset',()=>{
 const raw=rawCharacter('Mona',[6,9,12],'虚实流动'),missing=structuredClone(raw);
 missing.skills=missing.skills.filter(s=>s.name!=='星命定轨');
 assert.throws(()=>converter.character(missing,uid),/缺少「星命定轨」/);
 const duplicate=structuredClone(raw);duplicate.skills.push({...duplicate.skills.find(s=>s.name==='因果点破'),name:'普通攻击·因果点破'});
 assert.throws(()=>converter.character(duplicate,uid),/重复匹配「普通攻击·因果点破」/);
 const unknown=structuredClone(raw);unknown.skills=unknown.skills.filter(s=>s.skill_type===1&&s.name!=='虚实流动').map(s=>({...s,name:'未知主动技能'}));
 assert.throws(()=>converter.character(unknown,uid),/对应关系.*缺少/);
 const invalid=structuredClone(raw);invalid.skills.find(s=>s.name==='星命定轨').level=99;assert.throws(()=>converter.character(invalid,uid),/等级超出支持范围/);
 assert.equal(summary(missing).talents,'天赋：—、—、—');assert.match(summary(missing).warning,/缺少「星命定轨」/);
 const {store,presets}=storeHarness();assert.equal(store.importSnapshot(snapshot(raw),converter).imported,1);
 const name=store.data.value.entries[0].presetName,before=JSON.stringify(presets.getPreset(name).item);
 const failed=store.importSnapshot(snapshot(missing),converter);assert.equal(failed.rejected,1);assert.equal(JSON.stringify(presets.getPreset(name).item),before);
 assert.match(store.data.value.entries[0].warning,/使用已保存数据.*缺少「星命定轨」/);
 evidence('Invalid data and saved preset',{specificErrors:true,unknownLevelsNotGuessed:true,savedPresetPreserved:true});
});
test('5 Bounded catalog metadata check: all 134 characters have three distinct normalized talent names',()=>{
 const names=Object.keys(characters);assert.equal(names.length,134);
 const en=read('src/i18n/generated/en.json'),collisions=[];
 for(const [name,c]of Object.entries(characters))for(const [language,dict]of [['zh-cn',locale],['en',en]]){
  const values=[1,2,3].map(i=>dict[c['skillName'+i]]),keys=values.map(normalizeTalentName);
  if(keys.some(v=>!v)||new Set(keys).size!==3)collisions.push({name,language,values});
 }
 assert.deepEqual(collisions,[]);
 evidence('Catalog metadata',{characters:134,talentsPerLanguage:402,languages:['zh-cn','en'],missingOrColliding:0,nativeDamageNotExhaustivelyChecked:true});
});

