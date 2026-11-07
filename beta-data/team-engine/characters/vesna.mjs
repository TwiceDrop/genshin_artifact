import {createVesnaRuntime,VESNA_TIMING} from './vesna-runtime.mjs';
import {effect,numericSum} from '../rule-utils.mjs';

// The primary native formula is Anemo-only. For natural Cryo vortex
// contributions, take the elemental-only delta from two identical infusion
// probes. Query the primary formula last so graph capture retains its ABI.
function nativeAnalysis(api,input,element){
 const get=(x,el)=>api.CalculatorInterface.get_damage_analysis(x,el);
 if(!element||element==='Anemo'||!(input.skill.index===13&&input.character.params.Vesna.radiance||input.skill.index===0&&input.character.params.Vesna.stance))return get(input,element);
 const probe={...input,character:{...input.character,params:{Vesna:{...input.character.params.Vesna,stance:false}}},skill:{index:0,config:'NoConfig'}};
 const from=get(probe,'Anemo'),to=get(probe,element),d=get(input,'Anemo'),s=d.stellar_detail;
 const delta=(base,a,b)=>Object.fromEntries([...new Set([...Object.keys(base),...Object.keys(a),...Object.keys(b)])].map(k=>[k,(base[k]??0)+(b[k]??0)-(a[k]??0)]));
 return {...d,res_minus:delta(d.res_minus,from.res_minus,to.res_minus),...(s?{stellar_detail:{...s,critical:delta(s.critical,from.critical,to.critical),critical_damage:delta(s.critical_damage,from.critical_damage,to.critical_damage)}}:{})};
}
export const vesna={
 id:'Vesna',element:'Anemo',weaponType:'Sword',panelIndex:10,reactionStatIndex:0,stellarStatIndex:13,enablesStellarSwirl:true,usesElementalApplications:true,
 nativeBackend:'extension',constellationTalents:{3:'skill2',5:'skill3'},defaultWeapon:'BeyondTheChrysalis',previewWeapon:'DullBlade',capabilities:{energy:60,shield:false,nightsoul:false,arkhe:false},isBlunt:e=>[8,9].includes(e.index),
 nativeDamage:Object.fromEntries(Array.from({length:20},(_,index)=>[index,({input})=>({category:index<6?'normal':index===6?'charged':index<10?'plunge':index===17?'burst':'skill',element:index<10&&!input.character.params.Vesna.stance?'Physical':'Anemo',...(index>=7&&index<10?{plungeImpact:index!==7}:{})})])),
 nativeParameters:{
  'character.params.Vesna.stance':{zero:false,unit:true,values:[0,1]},
  'character.params.Vesna.radiance':{zero:false,unit:true,values:[0,1]},
  'character.params.Vesna.disciplinary_stacks':{values:[0,1,2,3,4,5,6],constantFields:['atk_ratio','direct_stellarswirl_ratio']},
 },
 actions:[{id:'skill',label:'操典·制胜有道／翔风剑',endOffsetMs:1300},{id:'burst',label:'致礼·献予女皇陛下',endOffsetMs:VESNA_TIMING.burst*1000},
  ...VESNA_TIMING.normal.map((delay,i)=>({id:'normal.'+(i+1),label:'普通攻击·第'+(i+1)+'段',endOffsetMs:(delay+(i===2?.05:0))*1000})),
  {id:'charged',label:'重击',endOffsetMs:VESNA_TIMING.charged*1000},{id:'plunge',label:'高空下落攻击'},{id:'plunge.low',label:'低空下落攻击'},{id:'plunge.collision',label:'下落期间伤害'}],
 modeled:['VesnaTalent1'],normalize:p=>{p.character.params={Vesna:{stance:false,radiance:false,disciplinary_stacks:0,anemo_cryo_count:1,other_count:0,flat_inside_discipline:false}};},
 expand(){},createTimeline:createVesnaRuntime,createCombat:createVesnaRuntime,nativeAnalysis,
 combatCompletion:a=>a.kind==='cast'||a.kind==='action'?a.time:undefined,
 adjustNativeDamage({native,result,math:m,adjustSource}){
  if(!native.stellar_detail)return;
  const atk=Object.values(result.atk).reduce((n,v)=>m.add(n,v),0),before=native.stellar_detail.base_bonus['薇斯纳·星耀祝礼']??0,value=m.min(.14,m.mul(.00007,m.max(0,atk)));
  result.direct_stellarswirl_base_compose.compiled=m.add(result.direct_stellarswirl_base_compose.compiled,m.sub(value,before));adjustSource?.('direct_stellarswirl_base_compose','薇斯纳·星耀祝礼',value,true);
 },
 create({role,profiles,elements,rotation,math:m}){const sum=numericSum(m),ac=elements.filter(e=>['Cryo','Anemo'].includes(e)).length,bool=v=>typeof v==='object'?v:!!v;return {
  prepare(p,e){const s=rotation().characterState?.(role,e);p.character.params.Vesna={...p.character.params.Vesna,stance:bool(e.vesnaStance??s?.stance??0),radiance:bool(e.damageModel==='reaction.stellarSwirl'?1:e.vesnaRadiance??rotation().reactionAt?.(e).swirlRadiance??0),disciplinary_stacks:s?.discipline??0,anemo_cryo_count:ac,other_count:elements.length-ac};},
  damageBuffs(r,e,_panels,source){return r!==role&&['direct.stellarSwirl','reaction.stellarSwirl'].includes(e.damageModel)?[effect('薇斯纳·星耀祝礼',{StellarSwirlBaseBonus:m.min(.14,m.mul(.00007,sum(source(role).atk)))})]:[];},
 };},
};
