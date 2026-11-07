import {eventKey,compareEvents} from './team-engine/event-order.mjs';

// Outcomes may have different hit identities, times and durations. Align facts
// by identity rather than by array index; their numeric rules stay unchanged.
export function combineTeamOutcomes(rows,m,trace){
 if(rows.length===1&&rows[0].weight===1)return rows[0].output;
 const weight=rows.reduce((n,row)=>m.add(n,row.weight),0),keys=['expectation','critical','non_critical'];
 const average=read=>m.div(rows.reduce((n,row)=>m.add(n,m.mul(row.weight,read(row.output))),0),weight);
 const damage=read=>Object.fromEntries(keys.map(key=>[key,average(output=>read(output)?.[key]??0)]));
 const first=rows[0].output,out={...first,...damage(output=>output)};
 out.duration=rows.every(row=>row.output.duration===first.duration)?first.duration:average(output=>output.duration);
 out.total_damage=out.expectation;out.dps=m.div(out.expectation,out.duration);
 out.character_damage=first.character_damage.map((_,role)=>damage(output=>output.character_damage[role]));
 out.panels=first.panels.map((panel,role)=>Object.fromEntries(Object.keys(panel).map(stat=>[stat,
  Object.fromEntries([...new Set(rows.flatMap(row=>Object.keys(row.output.panels[role][stat])))].map(source=>[source,average(output=>output.panels[role][stat][source]??0)])),
 ])));
 out.fanfare=average(output=>output.fanfare);out.furina_overflow=average(output=>output.furina_overflow);
 if(trace){
  out.trace_outcomes=rows.map(row=>({output:row.output,probability:m.div(row.weight,weight),label:row.label}));
  out.health_branches=rows.map(row=>({label:row.label,probability:m.div(row.weight,weight),health:row.output.health,duration:row.output.duration,
   heals:row.output.heals,bonds:row.output.bonds,effects:row.output.effects,resources:row.output.resources,
  }));
  const hits=new Map();
  for(const row of rows)for(const hit of row.output.hits){
   const key=eventKey(hit);if(!hits.has(key))hits.set(key,{hit,branches:[]});
   hits.get(key).branches.push({row,hit});
  }
  out.hits=[...hits.values()].map(({hit,branches})=>({...hit,
   ...Object.fromEntries(keys.map(key=>[key,m.div(branches.reduce((n,b)=>m.add(n,m.mul(b.row.weight,b.hit[key])),0),weight)])),
   branches:branches.map(b=>({label:b.row.label,probability:m.div(b.row.weight,weight),analysis:b.hit.analysis,fanfare:b.hit.fanfare,furina_overflow:b.hit.furina_overflow})),
  })).sort(compareEvents);
 }
 return out;
}
