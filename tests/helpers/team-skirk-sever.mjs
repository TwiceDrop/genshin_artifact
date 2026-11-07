import {effectInput,action} from './team-effect-refactor.mjs';
import {fixture} from '../../beta-tools/interface-audit-7108.mjs';
export function skirkSeverInput(mode='normal'){
 const x=effectInput();x.single_interfaces.forEach(p=>{p.character.constellation=0;p.weapon=fixture(p.character.name).weapon;p.artifacts.forEach(a=>a.set_name='GladiatorsFinale');});
 x.single_interfaces[0].character.constellation=6;x.team_dps.axis.initialActiveSlot='Skirk';
 const a=(id,skill,time,count)=>({...action(id,'Skirk',skill,time),...(count===undefined?{}:{params:{absorbedRifts:count}})}),tail=time=>({id:'tail',kind:'switch',actor:'Skirk',timeMs:time});
 x.team_dps.axis.timeline=[a('h','skill.hold',0,3),a('e','skill',100),a('q','burst',200,0),a('n3','normal.3',1000),a('n5','normal.5',2000),a('n3b','normal.3',3000),a('empty','normal.5',4000),tail(5000)];
 if(mode==='burst')x.team_dps.axis.timeline=[a('h','skill.hold',0,2),a('q','burst',1000),tail(4000)];
 if(mode==='expiry')x.team_dps.axis.timeline=[a('h','skill.hold',0,2),a('h2','skill.hold',5000,2),a('q','burst',15000),tail(21000)];
 if(mode==='control')x.single_interfaces[0].character.constellation=0;
 return x;
}
export function skirkSeverTeams(x){const first=x.single_interfaces.map(p=>p.artifacts),second=structuredClone(first);second.flat().forEach(a=>a.id+=900000);second[0].forEach(a=>a.sub_stats.push(['ATKPercentage',.12]));return [first,second];}
