import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {REMAINING_CHARACTER_NAMES,ALYOSHA_PRECISION} from '../beta-data/remaining-character-rules.mjs';
import {EXTENSION_BUFF_REGISTRY,EXTENSION_BUFF_ADAPTERS} from '../beta-data/extension-buffs.mjs';
import {calculateSingleHit,singleHitBuffs} from '../beta-data/single-hit-damage.mjs';
import {calculateDirectStellarConduct} from '../beta-data/direct-stellar-conduct.mjs';
import {calculateBloomFamilyDamage} from '../beta-data/bloom-damage.mjs';
import {calculateDirectLunarDamage} from '../beta-data/lunar-damage.mjs';
import {api,vody,vesna,sum} from '../beta-tools/runtime-7106.mjs';
const named=(name,p={})=>({name,config:{[name]:p}});
const near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<1e-8*Math.max(1,Math.abs(b)),String(a)+' != '+b);
const values=(name,p={},character='Vesna')=>EXTENSION_BUFF_REGISTRY.compile(named(name,p),{character:{name:character}})?.[0]?.config.ExtensionEffect.values||{};
const manual={kind:'ordinary',character:{name:'Klee'},panelMode:'before-buffs',panel:{ATK:2000,ATKBase:1000,ATKPercentage:1,em:0,critRate:0,critDamage:0,damageBonus:0},skillMultiplier:1,resistanceBeforeBuffs:0};
const lunar=buffs=>({kind:'lunar-bloom',owner:{id:'Nefer',em:0,critRate:.1,critDamage:1},scalingStat:100,skillMultiplier:1,resistanceMultiplier:1,buffs});
test('1 十二项注册、旅行者和可莉身份、基础属性、真实WASM普通面板',()=>{
 assert.equal(REMAINING_CHARACTER_NAMES.length,12);assert.equal(EXTENSION_BUFF_ADAPTERS.length,125);
 for(const n of REMAINING_CHARACTER_NAMES)assert.ok(EXTENSION_BUFF_REGISTRY.has(n));
 near(values('KleeC1',{},'Klee').ATKPercentage,.6);assert.deepEqual(values('KleeC1'),{});assert.deepEqual(values('KleeC1',{hexerei_secret_rite:false},'Klee'),{});
 near(calculateSingleHit({...manual,buffs:[named('KleeC1')]}).non_critical,1300);
 near(calculateSingleHit({...manual,panelMode:'final',buffs:[named('KleeC1')]}).non_critical,1000);
 for(const who of ['AetherCryo','LumineHydro']){near(values('TravelerElements',{},who).ATKPercentage,.2);near(values('TravelerEnhancedAttribute',{},who).ATKBase,10);}
 assert.deepEqual(values('TravelerElements'),{});near(calculateSingleHit({...manual,character:{name:'AetherCryo'},buffs:[named('TravelerEnhancedAttribute')]}).scalingStat,2020);
 const base=api.CommonInterface.get_attribute(vody),buffed=api.CommonInterface.get_attribute({...structuredClone(vody),buffs:[named('AlyoshaHunterPrecision',{c6:true,skill_level:10,stacks:2})]});
 near(sum(buffed.elemental_mastery)-sum(base.elemental_mastery),100);assert.ok(sum(buffed.atk)>sum(base.atk));
});
test('2 阿罗夏全等级和六命、星反应分流、排除冰旅行者自身',()=>{
 near(ALYOSHA_PRECISION[14],.2756);for(let level=1;level<=15;level++)near(values('AlyoshaHunterPrecision',{skill_level:level,c6:true,stacks:2}).ATKPercentage,2*ALYOSHA_PRECISION[level-1]);
 near(values('AlyoshaHunterPrecision',{c6:false,stacks:2}).EnhanceStellarSuperconduct,.2);near(values('AlyoshaHunterPrecision',{c6:true,stacks:2}).EnhanceStellarSuperconduct,.4);
 assert.deepEqual(values('AlyoshaHunterPrecision',{recipient_on_field:false}),{});
 assert.deepEqual(values('AetherCryoC6',{},'AetherCryo'),{});assert.deepEqual(values('AetherCryoC6',{},'LumineCryo'),{});
 const buffs=[named('CynoC2StellarConduct'),named('YaeMikoC1'),named('AetherCryoC6'),named('AetherCryoTalent1',{atk:5000}),named('AlyoshaHunterPrecision',{c6:true})];
 const direct={element:'Cryo',owner:{id:'Vesna',em:0,critRate:0,critDamage:0},scalingStat:100,skillMultiplier:1,baseMultiplier:1,resistanceMultiplier:1,buffs};near(calculateDirectStellarConduct(direct).expectation,100*1.07*2.8);
 near(values('AetherCryoTalent1',{radiance_mode:2,atk:5000}).StellarSwirlBaseBonus,.07);assert.equal(values('AetherCryoTalent1',{radiance_mode:2}).StellarConductBaseBonus,undefined);
 near(calculateSingleHit({...manual,kind:'stellar-swirl',element:'Anemo',buffs:[named('AetherCryoC6')]}).expectation,2800);
});
test('3 纳西妲与菈乌玛：普通绽放暴击率相加、固定暴伤不翻倍、燃烧与月绽放隔离',()=>{
 const buffs=[named('NahidaC2'),named('LaumaTalent2',{mode:1})];
 near(calculateSingleHit({...manual,kind:'bloom',levelBase:100,reactionBonus:.5,flatBonus:10}).expectation,310);
 near(calculateSingleHit({...manual,kind:'bloom',levelBase:100,buffs:[named('ResMinusBase',{p:20})]}).expectation,220);
 const ordinary=calculateBloomFamilyDamage({kind:'bloom',owner:{id:'trigger',em:0},levelBase:100,resistanceMultiplier:1,buffs});near(ordinary.expectation,270);near(ordinary.fixed_crit_damage,1);
 near(calculateBloomFamilyDamage({kind:'burning',owner:{id:'trigger',em:0},levelBase:100,resistanceMultiplier:1,buffs}).expectation,30);
 near(calculateDirectLunarDamage(lunar([named('NahidaC2'),named('LaumaTalent2',{mode:2})])).expectation,142);
 assert.deepEqual(values('NahidaC2',{marked:false}),{});near(values('NahidaC2',{def_minus:false}).DefMinus,0);
 const x={...structuredClone(vody),buffs:[named('NahidaC2')]};const a=api.CalculatorInterface.get_damage_analysis(vody),b=api.CalculatorInterface.get_damage_analysis(x);assert.ok(b.normal.non_critical>a.normal.non_critical);
});
test('4 杜林限定反应与魔导、伊法三分支、手动面板API及优化隔离',()=>{
 near(values('DurinTalent2',{reaction_element:2,hexerei_secret_rite:true}).ResMinusElectro,.35);near(values('DurinTalent2',{reaction_element:1}).ResMinusDendro,.2);
 for(const e of [0,5,6])assert.throws(()=>values('DurinTalent2',{reaction_element:e}),/须明确|蒸发/);
 near(values('DurinC2',{reaction_element:5}).BonusHydro,.5);assert.equal(values('DurinC2',{reaction_element:5}).BonusCryo,undefined);
 const v=values('IfaTalent2',{rescue_essentials:200});near(v.EnhanceSwirlBase,3);near(v.EnhanceElectroCharged,3);near(v.EnhanceMoonelectro,.4);
 const buffs=[named('DurinTalent2',{reaction_element:2,hexerei_secret_rite:true}),named('DurinC2',{reaction_element:2})];near(calculateSingleHit({...manual,buffs,resistanceBeforeBuffs:.1}).expectation,1000*1.5*1.125);
 const context={character:{name:'Klee'},buffs:[named('KleeC1')],single_hit_context:manual};near(api.CalculatorInterface.get_damage_analysis(context).single_hit.expectation,1300);assert.throws(()=>api.OptimizeSingleWasm.optimize(context,[]),/仅支持单次/);
 assert.throws(()=>singleHitBuffs([named('UnknownBuff')],{name:'Vesna'}),/尚无此BUFF/);
});
test('5 发布检查：新面板语法、版本、真实内核加载和构建文件',async()=>{
 assert.equal(fs.existsSync('src/pages/NewArtifactPlanPage/SingleHitPanel.vue'),false);
 assert.equal(JSON.parse(fs.readFileSync('package.json')).displayVersion,'7.1.07');
 const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');assert.equal(hash('mona_wasm/pkg/mona_wasm_bg.wasm'),'fa42077784f9556dd312743bc1327bd475970c53146e4867191f3cad63005b90');assert.notEqual(hash('mona_wasm/extension/mona_extension_bg.wasm'),'f2671ff81d77ef45c2c9cad87f2cb087f2e0565cfe92d225c2fcaa9532f8f561');
 assert.ok(Number.isFinite(api.CalculatorInterface.get_damage_analysis(vesna).direct_stellarswirl.expectation));
 const dist=path.resolve(process.env.MONA_RELEASE_DIST||'D:/Documents/ChatGPT/v7.1.07/web/dist');assert.ok(fs.existsSync(path.join(dist,'index.html')));const scripts=fs.readdirSync(path.join(dist,'js')).filter(n=>n.endsWith('.js'));assert.ok(scripts.some(n=>fs.readFileSync(path.join(dist,'js',n),'utf8').includes('7.1.07')));
 const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(x=>x.isDirectory()?walk(path.join(d,x.name)):[path.join(d,x.name)]);const files=walk(dist);assert.ok(files.some(p=>p.endsWith('.wasm')&&hash(p)===hash('mona_wasm/extension/mona_extension_bg.wasm')));assert.ok(files.some(p=>p.endsWith('.wasm')&&hash(p)===hash('mona_wasm/pkg/mona_wasm_bg.wasm')));
 const {createLocalServer}=await import(pathToFileURL(path.join(dist,'../server/local.mjs')).href);const server=createLocalServer();
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
 try{const url='http://127.0.0.1:'+server.address().port;const page=await fetch(url);assert.equal(page.status,200);assert.equal(await page.text(),fs.readFileSync(path.join(dist,'index.html'),'utf8'));for(const f of files.filter(p=>p.endsWith('.wasm'))){const response=await fetch(url+'/'+path.relative(dist,f).split(path.sep).join('/'));assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/application\/wasm/);assert.equal(crypto.createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'),hash(f));}}
 finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}

});
