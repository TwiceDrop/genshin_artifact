import {castFrameTable} from '../cast-frame-table.mjs';
import {elementalApplication as application} from '../ice-electro-reactions.mjs';
import {teamTalentUnlocked} from '../character-levels.mjs';
import {effect,numericSum} from '../rule-utils.mjs';
import {isMoonCrystallize,hasAscendantGleam} from '../moon-crystallize.mjs';
import {createColumbinaRuntime} from './columbina-runtime.mjs';
import {defineActionRecipes,basicAttackRecipes,basicNativeDamage} from '../action-recipes.mjs';
import {COLUMBINA_DOMAIN_BONUS} from '../../lunar-effect-rule-book.mjs';

const ripple=application();
const ordinary=basicAttackRecipes({element:'Hydro',normals:[[0,23],[1,20],[2,41]],charged:[3,72],plunge:[5,6,7],group:'columbina.normal'});
const commands=defineActionRecipes([
 ...ordinary,...['skill','skill.cycle'].map(id=>({id,label:id==='skill'?'万古潮汐':'万古潮汐·循环起点',endOffsetMs:400,events:[
  {kind:'hit',index:8,category:'skill',element:'Hydro',application:application(),delay:.4,cycleStart:id==='skill.cycle'},
 ]})),
 {id:'burst',label:'她的乡愁',endOffsetMs:2000,events:[{kind:'hit',index:13,category:'burst',element:'Hydro',application:application(2),delay:2},{kind:'window',key:'月之领域',delay:2,duration:20}]},
]);
export const columbina={
 castFrames:castFrameTable({skill:41,'skill.cycle':41,burst:131,charged:101},[36,37,76]),
 id:'Columbina',element:'Hydro',weaponType:'Catalyst',panelIndex:8,reactionStatIndex:12,nativeBackend:'legacy',usesElementalApplications:true,enablesLunarCrystallize:true,moonsign:true,
 defaultWeapon:'ApprenticesNotes',previewWeapon:'ApprenticesNotes',capabilities:{energy:60,shield:true,nightsoul:false,arkhe:false},constellationTalents:{3:'skill2',5:'skill3'},
 nativeDamage:{...basicNativeDamage(ordinary),8:{category:'skill',element:'Hydro'},9:{category:'skill',element:'Hydro'},12:{category:'skill',element:'Geo'},13:{category:'burst',element:'Hydro'}},
 actions:commands.actions,
 expand(ctx){
  commands.expand(ctx);
  const casts=ctx.actions.filter(a=>a.action==='skill');
  for(let i=0;i<casts.length;){
   const first=casts[i++],interval=ctx.profile.character.constellation>=2?4:6;
   let expires=first.time+25.4;
   while(i<casts.length&&casts[i].time+.4<expires)expires=casts[i++].time+25.4;
   const repeat=(start,period,template)=>{
    for(let n=0;first.time+start+period*n<expires&&first.time+start+period*n<=ctx.duration;n++){
     ctx.hit(first,{...template,persistent:true},start+period*n,template.index+'/'+n);
    }
   };
   repeat(2.4,2,{label:'引力涟漪',index:9,category:'skill',element:'Hydro',application:ripple});
   if(first.actionId==='skill.cycle')repeat(interval+.4,interval,{label:'引力干涉·月结晶',index:12,category:'skill',element:'Geo',cycleGravity:true,damageModel:'direct.lunarCrystallize',lunarStat:'hp'});
  }
 },
 createTimeline:createColumbinaRuntime,createCombat:createColumbinaRuntime,
 modeled:['ColumbinaP1','ColumbinaQ','ColumbinaConstellation','ColumbinaC2','ColumbinaC6'],
 normalize(p){p.character.params={Columbina:{p1_max_hp_stack:false,p3_active:false,p2_stacks:0,lunar_domain_active:false,gravity_type:3,has_verdant_dew:false,c2_active:false,c4_active:false,c6_active:false}};},
 effects({character:c},{profiles}){
  const trigger={kind:'hit',index:12};
  return [...(teamTalentUnlocked(c,1)?[{id:'columbina.lunarMadness',label:'月诱',stage:'base',target:'self',trigger,duration:10,stacks:{limit:3,refresh:'all'},reads:{},value:({stacks,m})=>({CriticalBase:m.mul(.05,stacks)})}]:[]),
   ...(c.constellation>=2?[{id:'columbina.c2.hp',label:'哥伦比娅·二命',stage:'base',target:'self',trigger,duration:8,reads:{},value:()=>({HPPercentage:.4})},
    ...(hasAscendantGleam(profiles)?[{id:'columbina.c2.def',label:'哥伦比娅·月结晶',stage:'attack',target:'teamOnField',trigger,duration:8,reads:{hp:{stat:'hp',stage:'base',timing:'live'}},value:({m,read})=>({DEFFixed:m.mul(.01,read('hp'))})}]:[])]:[])];
 },
 create({role,profiles,rotation,math:m}){
  const c=profiles[role].character,sum=numericSum(m);
  return {damageBuffs(r,e,_panels,source){
   const state=rotation().characterState(role,e);
   const c6=c.constellation===6&&['Hydro','Geo'].includes(e.element)?m.choose(m.lt(e.time,state?.critUntil??-Infinity),.8,0):0;
   const crit=effect('哥伦比娅·夜昏且暗，且随月光',{CriticalDamageBase:c6});
   if(!isMoonCrystallize(e))return c.constellation===6?[crit]:[];
   const values={EnhanceMoonCrystallizeBase:m.min(.07,m.mul(.000002,sum(source(role).hp)))};
   if(rotation().covered('月之领域',e.time,e.rootOrder))values.EnhanceMoonReaction=COLUMBINA_DOMAIN_BONUS[c.skill3];
   if(r!==role)values.ElevateMoonCrystallize=[0,.015,.085,.1,.115,.13,.2][c.constellation];
   if(r===role&&e.columbinaC4!==undefined)values.ExtraDmgDirectMoonCrystallize=m.mul(e.columbinaC4,m.mul(.125,sum(source(role).hp)));
   return [effect('哥伦比娅·月兆祝赐与月之领域',values),...(c.constellation===6?[crit]:[])];
  }};
 },
};
