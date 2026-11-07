import {scalarMath} from '../../team-dps-numeric-rules.mjs';
import {teamTalentUnlocked} from '../character-levels.mjs';
import {actionTime} from '../rule-utils.mjs';
import {afterEvent,eventKey,compareEventPosition} from '../event-order.mjs';
import {elementalApplication as application} from '../ice-electro-reactions.mjs';

// Animation approximations are explicit here; the resource rules do not encode
// the example rotation's hit count or buff coverage. Sword essence uses sixths.
export const VESNA_TIMING={skill:.6,stage1:.4,stage2:.65,stage3:[.8,.925,1.05,1.175,1.3],burst:2.1,pinion:.5,transpose:.45,normal:[.3,.45,.65,.45,.6,.8],charged:.85};
export function createVesnaRuntime({role,profile,math:m=scalarMath,reactions,enqueue,resources=[],recordResource=row=>resources.push(row),complete=(a,t)=>{a.completionTime=t;}}){
 const c=profile.character,and=(a,b)=>m.choose(a,b,0),possible=v=>typeof v==='object'||!!v;
 const s={until:-Infinity,essence:0,stage:1,highest:0,stanceToken:0,transposeFrom:Infinity,transposeUntil:-Infinity,stacks:Array(6).fill(-Infinity)},history=[];let serial=0;
 const live=e=>m.lt(e.time,s.until),remember=e=>history.push({at:afterEvent(e),...s,stacks:[...s.stacks]});
 function resource(e,value,gate,reason){const before=s.essence;s.essence=m.choose(gate,value,before);if(possible(gate))recordResource({kind:'resource',role,time:e.time,rootOrder:e.rootOrder,eventId:eventKey(e)+'/essence/'+reason,resource:'vesna.essence',before:m.div(before,6),after:m.div(s.essence,6),enabled:gate,reason});}
 function stack(e,gate){if(!teamTalentUnlocked(c,1))return;let carry=actionTime(e.time+20);for(let i=0;i<6;i++){const old=s.stacks[i];s.stacks[i]=m.choose(gate,carry,old);carry=old;}}
 function timer(e,delay,mechanic,values={},key=mechanic){enqueue({kind:'timer',role,time:actionTime(e.time+delay),rootOrder:e.rootOrder+(e.kind==='action'||e.kind==='cast'?20:0),order:e.order,step:delay?0:(e.step??0)+1,eventId:eventKey(e)+'/'+key,mechanic,...values});}
 function strike(e,delay,index,category,gate,key,extra={}){if(possible(gate))timer(e,delay,'vesna.strike',{index,category,enabled:gate,...extra},key);}
 function feathers(e,delay,count,gate){for(let i=0;i<count;i++)timer(e,delay,'vesna.pinion',{enabled:gate},'pinion/'+i);}
 function emit(e,values,key){if(possible(values.enabled??1))enqueue({...e,...values,kind:'hit',mechanic:undefined,time:e.time,step:(e.step??0)+1,parts:e.parts??1,part:e.part??0,eventId:eventKey(e)+'/'+key,eventKey:undefined,parentEventId:eventKey(e)});}
 function exit(e,gate){s.until=m.choose(gate,-Infinity,s.until);resource(e,0,gate,'exit');remember(e);}
 return {
  stateAt(e){const h=history.findLast(h=>compareEventPosition(h.at,e)<=0);return {stance:h?m.lt(e.time,h.until):0,discipline:h?h.stacks.reduce((n,end)=>m.add(n,m.lt(e.time,end)),0):0};},
  beforeEvent(e){if(e.kind==='switch'&&e.from===role&&e.role!==role){exit(e,e.enabled??1);s.stacks=s.stacks.map(t=>m.choose(e.enabled??1,-Infinity,t));s.transposeUntil=m.choose(e.enabled??1,-Infinity,s.transposeUntil);remember(e);}},
  onEvent(e){
   if(e.role!==role)return;const gate=e.enabled??1;
   if(e.mechanic==='vesna.strike'){
    const spirit=[13,14,15,17,19].includes(e.index),radiance=reactions.view().swirlRadiance;
    if(spirit){
     emit(e,{element:'Anemo',application:null,damageModel:'direct.stellarSwirl',vesnaRadiance:true,enabled:and(gate,radiance)},'stellar');
     emit(e,{element:'Anemo',application:application(1,e.index===17?'vesna.burst':'vesna.spirit',2,2),vesnaRadiance:false,enabled:and(gate,m.choose(radiance,0,1))},'ordinary');
    }else if(e.index<10){
     const stance=live(e),app=e.index===7?null:application(1,e.category==='normal'?'vesna.normal':e.category==='charged'?'vesna.charged':'vesna.plunge',3,2.5);
     emit(e,{element:'Anemo',nativeElement:'Anemo',application:app,vesnaStance:true,enabled:and(gate,stance)},'anemo');
     emit(e,{element:'Physical',nativeElement:'Physical',application:null,vesnaStance:false,enabled:and(gate,m.choose(stance,0,1))},'physical');
    }else emit(e,{element:'Anemo',application:application(1,e.index===16?'vesna.spirit':'vesna.skill',e.index===16?2:3,e.index===16?2:2.5),enabled:gate},'hit');
   }else if(e.mechanic==='vesna.pinion'){
    // Summoning, not damage or a successful hit, restores sword essence.
    const enabled=and(gate,live(e));resource(e,m.min(18,m.add(s.essence,1)),enabled,'pinion');
    strike(e,0,16,'skill',enabled,'hit',{label:'风翎'});remember(e);
   }else if(e.mechanic==='vesna.exit')exit(e,gate);
   else if(e.mechanic==='vesna.expire')exit(e,and(gate,and(m.eq(e.token,s.stanceToken),m.ge(e.time,s.until))));
   else if(e.kind==='cast'&&e.action==='burst'){
    resource(e,m.min(18,m.add(s.essence,6)),gate,'burst');stack(e,gate);remember(e);
    strike(e,VESNA_TIMING.burst,17,'burst',gate,'burst',{label:'致礼·献予女皇陛下',completionRoot:e.id});complete(e,actionTime(e.time+VESNA_TIMING.burst));
   }else if(e.kind==='cast'&&e.action==='skill'||e.kind==='action'&&(e.action.startsWith('normal.')||e.action==='charged'||e.action.startsWith('plunge'))){
    const skill=e.kind==='cast',normal=e.action.startsWith('normal.'),transpose=c.constellation>=6&&(skill||normal)?and(gate,and(m.ge(e.time,s.transposeFrom),m.lt(e.time,s.transposeUntil))):0,ordinary=and(gate,m.choose(transpose,0,1));
    if(possible(transpose)){
     s.transposeUntil=m.choose(transpose,-Infinity,s.transposeUntil);
     strike(e,VESNA_TIMING.transpose,18,'skill',transpose,'transpose/body',{label:'翔风剑·变移',completionRoot:e.id});
     strike(e,VESNA_TIMING.transpose,19,'skill',transpose,'transpose/spirit',{label:'翔风剑·变移·灵剑',completionRoot:e.id});
     feathers(e,VESNA_TIMING.transpose+VESNA_TIMING.pinion,3,and(transpose,live(e)));
    }
    if(skill){
     const stance=live(e),initial=and(ordinary,m.choose(stance,0,1)),special=and(ordinary,stance),free=c.constellation>=1?and(m.eq(s.stage,3),m.eq(s.highest,0)):0;
     const allowed=and(special,m.max(free,m.ge(s.essence,6)));
     resource(e,m.min(18,m.add(s.essence,12)),initial,'skill');s.until=m.choose(initial,actionTime(e.time+15),s.until);
     const token=++serial;s.stanceToken=m.choose(initial,token,s.stanceToken);if(possible(initial))timer(e,15,'vesna.expire',{token,enabled:initial});
     s.stage=m.choose(initial,1,s.stage);s.highest=m.choose(initial,0,s.highest);s.stacks=s.stacks.map(t=>m.choose(initial,c.constellation>=2&&teamTalentUnlocked(c,1)?actionTime(e.time+20):-Infinity,t));
     strike(e,VESNA_TIMING.skill,10,'skill',initial,'initial',{label:'操典·制胜有道',completionRoot:e.id});
     const stages=[1,2,3].map(n=>and(allowed,m.eq(s.stage,n)));stack(e,allowed);
     resource(e,m.sub(s.essence,m.choose(free,0,6)),allowed,'windborne');
     strike(e,VESNA_TIMING.stage1,11,'skill',stages[0],'stage1',{label:'翔风剑·一阶',completionRoot:e.id});
     for(const index of [12,13])strike(e,VESNA_TIMING.stage2,index,'skill',stages[1],'stage2/'+index,{label:index===12?'翔风剑·二阶':'翔风剑·二阶灵剑',completionRoot:e.id});
     for(const [i,delay]of VESNA_TIMING.stage3.entries())strike(e,delay,i===4?15:14,'skill',stages[2],'stage3/'+i,{label:i===4?'翔风剑·三阶终结':'翔风剑·三阶灵剑',completionRoot:e.id});
     s.stage=m.choose(allowed,m.min(3,m.add(s.stage,1)),s.stage);s.highest=m.add(s.highest,stages[2]);
     if(c.constellation>=6){s.transposeFrom=m.choose(stages[2],actionTime(e.time+VESNA_TIMING.stage3.at(-1)),s.transposeFrom);s.transposeUntil=m.choose(stages[2],actionTime(e.time+VESNA_TIMING.stage3.at(-1)+5),s.transposeUntil);}
     const last=and(stages[2],m.ge(s.highest,c.constellation>=1?4:3));timer(e,VESNA_TIMING.stage3.at(-1)+1/60,'vesna.exit',{enabled:last});
     complete(e,m.choose(transpose,actionTime(e.time+VESNA_TIMING.transpose),m.choose(initial,actionTime(e.time+VESNA_TIMING.skill),m.choose(stages[2],actionTime(e.time+VESNA_TIMING.stage3.at(-1)),m.choose(stages[1],actionTime(e.time+VESNA_TIMING.stage2),m.choose(stages[0],actionTime(e.time+VESNA_TIMING.stage1),e.time))))));
    }else{
     const index=normal?Number(e.action.at(-1))-1:({charged:6,'plunge.collision':7,'plunge.low':8,plunge:9})[e.action],delay=normal?VESNA_TIMING.normal[index]:index===6?VESNA_TIMING.charged:0,count=normal?[1,1,2,1,1,3][index]:index===7?0:2;
     for(let i=0;i<(index===2?2:1);i++)strike(e,delay+(index===2?i*.05:0),index,normal?'normal':index===6?'charged':'plunge',ordinary,'attack/'+i,{label:normal?'普通攻击·第'+(index+1)+'段':index===6?'重击':'下落攻击',parts:index===2?2:1,part:i,completionRoot:e.id});
     feathers(e,delay+VESNA_TIMING.pinion,count,and(ordinary,live(e)));
     complete(e,m.choose(transpose,actionTime(e.time+VESNA_TIMING.transpose),actionTime(e.time+delay+(index===2?.05:0))));
    }
    remember(e);
   }
  },
 };
}
