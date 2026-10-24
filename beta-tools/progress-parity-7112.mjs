import {api} from './runtime-7106.mjs';import {fixture} from './interface-audit-7108.mjs';import {beginOptimizationProgress} from '../beta-data/optimizer-progress.mjs';
const rows=[];console.log=()=>{};
for(const role of ['Kaeya','Vesna','Vodyanitsa'])for(const algorithm of ['AStar','Naive'])for(const mode of ['Any',{Set4:'GladiatorsFinale'}]){
 const x=fixture(role);x.algorithm=algorithm;x.constraint={set_mode:mode};const artifacts=x.artifacts.flatMap((a,i)=>[a,{...structuredClone(a),id:i+11,sub_stats:[['CriticalRate',.05+i*.01],['CriticalDamage',.12+i*.01],['ElementalMastery',60-i*7]]}]);const records=[];const p=beginOptimizationProgress(x,artifacts,v=>records.push(v));const results=api.OptimizeSingleWasm.optimize(x,artifacts);p.complete();p.dispose();rows.push({role,algorithm,mode,results:results.map(r=>({ids:[r.flower,r.feather,r.sand,r.goblet,r.head].join(','),value:r.value})).sort((a,b)=>a.ids.localeCompare(b.ids)),records});
}
process.stdout.write(JSON.stringify(rows));
