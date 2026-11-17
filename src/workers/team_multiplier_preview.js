import {createSkillMultiplierPreview} from '../../beta-data/team-engine/multiplier-preview.mjs';
import('mona').then(api=>{
 self.onmessage=({data})=>{
  try{self.postMessage({type:'result',requestId:data.requestId,result:createSkillMultiplierPreview(api,data.axis,data.characters,data.includeEffects,data.buffConstellations)});}
  catch(error){self.postMessage({type:'error',requestId:data.requestId,message:error.message,stack:error.stack});}
 };
 self.postMessage({type:'ready'});
}).catch(error=>self.postMessage({type:'error',message:error.message,stack:error.stack}));
