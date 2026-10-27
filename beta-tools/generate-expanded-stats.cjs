const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const data=require(path.join(root,'beta-data/weapons-expanded-release-71.json'));
const format=a=>a.map(v=>Number.isInteger(Number(v))?`${Number(v)}.0`:Number(v).toString()).join(',');
const lines=[
  '// Generated from beta-data/weapons-expanded-release-71.json.',
  '// Source: saved published v7.1.0 catalog and individual weapon pages.',
  'use crate::weapon::WeaponName;',
];
for(const w of data.weapons){
  if(w.levels.length!==96)throw Error('Incomplete level data: '+w.name);
  const normal=w.levels.filter(r=>!r.ascend);
  const promoted=[20,40,50,60,70,80].map(level=>w.levels.find(r=>r.level===level&&r.ascend));
  if(normal.length!==90||promoted.some(r=>!r))throw Error('Invalid level data: '+w.name);
  const n=w.name.toUpperCase().replace(/[^A-Z0-9]/g,'_');
  lines.push(`const ${n}_ATK:[f64;90]=[${format(normal.map(r=>r.attack))}];`);
  lines.push(`const ${n}_SUB:[f64;90]=[${format(normal.map(r=>r.subStat))}];`);
  lines.push(`const ${n}_ASC:[f64;6]=[${format(promoted.map(r=>r.attack))}];`);
}
lines.push('pub fn stats(name:WeaponName,level:i32,ascend:bool)->Option<(f64,f64)>{');
lines.push('  if !(1..=90).contains(&level){return None;}');
lines.push('  let i=(level-1) as usize;');
lines.push('  let (atk,sub,promoted)=match name {');
for(const w of data.weapons){
  const n=w.name.toUpperCase().replace(/[^A-Z0-9]/g,'_');
  lines.push(`    WeaponName::${w.name}=>(&${n}_ATK,&${n}_SUB,&${n}_ASC),`);
}
lines.push('    _=>return None,');
lines.push('  };');
lines.push('  let asc=if ascend {match level{20=>Some(0),40=>Some(1),50=>Some(2),60=>Some(3),70=>Some(4),80=>Some(5),_=>None}}else{None};');
lines.push('  Some((asc.map(|j|promoted[j]).unwrap_or(atk[i]),sub[i]))');
lines.push('}');
fs.writeFileSync(path.join(root,'mona_core/src/weapon/expanded_stats.rs'),lines.join('\n')+'\n');
