import {equipmentEnergy,equipmentPickups,aimingStacks,daybreakStacks,huskStacks} from '../../beta-data/equipment-combat-facts.mjs';
export const factEvent=(id,time,role=0,extra={})=>({eventId:id,id,time,role,rootOrder:time*100,order:0,...extra});
export function factRotation(roots=[],events=[],initial=0){
 const switches=roots.filter(h=>h.kind==='switch');let previous=initial;
 for(const h of switches){h.from=previous;previous=h.role;}
 return {roots,events,switches,slots:['a','b','c','d'],activeRole:(time,root=Infinity)=>switches.filter(h=>h.time<time||h.time===time&&h.rootOrder<=root).at(-1)?.role??initial};
}
export const factProfiles=()=>['Amber','Noelle','Kirara','Furina'].map(name=>({character:{name},weapon:{name:'DullBlade',refine:1}}));
export function factOutputs(m,gates,{remove=false}={}){
 const keep=rows=>remove?rows.filter(h=>h.enabled!==0):rows;
 const e=factEvent,point=time=>({time,rootOrder:Infinity,order:Infinity}),profiles=factProfiles();
 profiles[1].weapon.name='KatsuragikiriNagamasa';profiles[2].weapon.name='SapwoodBlade';
 const energyRotation=factRotation(keep([e('q',3,1,{kind:'cast',action:'burst',enabled:gates[1]})]),keep([e('e1',1,1,{category:'skill',enabled:gates[0]}),e('e2',2,1,{category:'skill'}),e('e3',12,1,{category:'skill'})]));
 const energy=equipmentEnergy(profiles,energyRotation,{math:m});
 const energyOut=[1.5,2.5,3.5,12.5].flatMap(time=>{const value=energy.at(1,point(time));return [value.current,value.zero,value.full];});
 const pickups=equipmentPickups(profiles,factRotation(keep([
  e('p1',1,0,{kind:'pickup',item:'leaf',source:'c',enabled:gates[1]}),e('p2',6,1,{kind:'pickup',item:'leaf',source:'c',enabled:gates[2]}),
  e('p3',7,0,{kind:'pickup',item:'leaf',source:'c'}),e('p4',21,0,{kind:'pickup',item:'leaf',source:'c'}),
 ]),keep([e('geo',2,1,{category:'skill',element:'Geo',enabled:gates[0]})])),keep([e('r1',0,2,{reaction:'Bloom',enabled:gates[0]}),e('r2',5,2,{reaction:'Bloom'}),e('r3',20,2,{reaction:'Bloom'})]),{math:m});
 const sum=rows=>rows.reduce((v,h)=>m.add(v,h.enabled??1),0);
 const pickupOut=['p1','p2','p3','p4'].map(id=>sum(pickups.leaves.filter(h=>h.eventId===id))).concat(sum(pickups.crystals));
 const aim=factRotation(keep([
  e('start',0,0,{kind:'aim',phase:'start'}),e('shot1',.2,0,{kind:'aim',phase:'shot',enabled:gates[0]}),e('shot2',.4,0,{kind:'aim',phase:'shot',enabled:gates[1]}),
  e('end',1,0,{kind:'aim',phase:'end',enabled:gates[2]}),e('start2',5,0,{kind:'aim',phase:'start'}),e('shot3',5.1,0,{kind:'aim',phase:'shot'}),e('end2',5.5,0,{kind:'aim',phase:'end'}),
 ]));
 const aimOut=[.19,.41,1.01,5.51,15.5].map(t=>aimingStacks(aim,0,point(t),m));
 const daybreak=factRotation([e('out',2,1,{kind:'switch'}),e('in',6,0,{kind:'switch'})],keep([
  e('n1',.5,0,{category:'normal',enabled:gates[0]}),e('n2',.55,0,{category:'normal',enabled:gates[1]}),e('s1',.6,0,{category:'skill',enabled:gates[2]}),e('n3',1.1,0,{category:'normal'}),
 ]));
 const daybreakOut=[false,true].flatMap(magus=>[.59,.61,1.11,5.1,7.1].flatMap(t=>Object.values(daybreakStacks(daybreak,0,point(t),magus,m))));
 const husk=factRotation([e('out',7,0,{kind:'switch'}),e('in',11,1,{kind:'switch'})],keep([
  e('g1',0,1,{category:'skill',element:'Geo',onField:true,enabled:gates[0]}),e('physical',.15,1,{category:'normal',element:'Physical',onField:true}),
  e('g2',.3,1,{category:'skill',element:'Geo',onField:true,enabled:gates[1]}),e('g3',6.3,1,{category:'skill',element:'Geo',onField:true,enabled:gates[2]}),
 ]),1);
 const huskOut=[.1,.31,6.31,7.01,10.01,11.01,16.31,17.01].map(t=>huskStacks(profiles,husk,1,point(t),m));
 return {energy:energyOut,pickup:pickupOut,aim:aimOut,daybreak:daybreakOut,husk:huskOut,outputs:[...energyOut,...pickupOut,...aimOut,...daybreakOut,...huskOut]};
}
