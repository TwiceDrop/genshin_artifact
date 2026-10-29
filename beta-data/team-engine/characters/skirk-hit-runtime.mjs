import {scalarMath} from '../../team-dps-numeric-rules.mjs';

// Resource/form expansion remains deterministic from commands. Actual hit
// consumption belongs to the candidate, including conditionally enabled hits.
export function createSkirkHitRuntime({window,windows,math:m=scalarMath}){
 const uses=new Map();
 return {prepareHit(e){
  if(e.category!=='normal'||e.c6)return;
  const cycle=window('skirkC2',e.time,e.rootOrder),used=uses.get(cycle)??0;
  e.qRifts=windows.skirkC2?.[cycle]?.qRifts??0;
  const gate=e.sevenPhase&&cycle>=0?m.choose(e.enabled??1,m.lt(used,10),0):0;
  e.qBonus=typeof gate==='object'?gate:!!gate;
  if(typeof gate==='object'||gate)uses.set(cycle,m.add(used,m.choose(gate,1,0)));
 }};
}
