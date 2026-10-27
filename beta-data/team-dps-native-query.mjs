import {createNativeGraphCompiler} from './team-dps-native-compiler.mjs';
import {LEGACY_EFFECT_SLOTS} from './legacy-effect-slots.mjs';
const statSlots={HPFixed:24,ATKFixed:28,DEFFixed:32,HPPercentage:25,ATKPercentage:29,DEFPercentage:33,ElementalMastery:4,Recharge:8,CriticalRate:37,CriticalDamage:52,HealingBonus:2};
for(const element of ['Hydro','Cryo','Pyro','Electro','Anemo','Geo','Dendro','Physical'])statSlots[element+'Bonus']=LEGACY_EFFECT_SLOTS['Bonus'+element];
const isRef=v=>v&&typeof v==='object'&&Number.isInteger(v.index)&&Object.keys(v).length===1;
const keyEdge=e=>JSON.stringify([e.from1,e.from2,e.to,e.label,e.fn,e.data]);
const slotKey=n=>'config_'+n.replace(/([A-Z])/g,'_$1').slice(1).toLowerCase();
export function createPortableNativeQuery({api,capture,libraries,projections,extensionSlots,builder,stats,setCount,sets,onProgress}){
 const compilers=libraries.map(lib=>createNativeGraphCompiler(builder,lib)),m=compilers[0].math;
 const templates=new Map(),setTemplates=new Map();
 function native(input,damage=false){
  const config=input.artifact_config;
  input={...input,artifact_config:config?Object.fromEntries([...new Set(input.artifacts.map(a=>a.set_name))].map(name=>[slotKey(name),config[slotKey(name)]])):null};
  const key=JSON.stringify([input,damage]);if(templates.has(key))return templates.get(key);
  const result=damage?api.CalculatorInterface.get_damage_analysis(input,null):api.CommonInterface.get_attribute(input);
  const snapshot=structuredClone(capture(input.character.name==='Vodyanitsa'));
  const value={result,snapshot};templates.set(key,value);return value;
 }
 function query(input,role,event,damage=false){
  onProgress?.({templates:templates.size});
  const ext=input.character.name==='Vodyanitsa',compiler=compilers[+ext],slot=i=>ext?i+(i>=70?12:11):i;
  const dynamic=[],clone=(value,path=[])=>{
   if(isRef(value)){dynamic.push({path,value});return 0;}
   if(Array.isArray(value))return value.map((v,i)=>clone(v,[...path,i]));
   if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,clone(v,[...path,k])]));
   return value;
  };
  const fixed=clone({...input,artifacts:[]}),buffDynamic=dynamic.filter(d=>d.path[0]==='buffs'),parameters=dynamic.filter(d=>d.path[0]!=='buffs'&&d.path[0]!=='artifact_config');
  const base=native(fixed,damage),snapshot=structuredClone(base.snapshot);
  function difference(other,baseSnapshot){
   const result={nodes:[],edges:[]};
   for(let i=0;i<snapshot.nodes.length;i++){
    const baseMap=new Map(baseSnapshot.nodes[i].map(v=>[v.label,v.value])),nextMap=new Map(other.nodes[i].map(v=>[v.label,v.value]));
    for(const label of new Set([...baseMap.keys(),...nextMap.keys()])){
     const difference=(nextMap.get(label)||0)-(baseMap.get(label)||0);
     if(difference)result.nodes.push({index:i,label,value:difference});
    }
   }
   const old=new Map(baseSnapshot.edges.map(e=>[keyEdge(e),e])),next=new Map(other.edges.map(e=>[keyEdge(e),e]));
   for(const [key,edge]of old)if(!next.has(key))result.edges.push({...edge,scale:-1});
   for(const [key,edge]of next)if(!old.has(key))result.edges.push({...edge,scale:1});
   return result;
  }
  function merge(diff,scale){
   for(const {index,label,value}of diff.nodes)snapshot.nodes[index].push({label,value:m.mul(value,scale)});
   for(const edge of diff.edges)snapshot.edges.push({...edge,scale:m.mul(edge.scale,scale)});
  }
  function delta(other,baseSnapshot,scale){merge(difference(other,baseSnapshot),scale);}
  function setDelta(key,from,to,scale){
   if(!setTemplates.has(key))setTemplates.set(key,difference(native(to).snapshot,native(from).snapshot));
   merge(setTemplates.get(key),scale);
  }
  const setPath=(target,path,value)=>{let x=target;for(const k of path.slice(0,-1))x=x[k];x[path.at(-1)]=value;};
  for(const p of parameters){
   const variant=structuredClone(fixed);setPath(variant,p.path,1);
   delta(native(variant,damage).snapshot,base.snapshot,p.value);
  }
  for(const name of sets){
   let previous=fixed;
   for(const count of [2,4]){
    const variant={...fixed,artifacts:['Flower','Feather','Sand','Goblet'].slice(0,count).map((slot,i)=>({id:i+1,slot,set_name:name,star:5,level:0,main_stat:['HPFixed',0],sub_stats:[]}))};
    const gate=m.ge(setCount(role,name),count),key=JSON.stringify([role,name,count,fixed.artifact_config?.[slotKey(name)]]);
    setDelta(key,previous,variant,gate);
    for(const p of dynamic.filter(p=>p.path[0]==='artifact_config'&&p.path[1]===slotKey(name))){
     const changed=structuredClone(variant);setPath(changed,p.path,1);
     if(count===4)setDelta(key+'/'+p.path.join('/'),variant,changed,m.mul(gate,p.value));
    }
    previous=variant;
   }
  }
  const overrides=new Map(),graph=compiler.graph(snapshot,overrides),add=(i,v)=>overrides.set(i,m.add(overrides.get(i)||0,v));
  for(const [name,i]of Object.entries(statSlots))if(stats(role,name)!==0){
   const value=stats(role,name),baseSlot={HPPercentage:23,ATKPercentage:27,DEFPercentage:31}[name];
   add(slot(i),baseSlot?m.mul(graph.get(slot(baseSlot)),value):value);
  }
  for(const p of buffDynamic){
   const attribute=p.path.at(-1),baseSlot={HPPercentage:23,ATKPercentage:27,DEFPercentage:31}[attribute];
   add(ext?extensionSlots[attribute]:LEGACY_EFFECT_SLOTS[attribute],baseSlot?m.mul(graph.get(slot(baseSlot)),p.value):p.value);
  }
  const panelMap={atk:[27,29,28,6],hp:[23,25,24],def:[31,33,32],elemental_mastery:[4,5],recharge:[8],critical:[37],critical_damage:[52],healing_bonus:[2],shield_strength:[9]};
  for(const element of ['Hydro','Cryo','Pyro','Electro','Anemo','Geo','Dendro','Physical'])panelMap['bonus_'+element.toLowerCase()]=[LEGACY_EFFECT_SLOTS['Bonus'+element]];
  if(!damage)return Object.fromEntries(Object.entries(panelMap).map(([key,slots])=>[key,{compiled:slots.reduce((n,i)=>m.add(n,graph.get(slot(i))),0)}]));
  const projection=projections.find(p=>p.role===role&&p.index===event.index&&!!p.furinaC6===!!input.skill.config?.Furina?.c6_after_e).fields;
  const originalGraph=compiler.graph(base.snapshot),result={};
  for(const field of ['atk','hp','def','em','atk_ratio','hp_ratio','def_ratio','em_ratio','extra_damage','bonus','critical','critical_damage','independent_damage_multiplier','def_minus','def_penetration','res_minus','healing_bonus']){
   const slots=projection[field]||[],constant=Object.values(base.result[field]||{}).reduce((a,b)=>a+b,0)-slots.reduce((n,i)=>n+originalGraph.get(i),0);
   result[field]={compiled:slots.reduce((n,i)=>m.add(n,graph.get(i)),constant)};
  }
  if(input.character.name==='Furina'&&[10,11,12].includes(event.index)){
   const talent=base.result.hp_ratio['技能倍率'],count=input.skill.config.Furina.hp_above50_count;
   result.hp_ratio.compiled=m.add(result.hp_ratio.compiled,m.mul(talent*.1,m.sub(count,fixed.skill.config.Furina.hp_above50_count)));
   const original=base.result.bonus['天赋「无人听的自白」'];
   if(original!==undefined)result.bonus.compiled=m.add(m.sub(result.bonus.compiled,original),m.min(.28,m.mul(.007,m.floor(m.div(result.hp.compiled,1000)))));
  }
  result.atk_ratio['技能倍率']=base.result.atk_ratio['技能倍率']||0;
  result.atk_ratio.compiled=m.sub(result.atk_ratio.compiled,result.atk_ratio['技能倍率']);
  if(['RoyalLongsword','RoyalSpear','RoyalGrimoire'].includes(input.weapon.name)){
   const royal=(projection.critical||[]).reduce((n,i)=>m.add(n,graph.named(i,'宗室被动等效')),0);
   result.critical.compiled=m.sub(result.critical.compiled,royal);result.critical['宗室被动等效']=royal;
  }
  return result;
 }
 return {query,math:m,templates};
}
