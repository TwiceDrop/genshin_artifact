// Synthetic, read-only evaluation of mixed sets and the two weapon types which
// the four-person axis cannot equip. Outputs stay in the local audit directory.
import fs from 'node:fs';
import {sample,gear,builds,allSets,fullSets,inspect,refinements,sum,close} from './team-dps-full-audit.mjs';
import {api} from './runtime-7106.mjs';
import {weapon,weapons,fixture} from './interface-audit-7108.mjs';
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';
const directory='.build-target/team-dps-full-audit',mode=process.argv[2],file=`${directory}/${mode}.jsonl`;
let count=0,hits=0,failures=[],buffer='';fs.writeFileSync(file,'');
function record(row){buffer+=JSON.stringify(row)+'\n';count++;if(row.error||row.issues?.length)failures.push(row);if(count%100===0){fs.appendFileSync(file,buffer);buffer='';console.log(JSON.stringify({mode,count,failures:failures.length}));}}
if(mode==='mixed'){
 for(let r=0;r<4;r++){
  const x=sample();x.single_interfaces[r].weapon=weapon(['Azurelight','SplendorOfTranquilWaters','SymphonistOfScents','HymnOfTheMaelstrom'][r]);const ev=createTeamDpsEvaluator(api,x);
  for(let a=0;a<fullSets.length;a++)for(let b=a+1;b<fullSets.length;b++){
   const aa=gear(r,fullSets[a].name2,100+a),bb=gear(r,fullSets[b].name2,200+b),off=allSets.find(s=>s.flower&&s.maxStar===5&&s.name2!==fullSets[a].name2&&s.name2!==fullSets[b].name2);
   const head=gear(r,off.name2,300+b)[4];head.set_name=off.name2;
   const candidate=builds(x);candidate[r]=[aa[0],aa[1],bb[2],bb[3],head];
   const row={role:r,sets:[fullSets[a].name2,fullSets[b].name2]};
   try{const out=ev.evaluate(candidate,true);hits+=out.hits.length;record({...row,expectation:out.expectation,issues:inspect(out)});}catch(e){record({...row,error:e.stack});}
  }
 }
}else if(mode==='outside'){
 for(const w of Object.values(weapons).filter(w=>['Bow','Claymore'].includes(w.type)))for(const refine of refinements(w.name))for(const set of allSets){
  const x=fixture(w.type==='Bow'?'Amber':'Noelle');x.weapon=weapon(w.name);x.weapon.refine=refine;if(w.star<3)x.weapon.level=70;x.artifacts=gear(0,set.name2);x.enemy={level:100,physical_res:.3,pyro_res:.1,geo_res:.1};
  const row={role:x.character.name,weapon:w.name,refine,set:set.name2};
  try{
   const d=api.CalculatorInterface.get_damage_analysis(x,null),issues=[];
   const base=(sum(d.atk)*sum(d.atk_ratio)+sum(d.hp)*sum(d.hp_ratio)+sum(d.def)*sum(d.def_ratio)+sum(d.em)*sum(d.em_ratio))*(1+sum(d.independent_damage_multiplier))+sum(d.extra_damage);
   const defense=190/(190+200*(1-Math.min(.9,sum(d.def_minus)))*(1-Math.min(1,sum(d.def_penetration)))),res=x.enemy[d.element.toLowerCase()+'_res']-sum(d.res_minus),resistance=res<0?1-res/2:res<.75?1-res:1/(1+4*res);
   const normal=base*(1+sum(d.bonus))*defense*resistance,cr=Math.min(1,Math.max(0,sum(d.critical))),cd=sum(d.critical_damage);
   for(const [k,v]of Object.entries({non_critical:normal,critical:normal*(1+cd),expectation:normal*(1+cr*cd)}))if(!Number.isFinite(d.normal[k])||!close(v,d.normal[k]))issues.push(k+':'+v+'/'+d.normal[k]);
   hits++;record({...row,expectation:d.normal.expectation,issues});
  }catch(e){record({...row,error:e.stack});}
 }
}
fs.appendFileSync(file,buffer);fs.writeFileSync(`${directory}/${mode}-summary.json`,JSON.stringify({mode,count,hits,failures},null,2));console.log(JSON.stringify({mode,complete:true,count,failures:failures.length}));
