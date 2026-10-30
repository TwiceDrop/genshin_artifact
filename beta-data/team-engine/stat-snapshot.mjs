// A snapshot selects native source fields, never the enemy's impact-time state.
// No field list means the existing whole-caster snapshot contract.
export const SNAPSHOT_DAMAGE_FIELDS=['atk','hp','def','em','atk_ratio','hp_ratio','def_ratio','em_ratio','extra_damage','independent_damage_multiplier','critical','critical_damage','bonus'];
const targetFields=['def_minus','def_penetration','res_minus'];
export function snapshotEvent(event){
 if(!event.statSnapshot)return event;
 const {fields,...position}=event.statSnapshot;
 if(fields!==undefined&&(!Array.isArray(fields)||fields.some(field=>!SNAPSHOT_DAMAGE_FIELDS.includes(field))))throw Error('技能快照字段无效：'+event.eventId);
 return {...event,...position};
}
export function mergeSnapshotDamage(snapshot,live,fields){
 return fields===undefined?{...snapshot,...Object.fromEntries(targetFields.map(field=>[field,live[field]]))}:
  {...live,...Object.fromEntries(fields.map(field=>[field,snapshot[field]]))};
}
