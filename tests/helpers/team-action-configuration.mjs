import fs from 'node:fs';
import {sample,builds,gear} from '../../beta-tools/team-dps-full-audit.mjs';
import {weapon} from '../../beta-tools/interface-audit-7108.mjs';
import {createTeamDpsEvaluator,sum} from '../../beta-data/team-dps-evaluator.mjs';
export function actionInput(){
 const input=sample();input.team_dps.axis=JSON.parse(fs.readFileSync(new URL('../../examples/team-dps/skirk-actions-prototype.json',import.meta.url),'utf8'));return input;
}
export function constrainedActionInput(api){
 const x=actionInput(),mains=[['ATKPercentage','HPPercentage','Recharge','ElementalMastery'],['CryoBonus','HydroBonus','ATKPercentage','HPPercentage'],['CriticalRate','CriticalDamage','HealingBonus','HPPercentage']];
 for(let r=0;r<4;r++){
  const p=x.single_interfaces[r];p.artifacts=gear(r,['GladiatorsFinale','EmblemOfSeveredFate','OceanHuedClam','SongOfDaysPast'][r]);
  p.weapon=weapon(['ToukabouShigure','XiphosMoonlight','CrescentPike','FlowingPurity'][r]);
  for(let k=2;k<5;k++)p.artifacts[k].main_stat=[mains[k-2][r],.2];
  p.artifacts[0].sub_stats.push(['ElementalMastery',r*100]);
  p.filter=Object.fromEntries(['sand_main_stat','goblet_main_stat','head_main_stat'].map((key,k)=>[key,[mains[k][r]]]));
 }
 x.single_interfaces[2].character.constellation=1;x.single_interfaces[2].constraint.set_mode={Set4:'OceanHuedClam'};
 x.single_interfaces[2].constraint.recharge_min=sum(createTeamDpsEvaluator(api,x).evaluate(builds(x)).panels[2].recharge)+.005;
 Object.assign(x.team_dps,{initial_ids:builds(x).map(b=>b.map(a=>a.id)),max_evaluations:65536,result_count:5,enemy_count:3,damage_scope:'all'});
 return x;
}
