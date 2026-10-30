import test from 'node:test';
import assert from 'node:assert/strict';
import {api} from '../beta-tools/runtime-7106.mjs';
import {fixture} from '../beta-tools/interface-audit-7108.mjs';
import {createActionAxis} from '../beta-data/team-engine/action-config.mjs';
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';
import {normalizeEnemy} from '../beta-data/enemy-interface.mjs';

const close=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=Math.max(1e-8,Math.abs(b)*1e-10),`${a} != ${b}`);
const action=(r,a,t)=>({kind:'action',actor:'member'+(r+1),action:a,timeMs:t*1000});
const end=t=>({kind:'switch',actor:'member4',timeMs:t*1000});
function input(names,rows){
 const axis=createActionAxis('synthetic-oracle',names);axis.timeline=rows.map((a,i)=>({...a,id:'a'+i}));
 return {single_interfaces:names.map(n=>{const p=fixture(n);p.artifacts=[];return p;}),team_dps:{axis,enemy:normalizeEnemy({level:100}),enemy_count:1,damage_scope:'single'}};
}
const run=x=>createTeamDpsEvaluator(api,x).evaluate(x.single_interfaces.map(p=>p.artifacts),true);
const star=x=>run(x).hits.find(h=>h.role===0&&h.index===12);

test('direct SSC has an independent numerical oracle and ignores ordinary bonus and defense',()=>{
 const x=input(['Odette','Alyosha','Qiqi','Mona'],[action(1,'skill',0),action(0,'skill',.5),action(0,'skill',1.2),end(3)]);
 const hit=star(x),atk=334.85+185;
 // Native level-10 talent 550.37%; four self Splendor stacks; no settled field
 // window yet; source blessing remains below cap; Cryo aura grants resonance.
 const nonCrit=atk*5.5037*(1+atk*.00007)*(1+.15*4)*.9;
 close(hit.non_critical,nonCrit);close(hit.expectation,nonCrit*(1+.2*.884));
 const y=structuredClone(x);y.single_interfaces[0].buffs=[{name:'ExtensionEffect',config:{ExtensionEffect:{label:'synthetic ordinary-only',values:{BonusCryo:4,BonusElementalSkill:3,BonusBase:2,DefMinus:.9,CriticalElementalSkill:.5,CriticalDamageElementalSkill:3}}}}];y.team_dps.enemy.level=1;
 close(star(y).expectation,hit.expectation);
 assert.equal(hit.analysis.direct_stellarconduct_base_multiplier,1);
});

test('Sandrone ray uses native talent once, two independently derived blessings, EM conversion and C2 ray stacks',()=>{
 const x=input(['Sandrone','Alyosha','Qiqi','Odette'],[action(1,'burst',0),action(3,'skill',.5),action(0,'charged',1),end(5)]);
 const h=run(x).hits.find(h=>h.role===0&&h.index===5),atk=342.03+185,odetteAtk=334.85+185,em=atk*.08;
 // At 2.5 s Odette has transferred one of her four stacks off field.
 const expected=atk*1.615*(1+(atk+odetteAtk)*.00007)*(1+.15+6*em/(2000+em))*.9;
 close(h.non_critical,expected);
 x.single_interfaces[0].character.constellation=2;
 const hits=run(x).hits.filter(h=>h.role===0&&h.index===5);
 assert.deepEqual(hits.map(h=>h.crit_damage),[1.1,1.3,1.5]);
 close(hits[0].non_critical,atk*1.615*(1+(atk+odetteAtk)*.00007)*(1+.15+.3+6*em/(2000+em))*.9);
 const ordinary=structuredClone(x);ordinary.single_interfaces[0].buffs=[{name:'ExtensionEffect',config:{ExtensionEffect:{label:'ordinary CA only',values:{CriticalChargedAttack:.5,CriticalDamageChargedAttack:4,BonusChargedAttack:3}}}}];
 close(run(ordinary).hits.find(h=>h.role===0&&h.index===5).expectation,hits[0].expectation);
});

test('Qiqi C2 adds 50% base ATK under radiance, not native 0.5 flat',()=>{
 const x=input(['Odette','Alyosha','Qiqi','Mona'],[action(1,'skill',0),action(0,'skill',.5),action(2,'normal.1',1),end(2)]);
 const c0=run(x).hits.find(h=>h.role===2&&h.index===0);
 x.single_interfaces[2].character.constellation=2;
 const c2=run(x).hits.find(h=>h.role===2&&h.index===0);
 close(c2.atk-c0.atk,(287+185)*.5);
});

test('ordinary superconduct uses 1.5x actual level base and no crit/ATK/defense scaling',()=>{
 const x=input(['Qiqi','Alyosha','Furina','Mona'],[action(1,'skill',0),action(0,'skill',1),end(3)]);
 const h=run(x).hits.find(h=>h.damageKind==='superconduct');
 close(h.non_critical,1446.8535*1.5*.9);close(h.expectation,h.non_critical);close(h.critical,h.non_critical);
 x.single_interfaces[0].buffs=[{name:'ExtensionEffect',config:{ExtensionEffect:{label:'synthetic reaction',values:{ATKFixed:10000,CriticalBase:1,CriticalDamageBase:4,ElementalMastery:500,EnhanceSuperconduct:.5}}}}];
 const next=run(x).hits.find(h=>h.damageKind==='superconduct');
 close(next.expectation,1446.8535*1.5*(1+16*500/2500+.5)*.9);
});

test('Furnace requires wearer trigger and grants one shared 50% plus only wearer 12% ATK',()=>{
 const x=input(['Odette','Alyosha','Qiqi','Mona'],[action(1,'skill',0),action(0,'skill',.5),action(0,'skill',1.2),end(3)]);
 const equipment=(name,first)=>['Flower','Feather','Sand','Goblet'].map((slot,i)=>({id:first+i,set_name:name,slot,level:20,star:5,main_stat:['HPFixed',0],sub_stats:[]}));
 x.single_interfaces[0].artifacts=equipment('HeartOfTheFurnace',100);
 const h=star(x),atk=(334.85+185)*1.3;
 close(h.atk,atk);close(h.non_critical,atk*5.5037*(1+atk*.00007)*(1+.6+.5)*.9);
 // A second wearer without a reaction cannot create or stack the team bonus.
 x.single_interfaces[2].artifacts=equipment('HeartOfTheFurnace',200);
 close(star(x).non_critical,h.non_critical);
 const first=run(x).hits.find(h=>h.role===1);
 close(first.analysis.bonus['炉火之心4·星伤']??0,0);
});
