import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {bindings} from '../mona_wasm/pkg/bindings.js';
import * as bridge from '../mona_wasm/pkg/mona_wasm_bg.js';
import * as extension from '../mona_wasm/extension/mona_extension.js';
import {createFacade} from '../beta-data/facade.mjs';
import {createBeta2} from '../beta-data/vesna-facade.mjs';
import {createLimitedWeaponFacade} from '../beta-data/limited-weapon-facade.mjs';
import {normalizeLimitedWeapon, limitedWeaponEffects} from '../beta-data/limited-weapons.mjs';
import {computeCurve,createDamageEvaluator} from '../src/algorithms/stat-gain/curve.mjs';

globalThis.module={require:createRequire(import.meta.url)};
const url=p=>new URL('../'+p,import.meta.url);
const read=p=>JSON.parse(fs.readFileSync(url(p),'utf8').replace(/^(?:\s*\/\/[^\n]*\n)*\s*export default\s*/,''));
bindings.lI(new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(url('mona_wasm/pkg/mona_wasm_bg.wasm'))),{'./mona_wasm_bg.js':bridge}).exports);
extension.initSync(fs.readFileSync(url('mona_wasm/extension/mona_extension_bg.wasm')));
const original={CommonInterface:bindings.Ps,CalculatorInterface:bindings.K2,OptimizeSingleWasm:bindings.E2,BonusPerStat:bindings.bd,TeamOptimizationWasm:bindings.B8,DSLInterface:bindings.ZB};
const support=read('beta-data/extension-support.json'),data=read('beta-data/weapons-limited-71.json');
const previous=createBeta2(createFacade(original,extension,read('beta-data/vodyanitsa.json'),support,read('src/assets/_gen_character.js')),extension,support);
const api=createLimitedWeaponFacade(previous,original,data);
const clone=structuredClone,sum=x=>Object.values(x||{}).reduce((a,b)=>a+b,0);
const close=(a,b,message='')=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=Math.max(1e-7,Math.abs(b)*1e-10),message+' '+a+' != '+b);
// Native legacy Amber predates the published core's C6 config; no product path routes her into it.
const nativeInput=x=>{const y=clone(x);if(y.character.name==='Amber'){y.character.params='NoConfig';y.skill.config='NoConfig';}return y;};
function numericallyEqual(actual,expected){
 if(typeof actual==='number'&&typeof expected==='number')return close(actual,expected);
 if(actual&&expected&&typeof actual==='object'&&typeof expected==='object'){assert.deepEqual(Object.keys(actual).sort(),Object.keys(expected).sort());for(const key of Object.keys(actual))numericallyEqual(actual[key],expected[key]);}
 else assert.equal(actual,expected);
}
const a=(x,core=api)=>core.CommonInterface.get_attribute(core===extension?nativeInput(x):x);
const d=(x,core=api)=>core.CalculatorInterface.get_damage_analysis(x,null);
const baseAtk=p=>p.atk['角色基础攻击']+p.atk['武器基础攻击'];
const named=(name,config)=>({name,config:{[name]:config}});
const equip=(name,params={},refine=1)=>({name,level:90,ascend:false,refine,params:{[name]:params}});
function fixture(character,weapon,params={},refine=1){
 const x={character:{name:character,level:90,ascend:false,constellation:0,skill1:9,skill2:9,skill3:9,params:'NoConfig'},weapon:equip(weapon,params,refine),skill:{index:0,config:'NoConfig'},artifacts:[],artifact_config:null,enemy:null,buffs:[]};
 if(character==='Amber'){x.character.params={Amber:{c6_active:false}};x.skill.config={Amber:{manual_detonation:false}};}
 if(character==='Diluc')x.skill.config={Diluc:{pyro:false}};
 if(character==='Vesna'){x.character.params={Vesna:{stance:true,radiance:true,disciplinary_stacks:6,anemo_cryo_count:1,other_count:0,flat_inside_discipline:false}};x.skill.index=17;}
 if(character==='Vodyanitsa'){x.character.params={Vodyanitsa:{e_active:false,song_active:false,ordinary_mode:true,c1_active:false,c2_active:false,c4_stacks:0,on_field:true}};x.skill={index:11,config:{Vodyanitsa:{low_hp_heal:false,q_song_bonus:false}}};}
 return x;
}
const tests=[];
function test(name,fn){try{fn();tests.push({name,pass:true});console.log('PASS',name);}catch(error){tests.push({name,pass:false,error:String(error),stack:error.stack});console.error('FAIL',name,String(error));}}
const byName=name=>data.weapons.find(w=>w.name===name);
const sumStar=result=>sum(result.direct_stellarswirl_compose);

test('公开快照SHA256、1248等级行及65档中英文特效数值一致',()=>{
 const offsets={11435:[2,3],11436:[0,2],11437:[3,5,4,6],12435:[0,1,2],12436:[0,2],13435:[0,2],13436:[0,1],14435:[0,1],14436:[0,1],14437:[0,1,2,3],15435:[1,0],15436:[0]};
 assert.equal(data.weapons.length,13);
 for(const w of data.weapons){
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(url(w.snapshot))).digest('hex'),w.sha256);
  assert.equal(w.levels.length,96);assert.equal(new Set(w.levels.map(r=>r.level+':'+r.ascend)).size,96);assert.equal(w.refinements.length,5);
  for(const r of w.refinementDetails)for(const field of ['description','descriptionEnglish']){
   const expected=w.id===15437?[r.recharge,r.parameters[0]]:offsets[w.id].map(i=>r.parameters[i]);
   const displayed=[...r[field].matchAll(/<color=[^>]+>\+?([\d.]+)(%)?<\/color>/g)].map(m=>Number(m[1])/(m[2]?100:1));
   assert.equal(displayed.length,expected.length);displayed.forEach((v,i)=>close(v,expected[i],w.name+' R'+r.refine));
  }
 }
 assert.equal(byName('NewBough').secondaryStat,'CriticalDamage');assert.equal(byName('WintersHeavyHeart').secondaryStat,'CriticalDamage');
 assert.equal(byName('Frostbreath').secondaryStat,'Recharge');assert.deepEqual(byName('BreezeborneRefrain').rechargeByRefine,[.2,.25,.3,.35,.4]);
});

const charFor={Sword:'Kaeya',Claymore:'Diluc',Polearm:'Xiangling',Catalyst:'Lisa',Bow:'Amber'};
const statKey={Critical:'critical',CriticalDamage:'critical_damage',Recharge:'recharge',ElementalMastery:'elemental_mastery',ATKPercentage:'atk',DEFPercentage:'def'};
for(const w of data.weapons)test(w.displayName+'：原生1～90级及六处突破前后（96组）',()=>{
 for(const row of w.levels){
  const x=fixture(charFor[w.weaponType],w.name);x.weapon=normalizeLimitedWeapon(x.weapon);x.weapon.level=row.level;x.weapon.ascend=row.ascend;
  const panel=a(x,extension);
  close(panel.atk['武器基础攻击'],row.attack,w.name+' Lv'+row.level+(row.ascend?'+':''));
  let expected=row.subStat;
  if(w.secondaryStat==='ATKPercentage')expected*=baseAtk(panel);
  if(w.secondaryStat==='DEFPercentage')expected*=panel.def['角色基础防御'];
  close(panel[statKey[w.secondaryStat]]['武器副词条'],expected,w.name+' 副词条');
 }
});

const proxies={
 NewBough:['Kaeya','HereticsMoltenBlade',{movement_rate:0},'critical','critical_damage'],
 WintersHeavyHeart:['Lisa','TheWidsith',{t1_rate:0,t2_rate:0,t3_rate:0},'critical_damage','critical_damage'],
 BreezeborneRefrain:['Amber','JadeVista',{same_count:0,diff_count:0},'critical','critical'],
};
for(const [name,[character,proxy,params,remove,add]] of Object.entries(proxies))test(name+'：旧角色保持原核白值曲线并换成精确副词条（96组）',()=>{
 for(const row of byName(name).levels){
  const x=fixture(character,name);x.weapon.level=row.level;x.weapon.ascend=row.ascend;
  const y=fixture(character,proxy,params);y.weapon.level=row.level;y.weapon.ascend=row.ascend;
  const actual=a(x),reference=a(y,original);
  close(actual.atk['武器基础攻击'],reference.atk['武器基础攻击']);
  close(sum(actual.atk),sum(reference.atk));
  const expectedRemove=sum(reference[remove])-reference[remove]['武器副词条'];
  close(sum(actual[remove]),expectedRemove+(add===remove?row.subStat:0));
  if(add!==remove)close(sum(actual[add]),sum(reference[add])+row.subStat);
  close(sum(actual.recharge),sum(reference.recharge)+(name==='BreezeborneRefrain'?.2:0));
 }
});

for(let refine=1;refine<=5;refine++){
 test('新枝R'+refine+'：普通/星烁替换、0～3层与0/50/100%覆盖率，凯亚与薇斯纳',()=>{
  const normalAtk=[.04,.05,.06,.07,.08][refine-1],starAtk=[.06,.075,.09,.105,.12][refine-1],em=[20,25,30,35,40][refine-1],star=[.08,.1,.12,.14,.16][refine-1];
  for(const character of ['Kaeya','Vesna']){
   const off=fixture(character,'NewBough',{stacks:0,rate:1,radiance:false},refine),before=a(off),beforeDamage=d(off);
   for(const radiance of [false,true])for(const stacks of [0,1,2,3])for(const rate of [0,.5,1]){
    const x=fixture(character,'NewBough',{stacks,rate,radiance},refine),after=a(x),result=d(x),n=stacks*rate;
    const addAtk=(radiance?starAtk:normalAtk)*n,addEM=radiance?0:em*n,addStar=radiance?star*n:0;
    close(sum(after.atk)-sum(before.atk),baseAtk(before)*addAtk);
    close(sum(after.elemental_mastery)-sum(before.elemental_mastery),addEM);
    close(sum(after.critical_damage),sum(before.critical_damage));
    if(character==='Kaeya')close(sumStar(result)-6*sum(after.elemental_mastery)/(2000+sum(after.elemental_mastery)),addStar);
    else{
     const atk0=sum(before.atk),atk1=sum(after.atk),em0=sum(before.elemental_mastery),em1=sum(after.elemental_mastery);
     const ratio=atk1/atk0*(1+Math.min(atk1*.00007,.14))/(1+Math.min(atk0*.00007,.14))*(1+6*em1/(2000+em1)+addStar)/(1+6*em0/(2000+em0));
     close(result.direct_stellarswirl.non_critical,beforeDamage.direct_stellarswirl.non_critical*ratio);
    }
   }
  }
 });
 test('凝雪沉心R'+refine+'：冰雷含装备者合计最多4位，普通/星烁互斥，丽莎与沃雅妮莎',()=>{
  const cryoEM=[24,30,36,42,48][refine-1],electroAtk=[.048,.06,.072,.084,.096][refine-1],radiantEM=[20,25,30,35,40][refine-1],star=[.06,.075,.09,.105,.12][refine-1];
  for(const character of ['Lisa','Vodyanitsa']){
   const off=fixture(character,'WintersHeavyHeart',{cryo_count:0,electro_count:0,radiance:false},refine),before=a(off);
   for(const [cryo_count,electro_count] of [[0,0],[4,0],[0,4],[2,2],[1,2]])for(const radiance of [false,true]){
    const x=fixture(character,'WintersHeavyHeart',{cryo_count,electro_count,radiance},refine),after=a(x);
    close(sum(after.atk)-sum(before.atk),baseAtk(before)*(radiance?0:electro_count*electroAtk));
    close(sum(after.elemental_mastery)-sum(before.elemental_mastery),radiance?(cryo_count+electro_count)*radiantEM:cryo_count*cryoEM);
    if(character==='Lisa')close(sumStar(d(x))-6*sum(after.elemental_mastery)/(2000+sum(after.elemental_mastery)),radiance?(cryo_count+electro_count)*star:0);
   }
  }
 });
 test('柔风游弦R'+refine+'：充能20～40%常驻，覆盖率只影响星伤',()=>{
  const recharge=[.2,.25,.3,.35,.4][refine-1],star=[.24,.3,.36,.42,.48][refine-1];
  const off=fixture('Amber','BreezeborneRefrain',{rate:0},refine),before=a(off),damage0=d(off);
  for(const rate of [0,.25,.5,1]){
   const x=fixture('Amber','BreezeborneRefrain',{rate},refine),after=a(x),result=d(x);
   close(sum(after.recharge),1+recharge);close(sum(after.critical),.05+.2756);
   close(sumStar(result)-sumStar(damage0),star*rate);
   close(result.normal.expectation,damage0.normal.expectation);close(sum(after.atk),sum(before.atk));
  }
 });
}

test('10把纪行/锻造武器：R1～R5独立开关与原生面板增量',()=>{
 const scenarios=[
  ['HereticsMoltenBlade','Vesna',{movement_rate:0},{movement_rate:.5},.18,0],
  ['Emberwell','Vesna',{reaction_active:false,stellar_active:false},{reaction_active:true,stellar_active:false},.16,0],
  ['BladeOfAtonement','Diluc',{reaction_active:false,stellar_active:false},{reaction_active:true,stellar_active:true},.16,64],
  ['Frostbreath','Xiangling',{active:false},{active:true},.2,0],
  ['SongOfTheVigil','Xiangling',{stellar_active:false},{stellar_active:true},.2,0],
  ['ClashOfKings','Vodyanitsa',{active:false},{active:true},.2,100],
  ['EchoesOfTheHeart','Vodyanitsa',{reaction_active:false,stellar_active:false},{reaction_active:true,stellar_active:true},0,60],
  ['JadeVista','Amber',{same_count:0,diff_count:0},{same_count:2,diff_count:1},.12,128],
  ['CovenantOfFrostAndSnow','Amber',{active:false},{active:true},0,120],
  ['ForgedByTheGoldenMelody','Diluc',{state:2,counterpoint_active:false,counterpoint_state:0},{state:2,counterpoint_active:true,counterpoint_state:1},.18,0],
 ];
 for(let refine=1;refine<=5;refine++)for(const [name,char,off,on,atk,em] of scenarios){
  const factor=[1,1.25,1.5,1.75,2][refine-1],before=a(fixture(char,name,off,refine),extension),after=a(fixture(char,name,on,refine),extension);
  close(sum(after.atk)-sum(before.atk),baseAtk(before)*atk*factor,name+' ATK R'+refine);
  close(sum(after.elemental_mastery)-sum(before.elemental_mastery),em*factor,name+' EM R'+refine);
  close(sum(after.recharge),sum(before.recharge),name+' 回能不能当成充能');
 }
});

test('引火之源：薇斯纳星伤开关独立于攻击开关',()=>{
 const off=fixture('Vesna','Emberwell',{reaction_active:false,stellar_active:false},5),x=clone(off);x.weapon.params.Emberwell.stellar_active=true;
 const em=sum(a(off).elemental_mastery),existing=1+6*em/(2000+em);
 close(sum(a(x).atk),sum(a(off).atk));close(d(x).direct_stellarswirl.non_critical,d(off).direct_stellarswirl.non_critical*(existing+.32)/existing);
 const starOnly=d(x).direct_stellarswirl.non_critical;x.weapon.params.Emberwell.reaction_active=true;assert.ok(d(x).direct_stellarswirl.non_critical>starOnly);
});

test('悬黎千钧旧2+2迁移为2+1，同元素优先且总队友最多3位',()=>{
 const legacy=equip('JadeVista',{same_count:2,diff_count:2},5),normalized=normalizeLimitedWeapon(legacy);
 assert.deepEqual(normalized.params.JadeVista,{same_count:2,diff_count:1,rate:1});assert.deepEqual(legacy.params.JadeVista,{same_count:2,diff_count:2});
 const overflow=normalizeLimitedWeapon(equip('JadeVista',{same_count:4,diff_count:4}));assert.deepEqual(overflow.params.JadeVista,{same_count:3,diff_count:0,rate:1});
 const actual=fixture('Amber','JadeVista',{same_count:2,diff_count:2},5),off=fixture('Amber','JadeVista',{same_count:0,diff_count:0},5);
 close(sum(a(actual).elemental_mastery)-sum(a(off).elemental_mastery),256);close(sum(a(actual).atk)-sum(a(off).atk),baseAtk(a(off))*.24);
});

test('金律铸影复调独立：当前攻击乐章叠加精通复调，当前星伤叠加攻击复调',()=>{
 for(const core of [api,extension])for(let refine=1;refine<=5;refine++){
  const atk=[.18,.225,.27,.315,.36][refine-1],em=[120,150,180,210,240][refine-1];
  const off=fixture('Diluc','ForgedByTheGoldenMelody',{state:0,counterpoint_active:false,counterpoint_state:0},refine),cross=clone(off);
  cross.weapon.params.ForgedByTheGoldenMelody={state:0,counterpoint_active:true,counterpoint_state:2};
  close(sum(a(cross,core).atk),sum(a(off,core).atk));close(sum(a(cross,core).elemental_mastery)-sum(a(off,core).elemental_mastery),em);
  const same=clone(off);same.weapon.params.ForgedByTheGoldenMelody.counterpoint_active=true;
  close(sum(a(same,core).atk)-sum(a(off,core).atk),baseAtk(a(off,core))*atk);
  off.weapon.params.ForgedByTheGoldenMelody.state=2;cross.weapon.params.ForgedByTheGoldenMelody={state:2,counterpoint_active:true,counterpoint_state:1};
  close(sum(a(cross,core).atk)-sum(a(off,core).atk),baseAtk(a(off,core))*atk);
 }
});

const team=(refine,rate)=>named('BreezeborneRefrainSupport',{refine,rate});
test('柔风队友Buff：旧角色星伤生效、普通伤害不变，多来源同名取最大',()=>{
 const off=fixture('Lisa','TheWidsith',{t1_rate:0,t2_rate:0,t3_rate:0}),before=d(off);
 for(const buffs of [[team(1,1)],[team(1,1),team(1,1)],[team(1,1),team(5,.75)],[team(5,.75),team(1,1)]]){
  const x=clone(off);x.buffs=buffs;const value=buffs.length===2&&buffs.some(b=>b.config.BreezeborneRefrainSupport.refine===5)?.36:.24;
  close(sumStar(d(x))-sumStar(before),value);close(d(x).normal.expectation,before.normal.expectation);
 }
});
test('柔风队友Buff：薇斯纳实际星伤增加、多个来源不叠加',()=>{
 const off=fixture('Vesna','NewBough',{stacks:0,radiance:true,rate:1}),before=d(off);
 const x=clone(off);x.buffs=[team(1,1),team(5,.75),team(5,.75)];
 close(d(x).direct_stellarswirl.non_critical,before.direct_stellarswirl.non_critical*1.36);
});
test('薇斯纳已有通用星伤Buff时，队友柔风正确叠加而不被同名过滤',()=>{
 const off=fixture('Vesna','NewBough',{stacks:0,radiance:true,rate:1});off.buffs=[named('EnhanceStellarGlimmerReaction',{p:30})];
 const x=clone(off);x.buffs.push(team(1,1));
 close(d(x).direct_stellarswirl.non_critical,d(off).direct_stellarswirl.non_critical*1.54/1.3);
});
test('装备柔风与队友同名Buff取最大，自己的效果不能算两次',()=>{
 const off=fixture('Amber','BreezeborneRefrain',{rate:0},5),x=clone(off);x.weapon.params.BreezeborneRefrain.rate=.5;
 const self=d(x);close(sumStar(self)-sumStar(d(off)),.24);
 x.buffs=[team(1,1),team(1,1)];close(sumStar(d(x)),sumStar(self));
 x.buffs.push(team(5,.75));close(sumStar(d(x))-sumStar(d(off)),.36);close(d(x).normal.expectation,self.normal.expectation);
});

test('寒息/戍望谣歌直接回能保留目标与CD，不折算面板充能',()=>{
 const frost=limitedWeaponEffects(equip('Frostbreath',{active:true},5)),song=limitedWeaponEffects(equip('SongOfTheVigil',{stellar_active:true},5));
 close(frost.energyPerTrigger,12);close(frost.energyInterval,16);assert.equal(frost.energyTarget,'队伍中其他角色');
 close(song.energyPerTrigger,8);close(song.energyInterval,9);assert.equal(song.energyTarget,'装备者');close(frost.recharge,0);close(song.recharge,0);
});

test('覆盖率、层数、队伍人数、精炼、等级和开关无效时在计算前拒绝',()=>{
 const malformed=[];
 for(const [key,value] of [['level',0],['level',91],['level',1.5],['refine',0],['refine',6],['refine',1.5],['ascend',1]]){
  const x=fixture('Kaeya','NewBough');x.weapon[key]=value;malformed.push(x);
 }
 for(const [name,char,params] of [
  ['NewBough','Kaeya',{stacks:-1}],['NewBough','Kaeya',{stacks:4}],['NewBough','Kaeya',{stacks:1.5}],
  ['NewBough','Kaeya',{rate:-.01}],['NewBough','Kaeya',{rate:1.01}],['NewBough','Kaeya',{rate:NaN}],['NewBough','Kaeya',{radiance:1}],
  ['WintersHeavyHeart','Lisa',{cryo_count:3,electro_count:2}],['WintersHeavyHeart','Lisa',{cryo_count:1.5}],['WintersHeavyHeart','Lisa',{electro_count:-1}],
  ['BreezeborneRefrain','Amber',{rate:Infinity}],['ForgedByTheGoldenMelody','Diluc',{counterpoint_state:4}],['JadeVista','Amber',{same_count:-1}],
 ])malformed.push(fixture(char,name,params));
 const invalidAscension=fixture('Kaeya','NewBough');invalidAscension.weapon.level=30;invalidAscension.weapon.ascend=true;malformed.push(invalidAscension);
 for(const x of malformed)assert.throws(()=>a(x),x.weapon.name+' '+JSON.stringify(x.weapon));
 for(const [refine,rate] of [[0,1],[6,1],[2.5,1],[1,-.1],[1,1.1],[1,NaN]]){
  const x=fixture('Vesna','NewBough');x.buffs=[team(refine,rate)];assert.throws(()=>a(x));
 }
});

test('新枝单人配装、十词条收益、最优曲线与薇斯纳实际星伤一致',()=>{
 const x=fixture('Vesna','NewBough',{stacks:3,radiance:true,rate:.5},5);x.artifacts=read('beta-data/mizuki-fixture.json').input.artifacts;
 x.buffs=[team(5,.5)];const target={name:'VesnaDefault',params:'NoConfig'},baseline=d(x).direct_stellarswirl.expectation;
 const results=api.OptimizeSingleWasm.optimize({...x,target_function:target,algorithm:'Naive',constraint:null,filter:null},x.artifacts);
 assert.ok(results.length);close(results[0].value,baseline);
 const bonus=api.BonusPerStat.bonus_per_stat({...x,tf:target,artifacts_config:x.artifact_config});assert.equal(bonus.atk_percentage.length,10);
 for(const n of [1,10]){
  const y=clone(x);y.buffs.push(named('ATKPercentage',{p:.058*n*100}));
  close(bonus.atk_percentage[n-1],d(y).direct_stellarswirl.expectation/baseline-1);
 }
 const options={stats:['ATKPercentage','ElementalMastery','CriticalDamage'],maxRolls:3,tier:'average'};
 const ev=createDamageEvaluator(api,x,'direct_stellarswirl',null,options.stats,options.tier),curve=computeCurve(ev.evaluate,options);
 close(curve.baseline,baseline);assert.equal(curve.points.length,4);assert.ok(curve.points[3].damage>baseline);
 for(const point of curve.points)close(point.damage,ev.evaluate(point.allocation));
});

test('旧角色新枝配装目标、词条收益和普通伤害曲线都读取武器效果',()=>{
 const x=fixture('Kaeya','NewBough',{stacks:3,radiance:false,rate:.5},5);x.artifacts=read('beta-data/mizuki-fixture.json').input.artifacts.map(t=>({...t,set_name:'GladiatorsFinale'}));
 const target={name:'MaxATK',params:'NoConfig'},baseline=sum(a(x).atk);
 const results=api.OptimizeSingleWasm.optimize({...x,target_function:target,algorithm:'Naive',constraint:null,filter:null},x.artifacts);
 assert.ok(results.length);close(results[0].value,baseline);
 const bonus=api.BonusPerStat.bonus_per_stat({...x,tf:target,artifacts_config:x.artifact_config});assert.equal(bonus.atk_percentage.length,10);
 close(bonus.atk_percentage[0],baseAtk(a(x))*.058/baseline);
 const options={stats:['ATKPercentage','CriticalDamage'],maxRolls:2,tier:'average'},ev=createDamageEvaluator(api,x,'normal',null,options.stats,options.tier);
 const curve=computeCurve(ev.evaluate,options);close(curve.baseline,d(x).normal.expectation);
});

test('MONA-DSL第二参数接入新枝/柔风与队友Buff，数值和面板伤害一致',()=>{
 const sword=fixture('Kaeya','NewBough',{stacks:3,radiance:false,rate:.5},5);
 const bow=fixture('Amber','BreezeborneRefrain',{rate:.5},5);bow.buffs=[team(5,.75),team(1,1)];
 const cases=[
  [sword,'prop p = Kaeya.atk\nprint(p)\nprop cd = Kaeya.cd0\nprint(cd)',[sum(a(sword).atk),sum(a(sword).critical_damage)]],
  [bow,'prop er = Amber.recharge\nprint(er)\ndmg a = Amber.Normal1\nprint(a.normal.e)',[sum(a(bow).recharge),d(bow).normal.expectation]],
 ];
 for(const [x,source,expected]of cases){const result=api.DSLInterface.run(source,x,x.artifacts);assert.equal(result.is_error,false,result.error_msg);const values=result.output.replace(/^MONA:\s*/gm,'').trim().split(/\s+/).map(Number);assert.equal(values.length,expected.length);values.forEach((v,i)=>close(v,expected[i]));}
 const vesna=fixture('Vesna','NewBough');assert.throws(()=>api.DSLInterface.run('print(1)',vesna,[]),/DSL/);
});

test('薇斯纳未实现静态评分时明确拒绝而不进入WASM panic',()=>{
 const x=fixture('Vesna','NewBough',{stacks:3,radiance:true,rate:1},5),target={name:'VesnaDefault',params:'NoConfig'},artifacts=read('beta-data/mizuki-fixture.json').input.artifacts;
 assert.throws(()=>api.CommonInterface.get_artifacts_rank_by_character(x.character,x.weapon,target,artifacts),/静态评分/);
});

test('无新武器/新队友Buff的旧角色与原发布内核面板和伤害数值一致',()=>{
 for(const file of ['beta-data/skirk-fixture.json','beta-data/mizuki-fixture.json']){
  const x=read(file).input;numericallyEqual(a(x),a(x,original));numericallyEqual(d(x),d(x,original));
 }
});
test('计算和配置迁移不修改用户输入',()=>{
 const x=fixture('Kaeya','NewBough',{stacks:3,radiance:true,rate:.5});x.buffs=[team(5,1)];const before=clone(x);a(x);d(x);assert.deepEqual(x,before);
});


// Coverage values describe average stat uptime, not a timeline simulation.
// These vectors are the per-effect R1 game values; refinement multipliers are
// explicit and assertions exercise both native and published calculation paths.
const coverageScenarios=[
 {name:'NewBough',character:'Kaeya',config:{stacks:3,radiance:false},rates:{rate:{attack:.12,em:60}}},
 {name:'NewBough',character:'Kaeya',config:{stacks:3,radiance:true},rates:{rate:{attack:.18,stellar:.24}}},
 {name:'WintersHeavyHeart',character:'Lisa',config:{cryo_count:2,electro_count:2,radiance:false},rates:{rate:{attack:.096,em:48}}},
 {name:'WintersHeavyHeart',character:'Lisa',config:{cryo_count:2,electro_count:2,radiance:true},rates:{rate:{em:80,stellar:.24}}},
 {name:'HereticsMoltenBlade',character:'Kaeya',config:{movement_rate:.5},rates:{rate:{attack:.18}}},
 {name:'Emberwell',character:'Kaeya',config:{reaction_active:true,stellar_active:true},rates:{reaction_rate:{attack:.16},stellar_rate:{stellar:.16}}},
 {name:'ForgedByTheGoldenMelody',character:'Diluc',config:{state:0,counterpoint_active:true,counterpoint_state:2},rates:{rate:{attack:.18},counterpoint_rate:{em:120}}},
 {name:'ForgedByTheGoldenMelody',character:'Diluc',config:{state:2,counterpoint_active:true,counterpoint_state:1},rates:{rate:{stellar:.28},counterpoint_rate:{attack:.18}}},
 {name:'ForgedByTheGoldenMelody',character:'Diluc',config:{state:0,counterpoint_active:true,counterpoint_state:0},rates:{rate:{attack:.18},counterpoint_rate:{attack:.18}}},
 {name:'BladeOfAtonement',character:'Diluc',config:{reaction_active:true,stellar_active:true},rates:{reaction_rate:{em:64},stellar_rate:{attack:.16}}},
 {name:'Frostbreath',character:'Xiangling',config:{active:true},rates:{rate:{attack:.2},energy_rate:{energy:6}}},
 {name:'SongOfTheVigil',character:'Xiangling',config:{stellar_active:true},rates:{rate:{attack:.2},energy_rate:{energy:4}}},
 {name:'ClashOfKings',character:'Lisa',config:{active:true},rates:{rate:{attack:.2,em:100}}},
 {name:'EchoesOfTheHeart',character:'Lisa',config:{reaction_active:true,stellar_active:true},rates:{reaction_rate:{em:60},stellar_rate:{stellar:.16}}},
 {name:'JadeVista',character:'Amber',config:{same_count:2,diff_count:1},rates:{rate:{attack:.12,em:128}}},
 {name:'CovenantOfFrostAndSnow',character:'Amber',config:{active:true},rates:{rate:{em:120}}},
 {name:'BreezeborneRefrain',character:'Amber',config:{},rates:{rate:{stellar:.24}}},
];
for(let refine=1;refine<=5;refine++)test('全13把R'+refine+'：各独立覆盖率0/25/50/100%，原生/旧核面板及星伤、基础属性不变',()=>{
 const factor=[1,1.25,1.5,1.75,2][refine-1];
 for(const scenario of coverageScenarios){
  const {name,character,config,rates}=scenario,zeros=Object.fromEntries(Object.keys(rates).map(key=>[key,0]));
  const baseline=fixture(character,name,{...config,...zeros},refine);
  for(const core of [api,extension]){
   const before=a(baseline,core),sub=statKey[byName(name).secondaryStat];
   for(const [key,vector] of Object.entries(rates))for(const rate of [0,.25,.5,1]){
    const x=clone(baseline);x.weapon.params[name][key]=rate;const after=a(x,core),effects=limitedWeaponEffects(x.weapon);
    const atk=(vector.attack||0)*factor*rate,em=(vector.em||0)*factor*rate,star=(vector.stellar||0)*factor*rate;
    const label=name+' R'+refine+' '+key+'='+rate+' '+(core===api?'published':'native');
    close(sum(after.atk)-sum(before.atk),baseAtk(before)*atk,label+' ATK');
    close(sum(after.elemental_mastery)-sum(before.elemental_mastery),em,label+' EM');
    close(effects.attack,atk,label+' summary ATK');close(effects.em,em,label+' summary EM');close(effects.stellar,star,label+' summary stellar');
    close(after.atk['武器基础攻击'],before.atk['武器基础攻击'],label+' base');
    if(before[sub]['武器副词条']===undefined)assert.equal(after[sub]['武器副词条'],undefined,label+' replaced sub');
    else close(after[sub]['武器副词条'],before[sub]['武器副词条'],label+' sub');
    for(const stat of ['critical','critical_damage','recharge','hp','def'])close(sum(after[stat]),sum(before[stat]),label+' '+stat);
    if(name==='BreezeborneRefrain')close(sum(after.recharge),1+[.2,.25,.3,.35,.4][refine-1],label+' permanent ER');
    if(core===api){
     const afterDamage=d(x),emTotal=sum(after.elemental_mastery);
     close(sumStar(afterDamage)-6*emTotal/(2000+emTotal),star,label+' actual stellar bucket');
    }
    if(key==='energy_rate'){
     close(effects.energyPerTrigger,vector.energy*factor,label+' energy per trigger');
     close(effects.energyPerInterval,vector.energy*factor*rate,label+' average energy');
    }
   }
  }
 }
});

test('新增覆盖率兼容旧存档：缺省100%，已有新枝/柔风语义和用户保存值不被覆盖',()=>{
 for(const scenario of coverageScenarios){
  if(['NewBough','BreezeborneRefrain'].includes(scenario.name))continue;
  const w=equip(scenario.name,clone(scenario.config)),before=clone(w),normalized=normalizeLimitedWeapon(w);
  for(const key of Object.keys(scenario.rates))close(normalized.params[scenario.name][key],1,scenario.name+' '+key+' default');
  assert.deepEqual(w,before);
  const key=Object.keys(scenario.rates)[0];w.params[scenario.name][key]=.25;
  close(normalizeLimitedWeapon(JSON.parse(JSON.stringify(w))).params[scenario.name][key],.25);
 }
 close(normalizeLimitedWeapon(equip('NewBough',{})).params.NewBough.rate,1);
 close(normalizeLimitedWeapon(equip('BreezeborneRefrain',{})).params.BreezeborneRefrain.rate,0);
});

test('每个新增覆盖率拒绝非有限数值、越界、空值和错误类型',()=>{
 const seen=new Set();
 for(const {name,character,config,rates} of coverageScenarios)for(const key of Object.keys(rates)){
  if(seen.has(name+key))continue;seen.add(name+key);
  for(const value of [-.01,1.01,NaN,Infinity,-Infinity,null,'0.5',true]){
   const x=fixture(character,name,{...config,[key]:value});
   assert.throws(()=>normalizeLimitedWeapon(x.weapon),name+' '+key+' '+String(value));
   assert.throws(()=>a(x),name+' '+key+' calculation');
  }
 }
});

test('触发开关关闭时100%覆盖率仍无相应增益，复调关闭不影响独立基础乐章',()=>{
 const scenarios=[
  ['Emberwell','Kaeya',{reaction_active:false,stellar_active:false,reaction_rate:1,stellar_rate:1}],
  ['BladeOfAtonement','Diluc',{reaction_active:false,stellar_active:false,reaction_rate:1,stellar_rate:1}],
  ['EchoesOfTheHeart','Lisa',{reaction_active:false,stellar_active:false,reaction_rate:1,stellar_rate:1}],
  ['Frostbreath','Xiangling',{active:false,rate:1,energy_rate:1}],
  ['SongOfTheVigil','Xiangling',{stellar_active:false,rate:1,energy_rate:1}],
  ['ClashOfKings','Lisa',{active:false,rate:1}],
  ['CovenantOfFrostAndSnow','Amber',{active:false,rate:1}],
 ];
 for(const [name,character,config] of scenarios)for(const core of [api,extension]){
  const off=fixture(character,name,config,5),zero=clone(off);
  for(const key of Object.keys(zero.weapon.params[name]))if(key.endsWith('rate'))zero.weapon.params[name][key]=0;
  const actual=a(off,core),base=a(zero,core);
  close(sum(actual.atk),sum(base.atk));close(sum(actual.elemental_mastery),sum(base.elemental_mastery));
  const effects=limitedWeaponEffects(off.weapon);close(effects.attack,0);close(effects.em,0);close(effects.stellar,0);
 }
 const golden=fixture('Diluc','ForgedByTheGoldenMelody',{state:0,rate:.25,counterpoint_active:false,counterpoint_state:2,counterpoint_rate:1},5);
 close(limitedWeaponEffects(golden.weapon).attack,.09);close(limitedWeaponEffects(golden.weapon).em,0);
 const zero=clone(golden);zero.weapon.params.ForgedByTheGoldenMelody.rate=0;
 for(const core of [api,extension])close(sum(a(golden,core).atk)-sum(a(zero,core).atk),baseAtk(a(zero,core))*.09);
});

test('寒息/戍望谣歌回能触发率独立于攻击Buff覆盖率，不影响面板和伤害',()=>{
 for(const name of ['Frostbreath','SongOfTheVigil'])for(let refine=1;refine<=5;refine++){
  const config=name==='Frostbreath'?{active:true}:{stellar_active:true};
  const off=fixture('Xiangling',name,{...config,rate:.25,energy_rate:0},refine),before=a(off),damage0=d(off);
  const energy=(name==='Frostbreath'?[6,7.5,9,10.5,12]:[4,5,6,7,8])[refine-1];
  for(const energy_rate of [0,.25,.5,1]){
   const x=clone(off);x.weapon.params[name].energy_rate=energy_rate;const effect=limitedWeaponEffects(x.weapon);
   close(effect.energyPerTrigger,energy);close(effect.energyPerInterval,energy*energy_rate);
   close(effect.energyInterval,name==='Frostbreath'?16:9);
   close(sum(a(x).atk),sum(before.atk));close(sum(a(x).recharge),sum(before.recharge));
   close(d(x).normal.expectation,damage0.normal.expectation);
  }
 }
});

test('薇斯纳引火之源双覆盖率真实星伤：攻击与星伤独立进入各乘区',()=>{
 for(let refine=1;refine<=5;refine++){
  const bonus=[.16,.2,.24,.28,.32][refine-1];
  const off=fixture('Vesna','Emberwell',{reaction_active:true,stellar_active:true,reaction_rate:0,stellar_rate:0},refine),before=a(off),damage0=d(off).direct_stellarswirl.non_critical;
  const atk0=sum(before.atk),em=sum(before.elemental_mastery),existing=1+6*em/(2000+em);
  for(const reaction_rate of [0,.25,.5,1])for(const stellar_rate of [0,.25,.5,1]){
   const x=clone(off);Object.assign(x.weapon.params.Emberwell,{reaction_rate,stellar_rate});const after=a(x),atk1=atk0+baseAtk(before)*bonus*reaction_rate;
   close(sum(after.atk),atk1);close(sum(after.elemental_mastery),em);
   const expected=damage0*atk1/atk0*(1+Math.min(atk1*.00007,.14))/(1+Math.min(atk0*.00007,.14))*(existing+bonus*stellar_rate)/existing;
   close(d(x).direct_stellarswirl.non_critical,expected);
  }
 }
});

test('沃雅妮莎群王局戏覆盖率同时影响普攻与精通蒸发，曲线读取同一数值',()=>{
 const off=fixture('Vodyanitsa','ClashOfKings',{active:true,rate:0},5);off.skill.index=0;
 const before=a(off),damage0=d(off);
 for(const rate of [0,.25,.5,1]){
  const x=clone(off);x.weapon.params.ClashOfKings.rate=rate;const panel=a(x),result=d(x);
  close(sum(panel.atk),sum(before.atk)+baseAtk(before)*.4*rate);close(sum(panel.elemental_mastery),200*rate);
  const expectedNormal=damage0.normal.non_critical*sum(panel.atk)/sum(before.atk);
  close(result.normal.non_critical,expectedNormal);
  close(result.vaporize.non_critical,expectedNormal*2*(1+(25/9)*(200*rate)/(1400+200*rate)));
  const options={stats:['ATKPercentage','ElementalMastery'],maxRolls:1,tier:'average'};
  const ev=createDamageEvaluator(api,x,'vaporize',null,options.stats,options.tier),curve=computeCurve(ev.evaluate,options);
  close(curve.baseline,result.vaporize.expectation);
 }
});

test('薇斯纳新双覆盖率接入单人配装、十词条收益与最优曲线',()=>{
 const x=fixture('Vesna','Emberwell',{reaction_active:true,stellar_active:true,reaction_rate:.25,stellar_rate:.5},5);
 x.artifacts=read('beta-data/mizuki-fixture.json').input.artifacts;
 const target={name:'VesnaDefault',params:'NoConfig'},baseline=d(x).direct_stellarswirl.expectation;
 const optimized=api.OptimizeSingleWasm.optimize({...x,target_function:target,algorithm:'Naive',constraint:null,filter:null},x.artifacts);
 assert.ok(optimized.length);close(optimized[0].value,baseline);
 const bonus=api.BonusPerStat.bonus_per_stat({...x,tf:target,artifacts_config:x.artifact_config});
 for(const n of [1,10]){
  const y=clone(x);y.buffs.push(named('ATKPercentage',{p:5.8*n}));
  close(bonus.atk_percentage[n-1],d(y).direct_stellarswirl.expectation/baseline-1);
 }
 const options={stats:['ATKPercentage','ElementalMastery','CriticalDamage'],maxRolls:2,tier:'average'};
 const ev=createDamageEvaluator(api,x,'direct_stellarswirl',null,options.stats,options.tier),curve=computeCurve(ev.evaluate,options);
 close(curve.baseline,baseline);for(const point of curve.points)close(point.damage,ev.evaluate(point.allocation));
});

test('金律旧角色跨乐章双覆盖率接入真实蒸发、配装、收益、曲线',()=>{
 const off=fixture('Diluc','ForgedByTheGoldenMelody',{state:0,rate:0,counterpoint_active:true,counterpoint_state:2,counterpoint_rate:0},5);off.skill.index=9;
 const x=clone(off);Object.assign(x.weapon.params.ForgedByTheGoldenMelody,{rate:.25,counterpoint_rate:.5});
 const before=a(off),after=a(x),beforeDamage=d(off),afterDamage=d(x);
 close(sum(after.atk)-sum(before.atk),baseAtk(before)*.09);close(sum(after.elemental_mastery)-sum(before.elemental_mastery),120);
 close(afterDamage.normal.non_critical,beforeDamage.normal.non_critical*sum(after.atk)/sum(before.atk));
 close(afterDamage.vaporize.non_critical,afterDamage.normal.non_critical*1.5*(1+(25/9)*120/(1400+120)));
 x.artifacts=read('beta-data/mizuki-fixture.json').input.artifacts.map(t=>({...t,set_name:'GladiatorsFinale'}));
 const target={name:'MaxATK',params:'NoConfig'},atk=sum(a(x).atk);
 const optimized=api.OptimizeSingleWasm.optimize({...x,target_function:target,algorithm:'Naive',constraint:null,filter:null},x.artifacts);
 assert.ok(optimized.length);close(optimized[0].value,atk);
 const bonus=api.BonusPerStat.bonus_per_stat({...x,tf:target,artifacts_config:x.artifact_config});close(bonus.atk_percentage[0],baseAtk(a(x))*.058/atk);
 const options={stats:['ATKPercentage','ElementalMastery'],maxRolls:2,tier:'average'},ev=createDamageEvaluator(api,x,'vaporize',null,options.stats,options.tier),curve=computeCurve(ev.evaluate,options);
 close(curve.baseline,d(x).vaporize.expectation);for(const point of curve.points)close(point.damage,ev.evaluate(point.allocation));
});

const report={checkedAt:new Date().toISOString(),passed:tests.filter(t=>t.pass).length,total:tests.length,tests};
fs.writeFileSync(url('beta-data/limited-71-tests.json'),JSON.stringify(report,null,2)+'\n');
console.log(report.passed+'/'+report.total+' passed');if(report.passed!==report.total)process.exitCode=1;
