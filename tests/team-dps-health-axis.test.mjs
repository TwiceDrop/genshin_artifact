import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sample,gear,builds,run,sum,inspect} from '../beta-tools/team-dps-full-audit.mjs';
import {weapon} from '../beta-tools/interface-audit-7108.mjs';
import {api} from '../beta-tools/runtime-7106.mjs';
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';
import {compileTeamDpsAxis} from '../beta-data/team-dps-rotation.mjs';
import {createEquipmentAxisRules} from '../beta-data/equipment-axis-rules.mjs';
import {optimizeTeamDps,evaluateTeamDps} from '../beta-data/team-dps-optimizer.mjs';
import vm from 'node:vm';
const folder='.build-target/team-dps-health-axis-20261027';
const save=(name,data)=>{fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(`${folder}/${name}.json`,JSON.stringify(data,null,2));};
const near=(a,b,label='')=>assert.ok(Math.abs(a-b)<1e-8*Math.max(1,Math.abs(b)),`${label}: ${a} != ${b}`);
const order=(a,b)=>a.time-b.time||a.rootOrder-b.rootOrder||(a.order??0)-(b.order??0);
function healthNear(a,b){
 assert.equal(a.length,b.length);
 for(let i=0;i<a.length;i++){
  for(const k of ['time','kind','role','label'])assert.equal(a[i][k],b[i][k]);
  for(const k of ['fanfare','overflow'])near(a[i][k],b[i][k]);
  for(const k of ['hp','maxHP','ratios'])a[i][k].forEach((v,j)=>near(v,b[i][k][j]));
  if(a[i].healing){const x=a[i].healing,y=b[i].healing;near(x.amount,y.amount);for(const k of ['rawAmounts','amounts','overheals','absorbedAmounts'])x[k].forEach((v,j)=>near(v,y[k][j]));}
 }
}
function input(){
 const x=sample();
 ['Azurelight','SplendorOfTranquilWaters','SymphonistOfScents','HymnOfTheMaelstrom'].forEach((n,r)=>x.single_interfaces[r].weapon=weapon(n));
 ['FinaleOfTheDeepGalleries','GoldenTroupe','GoldenTroupe','ScrollOfTheHeroOfCinderCity'].forEach((n,r)=>x.single_interfaces[r].artifacts=gear(r,n));
 x.team_dps.initial_hp=[1,1,1,1];return x;
}

test('axis health V1: independently replay C0/C1/C2 HP and fanfare at every hit',()=>{
 const summary=[];
 for(const cons of [0,1,2]){
  const x=input();x.single_interfaces[1].character.constellation=cons;
  const nativeHeals=[],wrapped={...api,CalculatorInterface:{get_damage_analysis(p,...args){const d=api.CalculatorInterface.get_damage_analysis(p,...args);if(d.is_heal)nativeHeals.push({p,d});return d;}}};
  const o=createTeamDpsEvaluator(wrapped,x).evaluate(builds(x),true),states=[];assert.deepEqual(inspect(o),[]);
  let ratios=[1,1,1,1],points=0,active=false,previous=o.health[0],nativeIndex=0;
  for(const h of o.health){
   let delta=0;
   if(h.kind==='fanfare_reset'){points=0;active=false;}
   if(h.kind==='fanfare_start'){points=cons?150:0;active=true;}
   if(h.kind==='fanfare_end'){points=0;active=false;}
   if(h.kind==='salon_drain'){
    const amount={11:.016,10:.024,12:.036}[h.index],eligible=ratios.flatMap((v,j)=>v>.5?[j]:[]);
    assert.deepEqual(h.consumedRoles,eligible);
    for(const j of eligible){ratios[j]-=amount;delta+=amount;}
   }
   if(h.healing){
    const heal=h.healing,rate=active?Math.min(cons?400:300,points)*.001:0;
    if(!h.healing.healing&&(h.role===3||h.recipients.length===4)){
     const {p,d}=nativeHeals[nativeIndex++];assert.equal(p.character.name,o.profiles[h.role].character.name);
     const base=sum(d.atk)*sum(d.atk_ratio)+sum(d.hp)*sum(d.hp_ratio)+sum(d.extra_damage);
     for(const raw of heal.rawAmounts)near(raw,base*(1+sum(d.healing_bonus)+rate),'native heal formula');
    }
    for(let k=0;k<h.recipients.length;k++){
     const j=h.recipients[k],max=previous.maxHP[j],amount=Math.min((1-ratios[j])*max,heal.rawAmounts[k]);
     near(heal.amounts[k],amount,'actual heal');near(heal.overheals[k],heal.rawAmounts[k]-amount,'overheal');near(heal.absorbedAmounts[k],0);
     if(h.healing.healing==='furina_a1')near(heal.rawAmounts[k],max*.02*(1+rate),'A1 amount');
     ratios[j]+=amount/max;delta+=amount/max;
    }
    near(sum(heal.rawAmounts),heal.amount+sum(heal.overheals)+sum(heal.absorbedAmounts),'heal conservation');
   }
   if(active)points=Math.min(cons===2?800:cons?400:300,points+delta*100*(cons===2?3.5:1));
   const fanfare=active?Math.min(cons?400:300,points):0,overflow=active&&cons===2?Math.max(0,points-400):0;
   near(h.fanfare,fanfare,'fanfare');near(h.overflow,overflow,'overflow');ratios.forEach((v,j)=>near(h.ratios[j],v,'hp ratio'));
   states.push({time:h.time,rootOrder:h.rootOrder,order:h.order,label:h.label,ratios:[...ratios],fanfare,overflow});previous=h;
  }
  assert.equal(nativeIndex,nativeHeals.length);
  assert.equal(o.health.filter(h=>h.kind==='salon_drain').length,24);
  assert.equal(o.heals.filter(h=>h.role===2).length,10);assert.equal(o.heals.filter(h=>h.role===3).length,10);
  for(const h of o.hits){const s=states.findLast(s=>order(s,h)<=0);near(h.fanfare,s.fanfare,'hit fanfare');near(h.furina_overflow,s.overflow,'hit overflow');h.hp_ratios.forEach((v,j)=>near(v,s.ratios[j]));
   if(h.role===1)near(h.analysis.hp['C2「女人皆善变，仿若水中萍。」']||0,h.analysis.hp['角色基础生命']*s.overflow*.0035,'C2 HP');
  }
  const last=(time)=>states.filter(s=>s.time<=time).at(-1);
  const row={cons,total:o.expectation,peak:o.fanfare,overflow:o.furina_overflow,firstCap:states.find(s=>s.fanfare===(cons?400:300))?.time,firstFullOverflow:states.find(s=>s.overflow===400)?.time,healCounts:{esco:10,vody:10,a1:o.heals.filter(h=>h.healing==='furina_a1').length},checkpoints:[0,.5,1.7,3.4,5.3,5.5,6.5,7.5,8.5,10.2,15.9,18.5,20.5].map(last)};
  save(`C${cons}`,{...row,health:states,hits:o.hits.map(h=>({time:h.time,role:h.role,label:h.label,part:h.part,fanfare:h.fanfare,overflow:h.furina_overflow}))});summary.push(row);
 }
 save('V1',summary);
});

test('axis health V2: HP-trigger equipment field gates, refresh, cooldown and native values',()=>{
 const x=input(),p=createTeamDpsEvaluator(api,x).profiles,rows=[],issues=[];
 const change=(time,role,rootOrder=200)=>({time,role,rootOrder,order:0,change:'decrease',ratio:.01,amount:100});
 const check=(label,role,name,set,hp,probes)=>{
  const profiles=structuredClone(p);profiles[role].weapon=weapon(name);profiles[role].artifacts=gear(role,set);
  const rotation=compileTeamDpsAxis(x.team_dps.axis,profiles,x.team_dps);rotation.hpEvents=hp;
  const rules=createEquipmentAxisRules(profiles,rotation,x.team_dps);
  for(const [time,expected]of probes){const e={time,rootOrder:1000,order:1000,onField:rotation.activeRole(time,1000)===role},item=rules.prepare(structuredClone(profiles[role]),role,e),w=item.weapon.params[name],actual=set==='MarechausseeHunter'?[item.artifact_config.config_marechaussee_hunter.stack]:name==='SplendorOfTranquilWaters'?[w.stack1,w.stack2]:[w.stack];
   rows.push({label,time,actual,expected});if(JSON.stringify(actual)!==JSON.stringify(expected))issues.push(rows.at(-1));
   const d=api.CalculatorInterface.get_damage_analysis({...item,skill:{index:role===1?11:4,config:role===1?{Furina:{hp_above50_count:0,c6_after_e:false,c6_pneuma:false}}:'NoConfig'}},null);
   if(set==='MarechausseeHunter')near(d.critical['逐影猎人4']||0,actual[0]*.12);
   if(name==='SplendorOfTranquilWaters'){near(d.bonus['静水流涌之辉被动']||0,actual[0]*.08);near(d.hp['静水流涌之辉被动']||0,d.hp['角色基础生命']*actual[1]*.14);}
   if(name==='TomeOfTheEternalFlow')near(d.bonus['万世流涌大典被动']||0,actual[0]*.14);
   if(name==='CashflowSupervision')near(d.bonus['金流监督被动']||0,actual[0]*.14);
  }
 };
 check('逐影后台不叠层',0,'Azurelight','MarechausseeHunter',[1,2,3].map(t=>change(t,0)),[[7.75,[0]]]);
 check('逐影同刻多次与整组刷新',0,'Azurelight','MarechausseeHunter',[change(8,0,201),change(8,0,202),change(8.1,0),change(12.9,0)],[[8.2,[3]],[13.1,[3]],[17.9,[0]]]);
 check('逐影退场保留既有层数',2,'SymphonistOfScents','MarechausseeHunter',[3,4,5,7].map(t=>change(t,2)),[[7.6,[3]],[10,[0]]]);
 for(const name of ['TomeOfTheEternalFlow','CashflowSupervision'])check(name,3,name,'GladiatorsFinale',[0,1,2,6.5,6.6,6.8,7.1,8].map(t=>change(t,3)),[[2.5,[0]],[6.4,[0]],[6.7,[1]],[6.9,[2]],[7.2,[3]],[10.6,[3]],[10.9,[3]],[11.1,[0]]]);
 check('静水后台双类刷新与独立CD',1,'SplendorOfTranquilWaters','GoldenTroupe',[change(0,1),change(1,1),change(5.9,1),change(0,0),change(0,2),change(0,3),change(1,0)],[[.1,[1,1]],[6.1,[3,2]],[7,[3,0]],[11.9,[0,0]]]);
 save(process.env.AUDIT_BEFORE?'V2-before':'V2',rows);assert.deepEqual(issues,[]);
});

test('axis health V3: actual-axis HP equipment, healing/Bond triggers and duplicate sources',()=>{
 const rows=[],frontAt=t=>t<3?1:t<6.5?2:t<7.5?3:0;
 const changes=(o,r)=>{let last=1;const list=[];for(const h of o.health){if(h.ratios[r]!==last){list.push({...h,change:h.ratios[r]>last?'increase':'decrease'});last=h.ratios[r];}}return list;};
 for(const r of [0,1]){
  const x=input();x.single_interfaces[r].artifacts=gear(r,'MarechausseeHunter');const o=run(x),hp=changes(o,r).filter(h=>frontAt(h.time)===r);
  for(const h of o.hits.filter(h=>h.role===r)){
   let n=0,end=-Infinity;for(const c of hp.filter(c=>order(c,h)<0)){n=c.time>=end?1:Math.min(3,n+1);end=c.time+5;}
   near(h.analysis.critical['逐影猎人4']||0,(h.time<end?n:0)*.12);
  }
  rows.push({set:'MarechausseeHunter',role:r,total:o.expectation,first:o.hits.find(h=>h.role===r).analysis.critical['逐影猎人4']||0});
 }
 for(const [r,name,set,initial]of [[1,'HarbingerOfDawn','GoldenTroupe',1],[2,'StaffOfHoma','GoldenTroupe',.49],[2,'SymphonistOfScents','Berserker',.69]]){
  const x=input();x.single_interfaces[r].weapon=weapon(name);x.single_interfaces[r].artifacts=gear(r,set);x.team_dps.initial_hp[r]=initial;const o=run(x);
  for(const h of o.hits.filter(h=>h.role===r)){
   if(name==='HarbingerOfDawn')near(h.analysis.critical['黎明神剑被动等效']||0,h.hp_ratios[r]>.9?.14:0);
   if(name==='StaffOfHoma')near(h.analysis.atk['护摩之杖被动等效'],h.hp*(h.hp_ratios[r]<.5?.018:.008));
   if(set==='Berserker')near(h.analysis.critical['战狂4']||0,h.hp_ratios[r]<.7?.24:0);
  }
  rows.push({name,set,total:o.expectation,initial});
 }
 {
  const x=input();x.single_interfaces[0].artifacts=gear(0,'VermillionHereafter');const o=run(x),hp=changes(o,0).filter(h=>h.time>=8&&h.change==='decrease');
  for(const h of o.hits.filter(h=>h.role===0)){
   let n=0,ready=-Infinity;for(const c of hp.filter(c=>order(c,h)<0))if(c.time>=ready){n=Math.min(4,n+1);ready=c.time+.8;}
   const bonus=h.time>=8?.08+.1*n:0,base=h.analysis.atk['角色基础攻击']+h.analysis.atk['武器基础攻击'];
   near(h.analysis.atk['辰砂往生录4']||0,base*bonus);
  }
  rows.push({set:'VermillionHereafter',total:o.expectation});
 }
 for(const set of ['OceanHuedClam','SongOfDaysPast']){
  const x=input();x.single_interfaces[3].weapon=weapon('FlowingPurity');x.single_interfaces[3].artifacts=gear(3,set);const o=run(x),first=o.heals.find(h=>h.role===3),end=first.time+(set==='OceanHuedClam'?3:6);
  assert.ok(sum(first.absorbedAmounts)>0);near(first.amount,0);
  const raw=o.heals.filter(h=>h.role===3&&h.time<end).reduce((n,h)=>n+sum(h.rawAmounts),0);
  if(set==='OceanHuedClam')near(o.hits.find(h=>h.label.includes('海染')).flat,.9*Math.min(30000,raw));
  else {const control=structuredClone(x);control.single_interfaces[3].artifacts=gear(3,'OceanHuedClam');const without=run(control),selected=o.hits.filter(h=>h.onField&&h.time>=end).slice(0,5);for(const h of selected)near(h.flat-without.hits.find(v=>v.order===h.order&&v.category!=='equipment').flat,.08*Math.min(15000,raw));}
  for(const h of o.heals)near(sum(h.rawAmounts),h.amount+sum(h.absorbedAmounts)+sum(h.overheals));
  rows.push({set,raw,absorbed:sum(first.absorbedAmounts),actual:first.amount});
 }
 const clean=input(),base=run(clean),duplicate=structuredClone(clean);
 for(const p of duplicate.single_interfaces)p.buffs.push({name:'FurinaQ',config:{FurinaQ:{fanfare_value:400,skill_level:10}}},{name:'SymphonistOfScents',config:{SymphonistOfScents:{refine:1,rate:1}}});
 const after=run(duplicate);near(after.expectation,base.expectation);healthNear(after.health,base.health);
 save('V3',{cases:rows,manualFanfareAndSymphonistDuplicatesRemoved:true});
});

test('axis health V4: candidate-dependent HP replay, cache rollback, Worker and single-hit preservation',async()=>{
 const x=input();x.single_interfaces[0].artifacts=gear(0,'MarechausseeHunter');x.single_interfaces[1].character.constellation=2;x.team_dps.initial_hp[0]=.25;
 const saved=JSON.stringify(x),singleBefore=api.CalculatorInterface.get_damage_analysis(x.single_interfaces[2],null),b=builds(x),e=createTeamDpsEvaluator(api,x),base=e.evaluate(b,true),next=structuredClone(b);
 next[0][0].id+=1000000;next[0][0].sub_stats.push(['HPPercentage',1]);
 const changed=e.evaluate(next,true),fresh=createTeamDpsEvaluator(api,x).evaluate(next,true);
 near(changed.expectation,fresh.expectation);healthNear(changed.health,fresh.health);assert.ok(Math.abs(changed.health.find(h=>h.time===5.5).ratios[0]-base.health.find(h=>h.time===5.5).ratios[0])>1e-6);
 const back=e.evaluate(b,true);near(back.expectation,base.expectation);healthNear(back.health,base.health);
 const messages=[],self={postMessage:m=>messages.push(m)},code=fs.readFileSync('src/workers/team_dps.js','utf8').replace(/^import .*$/mg,'').replace("import('mona')",'Promise.resolve(api)');
 vm.runInNewContext(code,{self,api,optimizeTeamDps,evaluateTeamDps,Promise});await Promise.resolve();self.onmessage({data:{input:x,artifacts:b.flat(),mode:'evaluate'}});
 assert.equal(messages.at(-1).type,'result');near(messages.at(-1).data.results[0].expectation,base.expectation);healthNear(messages.at(-1).data.results[0].health,base.health);
 assert.equal(JSON.stringify(x),saved);const singleAfter=api.CalculatorInterface.get_damage_analysis(x.single_interfaces[2],null);
 for(const metric of ['expectation','critical','non_critical'])near(singleAfter.normal[metric],singleBefore.normal[metric]);
 assert.deepEqual({...singleAfter,normal:null},{...singleBefore,normal:null});
 save('V4',{base:base.expectation,candidate:changed.expectation,rollback:true,worker:true,singleHitUnchanged:true,inputUnchanged:true});
});
