import {originalCryoInput,action,end} from './team-original-cryo-fixture.mjs';
import {weapon} from '../../beta-tools/interface-audit-7108.mjs';
import {createTeamDpsEvaluator} from '../../beta-data/team-dps-evaluator.mjs';
import {compileActionAxis} from '../../beta-data/team-engine/timeline.mjs';
export function stellarWeaponInput(mode='radiance'){
 const input=originalCryoInput(true,[action('yn',2,'normal.1',0),action('se',0,'skill',.5),action('sn1',0,'normal.1',.6),action('ye',2,'skill',.7),action('ee',1,'skill',1),action('eq',1,'burst',1.2),action('sn2',0,'normal.2',2),action('sn3',0,'normal.3',3.2),action('late',0,'normal.1',5.8),end(6.2)]);
 input.single_interfaces[0].weapon=weapon(mode==='radiance'?'NewBough':'Emberwell');
 input.single_interfaces[2].weapon=weapon(mode==='radiance'?'WintersHeavyHeart':'EchoesOfTheHeart');
 input.single_interfaces[1].weapon=weapon('SongOfTheVigil');
 input.single_interfaces[2].artifacts.forEach(a=>a.set_name='GladiatorsFinale');return input;
}
export function stellarWeaponTeams(input){const a=input.single_interfaces.map(p=>p.artifacts),b=structuredClone(a);b.forEach(build=>build.forEach(a=>a.id+=10000));b[2].forEach(a=>a.set_name='Empty');return [a,b,a];}
export function stellarWeaponEvaluator(api,input,execution={}){return createTeamDpsEvaluator(api,input,{...execution,compileRotation:(...args)=>{
 const plan=compileActionAxis(...args),role=input.single_interfaces.findIndex(p=>p.character.name==='YaeMiko');
 const gate=execution.setCount?execution.math.ge(execution.setCount(role,'GladiatorsFinale'),4):input.testElectro??1;
 for(const e of [...plan.events,...plan.roots])if(e.role===role)e.enabled=gate;return plan;
}});}
