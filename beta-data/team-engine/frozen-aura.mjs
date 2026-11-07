// 60fps Frozen decay: starts at 0.4 U/s, accelerates by 0.1 U/s²;
// while unfrozen the rate recovers twice as fast, down to its initial rate.
// Sum frame losses directly. A bounded integer search finds the depletion
// frame so unused elapsed frames recover the rate rather than accelerating it.
const minimum=1/150,acceleration=1/36000;
export const emptyFrozenAura=()=>({amount:0,decay:minimum});
export function frozenLifetimeFrames(state,limit,m){
 const loss=n=>m.add(m.mul(n,state.decay),m.mul(acceleration/2,m.mul(n,m.add(n,1))));
 let lo=0,hi=limit;
 for(let i=0;i<Math.ceil(Math.log2(limit+1));i++){
  const mid=m.floor(m.div(m.add(lo,hi),2)),searching=m.lt(lo,hi),done=m.ge(loss(mid),state.amount);
  lo=m.choose(searching,m.choose(done,lo,m.add(mid,1)),lo);hi=m.choose(searching,m.choose(done,mid,hi),hi);
 }
 return m.choose(m.gt(state.amount,0),lo,0);
}
export function advanceFrozenAura(state,frames,m){
 if(!frames)return {...state};
 if(typeof state.amount!=='object'&&state.amount===0)return {amount:0,decay:m.max(minimum,m.sub(state.decay,2*acceleration*frames))};
 const loss=n=>m.add(m.mul(n,state.decay),m.mul(acceleration/2,m.mul(n,m.add(n,1))));
 const active=frozenLifetimeFrames(state,frames,m),rest=m.sub(frames,active);
 return {amount:m.max(0,m.sub(state.amount,loss(active))),decay:m.max(minimum,m.sub(m.add(state.decay,m.mul(active,acceleration)),m.mul(rest,2*acceleration)))};
}
export const elementalFrame=time=>Math.floor(time*60+1e-8);
