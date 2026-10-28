import {teamTalentUnlocked} from '../../team-dps-character-rules.mjs';
import {effect,numericSum} from '../rule-utils.mjs';

export const vodyanitsa={
 id:'Vodyanitsa',element:'Hydro',panelIndex:8,hpRatioLabel:'遥久之歌·独立倍率',
 modeled:['VodyanitsaE','VodyanitsaA4','VodyanitsaC1','VodyanitsaC2','VodyanitsaC6','VodyanitsaSignature'],
 normalize:p=>{p.character.params={Vodyanitsa:{e_active:false,song_active:false,ordinary_mode:true,c1_active:false,c2_active:false,c4_stacks:0,on_field:true}};},
 skillConfig:()=>({Vodyanitsa:{low_hp_heal:false,q_song_bonus:false}}),
 timing:{horn:{start:3,interval:3,duration:16},healing:{start:0,interval:1.5,duration:15}},
 expand({actions,profile,hit,heal,periodic,addWindow}){
  for(const a of actions){
   if(a.action==='skill'){
    const life=16+(profile.character.constellation>=2?9:0);
    addWindow('vodySong',a,life);addWindow('vodyFlat',a,30,0,{frontUses:25,backUses:10});
    hit(a,{index:8,category:'skill',parts:1,element:'Hydro',label:'晨声纷流·施放'},0,'skill');
    periodic(a,{...vodyanitsa.timing.horn,duration:life},offset=>hit(a,{index:9,category:'skill',parts:1,element:'Hydro',label:'唤春角笛'},offset,'horn/'+offset));
    periodic(a,{...vodyanitsa.timing.healing,duration:life},offset=>heal(a,offset,'active'));
   }else if(a.action==='burst')hit(a,{index:11,category:'burst',parts:1,element:'Hydro',label:'终奏·伴尔沉沦'},0,'burst');
   else{const {index,category,label}={'normal.1':{index:0,category:'normal',label:'普通攻击·一段'},charged:{index:4,category:'charged',label:'重击'},plunge:{index:7,category:'plunge',label:'下落攻击'}}[a.action];hit(a,{index,category,label,parts:1,element:'Hydro'},0,a.action);}
  }
 },
 decorate({events,window,settings}){
  const used=new Map(),targets=settings.damage_scope==='all'?(settings.enemy_count??1):1;
  for(const e of events){
   const cycle=window('vodyFlat',e.time,e.rootOrder),key=cycle+'/'+e.onField,n=used.get(key)||0,limit=e.onField?25:10,eligible=cycle>=0&&['Hydro','Cryo'].includes(e.element);
   e.vodyTargets=eligible?Math.max(0,Math.min(targets,limit-n)):0;e.vodyFlat=e.vodyTargets>0;
   if(eligible){e.vodyPool=e.onField?'领唱':'重唱';e.vodyUsesBefore=limit-n;e.vodyUsesAfter=limit-n-e.vodyTargets;used.set(key,n+e.vodyTargets);}
  }
 },
 create({role,profiles,rotation,math:m,settings}){
  const c=profiles[role].character,sum=numericSum(m),a4=teamTalentUnlocked(c,4);
  const active=e=>rotation().model==='actions'?rotation().covered('vodySong',e.time):e.time<rotation().lastCast(role,'skill',e.time)+16;
  return {
   prepare(p,e){const params=p.character.params.Vodyanitsa;params.on_field=e.onField;params.c4_stacks=c.constellation>=4?m.min(3,rotation().heals.filter(h=>h.role===role&&h.time<=e.time&&h.time>=rotation().lastCast(role,'skill',e.time,e.rootOrder)).reduce((n,h)=>m.add(n,h.enabled??1),0)):0;},
   hpRatioMultiplier:e=>e.index===11&&active(e)?1+[.48,.516,.552,.6,.636,.672,.72,.768,.816,.864,.912,.96,1.02,1.08,1.14][c.skill3]:1,
   attackBuffs(r,e,panels){return active(e)&&c.constellation>=1?[effect('沃雅妮莎·一命',{ATKFixed:m.mul(.008,sum(panels[role].hp))})]:[];},
   damageBuffs(r,e,panels){
    const out=[],add=(label,values)=>out.push(effect(label,values));
    if(active(e)){
     if(['Hydro','Cryo'].includes(e.element))add('沃雅妮莎·宣叙·晨声纷流',{ResMinusBase:[.165,.18,.195,.21,.225,.24,.255,.27,.285,.3,.318,.336,.354,.372,.39][c.skill2]});
     if(c.constellation>=2&&(e.onField||c.constellation>=6))add('沃雅妮莎·二命',{CriticalDamageBase:.5});
     if(c.constellation>=6)add('沃雅妮莎·六命',{BonusBase:.6});
    }
    if(e.vodyFlat&&a4){const targets=settings.damage_scope==='all'?(settings.enemy_count??1):1;add('沃雅妮莎·十二弦的泪歌',{ExtraDmgBase:m.div(m.mul(m.min(3500,m.mul(m.max(0,m.sub(sum(panels[role].hp),40000)),.14)),e.vodyTargets),targets)});}
    return out;
   },
   healingBase:(h,p,native)=>native(10),
   recipientHealing(h,j,value){return !h.healing&&c.constellation>=4?m.choose(m.lt(rotation().healthAt(h).ratios[j],.5),m.mul(value,1.5),value):value;},
  };
 },
};
