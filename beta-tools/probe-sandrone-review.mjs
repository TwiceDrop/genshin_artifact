// Independent numeric review of Sandrone's added Stellar Swirl skills.
// Reads exact source ratios and checks the real published WASM + facade.
// This script does not write product code or reports.
import fs from 'node:fs'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {bindings} from '../mona_wasm/pkg/bindings.js'
import * as bridge from '../mona_wasm/pkg/mona_wasm_bg.js'
import {createStellarSupportFacade} from '../beta-data/stellar-support-facade.mjs'
import {createStrengthenedFacade} from '../beta-data/strengthened-facade.mjs'
globalThis.module={require:createRequire(import.meta.url)}
const file=p=>new URL('../'+p,import.meta.url)
bindings.lI(new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(file('mona_wasm/pkg/mona_wasm_bg.wasm'))),{'./mona_wasm_bg.js':bridge}).exports)
const original={CommonInterface:bindings.Ps,CalculatorInterface:bindings.K2,OptimizeSingleWasm:bindings.E2,BonusPerStat:bindings.bd,CalcArtifactBestSet:bindings.uC}
const support=createStellarSupportFacade(original,original)
const api=createStrengthenedFacade(support.facade,support.transformStellarTarget)
const data=JSON.parse(fs.readFileSync(file('beta-data/sandrone-stellar-skills.json'),'utf8'))
const sum=x=>Object.values(x||{}).reduce((a,b)=>a+b,0)
const named=(name,config)=>({name,config:{[name]:config}})
const close=(actual,expected,label)=>assert.ok(Number.isFinite(actual)&&Math.abs(actual-expected)<Math.max(1e-7,Math.abs(expected)*1e-9),label+': '+actual+' != '+expected)
const fixture=(co=0,level=90,talent=10)=>({
 character:{name:'Sandrone',level,ascend:false,constellation:co,skill1:talent-1,skill2:talent-1,skill3:talent-1,
  params:{Sandrone:{stellar_base_active:false,em_conversion_active:false,c1_team_stellar:false,c6_elevate_active:false}}},
 weapon:{name:'WasterGreatsword',level:1,ascend:false,refine:1,params:'NoConfig'},
 skill:{index:18,config:{Sandrone:{c2_ray_stacks:0,prism_overcharge:false,burst_tactics_stacks:0,stellarconduct_hits:0}}},
 artifacts:[],buffs:[],enemy:null,artifact_config:null,
})
function expected(x,{emBonus=0,bonus=0,base=0,elevation=0,res=.9,flat=0}={}){
 const a=api.CommonInterface.get_attribute(x),co=x.character.constellation,idx=x.skill.index,c=x.character.params.Sandrone,s=x.skill.config.Sandrone
 const atk=sum(a.atk),em=sum(a.elemental_mastery)+emBonus,cr=Math.min(1,Math.max(0,sum(a.critical)))
 let ratio=idx===18?data.charged[x.character.skill1]:idx===19?data.skill[x.character.skill2]:idx===20?data.burst[x.character.skill3]:idx===21&&co>=4?data.c4:idx===22&&co>=6?data.c6:0
 if(idx===19&&s.prism_overcharge)ratio*=4
 if(idx===20)ratio*=1+.1*s.burst_tactics_stacks
 const c2=co>=2&&idx===18?.4+.2*Math.min(3,Math.max(0,s.c2_ray_stacks)):0
 const cd=sum(a.critical_damage)+c2
 const non=(atk*ratio+flat)*(1+6*em/(2000+em)+bonus+(co>=1&&c.c1_team_stellar?.3:0))*(1+base+(c.stellar_base_active?Math.min(.14,atk*.00007):0))*(1+elevation+(co>=6&&c.c6_elevate_active?.2:0))*res
 return {non_critical:non,critical:non*(1+cd),expectation:non*(1+cr*cd),ratio}
}
let checks=0
function check(x,options={},label=''){
 const analysis=api.CalculatorInterface.get_damage_analysis(x,null)
 const actual=analysis.direct_stellarswirl
 const e=expected(x,options)
 if(e.ratio===0){assert.ok(!actual||actual.expectation===0,label+' should be disabled');checks++;return}
 assert.ok(actual,label+' missing direct_stellarswirl')
 for(const key of ['non_critical','critical','expectation'])close(actual[key],e[key],label+' '+key)
 checks++
}
const tests=[]
function test(name,fn){try{fn();tests.push({name,pass:true});console.log('PASS',name)}catch(e){tests.push({name,pass:false,error:String(e)});console.error('FAIL',name,String(e))}}
test('all 45 source skill multipliers across levels 1/20/50/90 and C0/2/4/6',()=>{
 for(const level of [1,20,50,90])for(const co of [0,2,4,6])for(let talent=1;talent<=15;talent++)for(const index of [18,19,20]){
  const x=fixture(co,level,talent);x.skill.index=index;check(x,{},'L'+level+' C'+co+' T'+talent+' idx'+index)
 }
})
test('C4 and C6 fixed ATK ratios and constellation gates',()=>{
 for(const level of [1,90])for(const co of [0,3,4,5,6])for(const index of [21,22]){
  const x=fixture(co,level);x.skill.index=index;check(x,{},'L'+level+' C'+co+' idx'+index)
 }
})
test('C2 condensed beam critical damage, E overcharge and Q tactic stacks',()=>{
 for(const co of [0,2,6])for(const index of [18,19,20,21,22])for(const stack of [0,1,3]){
  const x=fixture(co);x.skill.index=index
  Object.assign(x.skill.config.Sandrone,{c2_ray_stacks:stack,prism_overcharge:true,burst_tactics_stacks:stack===3?10:stack*5})
  check(x,{},'C'+co+' idx'+index+' stack'+stack)
 }
})
test('EM, universal stellar damage, resistance, C1, base and C6 elevation combine in their correct buckets',()=>{
 for(const em of [0,500,2000])for(const index of [18,19,20,21,22]){
  const x=fixture(6);x.skill.index=index
  Object.assign(x.character.params.Sandrone,{stellar_base_active:true,c1_team_stellar:true,c6_elevate_active:true})
  x.buffs=[named('ElementalMastery',{value:em}),named('EnhanceStellarGlimmerReaction',{p:30}),named('ElevateStellarGlimmerReaction',{p:25}),named('ResMinus',{p:20})]
  check(x,{bonus:.3,elevation:.25,res:1.05},'EM'+em+' idx'+index)
 }
})
test('another character base bonus adds to Sandrone base rather than multiplying it twice',()=>{
 const x=fixture(6);Object.assign(x.character.params.Sandrone,{stellar_base_active:true,c6_elevate_active:true})
 x.buffs=[named('OdetteTalent1',{atk:2000,radiance_mode:2})]
 for(const index of [18,19,20,21,22]){x.skill.index=index;check(x,{base:.14},'Odette base idx'+index)}
})
test('Qiqi C6 direct flat belongs before EM bonus, while Mizuki C1 reaction flat never contaminates direct damage',()=>{
 const x=fixture(6);x.buffs=[named('ElementalMastery',{value:500}),named('QiqiC6StellarConduct',{atk:2000}),named('YumemizukiMizukiC1',{em:1000})]
 for(const index of [18,19,20,21,22]){x.skill.index=index;check(x,{flat:12000},'Qiqi+Mizuki idx'+index)}
})
test('old Sandrone skills are unchanged without any new support buffs',()=>{
 for(const co of [0,2,4,6])for(let index=0;index<=17;index++){
  const x=fixture(co);x.skill.index=index
  assert.deepEqual(api.CalculatorInterface.get_damage_analysis(x,null),original.CalculatorInterface.get_damage_analysis(x,null),'C'+co+' old idx'+index)
 }
})

const targetFor=(mode,skill)=>({name:'SandroneStellarSwirl',params:{SandroneStellarSwirl:{mode,...skill.config.Sandrone}}})
function inventoryFor(x){
 const raw=JSON.parse(fs.readFileSync(file('beta-data/mizuki-fixture.json'),'utf8')).input.artifacts
 const fixed=raw.map((a,i)=>({...a,id:i+1,set_name:'GladiatorsFinale',sub_stats:[]}))
 x.artifacts=fixed
 const bare=sum(api.CommonInterface.get_attribute(x).atk)
 const head=fixed.find(a=>a.slot==='Head')
 const heads=[
  {...head,id:5,sub_stats:[['ATKFixed',1990-bare],['CriticalRate',0]]},
  {...head,id:6,sub_stats:[['ATKFixed',2010-bare],['CriticalRate',.06]]},
  {...head,id:7,sub_stats:[['ATKFixed',2300-bare],['CriticalDamage',.5]]},
 ]
 return {fixed:fixed.filter(a=>a.slot!=='Head'),heads,all:[...fixed.filter(a=>a.slot!=='Head'),...heads]}
}
test('outer product chain: all five targets agree with each candidate across ATK 2000, crit cap, levels and Cryo-only resistance',()=>{
 for(const level of [1,20,90])for(const critical of [30,45,100])for(let mode=0;mode<5;mode++){
  const x=fixture(6,level,15);x.skill.index=18+mode
  Object.assign(x.character.params.Sandrone,{stellar_base_active:true,em_conversion_active:true,c1_team_stellar:true,c6_elevate_active:true})
  Object.assign(x.skill.config.Sandrone,{c2_ray_stacks:3,prism_overcharge:true,burst_tactics_stacks:10})
  x.buffs=[named('Critical',{p:critical}),named('QiqiC6StellarConduct',{atk:1700}),{name:'YumemizukiMizukiC6',config:'NoConfig'},named('YumemizukiMizukiC1',{em:1200}),named('YumemizukiMizukiC2',{em:500}),named('OdetteTalent1',{atk:1000,radiance_mode:2})]
  x.enemy={level:100,electro_res:.1,pyro_res:.1,hydro_res:.1,cryo_res:process.argv.includes("--default-enemy")?.1:.7,geo_res:.1,anemo_res:-.4,dendro_res:.1,physical_res:.1}
  const inv=inventoryFor(x),expectedByHead=new Map()
  for(const head of inv.heads){
   const y={...x,artifacts:[...inv.fixed,head]}
   const attack=sum(api.CommonInterface.get_attribute(y).atk)
   close(attack,head.id===5?1990:head.id===6?2010:2300,'candidate ATK')
   expectedByHead.set(head.id,api.CalculatorInterface.get_damage_analysis(y,null).direct_stellarswirl.expectation)
  }
  for(const startingHead of [inv.heads[0],inv.heads[2]]){
   x.artifacts=[...inv.fixed,startingHead]
   const rows=api.OptimizeSingleWasm.optimize({...x,target_function:targetFor(mode,x.skill),algorithm:'Naive',constraint:null,filter:null},inv.all)
   assert.ok(rows.length)
   close(rows[0].value,Math.max(...expectedByHead.values()),'outer optimum L'+level+' mode'+mode+' crit'+critical)
   for(const row of rows){close(row.value,expectedByHead.get(row.head),'outer candidate '+row.head);checks++}
  }
 }
})
test('outer product chain: bonus-per-stat equals actual damage changes around the ATK and crit caps',()=>{
 for(const attack of [1990,2010])for(const critical of [30,100])for(let mode=0;mode<5;mode++){
  const x=fixture(6);x.skill.index=18+mode
  Object.assign(x.character.params.Sandrone,{stellar_base_active:true,em_conversion_active:true,c1_team_stellar:true,c6_elevate_active:true})
  Object.assign(x.skill.config.Sandrone,{c2_ray_stacks:3,prism_overcharge:true,burst_tactics_stacks:10})
  x.buffs=[named('Critical',{p:critical}),named('QiqiC6StellarConduct',{atk:1700}),{name:'YumemizukiMizukiC6',config:'NoConfig'}]
  const inv=inventoryFor(x);x.artifacts=[...inv.fixed,inv.heads[attack===1990?0:1]]
  const baseline=api.CalculatorInterface.get_damage_analysis(x,null).direct_stellarswirl.expectation
  const gains=api.BonusPerStat.bonus_per_stat({...x,tf:targetFor(mode,x.skill),artifacts_config:x.artifact_config})
  for(const [name,key,value]of [['ATKPercentage','atk_percentage',5.8],['Critical','critical_rate',3.9],['CriticalDamage','critical_damage',7.8],['ElementalMastery','elemental_mastery',23]]){
   const y=structuredClone(x);y.buffs.push(named(name,name==='ElementalMastery'?{value}:{p:value}))
   const actual=api.CalculatorInterface.get_damage_analysis(y,null).direct_stellarswirl.expectation/baseline-1
   close(gains[key]?.[0]??0,actual,'outer gain '+key+' ATK'+attack+' crit'+critical+' mode'+mode);checks++
  }
 }
})
test('outer product chain rejects theoretical set ranking before target conversion',()=>{
 const x=fixture(6)
 assert.throws(()=>api.CalcArtifactBestSet.calc_artifact_best_set({...x,target_function:targetFor(0,x.skill)}),/暂不支持理论套装排行/)
})

console.log(JSON.stringify({passed:tests.filter(x=>x.pass).length,total:tests.length,checks}))
if(tests.some(x=>!x.pass))process.exitCode=1
