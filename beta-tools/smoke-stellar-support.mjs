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
test('薇斯纳星耀祝礼按来源攻击力封顶、覆盖率计算，只加星扩散基础伤害', () => {
    for (const [atk, coverage] of [[0, 1], [1000, 1], [2000, .5], [3500, 1], [3500, 0]]) {
        const x = input(), off = damage(x);
        x.buffs = [named('VesnaTalent1', {atk, coverage})];
        const on = damage(x), expected = Math.min(atk * .00007, .14) * coverage;
        close(sum(on.direct_stellarswirl_base_compose) - sum(off.direct_stellarswirl_base_compose), expected);
        close(on.normal.expectation, off.normal.expectation);
        close(sum(on.direct_stellarconduct_base_compose), sum(off.direct_stellarconduct_base_compose));
        close(on.direct_stellarswirl.expectation / off.direct_stellarswirl.expectation,
            (1 + sum(off.direct_stellarswirl_base_compose) + expected) / (1 + sum(off.direct_stellarswirl_base_compose)));
        close(on.stellarswirl_cryo.expectation / off.stellarswirl_cryo.expectation, 1 + expected);
    }
    assert.throws(() => damage({...input(), buffs: [named('VesnaTalent1', {atk: 2000, coverage: 1.1})]}), /覆盖率/);
});
test('薇斯纳与桑多涅、奥黛塔的星耀祝礼独立叠加', () => {
    const x = input();
    x.buffs = [named('OdetteTalent1', {atk: 1000, radiance_mode: 2}),
        named('SandroneTalent1', {atk: 2000}), named('VesnaTalent1', {atk: 2500, coverage: .5})];
    const result = damage(x);
    close(sum(result.direct_stellarswirl_base_compose), .07 + .14 + .07);
    close(result.direct_stellarswirl_base_compose['桑多涅·星耀祝礼：星扩散'], .14);
    close(result.direct_stellarswirl_base_compose['薇斯纳·星耀祝礼：星扩散'], .07);
});
test('桑多涅前台可同时接收薇斯纳队友星耀祝礼', () => {
    const x = sandrone(0), off = damage(x, full);
    x.buffs.push(named('VesnaTalent1', {atk: 1500, coverage: .5}));
    const on = damage(x, full);
    close(sum(on.direct_stellarswirl_base_compose) - sum(off.direct_stellarswirl_base_compose), .0525);
});
test('薇斯纳队友星耀祝礼进入瑞希单人配装目标', () => {
    const x = input();
    x.buffs = [named('VesnaTalent1', {atk: 2000, coverage: .75})];
    const target = {name:MIZUKI_STELLAR_TARGET,params:{[MIZUKI_STELLAR_TARGET]:{mode:0}}};
    const ranked = full.OptimizeSingleWasm.optimize({...x,target_function:target,algorithm:'Naive',constraint:null,filter:null},x.artifacts);
    close(ranked[0].value, damage(x,full).direct_stellarswirl.expectation);
});
test('七七六命只增加直接星扩散基础，不增加面板攻击或反应星扩散', () => {
    const x = input(6), off = damage(x); x.buffs = [named('QiqiC6StellarConduct', {atk: 2000})];
    const a = damage(x);
    close(sum(a.atk), sum(off.atk)); close(a.normal.expectation, off.normal.expectation);
    close(a.stellarswirl_anemo.expectation, off.stellarswirl_anemo.expectation);
    close(a.stellarswirl_cryo.expectation, off.stellarswirl_cryo.expectation);
    // Level, EM and reaction bonuses do not amplify the 6 × 2000 flat.
    // The default enemy has 10% Anemo RES; Mizuki C2 shreds 20%, giving
    // -10% effective resistance and the negative-RES multiplier 1.05.
    close(a.direct_stellarswirl.non_critical-off.direct_stellarswirl.non_critical,12000*1.05);
    const crit=Math.max(0,Math.min(1,sum(a.critical)+sum(a.critical_stellarswirl)));
    const cd=sum(a.critical_damage)+sum(a.critical_damage_stellarswirl);
    close(a.direct_stellarswirl.expectation-off.direct_stellarswirl.expectation,12000*1.05*(1+crit*cd));
    const stronger=clone(x);stronger.buffs.push(named('ElementalMastery',{value:500}),named('EnhanceStellarGlimmerReaction',{p:50}));
    const baseline=clone(stronger);baseline.buffs.shift();
    const high=damage(stronger),low=damage(baseline);
    close(high.direct_stellarswirl.non_critical-low.direct_stellarswirl.non_critical,12000*1.05);
});
test('等级1/20/70/80/90，C0/C1/C6及两种直伤的七七加值DSL与面板一致', () => {
    for(const level of [1, 20, 70, 80, 90]) for(const co of [0, 1, 6]) for(const idx of co ? [14, 15] : [14]) {
        const x = input(co, level); x.skill.index = idx;
        x.buffs = [named('QiqiC6StellarConduct', {atk: 1800}), named('QiqiTalent2StellarConduct'), named('YumemizukiMizukiC1', {em: 900})];
        const source = `dmg hit = YumemizukiMizuki.${idx === 14 ? 'TalentStellarSwirl' : 'C1StellarSwirl'}\nresult = hit.direct_stellarswirl.e`;
        const transformed = support.adjustStellarSupportDsl(source, x);
        assert.match(transformed.source,/stellarswirl_anemo/);
        // Invoke through the optimizer, whose callback recalculates each artifact candidate.
        const target = {name: 'YumemizukiMizukiDefault', params: 'NoConfig', use_dsl: true, dsl_source: source};
        const result = api.OptimizeSingleWasm.optimize({...x, target_function: target, algorithm: 'Naive', constraint: null, filter: null}, x.artifacts);
        close(result[0].value, damage(x).direct_stellarswirl.expectation);
        const q = clone(x); q.character.params.YumemizukiMizuki.c1_reaction_active = false;
        close(damage(q).direct_stellarswirl.expectation, damage(x).direct_stellarswirl.expectation);
    }
});
test('七七C6不改反应目标，自定义DSL可组合直接星扩散', () => {
    const x = input(1); x.buffs = [named('QiqiC6StellarConduct', {atk: 1000})];
    const source = 'dmg hit = YumemizukiMizuki.TalentStellarSwirl\nresult = hit.stellarswirl_cryo.e';
    assert.deepEqual(support.adjustStellarSupportDsl(source, x), {source, input: x});
    const custom='dmg hit = YumemizukiMizuki.TalentStellarSwirl\nresult = hit.direct_stellarswirl.e * 2 + hit.direct_stellarswirl.c + hit.direct_stellarswirl.n';
    const adjusted=support.adjustStellarSupportDsl(custom,x);
    assert.match(adjusted.source,/stellarswirl_anemo/);
    const target={name:'YumemizukiMizukiDefault',params:'NoConfig',use_dsl:true,dsl_source:custom};
    const result=api.OptimizeSingleWasm.optimize({...x,target_function:target,algorithm:'Naive',constraint:null,filter:null},x.artifacts);
    const direct=damage(x).direct_stellarswirl;
    close(result[0].value,direct.expectation*2+direct.critical+direct.non_critical);
    assert.deepEqual(support.adjustStellarSupportDsl('result = 1',x),{source:'result = 1',input:x});
    const mixed=clone(x);mixed.character.params.YumemizukiMizuki.c1_reaction_active=false;
    const mixSource='dmg hit = YumemizukiMizuki.TalentStellarSwirl\nresult = hit.direct_stellarswirl.e + hit.stellarswirl_anemo.e';
    const mix=api.OptimizeSingleWasm.optimize({...mixed,target_function:{...target,dsl_source:mixSource},algorithm:'Naive',constraint:null,filter:null},mixed.artifacts);
    const analyzed=damage(mixed);
    close(mix[0].value,analyzed.direct_stellarswirl.expectation+analyzed.stellarswirl_anemo.expectation);
    assert.throws(()=>support.adjustStellarSupportDsl(mixSource,x),/逐项保留/);
});
function sandrone(co=6) {
    const x=input();x.character={name:'Sandrone',level:90,ascend:false,constellation:co,skill1:9,skill2:9,skill3:9,params:{Sandrone:{stellar_base_active:true,em_conversion_active:true,c1_team_stellar:true,c6_elevate_active:true}}};
    x.weapon={name:'ForgedByTheGoldenMelody',level:90,ascend:false,refine:5,params:{ForgedByTheGoldenMelody:{state:2,counterpoint_active:false}}};
    x.skill={index:18,config:{Sandrone:{c2_ray_stacks:3,prism_overcharge:true,burst_tactics_stacks:10,stellarconduct_hits:0}}};
    x.buffs=[named('QiqiC6StellarConduct',{atk:2000}),named('QiqiTalent2StellarConduct'),named('DionaC6StellarConduct'),named('OdetteTalent1',{atk:1000,radiance_mode:2})];
    return x;
}
test('桑多涅直接星扩散的七七定额在基础/精通后、冰抗与擢升前',()=>{
    const withFlat=sandrone(),without=clone(withFlat);
    without.buffs=without.buffs.filter(b=>b.name!=='QiqiC6StellarConduct');
    const on=damage(withFlat),off=damage(without);
    // 12000 flat × 0.9 Cryo RES × 1.2 C6 Stellar elevation.
    close(on.direct_stellarswirl.non_critical-off.direct_stellarswirl.non_critical,12000*.9*1.2);
    const elevated=clone(withFlat);elevated.buffs.push(named('ElementalMastery',{value:500}),
        named('EnhanceStellarGlimmerReaction',{p:50}));
    const elevatedOff=clone(elevated);elevatedOff.buffs=elevatedOff.buffs.filter(b=>b.name!=='QiqiC6StellarConduct');
    close(damage(elevated).direct_stellarswirl.non_critical
        -damage(elevatedOff).direct_stellarswirl.non_critical,12000*.9*1.2);
});
test('桑多涅新技能可用于含多段结果的自定义 DSL',()=>{
    const x=sandrone(),config='{c2_ray_stacks: 3, prism_overcharge: true, burst_tactics_stacks: 10, stellarconduct_hits: 0}';
    const source=`dmg first = Sandrone.ChargedRayStellar(${config})\nresult = first.direct_stellarswirl.e * 2 + first.direct_stellarswirl.c + first.direct_stellarswirl.n`;
    const target={name:SANDRONE_STELLAR_TARGET,params:'NoConfig',use_dsl:true,dsl_source:source};
    const result=api.OptimizeSingleWasm.optimize({...x,target_function:target,algorithm:'Naive',constraint:null,filter:null},x.artifacts);
    const direct=damage(x).direct_stellarswirl;
    close(result[0].value,direct.expectation*2+direct.critical+direct.non_critical);
    const changed=clone(x);changed.artifacts[4].sub_stats.push(['ATKPercentage',.1]);
    const value=api.OptimizeSingleWasm.optimize({...changed,target_function:target,algorithm:'Naive',constraint:null,filter:null},changed.artifacts)[0].value;
    const next=damage(changed).direct_stellarswirl;
    close(value,next.expectation*2+next.critical+next.non_critical);
    const combined=`dmg first = Sandrone.ChargedRayStellar(${config})\ndmg second = Sandrone.SkillPrismStellar(${config})\nresult = first.direct_stellarswirl.e + second.direct_stellarswirl.e`;
    const both=api.OptimizeSingleWasm.optimize({...x,target_function:{...target,dsl_source:combined},algorithm:'Naive',constraint:null,filter:null},x.artifacts)[0].value;
    const prism=clone(x);prism.skill.index=19;
    close(both,direct.expectation+damage(prism).direct_stellarswirl.expectation);
    const short='dmg first = Sandrone.ChargedRayStellar({c2_ray_stacks: 3})\nresult = first.direct_stellarswirl.e';
    const shortResult=api.OptimizeSingleWasm.optimize({...x,target_function:{...target,dsl_source:short},algorithm:'Naive',constraint:null,filter:null},x.artifacts);
    close(shortResult[0].value,direct.expectation);
    const playground=clone(x);delete playground.artifacts;delete playground.skill;
    const printed=api.DSLInterface.run(`dmg first = Sandrone.ChargedRayStellar(${config})\nprint(first.direct_stellarswirl.e)`,playground,x.artifacts);
    assert.equal(printed.is_error,false);
    close(Number(printed.output.match(/[0-9]+(?:\.[0-9]+)?/)[0]),direct.expectation);
});
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
    const b=x.artifacts.map((v,i)=>({...v,id:i+6,set_name:'HeartOfTheFurnace',sub_stats:[...v.sub_stats,['ATKPercentage',.1],['ElementalMastery',30],['CriticalRate',.04]]}));
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
    const after=damage(x,full),skillBase=sum(before.atk)*sum(before.atk_ratio);
    close(sum(after.direct_stellarswirl_base_compose)-sum(before.direct_stellarswirl_base_compose),.14);
    close(sum(after.direct_stellarswirl_compose)-sum(before.direct_stellarswirl_compose),.8);
    close(sum(after.direct_stellarswirl_extra_fixed),12100);
    // Direct Stellar Swirl: ATK × ratio × base bonus × EM/reaction bonus,
    // then flat increases, then RES, CRIT and elevation. Both cases share the
    // last three multipliers, so only the pre-RES amount changes here.
    const preResistance=(analysis)=>skillBase*(1+sum(analysis.direct_stellarswirl_base_compose))
        *(1+sum(analysis.direct_stellarswirl_compose))+sum(analysis.direct_stellarswirl_extra_fixed);
    const expected=before.direct_stellarswirl.expectation*preResistance(after)/preResistance(before);
    close(after.direct_stellarswirl.expectation,expected);
});
test('薇斯纳本人已有固有天赋，不重复叠加自己的可选队友增益',()=>{
    const x=sandrone(0);x.character={name:'Vesna',level:90,ascend:false,constellation:0,skill1:9,skill2:9,skill3:9,params:{Vesna:{stance:true,radiance:true,disciplinary_stacks:6,anemo_cryo_count:1,other_count:0,flat_inside_discipline:false}}};
    x.weapon={name:'NewBough',level:90,ascend:false,refine:5,params:{NewBough:{stacks:3,rate:.5,radiance:true}}};
    x.skill={index:17,config:'NoConfig'};x.artifacts=[];x.buffs=[];
    const own=damage(x,full);
    x.buffs=[named('VesnaTalent1',{atk:3000,coverage:1})];
    close(damage(x,full).direct_stellarswirl.expectation,own.direct_stellarswirl.expectation);
});
if(process.env.UPDATE_STELLAR_SNAPSHOT)
    fs.writeFileSync(new URL('../beta-data/stellar-support-tests.json', import.meta.url), JSON.stringify({tests}, null, 2) + '\n');
if(tests.some(t => !t.pass)) process.exitCode = 1;
