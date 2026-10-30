import {createTeamDpsEvaluator} from '../../beta-data/team-dps-evaluator.mjs';
import('mona').then(api=>{
 let evaluator,catalog;
 self.onmessage=({data})=>{
  try{
   if(data.type==='initialize'){
    evaluator=createTeamDpsEvaluator(api,data.input);
    catalog=new Map(data.artifacts.map(a=>[a.id,a]));
    self.postMessage({type:'initialized'});
   }else if(data.type==='score'){
    const team=data.ids.map(ids=>ids.map(id=>catalog.get(id)));
    self.postMessage({type:'scored',result:evaluator.evaluate(team)});
   }
  }catch(error){self.postMessage({type:'error',message:error.message,stack:error.stack});}
 };
 self.postMessage({type:'ready'});
}).catch(error=>self.postMessage({type:'error',message:error.message,stack:error.stack}));
