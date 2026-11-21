// Independent crit rolls can change the order of the four contributions.
export function rankedReactionDamage(rows,m){
 function weighted(values){return values.map((v,i)=>{
  const rank=values.reduce((n,w,j)=>j===i?n:m.add(n,j<i?m.ge(w,v):m.gt(w,v)),0);
  return m.mul(v,m.choose(m.eq(rank,0),.6,m.choose(m.eq(rank,1),.3,.05)));
 });}
 const normal=weighted(rows.map(r=>r.non_critical)),critical=weighted(rows.map(r=>r.critical)),expectation=rows.map(()=>0);
 for(let bits=0;bits<2**rows.length;bits++){
  const chance=rows.reduce((p,r,i)=>m.mul(p,bits&(1<<i)?r.cr:m.sub(1,r.cr)),1);
  const damage=weighted(rows.map((r,i)=>bits&(1<<i)?r.critical:r.non_critical));
  damage.forEach((v,i)=>expectation[i]=m.add(expectation[i],m.mul(chance,v)));
 }
 return rows.map((_,i)=>({non_critical:normal[i],critical:critical[i],expectation:expectation[i]}));
}
