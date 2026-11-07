import {sample} from '../../beta-tools/team-dps-full-audit.mjs';
import {weapon} from '../../beta-tools/interface-audit-7108.mjs';
export function teamDetailFixture(durationMs=20500){
 const input=sample(),names=['Azurelight','SplendorOfTranquilWaters','FavoniusLance','ThrillingTalesOfDragonSlayers'];
 input.single_interfaces.forEach((p,r)=>{p.character.constellation=[0,2,6,0][r];p.weapon=weapon(names[r]);p.weapon.refine=r<2?1:5;p.weapon.level=r===2?70:90;});
 Object.assign(input.single_interfaces[2].character,{skill1:0,skill2:12,skill3:10});
 input.team_dps.axis.durationMs=durationMs;
 input.team_dps.axis.timeline=input.team_dps.axis.timeline.filter(e=>e.timeMs<=durationMs);
 Object.assign(input.team_dps,{max_evaluations:8,result_count:2,search_algorithm:'branch_bound',compute_backend:'cpu'});
 return input;
}
