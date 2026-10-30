import {previewDefaults} from '../beta-data/preview-7201-config.mjs';
export const named=(name,p)=>({name,config:{[name]:p}});
export function input(name='Mitya') {return {character:{name,level:90,ascend:false,constellation:0,skill1:9,skill2:9,skill3:9,params:{[name]:{...previewDefaults[name]}}},weapon:{name:name==='Mitya'?'ApprenticesNotes':'DullBlade',level:1,ascend:false,refine:1,params:'NoConfig'},artifacts:[],artifact_config:null,enemy:null,buffs:[],skill:{index:name==='Mitya'?8:4,config:'NoConfig'}};}
export const gear=['Flower','Feather','Sand','Goblet','Head'].map((slot,i)=>({id:i+1,set_name:'GladiatorsFinale',slot,level:20,star:5,main_stat:[i===0?'HPFixed':i===1?'ATKFixed':'ElementalMastery',i===0?4780:i===1?311:187],sub_stats:[]}));
