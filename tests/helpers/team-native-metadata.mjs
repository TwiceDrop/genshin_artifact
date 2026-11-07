import {effectInput,action} from './team-effect-refactor.mjs';
import {monaRuntimeInput} from './team-runtime-mona.mjs';

export const nativeMetadataCases=['furina-infusion','furina-salon','skirk-forms','mona-snapshot'];
export function nativeMetadataInput(name){
 const x=name==='mona-snapshot'?monaRuntimeInput('c6-boundary'):effectInput();
 x.single_interfaces.forEach(p=>p.character.constellation=0);
 x.team_dps.initial_hp=[.4,.51,.8,.5];
 if(name==='furina-infusion'){
  x.single_interfaces[1].character.constellation=6;x.single_interfaces[2].character.constellation=2;
  x.team_dps.axis.timeline=[action('e','Furina','skill',0),action('q','Furina','burst',100),action('e2','Escoffier','skill',200),
   ...['normal.1','normal.2','plunge.collision','plunge.low','plunge','charged','normal.3','normal.4','charged','normal.1'].map((id,i)=>action('n'+i,'Furina',id,1000+i*500)),
   action('reset','Furina','skill',7000),action('last','Furina','normal.1',7500),{id:'tail',kind:'switch',actor:'Furina',timeMs:8500}];
 }else if(name==='furina-salon'){
  x.single_interfaces[1].character.constellation=2;x.single_interfaces[3].character.constellation=1;
  x.team_dps.axis.timeline=[action('q','Furina','burst',0),action('f-e','Furina','skill',2100),action('v-e','Vodyanitsa','skill',2500),action('e-e','Escoffier','skill',3000),action('heal','Escoffier','burst',4000),action('s-e','Skirk','skill',4500),action('n','Skirk','normal.3',5000),{id:'tail',kind:'switch',actor:'Skirk',timeMs:12000}];
 }else if(name==='skirk-forms'){
  x.single_interfaces[0].character.constellation=6;
  x.team_dps.axis.timeline=[action('physical','Skirk','normal.1',0),action('physical-ca','Skirk','charged',100),action('v-e','Vodyanitsa','skill',200),action('e-e','Escoffier','skill',300),action('s-e','Skirk','skill',500),{...action('q','Skirk','burst',600),params:{absorbedRifts:3}},...Array.from({length:5},(_,i)=>action('n'+i,'Skirk','normal.'+(i+1),1000+i*500)),{...action('ca','Skirk','charged',3500),params:{absorbedRifts:2}},action('exit','Vodyanitsa','normal.1',4000),{...action('hold','Skirk','skill.hold',4500),params:{absorbedRifts:3}},action('ruin','Skirk','burst',5000)];
 }else if(name==='mona-snapshot'){
  x.single_interfaces[3].character.constellation=6;
  x.team_dps.axis.timeline.splice(1,0,action('phantom','Mona','skill.hold',500));
 }else throw Error('Unknown native metadata fixture '+name);
 return x;
}

export function nativeMetadataTeams(input){
 const first=input.single_interfaces.map(p=>p.artifacts),second=structuredClone(first);
 second.flat().forEach(a=>a.id+=900000);
 second[1].forEach(a=>a.sub_stats.push(['HPPercentage',.3]));
 second[2].forEach(a=>a.sub_stats.push(['ATKPercentage',.2]));
 second[3].forEach(a=>a.sub_stats.push(['HPPercentage',.2],['ATKPercentage',.1]));
 return [first,second];
}
