import {TEAM_DPS_CHARACTER_CAPABILITIES} from './team-dps-config.mjs';
import characters from '../src/assets/_gen_character.js';
import {equipmentWeakpoint} from './equipment-combat-facts.mjs';

const nc=['normal','charged'],ncp=[...nc,'plunge'];
const recipes={
 Messenger:r=>({weakpoint:true,chance:1,cooldown:10,ratio:.75+.25*r,forceCritical:true,targetCount:1,label:'信使·飞矢传书'}),
 SkywardSpine:r=>({categories:nc,chance:.5,cooldown:2,ratio:.25+.15*r,label:'天空之脊·真空刃'}),
 Frostbearer:(r,cryo)=>({categories:nc,chance:.5+.1*r,cooldown:10,ratio:cryo?1.6+.4*r:.65+.15*r,label:'忍冬之果·恒冰晶核'}),
 DragonspineSpear:(r,cryo)=>({categories:nc,chance:.5+.1*r,cooldown:10,ratio:cryo?1.6+.4*r:.65+.15*r,label:'龙脊长枪·恒冰晶核'}),
 Halberd:r=>({categories:['normal'],chance:1,cooldown:10,ratio:1.2+.4*r,label:'钺矛·追加攻击'}),
 PrizedIsshinBlade:()=>({categories:ncp,chance:1,cooldown:8,ratio:1.8,label:'「一心传」名刀·祟灵'}),
 SwordOfNarzissenkreuz:r=>({categories:ncp,chance:1,cooldown:12,ratio:1.2+.4*r,delay:.1,label:'水仙十字之剑·荒芒冲击'}),
 SkywardAtlas:r=>({categories:['normal'],chance:.5,cooldown:30,ratio:1.2+.4*r,children:'atlas',targetCount:1,label:'天空之卷·浮游攻击'}),
 EyeOfPerception:r=>({categories:nc,chance:.5,cooldown:13-r,ratio:2.1+.3*r,children:'eye',targetCount:1,label:'昭心·昭心法球'}),
 FilletBlade:r=>({chance:.5,cooldown:16-r,ratio:2+.4*r,label:'吃虎鱼刀·决'}),
 SwordOfDescension:()=>({categories:nc,chance:.5,cooldown:10,ratio:2,label:'降临之剑·降世'}),
 SkywardBlade:r=>({categories:nc,chance:1,cooldown:0,burstWindow:12,ratio:.15+.05*r,label:'天空之刃·破空之势'}),
 CursedBlade:()=>({categories:ncp,chance:1,cooldown:8,ratio:1.8,label:'笼钓瓶一心·切落风'}),
 AshGravenDrinkingHorn:r=>({chance:1,cooldown:15,ratio:.3+.1*r,stat:'hp',delay:0,live:true,label:'苍纹角杯·范围伤害'}),
 TheFlute:r=>({categories:nc,chance:1,cooldown:.5,harmonics:{count:5,lifetime:30},ratio:.75+.25*r,delay:0,live:true,label:'笛剑·和音'}),
};

// Only recipe structure is compiled. Whether a hit exists, spends a cooldown,
// or completes a harmonic pool is resolved anew for each candidate.
export function compileEquipmentProcRules(profiles,settings={}){
 const cryo=profiles.some(p=>characters[p.character.name].element==='Cryo');
 return profiles.map(profile=>{
  const {name,refine}=profile.weapon,recipe=recipes[name]?.(refine,cryo);
  if(name==='SwordOfNarzissenkreuz'&&(TEAM_DPS_CHARACTER_CAPABILITIES[profile.character.name]?.arkhe||settings.narzissenkreuz_enabled===false))return;
  return recipe?{stat:'atk',delay:1/60,...recipe,name,accept:hit=>hit.onField&&hit.category!=='equipment'&&(!recipe.categories||recipe.categories.includes(hit.category))&&(!recipe.weakpoint||equipmentWeakpoint(profile,hit))}:undefined;
 });
}

export function procChildren(recipe,hit,settings){
 if(recipe.children==='atlas')return Array.from({length:6},(_,i)=>({time:hit.time+(i+1)*147/60+10/60,order:hit.order+.5+(i+1)/100}));
 if(recipe.children==='eye'){
  const ready=Array(settings.enemy_count??1).fill(-Infinity),out=[];let time=hit.time;
  for(let i=0;i<5;i++){
   const target=ready.findIndex(t=>t<=time);if(target<0)break;
   ready[target]=time+.6;time+=10/60;out.push({time,order:hit.order+.5+i/100,targetIds:[target]});
  }
  return out;
 }
 return [{time:hit.time+recipe.delay,order:hit.order+.5}];
}
