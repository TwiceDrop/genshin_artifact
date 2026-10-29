import {TEAM_DPS_SLOTS} from './team-dps-config.mjs';
import {intervalMath} from './team-dps-numeric-program.mjs';

export function artifactProgramRow(artifact,stats,sets){
 const row=new Float64Array(stats.length+sets.length);
 for(const [name,value]of [artifact.main_stat,...artifact.sub_stats])row[stats.indexOf(name)]+=value;
 if(sets.includes(artifact.set_name))row[stats.length+sets.indexOf(artifact.set_name)]=1;
 return row;
}

// The codec may score any available artifact in its slot, including baseline
// builds outside search filters. Bounds therefore do not assume main-stat
// filters, set constraints or one of the supplied complete example teams.
export function teamProgramInputBounds(candidates,stats,sets,roles){
 const pools=TEAM_DPS_SLOTS.map(slot=>candidates.filter(a=>a.slot===slot).map(a=>artifactProgramRow(a,stats,sets)));
 if(pools.some(pool=>pool.length===0))return undefined;
 const bounds=Array.from({length:stats.length+sets.length},(_,field)=>{
  const ranges=pools.map(pool=>[Math.min(...pool.map(row=>row[field])),Math.max(...pool.map(row=>row[field]))]);
  if(ranges.every(([lo,hi])=>lo===0&&hi===0))return [0,0];
  if(field>=stats.length)return [ranges.reduce((n,r)=>n+r[0],0),ranges.reduce((n,r)=>n+r[1],0)];
  let range=[0,0],magnitude=0;
  for(const pair of ranges){range=intervalMath.add(range,pair);magnitude=intervalMath.add([magnitude,magnitude],[Math.max(Math.abs(pair[0]),Math.abs(pair[1])),Math.max(Math.abs(pair[0]),Math.abs(pair[1]))])[1];}
  // Cover the codec's binary64 summation in any artifact-ID order, not just
  // exact real addition of the per-slot extrema.
  const n=TEAM_DPS_SLOTS.length,gamma=n*Number.EPSILON/(1-n*Number.EPSILON),margin=intervalMath.mul([gamma,gamma],[magnitude,magnitude])[1];
  return [intervalMath.sub([range[0],range[0]],[margin,margin])[0],intervalMath.add([range[1],range[1]],[margin,margin])[1]];
 });
 return Array.from({length:roles},()=>bounds).flat();
}
