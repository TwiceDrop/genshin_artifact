import test from 'node:test';
import assert from 'node:assert/strict';
import {api} from '../beta-tools/runtime-7106.mjs';
import {createActionAxis} from '../beta-data/team-engine/action-config.mjs';
import {createSkillMultiplierPreview} from '../beta-data/team-engine/multiplier-preview.mjs';
import {fixture} from '../beta-tools/interface-audit-7108.mjs';
const names=['Skirk','Furina','Escoffier','Vodyanitsa'];
const a=(id,r,action,timeMs,params)=>({id,kind:'action',actor:'member'+r,action,timeMs,...(params?{params}:{})});
const axis=timeline=>({...createActionAxis('synthetic-preview',names),timeline});
const near=(x,y)=>assert.ok(Math.abs(x-y)<1e-9*Math.max(1,Math.abs(y)),`${x} != ${y}`);
const total=x=>Object.values(x).reduce((a,b)=>a+b,0);
function native(name,index,config,level=9){const p=fixture(name);Object.assign(p.character,{constellation:0,skill1:level,skill2:level,skill3:level});p.character.params=name==='Skirk'?{Skirk:{death_crossing_stacks:0,team_has_hydro_cryo:false,c2_atk_bonus:false}}:{Vodyanitsa:{e_active:false,song_active:false,ordinary_mode:true,c1_active:false,c2_active:false,c4_stacks:0,on_field:true}};p.artifacts=[];p.buffs=[];p.skill={index,config};return api.CalculatorInterface.get_damage_analysis(p,null);}

test('preview: six Q hits use native per-hit coefficients and exact tail exclusion',()=>{
 const c=axis([a('q',1,'burst',2000)]),p=createSkillMultiplierPreview(api,c),r=p.roles[0];
 const config={Skirk:{cunning_stacks:0,seven_phase_mode:false,death_crossing_stacks:0,void_rift_count:0}};
 const slash=total(native('Skirk',15,config).atk_ratio),final=total(native('Skirk',16,config).atk_ratio);
 assert.equal(r.hits.length,6);for(const h of r.hits.slice(0,5))near(h.base.atk,slash);near(r.hits[5].base.atk,final);near(r.base.atk,5*slash+final);near(p.duration,2+158/60);
 c.endHit='exclude';const excluded=createSkillMultiplierPreview(api,c);assert.equal(excluded.roles[0].hits.length,5);near(excluded.roles[0].base.atk,5*slash);
});

test('preview: HP burst Song multiplier only scales native talent, separate stats stay separate',()=>{
 const c=axis([a('e',4,'skill',0),a('q',4,'burst',1000)]),p=createSkillMultiplierPreview(api,c),q=p.roles[3].hits.find(h=>h.eventId==='q/burst');
 const base=total(native('Vodyanitsa',11,{Vodyanitsa:{low_hp_heal:false,q_song_bonus:false}}).hp_ratio);
 near(q.base.hp,base);near(q.effective.hp,base*1.864);assert.equal(q.base.atk,0);assert.equal(q.modifiers.length,1);
 near(p.roles[3].effective.hp,p.roles[3].hits.reduce((n,h)=>n+h.effective.hp,0));
});

test('preview: same-time exits, conditions, independent summons and C6 additions',()=>{
 const ordered=axis([a('e',1,'skill',0),a('n',1,'normal.3',1000),a('leave',2,'normal.1',1000)]),p=createSkillMultiplierPreview(api,ordered);assert.equal(p.roles[0].hits.length,2);assert.ok(p.roles[0].hits.every(h=>h.element==='Cryo'&&h.onField));
 const conditional=axis([{...a('e',1,'skill',0),when:{constellationAtLeast:6}},a('q',1,'burst',1000)]);assert.equal(createSkillMultiplierPreview(api,conditional).roles[0].hits.length,6);
 const characters=names.map(name=>({name,level:90,ascend:false,constellation:name==='Skirk'?6:0,skill1:9,skill2:9,skill3:9}));assert.equal(createSkillMultiplierPreview(api,conditional,characters).roles[0].hits.length,0);
 const c=axis([a('f',2,'skill',0),a('ec',3,'skill',0),a('v',4,'skill',0),a('hold',1,'skill.hold',1000,{absorbedRifts:3}),a('e',1,'skill',1100),a('q',1,'burst',1200),a('n',1,'normal.3',3000)]),before=JSON.stringify({c,characters}),out=createSkillMultiplierPreview(api,c,characters);
 const c6=out.roles[0].hits.filter(h=>h.label==='虚境裂隙·六命');assert.equal(c6.length,3);c6.forEach(h=>{near(h.base.atk,1.8);near(h.effective.atk,1.8*1.7);});assert.equal(JSON.stringify({c,characters}),before);
 assert.deepEqual(out.roles[1].hits.map(h=>h.label),['荒性泡沫','海薇玛夫人','谢贝蕾妲小姐','乌瑟勋爵']);out.roles[1].hits.forEach((h,i)=>near(h.time,[.3,110/60,131/60,133/60][i]));assert.ok(out.roles[1].hits.every(h=>!h.onField));
 assert.equal(out.roles[1].character.skill2,10);assert.ok(out.roles.every(r=>Object.values(r.effective).every(Number.isFinite)));
});
