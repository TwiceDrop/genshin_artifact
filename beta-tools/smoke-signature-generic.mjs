import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {bindings} from '../mona_wasm/pkg/bindings.js';
import * as bridge from '../mona_wasm/pkg/mona_wasm_bg.js';
import * as extension from '../mona_wasm/extension/mona_extension.js';
import {createFacade} from '../beta-data/facade.mjs';
import {createBeta2} from '../beta-data/vesna-facade.mjs';
import {createLimitedWeaponFacade} from '../beta-data/limited-weapon-facade.mjs';

globalThis.module={require:createRequire(import.meta.url)};
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url),'utf8').replace(/^(?:\s*\/\/[^\n]*\n)*\s*export default\s*/,''));
bindings.lI(new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(new URL('../mona_wasm/pkg/mona_wasm_bg.wasm',import.meta.url))),{'./mona_wasm_bg.js':bridge}).exports);
extension.initSync(fs.readFileSync(new URL('../mona_wasm/extension/mona_extension_bg.wasm',import.meta.url)));
const original={CommonInterface:bindings.Ps,CalculatorInterface:bindings.K2,OptimizeSingleWasm:bindings.E2,BonusPerStat:bindings.bd,TeamOptimizationWasm:bindings.B8,DSLInterface:bindings.ZB};
const support=read('beta-data/extension-support.json');
const signatures=read('beta-data/weapons-signature-release-71.json');
const base=createBeta2(createFacade(original,extension,read('beta-data/vodyanitsa.json'),support,read('src/assets/_gen_character.js')),extension,support);
const api=createLimitedWeaponFacade(base,original,read('beta-data/weapons-release-71.json'),signatures);
const sum=x=>Object.values(x||{}).reduce((a,b)=>a+b,0);
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
function equip(character,name,params,refine=1){return {character:{name:character,level:90,ascend:false,constellation:0,skill1:9,skill2:9,skill3:9,params:'NoConfig'},weapon:{name,level:90,ascend:false,refine,params:{[name]:params}},skill:{index:0,config:'NoConfig'},artifacts:[],artifact_config:null,enemy:null,buffs:[]};}
const hymn=(c,params={},refine=1)=>equip(c,'HymnOfTheMaelstrom',{hp:0,stacks:0,boosted:false,on_field:true,...params},refine);
const chrysalis=(c,params={},refine=1)=>equip(c,'BeyondTheChrysalis',{loyal_rate:0,rebel_rate:0,plenty_rate:0,on_field:true,...params},refine);

// Every published level, including both sides of each ascension, must survive
// the old-core carrier without losing the real secondary stat.
for(const [name,character,fixture,secondary] of [
    ['HymnOfTheMaelstrom','Neuvillette',hymn,'hp'],
    ['BeyondTheChrysalis','Kaeya',chrysalis,'critical_damage'],
]){
    const weapon=signatures.weapons.find(w=>w.name===name);
    assert.equal(weapon.levels.length,96);
    for(const row of weapon.levels){
        const x=fixture(character);x.weapon.level=row.level;x.weapon.ascend=row.ascend;
        const a=api.CommonInterface.get_attribute(x);
        // The published old WASM interpolates weapon ATK between breakpoints;
        // its carrier differs by at most 1.37 before level 90.
        assert.ok(Math.abs(a.atk['武器基础攻击']-row.attack)<1.4);
        if(row.level===90)close(a.atk['武器基础攻击'],row.attack);
        if(secondary==='hp'){
            close(sum(a.hp),a.hp['角色基础生命']*(1+row.subStat));
            close(sum(a.elemental_mastery),0);
        }else close(sum(a.critical_damage),.5+row.subStat);
    }
}
const loyal=chrysalis('Kaeya',{loyal_rate:100,rebel_rate:100,plenty_rate:50});
let result=api.CommonInterface.get_attribute(loyal);
close(sum(result.critical_damage),.5+.441+.56);
close(result.weapon_effects.stellarSwirlBonus,.36);
close(result.weapon_effects.energyPerFourSeconds,2.5);
loyal.weapon.params.BeyondTheChrysalis.on_field=false;
close(sum(api.CommonInterface.get_attribute(loyal).critical_damage),.5+.441);
assert.ok(api.CalculatorInterface.get_damage_analysis(loyal,null).normal);

const boosted=hymn('Neuvillette',{hp:60000,stacks:3,boosted:true},5);
result=api.CommonInterface.get_attribute(boosted);
close(sum(result.atk),result.atk['角色基础攻击']+result.atk['武器基础攻击']+(.84*(result.atk['角色基础攻击']+result.atk['武器基础攻击'])));
close(sum(result.hp),result.hp['角色基础生命']*(1+.6615+.42));
close(sum(result.healing_bonus),.08);
boosted.weapon.params.HymnOfTheMaelstrom.on_field=false;
close(sum(api.CommonInterface.get_attribute(boosted).atk),750);
close(sum(api.CommonInterface.get_attribute(boosted).hp),sum(result.hp));
assert.ok(api.CalculatorInterface.get_damage_analysis(boosted,null).normal);

for(const c of ['Neuvillette','Odette']){
    const a=api.CommonInterface.get_attribute(hymn(c));
    close(a.atk['武器基础攻击'],542);
    assert.ok(a.hp['角色基础生命']>0);
    assert.ok(api.CalculatorInterface.get_damage_analysis(hymn(c),null).normal);
}
const candidates=read('beta-data/mizuki-fixture.json').input.artifacts.map(a=>({...a,set_name:'GladiatorsFinale'}));
for(const x of [chrysalis('Kaeya',{loyal_rate:100}),hymn('Neuvillette',{hp:60000,stacks:3},3)]){
    x.artifacts=candidates;
    const baseline=sum(api.CommonInterface.get_attribute(x).atk);
    const target={name:'MaxATK',params:'NoConfig'};
    const optimized=api.OptimizeSingleWasm.optimize({...x,target_function:target,algorithm:'Naive',constraint:null,filter:null},candidates);
    assert.ok(optimized.length);
    close(optimized[0].value,baseline);
    const bonus=api.BonusPerStat.bonus_per_stat({...x,tf:target,artifacts_config:x.artifact_config});
    assert.equal(bonus.atk_percentage.length,10);
    assert.ok(bonus.atk_percentage.every(Number.isFinite));
    assert.ok(api.CalculatorInterface.get_damage_analysis(x,null).normal);
}
console.log('PASS generic 7.1 signature weapons: published 96-level curves, self effects and legacy characters');
