
import fs from 'node:fs';
import {createRequire} from 'node:module';
globalThis.module={require:createRequire(import.meta.url)};
import {bindings} from '../mona_wasm/pkg/bindings.js';
import * as bridge from '../mona_wasm/pkg/mona_wasm_bg.js';
import * as extension from '../mona_wasm/extension/mona_extension.js';
import {createFacade} from '../beta-data/facade.mjs';
import {createBeta2} from '../beta-data/vesna-facade.mjs';
import {createLimitedWeaponFacade} from '../beta-data/limited-weapon-facade.mjs';
import {createStellarSupportFacade} from '../beta-data/stellar-support-facade.mjs';
import {createStrengthenedFacade} from '../beta-data/strengthened-facade.mjs';
import {createExpandedWeaponsFacade} from '../beta-data/expanded-weapons.mjs';
import {withHybridTeamOptimization,deriveTeamBuffs} from '../beta-data/hybrid-team-optimizer.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url),'utf8').replace(/^(?:\s*\/\/[^\n]*\n)*\s*export default\s*/,''));
bindings.lI(new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(new URL('../mona_wasm/pkg/mona_wasm_bg.wasm',import.meta.url))),{'./mona_wasm_bg.js':bridge}).exports);
extension.initSync(fs.readFileSync(new URL('../mona_wasm/extension/mona_extension_bg.wasm',import.meta.url)));
const original={BonusPerStat:bindings.bd,CalcArtifactBestSet:bindings.uC,CalculatorInterface:bindings.K2,CommonInterface:bindings.Ps,DSLInterface:bindings.ZB,OptimizeSingleWasm:bindings.E2,PotentialInterface:bindings.gF,TeamOptimizationWasm:bindings.B8,TransformativeDamage:bindings.PX};
const support=read('beta-data/extension-support.json'),chars=read('src/assets/_gen_character.js'),buffs=read('src/assets/_gen_buff.js');
const stellar=createStellarSupportFacade(createLimitedWeaponFacade(createBeta2(createFacade(original,extension,read('beta-data/vodyanitsa.json'),support,chars),extension,support),original,read('beta-data/weapons-release-71.json'),read('beta-data/weapons-signature-release-71.json')),original);
const api=withHybridTeamOptimization(createExpandedWeaponsFacade(createStrengthenedFacade(stellar.facade,stellar.transformStellarTarget),original,extension));
const named=(name,p)=>({name,config:p?{[name]:p}:'NoConfig'});
const sum=x=>Object.values(x||{}).reduce((a,b)=>a+b,0);
const vody={character:{name:'Vodyanitsa',level:90,ascend:false,constellation:0,skill1:9,skill2:9,skill3:9,params:{Vodyanitsa:{e_active:false,song_active:false,ordinary_mode:true,c1_active:false,c2_active:false,c4_stacks:0,on_field:true}}},weapon:{name:'HymnOfTheMaelstrom',level:90,ascend:false,refine:1,params:{HymnOfTheMaelstrom:{stacks:0,boosted:false,on_field:true}}},skill:{index:11,config:{Vodyanitsa:{low_hp_heal:false,q_song_bonus:false}}},artifacts:[],artifact_config:null,enemy:null,buffs:[]};
const vesna={...structuredClone(vody),character:{name:'Vesna',level:90,ascend:false,constellation:0,skill1:9,skill2:9,skill3:9,params:{Vesna:{stance:true,radiance:true,disciplinary_stacks:6,anemo_cryo_count:1,other_count:1,flat_inside_discipline:false}}},weapon:{name:'BeyondTheChrysalis',level:90,ascend:false,refine:1,params:{BeyondTheChrysalis:{loyal_wind:true,rebel_wind:true,on_field:true}}},skill:{index:17,config:'NoConfig'}};

export {api,original,vody,vesna,read,named,sum};
