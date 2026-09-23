import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {bindings} from '../mona_wasm/pkg/bindings.js';
import * as bridge from '../mona_wasm/pkg/mona_wasm_bg.js';
import * as extension from '../mona_wasm/extension/mona_extension.js';
import {createFacade} from '../beta-data/facade.mjs';
import {createBeta2} from '../beta-data/vesna-facade.mjs';
import {createLimitedWeaponFacade} from '../beta-data/limited-weapon-facade.mjs';
import {createStrengthenedFacade,MIZUKI_STELLAR_TARGET} from '../beta-data/strengthened-facade.mjs';
import {createStellarSupportFacade, SANDRONE_STELLAR_TARGET, SANDRONE_STELLAR_RATIOS} from '../beta-data/stellar-support-facade.mjs';
globalThis.module = {require: createRequire(import.meta.url)};
const read = p => JSON.parse(fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8').replace(/^(?:\s*\/\/[^\n]*\n)*\s*export default\s*/,''));
bindings.lI(new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(new URL('../mona_wasm/pkg/mona_wasm_bg.wasm', import.meta.url))), {'./mona_wasm_bg.js': bridge}).exports);
const original = {CommonInterface: bindings.Ps, CalculatorInterface: bindings.K2, OptimizeSingleWasm: bindings.E2,
    BonusPerStat: bindings.bd, TeamOptimizationWasm: bindings.B8, DSLInterface: bindings.ZB};
const support = createStellarSupportFacade(original, original), api = support.facade;
extension.initSync(fs.readFileSync(new URL('../mona_wasm/extension/mona_extension_bg.wasm',import.meta.url)));
const nativeSupport=read('beta-data/extension-support.json');
const previous=createBeta2(createFacade(original,extension,read('beta-data/vodyanitsa.json'),nativeSupport,read('src/assets/_gen_character.js')),extension,nativeSupport);
const limited=createLimitedWeaponFacade(previous,original,read('beta-data/weapons-limited-71.json'));
const completeSupport=createStellarSupportFacade(limited,original);
const full=createStrengthenedFacade(completeSupport.facade,completeSupport.transformStellarTarget);
const sum = o => Object.values(o || {}).reduce((a, b) => a + b, 0), clone = structuredClone;
const close = (a, b) => assert.ok(Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < Math.max(1e-7, Math.abs(b) * 1e-10), `${a} != ${b}`);
const named = (name, p) => ({name, config: p ? {[name]: p} : 'NoConfig'});
const tests = [];
function test(name, fn) {try {fn(); tests.push({name, pass: true}); console.log('PASS', name);} catch(e) {tests.push({name, pass: false, error: String(e), stack: e.stack}); console.error('FAIL', name, String(e));}}
function input(co = 0, level = 90) {
    const x = clone(read('beta-data/mizuki-fixture.json').input);
    x.character.constellation = co; x.character.level = level;
    x.character.params.YumemizukiMizuki.enhanced_state = true;
    x.skill = {index: 14, config: 'NoConfig'}; x.buffs = []; return x;
}
const damage = (x, engine = api) => engine.CalculatorInterface.get_damage_analysis(x, null);
test('迪奥娜40%原核已支持星扩散，保持一次加成', () => {
    const x = input(), off = damage(x); x.buffs = [named('DionaC6StellarConduct')];
    const a = damage(x), b = damage(x, original);
    close(a.direct_stellarswirl.expectation, b.direct_stellarswirl.expectation);
    close(sum(a.direct_stellarswirl_compose) - sum(off.direct_stellarswirl_compose), .4);
});
test('七七50%与桑多涅30%只补星扩散、保留原有星超导和赛诺增益', () => {
    for(const name of ['QiqiTalent2StellarConduct', 'SandroneC1']) {
        const x = input(); x.buffs = [named(name), named('CynoC2StellarConduct', {stack: 3}), named('EnhanceStellarGlimmerReaction', {p: 20})];
        const a = damage(x), b = damage(x, original), delta = name.startsWith('Qiqi') ? .5 : .3;
        close(sum(a.direct_stellarconduct_compose), sum(b.direct_stellarconduct_compose));
        close(sum(a.direct_stellarswirl_compose) - sum(b.direct_stellarswirl_compose), delta);
        close(a.normal.expectation, b.normal.expectation);
        close(a.direct_stellarswirl.expectation / b.direct_stellarswirl.expectation, (1 + sum(b.direct_stellarswirl_compose) + delta) / (1 + sum(b.direct_stellarswirl_compose)));
        assert.ok(Object.values(a.direct_stellarswirl_compose).every(Number.isFinite));
    }
});
test('桑多涅队友星耀祝礼精确基础乘区，保留既有奥黛塔', () => {
    for(const atk of [0, 1000, 2000, 3500]) {
        const x = input(); x.buffs = [named('SandroneTalent1', {atk}), named('OdetteTalent1', {atk: 1000, radiance_mode: 2})];
        const a = damage(x), b = damage(x, original), delta = Math.min(atk * .00007, .14);
        close(sum(a.direct_stellarswirl_base_compose), .07 + delta);
        close(sum(a.direct_stellarconduct_base_compose), sum(b.direct_stellarconduct_base_compose));
    }
});
test('七七六命只增加直接星扩散基础，不增加面板攻击或反应星扩散', () => {
    const x = input(6), off = damage(x); x.buffs = [named('QiqiC6StellarConduct', {atk: 2000})];
    const a = damage(x), raw = sum(off.em) * sum(off.direct_stellarswirl_ratio) + sum(off.direct_stellarswirl_extra_fixed);
    close(sum(a.atk), sum(off.atk)); close(a.normal.expectation, off.normal.expectation);
    close(a.stellarswirl_anemo.expectation, off.stellarswirl_anemo.expectation);
    close(a.stellarswirl_cryo.expectation, off.stellarswirl_cryo.expectation);
    close(a.direct_stellarswirl.expectation / off.direct_stellarswirl.expectation, (raw + 12000) / raw);
});
test('等级1/20/70/80/90，C0/C1/C6及两种直伤的七七加值DSL与面板一致', () => {
    for(const level of [1, 20, 70, 80, 90]) for(const co of [0, 1, 6]) for(const idx of co ? [14, 15] : [14]) {
        const x = input(co, level); x.skill.index = idx;
        x.buffs = [named('QiqiC6StellarConduct', {atk: 1800}), named('QiqiTalent2StellarConduct'), named('YumemizukiMizukiC1', {em: 900})];
        const source = `dmg hit = YumemizukiMizuki.${idx === 14 ? 'TalentStellarSwirl' : 'C1StellarSwirl'}\nresult = hit.direct_stellarswirl.e`;
        const transformed = support.adjustStellarSupportDsl(source, x);
        const p = clone(transformed.input);
        // Invoke through the optimizer, whose callback recalculates each artifact candidate.
        const target = {name: 'YumemizukiMizukiDefault', params: 'NoConfig', use_dsl: true, dsl_source: transformed.source};
        const result = api.OptimizeSingleWasm.optimize({...p, target_function: target, algorithm: 'Naive', constraint: null, filter: null}, p.artifacts);
        close(result[0].value, damage(x).direct_stellarswirl.expectation);
        const q = clone(x); q.character.params.YumemizukiMizuki.c1_reaction_active = false;
        close(damage(q).direct_stellarswirl.expectation, damage(x).direct_stellarswirl.expectation);
    }
});
test('七七C6不改反应目标、自定义DSL明确拒绝', () => {
    const x = input(1); x.buffs = [named('QiqiC6StellarConduct', {atk: 1000})];
    const source = 'dmg hit = YumemizukiMizuki.TalentStellarSwirl\nresult = hit.stellarswirl_cryo.e';
    assert.deepEqual(support.adjustStellarSupportDsl(source, x), {source, input: x});
    assert.throws(() => support.adjustStellarSupportDsl('result = 1', x), /自定义DSL/);
});
function sandrone(co=6) {
    const x=input();x.character={name:'Sandrone',level:90,ascend:false,constellation:co,skill1:9,skill2:9,skill3:9,params:{Sandrone:{stellar_base_active:true,em_conversion_active:true,c1_team_stellar:true,c6_elevate_active:true}}};
    x.weapon={name:'ForgedByTheGoldenMelody',level:90,ascend:false,refine:5,params:{ForgedByTheGoldenMelody:{state:2,counterpoint_active:false}}};
    x.skill={index:18,config:{Sandrone:{c2_ray_stacks:3,prism_overcharge:true,burst_tactics_stacks:10,stellarconduct_hits:0}}};
    x.buffs=[named('QiqiC6StellarConduct',{atk:2000}),named('QiqiTalent2StellarConduct'),named('DionaC6StellarConduct'),named('OdetteTalent1',{atk:1000,radiance_mode:2})];
    return x;
}
test('桑多涅45档精确倍率与独立来源快照一致',()=>{
    const expected=read('beta-data/sandrone-stellar-skills.json');
    for(const key of ['charged','skill','burst','c4','c6'])assert.deepEqual(SANDRONE_STELLAR_RATIOS[key],expected[key]);
});
test('桑多涅五种新技能的配装DSL、词条收益与面板一致',()=>{
    for(let mode=0;mode<5;mode++) {
        const x=sandrone();x.skill.index=18+mode;
        const target={name:SANDRONE_STELLAR_TARGET,params:{[SANDRONE_STELLAR_TARGET]:{mode,c2_ray_stacks:3,prism_overcharge:true,burst_tactics_stacks:10}}};
        const result=api.OptimizeSingleWasm.optimize({...x,target_function:target,algorithm:'Naive',constraint:null,filter:null},x.artifacts);
        close(result[0].value,damage(x).direct_stellarswirl.expectation);
        const gain=api.BonusPerStat.bonus_per_stat({...x,tf:target,artifacts_config:x.artifact_config});
        for(const [buff,field,value]of [['ATKPercentage','atk_percentage',5.8],['ElementalMastery','elemental_mastery',23],['CriticalDamage','critical_damage',7.8]]) {
            const y=clone(x);y.buffs.push(named(buff,buff==='ElementalMastery'?{value}:{p:value}));
            close(gain[field][0],damage(y).direct_stellarswirl.expectation/damage(x).direct_stellarswirl.expectation-1);
        }
    }
});
test('桑多涅配装每候选重新计算攻击/精通/星伤，32套混合圣遗物最优值正确',()=>{
    const x=sandrone();x.buffs.push(named('YumemizukiMizukiC1',{em:1000}));
    const a=x.artifacts.map((v,i)=>({...v,id:i+1,set_name:'ScarletProof'}));
    const b=x.artifacts.map((v,i)=>({...v,id:i+6,set_name:'HeartOfTheFurnace',sub_stats:[...v.sub_stats,['ATKPercentage',.1],['ElementalMastery',30]]}));
    x.artifact_config={...x.artifact_config,config_scarlet_proof:{rate:1},config_heart_of_the_furnace:{rate:1}};
    const target={name:SANDRONE_STELLAR_TARGET,params:{[SANDRONE_STELLAR_TARGET]:{mode:0,c2_ray_stacks:3,prism_overcharge:true,burst_tactics_stacks:10}}};
    let best=-Infinity;
    for(let mask=0;mask<32;mask++) {const y=clone(x);y.artifacts=a.map((v,i)=>mask&(1<<i)?b[i]:v);best=Math.max(best,damage(y).direct_stellarswirl.expectation);}
    const result=api.OptimizeSingleWasm.optimize({...x,target_function:target,algorithm:'Naive',constraint:null,filter:null},[...a,...b]);
    close(result[0].value,best);
});
test('完整包装链瑞希四种目标+七七+新限定武器与实际伤害一致',()=>{
    for(let mode=0;mode<4;mode++) {
        const x=input(6);x.skill.index=mode===1?15:14;
        x.weapon={name:'WintersHeavyHeart',level:90,ascend:false,refine:5,params:{WintersHeavyHeart:{cryo_count:2,electro_count:1,radiance:true,rate:.5}}};
        x.buffs=[named('QiqiC6StellarConduct',{atk:2300}),named('QiqiTalent2StellarConduct'),named('SandroneC1'),named('SandroneTalent1',{atk:1000}),named('YumemizukiMizukiC1',{em:1000})];
        const target={name:MIZUKI_STELLAR_TARGET,params:{[MIZUKI_STELLAR_TARGET]:{mode}}};
        const result=full.OptimizeSingleWasm.optimize({...x,target_function:target,algorithm:'Naive',constraint:null,filter:null},x.artifacts);
        const reaction=['direct_stellarswirl','direct_stellarswirl','stellarswirl_anemo','stellarswirl_cryo'][mode];
        close(result[0].value,damage(x,full)[reaction].expectation);
    }
});
test('完整包装链桑多涅五目标+金律覆盖率与面板一致',()=>{
    for(let mode=0;mode<5;mode++) {
        const x=sandrone();x.skill.index=18+mode;
        x.weapon.params.ForgedByTheGoldenMelody={state:2,counterpoint_active:true,counterpoint_state:3,rate:.4,counterpoint_rate:.7};
        const target={name:SANDRONE_STELLAR_TARGET,params:{[SANDRONE_STELLAR_TARGET]:{mode,c2_ray_stacks:3,prism_overcharge:true,burst_tactics_stacks:10}}};
        const result=full.OptimizeSingleWasm.optimize({...x,target_function:target,algorithm:'Naive',constraint:null,filter:null},x.artifacts);
        close(result[0].value,damage(x,full).direct_stellarswirl.expectation);
    }
});
test('原生薇斯纳七七/桑多涅/既有VesnaSupport合并，数值和分乘区一致',()=>{
    const x=sandrone(0);x.character={name:'Vesna',level:90,ascend:false,constellation:0,skill1:9,skill2:9,skill3:9,params:{Vesna:{stance:true,radiance:true,disciplinary_stacks:6,anemo_cryo_count:1,other_count:0,flat_inside_discipline:false}}};
    x.weapon={name:'NewBough',level:90,ascend:false,refine:5,params:{NewBough:{stacks:3,rate:.5,radiance:true}}};
    x.skill={index:17,config:'NoConfig'};x.artifacts=[];x.buffs=[named('VesnaSupport',{flat:100,base:.03,bonus:.1,crit_damage:.2,elevation:.05,anemo_res:0})];
    const before=damage(x,full);
    x.buffs.push(named('QiqiC6StellarConduct',{atk:2000}),named('QiqiTalent2StellarConduct'),named('SandroneC1'),named('SandroneTalent1',{atk:2000}));
    const after=damage(x,full),rawBefore=sum(before.atk)*sum(before.atk_ratio)+100;
    close(sum(after.direct_stellarswirl_base_compose)-sum(before.direct_stellarswirl_base_compose),.14);
    close(sum(after.direct_stellarswirl_compose)-sum(before.direct_stellarswirl_compose),.8);
    close(sum(after.direct_stellarswirl_extra_fixed),12100);
    const expected=before.direct_stellarswirl.expectation*(rawBefore+12000)/rawBefore*(1+sum(after.direct_stellarswirl_base_compose))/(1+sum(before.direct_stellarswirl_base_compose))*(1+sum(after.direct_stellarswirl_compose))/(1+sum(before.direct_stellarswirl_compose));
    close(after.direct_stellarswirl.expectation,expected);
});
fs.writeFileSync(new URL('../beta-data/stellar-support-tests.json', import.meta.url), JSON.stringify({tests}, null, 2) + '\n');
if(tests.some(t => !t.pass)) process.exitCode = 1;
