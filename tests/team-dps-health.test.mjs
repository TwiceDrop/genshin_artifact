import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {resolveEquipmentHealing} from '../beta-data/equipment-healing-events.mjs';
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';
import {optimizeTeamDps,evaluateTeamDps} from '../beta-data/team-dps-optimizer.mjs';
import {sample,builds,run,gear,sum,inspect} from '../beta-tools/team-dps-full-audit.mjs';
import {weapon} from '../beta-tools/interface-audit-7108.mjs';
import {api} from '../beta-tools/runtime-7106.mjs';
import vm from 'node:vm';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const save=(name,data)=>{fs.mkdirSync('.build-target/team-dps-health-20261027',{recursive:true});fs.writeFileSync('.build-target/team-dps-health-20261027/'+name+'.json',JSON.stringify(data,null,2));};
const event=(kind,time,role=0,data={})=>({kind,time,role,rootOrder:time*100,order:0,...data});
function ledger({cons=0,ratios=[1,1,1,1],events=[],heals=[],roots=[],bond=false}={}){
 const p=['Skirk','Furina','Escoffier','Vodyanitsa'].map((name,r)=>({character:{name,level:90,constellation:r===1?cons:0},weapon:{name:bond&&r===0?'FinaleOfTheDeep':'DullBlade',refine:1}}));
 const base={events,heals,roots:[event('cast',0,1,{action:'burst'}),...roots],duration:12,endHit:'include',activeRole:()=>0,lastCast:()=>0,fanfareWindows:[{start:0,end:10}],initialHealth:{ratios,fanfare:0,overflow:0,active:false}};
 let state;
 const panelAt=(r,h)=>({hp:{base:10000*(1+(r===1?state.healthAt(h).overflow*.0035:0))},critical:{base:0}});
 const out=resolveEquipmentHealing(p,[[],[],[],[]],base,{panelAt,healAt:h=>h.recipients.map(j=>h.healing==='furina_a1'?sum(panelAt(j,h).hp)*.02:h.raw),criticalAt:()=>0,refresh:x=>state=x});
 return out;
}

test('health V1: conservation, thresholds, overflow, Bond, burst reset and C0/C1/C2 caps',()=>{
 const events=[event('hit',1,1,{hpDrain:.036,eventId:'repeat',order:1}),event('hit',2,1,{hpDrain:.036,eventId:'repeat',order:2})];
 const out=ledger({ratios:[1,.5,.51,.2],events,heals:[event('heal',3,2,{recipients:[0,1,2,3],raw:1000})],roots:[event('hp_change',4,0,{change:'damage',ratio:1})]});
 assert.equal(out.salonCounts.get(1),2);assert.equal(out.salonCounts.get(2),1);
 const first=out.health.find(h=>h.kind==='salon_drain');near(first.ratios[2],.474);near(first.ratios[1],.5);near(first.fanfare,7.2);
 const heal=out.heals.find(h=>h.time===3);near(heal.amount,3720);near(sum(heal.overheals),280);near(out.health.find(h=>h.time===3).fanfare,48);
 assert.deepEqual(out.heals.filter(h=>h.healing==='furina_a1').map(h=>h.time),[5,7]);assert.equal(out.hpEvents.some(h=>h.time===4),false);
 for(const h of out.heals)near(sum(h.rawAmounts),h.amount+sum(h.overheals)+sum(h.absorbedAmounts));
 const debt=ledger({bond:true,roots:[event('cast',.5,0,{action:'skill'})],heals:[event('heal',1,2,{recipients:[0],raw:3000})]});
 const dh=debt.heals[0];near(dh.rawAmounts[0],3000);near(dh.absorbedAmounts[0],2500);near(dh.amount,0);near(dh.overheals[0],500);near(debt.health.find(h=>h.time===1).fanfare,0);assert.ok(debt.bonds.some(b=>b.change==='clear'));
 const under=ledger({ratios:[.4,.4,.4,.4],heals:[event('heal',1,2,{recipients:[0],raw:1000})]});assert.equal(under.heals.length,1);
 const caps=[];
 for(const cons of [0,1,2,6]){
  const pace=ledger({cons,roots:[event('hp_change',.5,0,{change:'decrease',ratio:.1})],heals:[event('heal',1,2,{recipients:[0],raw:1000})]});
  const gained=cons>=2?35:10,initial=cons>=1?150:0;
  near(pace.health.find(h=>h.time===.5).fanfare,initial+gained);near(pace.health.find(h=>h.time===1).fanfare,initial+gained*2);
  const o=ledger({cons,ratios:[.2,.2,.2,.2],heals:[event('heal',1,2,{recipients:[0,1,2,3],raw:100000})]}),start=o.health.find(h=>h.kind==='fanfare_start'),full=o.health.find(h=>h.time===1),end=o.health.find(h=>h.kind==='fanfare_end');
  near(start.fanfare,cons>=1?150:0);near(full.fanfare,cons>=1?400:300);near(full.overflow,cons>=2?400:0);near(full.maxHP[1],cons>=2?24000:10000);assert.deepEqual(full.ratios,[1,1,1,1]);near(end.fanfare,0);near(end.overflow,0);near(end.hp[1],10000);caps.push({cons,fanfare:full.fanfare,overflow:full.overflow,maxHP:full.maxHP[1]});
 }
 save('V1',{thresholds:first.ratios,healed:heal.amount,overflow:sum(heal.overheals),caps});
});

test('health V2: published WASM fanfare, pet counts, C2 HP, healing and HP equipment',()=>{
 const rows=[];
 for(const cons of [0,1,2,6]){
  const x=sample();x.single_interfaces[1].character.constellation=cons;x.team_dps.initial_hp=[.51,.5,.49,.4];const o=run(x);assert.deepEqual(inspect(o),[]);
  for(const h of o.hits.filter(h=>h.hpDrain)){
   const drain=o.health.find(s=>s.kind==='salon_drain'&&s.order===h.order);near(h.analysis.hp_ratio['「沙龙成员」加成']||0,h.analysis.hp_ratio['技能倍率']*.1*drain.consumedRoles.length);
  }
  for(const h of o.hits.filter(h=>h.role===1))near(h.analysis.hp['C2「女人皆善变，仿若水中萍。」']||0,h.analysis.hp['角色基础生命']*h.furina_overflow*.0035);
  for(const h of o.heals)near(sum(h.rawAmounts),h.amount+sum(h.overheals)+sum(h.absorbedAmounts));
  assert.ok(o.health.every(h=>h.ratios.every(v=>v>=0&&v<=1)));assert.ok(o.hits.filter(h=>h.time>=18.5).every(h=>h.fanfare===undefined||h.fanfare===0));
  if(cons===6)assert.ok(o.heals.some(h=>h.healing==='furina_c6'));
  const y=structuredClone(x);y.team_dps.fanfare=999;y.team_dps.furina_overflow=999;y.team_dps.axis.coverage.furinaHpChangeMs=[0,1,2];y.team_dps.axis.timeline.push({id:'ignored-enemy-hit',kind:'hp_change',actor:'carry',timeMs:9000,change:'damage',ratio:1});near(run(y).expectation,o.expectation);
  rows.push({cons,total:o.expectation,peak:o.fanfare,overflow:o.furina_overflow,heals:o.heals.length});
 }
 const noHealth=()=>{const x=sample();x.team_dps.axis.timeline=x.team_dps.axis.timeline.filter(h=>h.kind!=='heal'&&!h.action?.startsWith('furina.salon.'));return x;};
 const cases=[{r:0,w:'HarbingerOfDawn',lo:.9,hi:.91,stat:'critical',delta:.14},{r:2,w:'StaffOfHoma',lo:.49,hi:.5,stat:'atk'}, {r:0,set:'Berserker',lo:.69,hi:.7,stat:'critical',delta:-.24}];
 for(const c of cases){const x=noHealth();if(c.w)x.single_interfaces[c.r].weapon=weapon(c.w);if(c.set)x.single_interfaces[c.r].artifacts=gear(c.r,c.set);x.team_dps.initial_hp=[1,1,1,1];x.team_dps.initial_hp[c.r]=c.lo;const lo=run(x);x.team_dps.initial_hp[c.r]=c.hi;const hi=run(x);if(c.delta!==undefined)near(sum(hi.panels[c.r][c.stat])-sum(lo.panels[c.r][c.stat]),c.delta);else near(sum(lo.panels[c.r].atk)-sum(hi.panels[c.r].atk),sum(lo.panels[c.r].hp)*.01);}
 const v=noHealth();v.single_interfaces[3].character.constellation=4;v.team_dps.axis.coverage.fanfare={startMs:10000,endMs:20000};v.team_dps.axis.timeline.push({id:'low-heal',kind:'heal',actor:'support',timeMs:1000,recipients:'active'});v.team_dps.initial_hp=[1,.4,1,1];const low=run(v).heals.find(h=>h.role===3);v.team_dps.initial_hp[1]=.5;const high=run(v).heals.find(h=>h.role===3);near(low.rawAmounts[0]/high.rawAmounts[0],1.5);
 const native=structuredClone(v.single_interfaces[3]);native.skill={index:10,config:{Vodyanitsa:{low_hp_heal:false,q_song_bonus:false}}};const nativeHigh=api.CalculatorInterface.get_damage_analysis(native,null);native.skill.config.Vodyanitsa.low_hp_heal=true;const nativeLow=api.CalculatorInterface.get_damage_analysis(native,null);near(nativeLow.normal.expectation/nativeHigh.normal.expectation,1.5);
 const mh=noHealth();mh.single_interfaces[0].artifacts=gear(0,'MarechausseeHunter');mh.team_dps.axis.timeline.push({id:'full-heal',kind:'heal',actor:'healer',timeMs:7000,recipients:'team'});const empty=run(mh);mh.team_dps.axis.timeline.push({id:'own-cost',kind:'hp_change',actor:'carry',timeMs:7500,change:'decrease',ratio:.1});const drained=run(mh);near(sum(drained.hits.find(h=>h.role===0).analysis.critical)-sum(empty.hits.find(h=>h.role===0).analysis.critical),.12);
 const recast=sample();recast.team_dps.axis.timeline.push({id:'q-repeat',kind:'cast',actor:'hydro',timeMs:16000,action:'burst'});recast.single_interfaces[1].character.constellation=2;const repeat=run(recast),starts=repeat.health.filter(h=>h.kind==='fanfare_start');assert.equal(starts.length,2);near(starts[1].fanfare,150);assert.ok(repeat.hits.find(h=>h.time===19&&h.role===0).fanfare>0);
 save('V2',{rows,lowHpHealRatio:low.rawAmounts[0]/high.rawAmounts[0],recastStarts:starts.map(h=>({time:h.time,fanfare:h.fanfare}))});
});

test('health V3: candidate healing changes teammates, cache isolation, joint scoring and Worker',async()=>{
 const x=sample();x.team_dps.initial_hp=[.5,.5,.5,.5];const saved=JSON.stringify(x),b=builds(x),e=createTeamDpsEvaluator(api,x),a=e.evaluate(b,true),changed=structuredClone(b);changed[2][0].id+=1000000;changed[2][0].sub_stats.push(['ATKPercentage',1]);const high=e.evaluate(changed,true),fresh=createTeamDpsEvaluator(api,x).evaluate(changed,true);
 near(high.expectation,fresh.expectation);assert.ok(high.hits.some((h,i)=>h.role===0&&Math.abs(h.fanfare-a.hits[i].fanfare)>1));near(e.evaluate(b).expectation,a.expectation);assert.equal(JSON.stringify(x),saved);
 x.team_dps.max_evaluations=6;x.team_dps.result_count=3;const inventory=[...b.flat(),changed[2][0]],lookup=new Map(inventory.map(a=>[a.id,a])),out=optimizeTeamDps(api,x,inventory);
 assert.equal(out.results.length,3);for(const row of out.results){const current=row.artifacts.map(ids=>['flower','feather','sand','goblet','head'].map(k=>lookup.get(ids[k])));const score=createTeamDpsEvaluator(api,x).evaluate(current,true);near(row.expectation,score.expectation);assert.equal(new Set(current.flat().map(a=>a.id)).size,20);assert.deepEqual(inspect(score),[]);}
 const messages=[],self={postMessage:m=>messages.push(m)},code=fs.readFileSync('src/workers/team_dps.js','utf8').replace(/^import .*$/mg,'').replace("import('mona')",'Promise.resolve(api)');vm.runInNewContext(code,{self,api,optimizeTeamDps,evaluateTeamDps,Promise});await Promise.resolve();self.onmessage({data:{input:x,artifacts:inventory,mode:'evaluate'}});assert.equal(messages.at(-1).type,'result');near(messages.at(-1).data.results[0].expectation,a.expectation);assert.ok(messages.at(-1).data.results[0].health.length>0);
 const w=sample();w.single_interfaces[3].weapon=weapon('TheWidsith');const average=run(w);assert.equal(average.health_branches.length,3);assert.ok(average.hits.every(h=>h.branches.length===3));
 save('V3',{base:a.expectation,healingCandidate:high.expectation,basePeak:a.fanfare,healingPeak:high.fanfare,evaluated:out.evaluated_teams,retained:out.results.length,worker:true,widsithBranches:average.health_branches.length});
});
