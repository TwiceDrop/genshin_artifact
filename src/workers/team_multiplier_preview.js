import {createSkillMultiplierPreview} from '../../beta-data/team-engine/multiplier-preview.mjs';
import('mona').then(api=>{
 self.onmessage=({data})=>{
  try{self.postMessage({type:'result',result:createSkillMultiplierPreview(api,data.axis,data.characters)});}
  catch(error){self.postMessage({type:'error',message:error.message,stack:error.stack});}
 };
 self.postMessage({type:'ready'});
}).catch(error=>self.postMessage({type:'error',message:error.message,stack:error.stack}));
