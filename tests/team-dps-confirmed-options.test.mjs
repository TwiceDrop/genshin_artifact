import test from 'node:test';
import assert from 'node:assert/strict';
import {api} from '../beta-tools/runtime-7106.mjs';
import {fixture,weapon} from '../beta-tools/interface-audit-7108.mjs';
import {TEAM_DPS_ROLES,parseTeamDpsConfiguration} from '../beta-data/team-dps-config.mjs';
import {compileTeamDpsAxis} from '../beta-data/team-dps-rotation.mjs';
import {createEquipmentAxisRules} from '../beta-data/equipment-axis-rules.mjs';
import {equipmentDamageEvents} from '../beta-data/equipment-damage-events.mjs';
import {equipmentEnergy,equipmentWeakpoint} from '../beta-data/equipment-combat-facts.mjs';
import {defaultWeaponOptions,MANUAL_WEAPON_OPTIONS} from '../beta-data/team-dps-weapon-options.mjs';
import {evaluateTeamDps} from '../beta-data/team-dps-optimizer.mjs';
import {importedAxis} from './helpers/team-dps-configuration.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const sum=x=>Object.values(x).reduce((a,b)=>a+b,0);
const profiles=()=>['Amber','Noelle','Kirara','Furina'].map(n=>fixture(n));
const event=(time,role=0,extra={})=>({time,role,rootOrder:time*100,order:time*100,category:'normal',onField:true,...extra});
function rotation(roots=[],events=[],initial=0){
 const switches=roots.filter(h=>h.kind==='switch');let prev=initial;for(const h of switches){h.from=prev;prev=h.role;}
 const occurred=(h,t,order=Infinity)=>h.time<t||(h.time===t&&h.rootOrder<=order);
 return {roots,events,switches,heals:[],bonds:[],hpChanges:[],slots:['a','b','c','d'],duration:60,endHit:'include',
  activeRole:(t,order)=>switches.filter(h=>occurred(h,t,order)).at(-1)?.role??initial,
  lastCast:(r,kind,t,order)=>Math.max(-Infinity,...roots.filter(h=>h.role===r&&h.kind==='cast'&&h.action===kind&&occurred(h,t,order)).map(h=>h.time)),
  entered:(t,order)=>switches.filter(h=>occurred(h,t,order)).at(-1)?.time??0};
}
function prepared(p,rot,r,e,settings={}){const rules=createEquipmentAxisRules(p,rot,settings);return {rules,p:rules.prepare(structuredClone(p[r]),r,e)};}
function damage(p,rot,r,e,settings={}){
 const rules=createEquipmentAxisRules(p,rot,settings),builds=p.map(x=>x.artifacts);
 const base=p.map((x,j)=>{const q=rules.prepare(structuredClone(x),j,e);q.buffs=rules.baseBuffs(builds,j,e);return q;});
 const panels=base.map(x=>api.CommonInterface.get_attribute(x));
 const input=base[r];input.buffs.push(...rules.derivedBuffs(builds,r,e,panels,()=>panels));
 return api.CalculatorInterface.get_damage_analysis(input,null);
}
test('confirmed V1: energy spending, zero balance, native manual ratios and source snapshots',()=>{
 const p=profiles(),roots=[event(2,0,{kind:'cast',action:'burst'}),event(3,1,{kind:'cast',action:'burst'}),event(4,0,{kind:'cast',action:'burst'})];
 p[1].weapon=weapon('KatsuragikiriNagamasa');const rot=rotation(roots,[event(1,1,{category:'skill'}),event(2,1,{category:'skill'}),event(12,1,{category:'skill'})]);
 const en=equipmentEnergy(p,rot);assert.deepEqual(en.histories[1].rows.map(h=>h.amount),[3,57]);assert.equal(en.at(1,event(1.1)).current,57);assert.equal(en.at(1,event(3.1)).zero,true);
 p[1]=fixture('Mavuika');p[1].weapon=weapon('KatsuragikiriNagamasa');assert.equal(equipmentEnergy(p,rot).histories[1].rows.length,0);
 p[1]=fixture('Noelle');
 p[0].weapon=weapon('Cloudforged');let q=prepared(p,rot,0,event(4.1)).p;assert.equal(q.weapon.params.Cloudforged.stack,1);
 for(const [r,n]of [[0,'MouunsMoon'],[1,'Akuoumaru']]){
  p[r].weapon=weapon(n);const conditions=p.map(()=>defaultWeaponOptions());conditions[r][n].rate=.5;
  // The shared public BUFF affects burst only; compare its actual attribute entry.
  const rules=createEquipmentAxisRules(p,rot,{weapon_conditions:conditions});const buff=rules.baseBuffs(p.map(x=>x.artifacts),r,event(1)).find(x=>x.config.ExtensionEffect.label===n);near(buff.config.ExtensionEffect.values.BonusElementalBurst,.2);
  const x=rules.prepare(structuredClone(p[r]),r,event(1));x.buffs=[buff];x.skill.index=11;
  const high=api.CalculatorInterface.get_damage_analysis(x,null);x.buffs=[];const low=api.CalculatorInterface.get_damage_analysis(x,null);near(sum(high.bonus)-sum(low.bonus),.2);assert.equal(q.character.name,'Amber');
 }
 p[0].weapon=weapon('Slingshot');const conditions=p.map(()=>defaultWeaponOptions());let a=damage(p,rot,0,event(1),{weapon_conditions:conditions});conditions[0].Slingshot.close_rate=.5;const b=damage(p,rot,0,event(1),{weapon_conditions:conditions});near(sum(b.bonus)-sum(a.bonus),.23);
 p[0].weapon=weapon('AmosBow');const base=damage(p,rot,0,event(1),{weapon_conditions:conditions});conditions[0].AmosBow.stack=3;near(sum(damage(p,rot,0,event(1),{weapon_conditions:conditions}).bonus)-sum(base.bonus),.24);
 assert.ok(MANUAL_WEAPON_OPTIONS.TalkingStick.length===2);assert.equal(MANUAL_WEAPON_OPTIONS.UltimateOverlordsMegaMagicSword[0].scale,100);
 for(const n of ['TalkingStick','UltimateOverlordsMegaMagicSword']){
  p[1].weapon=weapon(n);const low=damage(p,rotation(),1,event(0),{weapon_conditions:conditions}),baseAttack=low.atk['角色基础攻击']+low.atk['武器基础攻击'];
  if(n==='TalkingStick'){conditions[1][n].rate1=.5;conditions[1][n].rate2=.25;}else conditions[1][n].rate=.5;
  const high=damage(p,rotation(),1,event(0),{weapon_conditions:conditions});near(sum(high.atk)-sum(low.atk),baseAttack*(n==='TalkingStick'?.08:.06));
 }
 const saved=JSON.stringify(p);prepared(p,rot,0,event(2));assert.equal(JSON.stringify(p),saved);
});

test('confirmed V2: field timers, phase timers, aim/weakpoint and declared import facts',()=>{
 const p=profiles(),switches=[event(10,0,{kind:'switch'}),event(16,1,{kind:'switch'}),event(19,0,{kind:'switch'})],rot=rotation(switches,[],1);
 p[0].weapon=weapon('AlleyHunter');const stack=t=>prepared(p,rot,0,event(t)).p.weapon.params.AlleyHunter.stack;
 assert.equal(stack(0),0);assert.equal(stack(9.9),9);assert.equal(stack(10.1),10);assert.equal(stack(14),8);assert.equal(stack(16.1),4);assert.equal(stack(19.1),7);
 p[0].weapon=weapon('SerpentSpine');assert.equal(prepared(p,rot,0,event(14)).p.weapon.params.SerpentSpine.stack,1);assert.equal(prepared(p,rot,0,event(19.1)).p.weapon.params.SerpentSpine.stack,1);
 const shortSwap=rotation([event(3,1,{kind:'switch'}),event(3.5,0,{kind:'switch'})]);assert.equal(prepared(p,shortSwap,0,event(4.1)).p.weapon.params.SerpentSpine.stack,1);
 const phase=rotation([], [event(0),event(6.9),event(7),event(13.9),event(14)],0);p[0].weapon=weapon('FadingTwilight');const at=t=>prepared(p,phase,0,event(t)).p.weapon.params.FadingTwilight.state;
 assert.equal(at(6.99),0);assert.equal(at(7.01),1);assert.equal(at(14.01),2);
 p[1].weapon=weapon('ForgedByTheGoldenMelody');phase.events.push(event(9,1,{stellar:true}),event(12,1,{stellar:true}));
 const melody=t=>prepared(p,phase,1,event(t)).p.weapon.params.ForgedByTheGoldenMelody;
 assert.equal(melody(0).state,0);assert.equal(melody(10).state,1);assert.equal(melody(20).state,2);assert.equal(melody(10).counterpoint_state,1);assert.equal(melody(21).counterpoint_active,false);
 const aim=rotation([event(0,0,{kind:'aim',phase:'start'}),event(.2,0,{kind:'aim',phase:'shot'}),event(.4,0,{kind:'aim',phase:'shot'}),event(.7,0,{kind:'aim',phase:'shot'}),event(1,0,{kind:'aim',phase:'end'}),event(5,0,{kind:'aim',phase:'start'}),event(5.1,0,{kind:'aim',phase:'shot'}),event(5.5,0,{kind:'aim',phase:'end'})]);
 p[0].weapon=weapon('FlowerWreathedFeathers');const aimed=t=>prepared(p,aim,0,event(t)).p.weapon.params.FlowerWreathedFeathers.stack;
 assert.equal(aimed(.19),0);assert.equal(aimed(.41),1);assert.equal(aimed(1.01),2);assert.equal(aimed(5.51),3);assert.equal(aimed(15.5),0);
 const weak=event(1,0,{category:'charged',weakpoint:true}),hits=rotation([],[weak,event(2,0,{category:'charged',weakpoint:true}),event(11,0,{category:'charged',weakpoint:true})]);
 p[0].weapon=weapon('PrototypeCrescent');assert.equal(prepared(p,hits,0,event(2.1)).p.weapon.params.PrototypeCrescent.rate,1);assert.equal(prepared(p,hits,0,event(21)).p.weapon.params.PrototypeCrescent.rate,0);
 p[0].weapon=weapon('Messenger');const procs=equipmentDamageEvents(p,p.map(x=>x.artifacts),hits,()=>0).procs;assert.equal(procs.length,2);assert.ok(procs.every(h=>h.forceCritical));near(procs[0].ratio,1);
 assert.equal(equipmentWeakpoint(p[0],weak),true);assert.equal(equipmentWeakpoint(p[1],weak),false);
 p[0].weapon=weapon('DaybreakChronicles');const db=rotation([event(2,1,{kind:'switch'}),event(6,0,{kind:'switch'})],[event(.5,0,{category:'normal'})]);const bonus=t=>createEquipmentAxisRules(p,db).baseBuffs(p.map(x=>x.artifacts),0,event(t)).find(x=>x.config.ExtensionEffect.label.includes('渐起')).config.ExtensionEffect.values;
 near(bonus(.6).BonusNormalAttack,.1);near(bonus(1.1).BonusNormalAttack,0);near(bonus(5.1).BonusElementalSkill,.6);near(bonus(7.1).BonusElementalSkill,.5);
 const axis=importedAxis();axis.timeline.push({id:'aim-new',kind:'aim',phase:'start',actor:'carry',timeMs:9000},{id:'leaf-new',kind:'pickup',item:'leaf',source:'support',actor:'carry',timeMs:9500});axis.timeline.find(h=>h.kind==='hit').weakpoint=true;
 const compiled=compileTeamDpsAxis(parseTeamDpsConfiguration(JSON.stringify(axis)),TEAM_DPS_ROLES.map(n=>fixture(n)));assert.ok(compiled.roots.some(h=>h.kind==='aim'));assert.ok(compiled.roots.some(h=>h.kind==='pickup'));assert.ok(compiled.events.some(h=>h.weakpoint));
});

test('confirmed V3: pickup ownership, crystallize, live mastery conversion and four-role scoring',()=>{
 const p=profiles();p[2].weapon=weapon('SapwoodBlade');
 const roots=[event(1,0,{kind:'pickup',item:'leaf',source:'c'}),event(2,1,{kind:'pickup',item:'leaf',source:'c'})],hits=[event(.5,2,{category:'skill',element:'Dendro'}),event(3,1,{category:'skill',element:'Geo'})];
 const rot=rotation(roots,hits,1),rules=createEquipmentAxisRules(p,rot),buffs=r=>rules.baseBuffs(p.map(x=>x.artifacts),r,event(2.5));
 assert.equal(rules.pickups.leaves.length,1);near(buffs(0).find(x=>x.config.ExtensionEffect.label==='种识之叶').config.ExtensionEffect.values.ElementalMastery,60);assert.equal(buffs(1).some(x=>x.config.ExtensionEffect.label==='种识之叶'),false);
 p[1].weapon=weapon('Verdict');p[1].artifacts.forEach(a=>a.set_name='ArchaicPetra');const cr=createEquipmentAxisRules(p,rot);assert.equal(cr.pickups.crystals.length,1);assert.equal(cr.pickups.crystals[0].role,1);
 assert.equal(cr.prepare(structuredClone(p[1]),1,event(3.1)).weapon.params.Verdict.stack,1);assert.equal(cr.prepare(structuredClone(p[1]),1,event(3.2)).weapon.params.Verdict.stack,0);
 const petra=cr.baseBuffs(p.map(x=>x.artifacts),0,event(3.1)).find(x=>x.config.ExtensionEffect.label==='悠古的磐岩4').config.ExtensionEffect.values;near(petra.BonusPyro,.35);near(petra.BonusHydro,.35);assert.equal(petra.BonusDendro,undefined);
 const physical=rotation([], [event(3,1)]);assert.equal(createEquipmentAxisRules(p,physical).pickups.crystals.length,0);
 const physicalDendro=rotation([], [event(.5,2)],1);assert.equal(createEquipmentAxisRules(p,physicalDendro).reactions.length,0);
 p[1].weapon=weapon('MakhairaAquamarine');p[1].artifacts.forEach(a=>a.set_name='GladiatorsFinale');const old=damage(p,rotation(),0,event(0)),self=damage(p,rotation(),1,event(0));p[1].artifacts[0].sub_stats.push(['ElementalMastery',500]);
 near(sum(damage(p,rotation(),0,event(0)).atk)-sum(old.atk),36);near(sum(damage(p,rotation(),1,event(0)).atk)-sum(self.atk),120);
 p[0].weapon=weapon('AquaSimulacra');assert.equal(prepared(p,rotation(),0,event(10)).p.weapon.params.AquaSimulacra.is_enemy_around,true);
 p[0].weapon=weapon('RecurveBow');p[1].weapon=weapon('WhiteIronGreatsword');assert.equal(equipmentDamageEvents(p,p.map(x=>x.artifacts),rotation(),()=>0).procs.length,0);
 const team=TEAM_DPS_ROLES.map((n,r)=>{const x=fixture(n);x.artifacts.forEach(a=>a.id+=100*r);return x;}),input={single_interfaces:team,team_dps:{axis:importedAxis(),enemy:{level:100},initial_ids:team.map(p=>p.artifacts.map(a=>a.id))}};
 const saved=JSON.stringify(input),out=evaluateTeamDps(api,input,team.flatMap(p=>p.artifacts));assert.ok(out.baseline.expectation>0);assert.equal(JSON.stringify(input),saved);
});
