import {createTeamDpsEvaluator,sum} from './team-dps-evaluator.mjs';
import {TEAM_DPS_SLOTS} from './team-dps-config.mjs';
import {xiphosRecharge} from './equipment-effect-values.mjs';

const fields=[['recharge','recharge_min','Recharge'],['critical','crit_min','CriticalRate'],['critical_damage','crit_damage_min','CriticalDamage'],['elemental_mastery','em_min','ElementalMastery']];
const empty=()=>Object.fromEntries(fields.map(([stat])=>[stat,0]));
export const artifactConstraintStats=a=>{
 const out=empty();for(const [name,value]of [a.main_stat,...a.sub_stats]){
  const field=fields.find(([, ,key])=>key===name);if(field)out[field[0]]+=value;
 }return out;
};
function setRequirements(mode){
 if(mode?.Set4)return [[mode.Set4,4]];
 if(mode?.Set22)return mode.Set22.map(name=>[name,2]);
 return [];
}
function reachable(sets,domains){
 const required=sets.filter(([,count])=>count>0);
 function place(i,used){
  if(i===required.length)return true;
  const [name,needed]=required[i],slots=domains.map((pool,k)=>!used.has(k)&&pool.some(a=>a.set_name===name)?k:-1).filter(k=>k>=0);
  function choose(start,left){
   if(!left)return place(i+1,used);
   for(let j=start;j<=slots.length-left;j++){used.add(slots[j]);if(choose(j+1,left-1))return true;used.delete(slots[j]);}
   return false;
  }
  return choose(0,needed);
 }
 return place(0,new Set());
}
function modes(domains){
 const sets=[...new Set(domains.flat().map(a=>a.set_name))],out=[[]];
 for(const a of sets){
  if(reachable([[a,2]],domains))out.push([[a,2]]);
  if(reachable([[a,4]],domains))out.push([[a,4]]);
 }
 for(let a=0;a<sets.length;a++)for(let b=a+1;b<sets.length;b++)if(reachable([[sets[a],2],[sets[b],2]],domains))out.push([[sets[a],2],[sets[b],2]]);
 return out;
}

// These four constraint fields are additive at the axis's initial panel.
// Weapon/character/configured BUFF constants and every reachable set mode are
// read from the published evaluator. Xiphos' cross-role EM conversion is added
// separately using the same public effect formula as ordinary scoring.
export function createTeamConstraintBounds(api,input,pools,onProgress=()=>{},evaluatorFactory=createTeamDpsEvaluator){
 const evaluator=evaluatorFactory(api,input),profiles=evaluator.profiles;
 const required=profiles.map(p=>setRequirements(p.constraint?.set_mode));
 const hasStats=profiles.some(p=>fields.some(([,field])=>p.constraint?.[field]>0));
 const stats=new Map(pools.flat(2).map(a=>[a.id,artifactConstraintStats(a)]));
 let serial=1;
 const blank=(r,mode)=>{
  const labels=mode.flatMap(([name,count])=>Array(count).fill(name));
  return TEAM_DPS_SLOTS.map((slot,k)=>({id:serial++,slot,set_name:labels[k]||'Empty',star:5,level:20,main_stat:['HPFixed',0],sub_stats:[]}));
 };
 const baseTeam=profiles.map((_,r)=>blank(r,[]));
 const modesByRole=hasStats?profiles.map((_,r)=>modes(pools[r]).map(mode=>{
  onProgress();
  const team=baseTeam.map((b,j)=>j===r?blank(r,mode):b),panels=profiles.map((_,j)=>evaluator.constraints(j,team));
  const values=Object.fromEntries(fields.map(([stat])=>[stat,sum(panels[r][stat])]));
  for(let j=0;j<profiles.length;j++)if(profiles[j].weapon.name==='XiphosMoonlight')values.recharge-=xiphosRecharge(sum(panels[j].elemental_mastery),profiles[j].weapon.refine,j===r?1:.3);
  const magnitude=Object.fromEntries(fields.map(([stat])=>[stat,Object.values(panels[r][stat]).reduce((n,v)=>n+Math.abs(v),0)]));
  const terms=Object.fromEntries(fields.map(([stat])=>[stat,Object.keys(panels[r][stat]).length]));
  return {sets:mode,values,magnitude,terms};
 })):[];

 function upper(domains){
  const rounding=[];
  const values=profiles.map((_,r)=>{
   const candidates=modesByRole[r].filter(mode=>reachable(mode.sets,domains[r]));
   const terms=domains[r].reduce((n,pool)=>n+Math.max(...pool.map(a=>1+a.sub_stats.length)),0);
   rounding[r]=Object.fromEntries(fields.map(([stat])=>{
    const n=2*(terms+Math.max(...candidates.map(x=>x.terms[stat]))+1),gamma=n*Number.EPSILON/(1-n*Number.EPSILON);
    const magnitude=Math.max(...candidates.map(x=>x.magnitude[stat]))+domains[r].reduce((n,pool)=>n+Math.max(...pool.map(a=>[a.main_stat,...a.sub_stats].filter(([key])=>fields.find(([s])=>s===stat)[2]===key).reduce((v,[,a])=>v+Math.abs(a),0))),0);
    return [stat,gamma*magnitude];
   }));
   return Object.fromEntries(fields.map(([stat])=>[stat,Math.max(...candidates.map(x=>x.values[stat]))+domains[r].reduce((n,pool)=>n+Math.max(...pool.map(a=>stats.get(a.id)[stat])),0)]));
  });
  for(let r=0;r<profiles.length;r++)for(let j=0;j<profiles.length;j++)if(profiles[j].weapon.name==='XiphosMoonlight'){
   const value=xiphosRecharge(values[j].elemental_mastery,profiles[j].weapon.refine,j===r?1:.3);
   values[r].recharge+=value;rounding[r].recharge+=xiphosRecharge(rounding[j].elemental_mastery,profiles[j].weapon.refine,j===r?1:.3)+8*Number.EPSILON*(Math.abs(value)+Math.abs(values[r].recharge));
  }
  for(let r=0;r<profiles.length;r++)for(const [stat]of fields)values[r][stat]+=rounding[r][stat];
  return values;
 }
 return {
  upper,
  feasible(domains){
   if(domains.some(row=>row.some(pool=>!pool.length)))return false;
   for(let r=0;r<profiles.length;r++)if(!reachable(required[r],domains[r]))return false;
   if(!hasStats)return true;
   const bounds=upper(domains);
   return profiles.every((p,r)=>fields.every(([stat,field])=>!(p.constraint?.[field]>bounds[r][stat])));
  },
  modeCounts:modesByRole.map(m=>m.length),
 };
}
