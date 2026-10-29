import {characterPackages} from '../../beta-data/team-engine/character-packages.mjs';
// Synthetic capability fixture, never installed in the shipped character package.
export const stackSnapshotDefinition={
 id:'test.stack-snapshot',label:'合成逐层生命快照',stage:'attack',target:'team',
 trigger:{kind:'heal',healing:null},duration:4,
 stacks:{limit:3,refresh:'independent',overflow:'replaceOldest'},
 reads:{maxHP:{stat:'hp',stage:'base',timing:'stack'}},
 value:({m,read})=>({ATKFixed:m.min(600,m.mul(.01,read('maxHP')))}),
};
export function installStackSnapshotFixture(){
 const original=characterPackages.Vodyanitsa.effects;
 characterPackages.Vodyanitsa.effects=(...args)=>[...original(...args),stackSnapshotDefinition];
 return ()=>{characterPackages.Vodyanitsa.effects=original;};
}
export function configureStackSnapshotFixture(input){
 const x=structuredClone(input);x.single_interfaces.forEach(p=>p.character.constellation=0);
 x.single_interfaces[3].character.constellation=4;x.team_dps.initial_hp=[.4,.5,.6,.3];
 const action=(id,actor,action,timeMs)=>({id,actor,action,timeMs,kind:'action'});
 x.team_dps.axis.timeline=[action('v-e','Vodyanitsa','skill',0),action('s-e','Skirk','skill',100),...Array.from({length:7},(_,i)=>action('n'+i,'Skirk','normal.1',500+i*1000)),{id:'tail',kind:'switch',actor:'Skirk',timeMs:7500}];
 return x;
}
