import {castFrameTable} from '../cast-frame-table.mjs';
import {defineActionRecipes,basicAttackRecipes,basicNativeDamage} from '../action-recipes.mjs';
import {characterPackages} from '../character-packages.mjs';
import {createLinneaRuntime} from './linnea-runtime.mjs';
import {elementalApplication as application} from '../ice-electro-reactions.mjs';
import {teamTalentUnlocked} from '../character-levels.mjs';
import {effect,numericSum} from '../rule-utils.mjs';
import {hasAscendantGleam,isMoonCrystallize} from '../moon-crystallize.mjs';

// The supplied cycle gives the seventh pummeler explicitly at 19.0.
const pummels=[3,5.5,8.5,11,14,16.5,19];
const ordinary=basicAttackRecipes({normals:[[0,25],[1,22],[2,57]],aimed:[3,25],charged:[4,96,'Geo'],plunge:[5,6,7]});
const commands=defineActionRecipes([...ordinary,
 {id:'skill',label:'对策·露米呀吼吼！',events:[]},{id:'skill.refresh',label:'刷新露米·循环起点',events:[]},
 {id:'skill.mega',label:'露米·百万吨重锤',endOffsetMs:50/60*1000,events:[]},
 {id:'burst',label:'备忘·极端环境生存指南',endOffsetMs:1600,events:[
  {kind:'heal',delay:1.6,recipients:'team',healing:'linnea.initial'},
  {kind:'heal',repeat:{start:2.6,interval:1,duration:14},recipients:'active',healing:'linnea.tick'},
 ]},
]);
function expand(ctx){
 commands.expand(ctx);
 const cast=ctx.actions.find(a=>a.kind==='cast');
 if(cast?.actionId!=='skill.refresh')return;
 const start={...cast,time:0};
 for(let n=0;1.5+5.3*n<=ctx.duration;n++)
  ctx.hit(start,{index:9,category:'skill',element:'Geo',damageModel:'direct.lunarCrystallize',lunarStat:'def',cycleLumi:true,linneaHammer:true,label:'露米·加力重锤',persistent:true},1.5+5.3*n,'hammer/'+n);
 let offset=pummels[0];
 for(let n=0;offset<=ctx.duration;n++){
  for(let part=0;part<2;part++)ctx.hit(start,{index:8,category:'skill',element:'Geo',part,cycleLumi:true,linneaHammer:true,application:application(1,'linnea.pummeler',3,2.5),label:'露米·捶捶乱打',persistent:true},offset+.3*part,'pummeler/'+n+'/'+part);
  offset=pummels[n+1]??offset+(n%2===0?2.5:3);
 }
}
export const linnea={
 castFrames:castFrameTable({skill:14,'skill.refresh':14,'skill.mega':10,burst:110,aimed:23,charged:94},[21,26,43]),
 id:'Linnea',element:'Geo',weaponType:'Bow',panelIndex:8,reactionStatIndex:8,nativeBackend:'legacy',usesElementalApplications:true,enablesLunarCrystallize:true,moonsign:true,
 defaultWeapon:'HuntersBow',previewWeapon:'HuntersBow',capabilities:{energy:60,shield:false,nightsoul:false,arkhe:false},constellationTalents:{3:'skill2',5:'skill3'},
 nativeDamage:{...basicNativeDamage(ordinary),11:{kind:'healing'},12:{kind:'healing'},...Object.fromEntries([8,9,10].map(i=>[i,{category:'skill',element:'Geo'}]))},
 actions:commands.actions,expand,createTimeline:ctx=>createLinneaRuntime({...ctx,previewWindow:ctx.addWindow}),createCombat:createLinneaRuntime,
 effects({character:c}){
  if(c.constellation<4)return [];
  return ['self','teamOnField'].map(target=>({id:'linnea.c4.'+target,label:'莉奈娅·四命',stage:'base',target,trigger:{kind:'timer',mechanic:'linnea.harmony'},duration:5,reads:{},value:()=>({DEFPercentage:.25})}));
 },
 modeled:['LinneaTalent1','LinneaTalent2','LinneaTalent3','LinneaC1','LinneaC2','LinneaC4','LinneaC6'],
 normalize(p){p.character.params={Linnea:{talent1_enabled:false,talent2_mode:0,talent3_enabled:false,c1_record_mooncrystallize_rate:0,c1_record_mega_layers:0,c2_geo_hydro_crit_damage_rate:0,c2_mega_crit_damage_rate:0,c4_mode:0,c4_rate:0,c6_full_moon:false}};},
 skillConfig:()=>({Linnea:{c1_record_mooncrystallize_rate:0,c1_record_mega_layers:0}}),
 create({role,profiles,rotation,math:m}){
  const c=profiles[role].character,sum=numericSum(m),full=hasAscendantGleam(profiles);
  const state=e=>rotation().characterState(role,e);
  return {healingBase:(h,p,native)=>native(h.healing==='linnea.initial'?11:12),attackBuffs(r,e,panels){
   const active=rotation().activeRole(e.time,e.rootOrder),recipient=characterPackages[profiles[active].character.name].moonsign?active:role;
   if(!teamTalentUnlocked(c,4)||r!==recipient)return [];
   return [effect('莉奈娅·万类博物图鉴',{ElementalMasteryExtra:m.mul(.05,sum(panels[role].def))})];
  },damageBuffs(r,e,_panels,source){
   const values={};
   if(c.constellation>=2&&['Hydro','Geo'].includes(characterPackages[profiles[r].character.name].element)){
    const bonus=m.choose(m.lt(e.time,m.add(rotation().reactionAt(e).lastHarmony,8)),.4,0);
    values.CriticalDamageBase=r===role&&e.linneaHammer&&e.index===10?m.add(bonus,1.5):bonus;
   }
   if(e.element==='Geo'&&teamTalentUnlocked(c,1))values.ResMinusGeo=m.choose(m.lt(e.time,state(e)?.expires??-Infinity),full?.3:.15,0);
   if(isMoonCrystallize(e)){
    values.EnhanceMoonCrystallizeBase=m.min(.14,m.mul(.00007,sum(source(role).def)));
    const spent=state(e)?.spent;
    if(spent&&e.targetIds?.length){
     const coefficient=m.div(e.targetIds.reduce((total,id)=>m.add(total,spent[id]??0),0),e.targetIds.length);
     values.ExtraDmgDirectMoonCrystallize=m.mul(coefficient,sum(source(role).def));
    }
    if(c.constellation>=6&&full)values.ElevateMoonCrystallize=.25;
   }
   return [effect('莉奈娅·野外观察手记与月兆祝赐',values)];
  }};
 },
};
