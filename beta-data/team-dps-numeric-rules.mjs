// Numeric rules shared by the scalar evaluator and the WebGPU program compiler.
// A rule is evaluated with numbers on CPU, or expression references while compiling.
export const scalarMath={
 add:(a,b)=>a+b,sub:(a,b)=>a-b,mul:(a,b)=>a*b,div:(a,b)=>a/b,
 min:Math.min,max:Math.max,abs:Math.abs,floor:Math.floor,
 lt:(a,b)=>a<b,gt:(a,b)=>a>b,ge:(a,b)=>a>=b,eq:(a,b)=>a===b,
 choose:(condition,yes,no)=>condition?yes:no,
};
export function createTeamNumericRules(m=scalarMath){
 const {add,sub,mul,div,min,max,abs,lt,gt,ge,eq,choose}=m;
 const clamp=(v,lo,hi)=>max(lo,min(hi,v));
 return {
  healthChange:(ratio,amount,maxHP)=>clamp(add(ratio,div(amount,maxHP)),0,1),
  fanfareStart:cons=>choose(ge(cons,1),150,0),
  fanfareCap:cons=>choose(ge(cons,1),400,300),
  fanfareGain:(points,delta,cons,active)=>choose(active,min(choose(ge(cons,2),800,choose(ge(cons,1),400,300)),add(points,mul(mul(delta,100),choose(ge(cons,2),3.5,1)))),points),
  fanfare:(points,cons,active)=>choose(active,min(choose(ge(cons,1),400,300),points),0),
  overflow:(points,cons,active)=>choose(active,choose(ge(cons,2),max(0,sub(points,choose(ge(cons,1),400,300))),0),0),
  furinaHP:(baseHP,overflow)=>mul(mul(baseHP,overflow),.0035),
  healing:(raw,bond,ratio,maxHP)=>{
   const absorbed=min(bond,raw),afterBond=sub(bond,absorbed),available=sub(raw,absorbed),applied=min(available,mul(sub(1,ratio),maxHP));
   const next=clamp(add(ratio,div(applied,maxHP)),0,1);
   return {absorbed,bond:afterBond,available,applied,ratio:next,overheal:sub(available,applied),delta:sub(next,ratio)};
  },
  healAmount:(base,outgoing,incoming)=>mul(base,add(add(1,outgoing),incoming)),
  damage:(base,bonus,defense,resistance,targets,critical,criticalDamage)=>{
   const n=mul(mul(mul(mul(base,add(1,bonus)),defense),resistance),targets),cr=clamp(critical,0,1);
   return {non_critical:n,critical:mul(n,add(1,criticalDamage)),expectation:mul(n,add(1,mul(cr,criticalDamage)))};
  },
  defense:(level,enemyLevel,minus,penetration)=>div(add(level,100),add(add(level,100),mul(mul(add(enemyLevel,100),sub(1,min(.9,minus))),sub(1,min(1,penetration))))),
  resistance:value=>choose(lt(value,0),sub(1,div(value,2)),choose(lt(value,.75),sub(1,value),div(1,add(mul(4,value),1)))),
  hpChanged:(before,after)=>gt(abs(sub(after,before)),0),
  salonEligible:ratio=>gt(ratio,.5),
  lowHP:ratio=>lt(ratio,.5),
  highHP:ratio=>gt(ratio,.9),
  berserker:ratio=>lt(ratio,.7),
  bondCleared:amount=>eq(amount,0),
 };
}
export const teamNumericRules=createTeamNumericRules();

// Search and display use the completed candidate's duration, never the axis
// preview or another candidate's time. Damage mode retains its original units.
export const teamDpsObjectiveValue=(result,objective='damage',metric='expectation')=>
 objective==='dps'?result[metric]/result.duration:result[metric];
