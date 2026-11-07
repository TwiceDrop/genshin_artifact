export const effect=(label,values)=>({name:'ExtensionEffect',config:{ExtensionEffect:{label,values}}});
export const numericSum=m=>x=>Object.values(x||{}).reduce((a,b)=>m.add(a,b),0);
// Native formulas may aggregate equal or unequal contacts. This scales talent
// coefficients only; per-contact flat additions keep their full value.
export const scaleTalentPart=(m,event,value)=>event.talentShare===undefined?m.div(value,event.parts||1):m.mul(value,event.talentShare);
export const chronological=(a,b)=>a.time-b.time||a.rootOrder-b.rootOrder||(a.order??0)-(b.order??0);
// Canonical seconds remove arithmetic-path differences at frame-derived boundaries.
export const actionTime=t=>Math.round(t*1e12)/1e12;
export const hydroCryo=elements=>elements.filter(e=>e==='Hydro'||e==='Cryo').length;
