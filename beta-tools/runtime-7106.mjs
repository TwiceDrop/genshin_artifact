import {progressImports} from '../beta-data/optimizer-progress.mjs';
import {composeKernelApi,originalApiFromBindings} from '../beta-data/compose-kernel-api.mjs';
import fs from 'node:fs';
import {createRequire} from 'node:module';
globalThis.module={require:createRequire(import.meta.url)};
import {bindings} from '../mona_wasm/pkg/bindings.js';
import * as bridge from '../mona_wasm/pkg/mona_wasm_bg.js';
import * as extension from '../mona_wasm/extension/mona_extension.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url),'utf8').replace(/^(?:\s*\/\/[^\n]*\n)*\s*export default\s*/,''));
const core=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(new URL(process.env.MONA_PROGRESS==='1'?'../mona_wasm/pkg/mona_effect_bridge_progress.wasm':'../mona_wasm/pkg/mona_effect_bridge.wasm',import.meta.url))),{'./mona_wasm_bg.js':bridge,mona_progress:progressImports(()=>core.memory)}).exports;
bindings.lI(core);
extension.initSync(fs.readFileSync(new URL(process.env.MONA_PROGRESS==='1'?'../mona_wasm/extension/mona_extension_bg_progress.wasm':'../mona_wasm/extension/mona_extension_bg.wasm',import.meta.url)));
const rawOriginal=originalApiFromBindings(bindings);
const {api,original}=composeKernelApi({rawOriginal,core,extension,data:{vodyanitsa:read('beta-data/vodyanitsa.json'),support:read('beta-data/extension-support.json'),
 characters:read('src/assets/_gen_character.js'),weapons:read('beta-data/weapons-release-71.json'),signatureWeapons:read('beta-data/weapons-signature-release-71.json')}});
const named=(name,p)=>({name,config:p?{[name]:p}:'NoConfig'});
const sum=x=>Object.values(x||{}).reduce((a,b)=>a+b,0);
const vody={character:{name:'Vodyanitsa',level:90,ascend:false,constellation:0,skill1:9,skill2:9,skill3:9,params:{Vodyanitsa:{e_active:false,song_active:false,ordinary_mode:true,c1_active:false,c2_active:false,c4_stacks:0,on_field:true}}},weapon:{name:'HymnOfTheMaelstrom',level:90,ascend:false,refine:1,params:{HymnOfTheMaelstrom:{stacks:0,boosted:false,on_field:true}}},skill:{index:11,config:{Vodyanitsa:{low_hp_heal:false,q_song_bonus:false}}},artifacts:[],artifact_config:null,enemy:null,buffs:[]};
const vesna={...structuredClone(vody),character:{name:'Vesna',level:90,ascend:false,constellation:0,skill1:9,skill2:9,skill3:9,params:{Vesna:{stance:true,radiance:true,disciplinary_stacks:6,anemo_cryo_count:1,other_count:1,flat_inside_discipline:false}}},weapon:{name:'BeyondTheChrysalis',level:90,ascend:false,refine:1,params:{BeyondTheChrysalis:{loyal_wind:true,rebel_wind:true,on_field:true}}},skill:{index:17,config:'NoConfig'}};

export {api,original,rawOriginal,vody,vesna,read,named,sum};
