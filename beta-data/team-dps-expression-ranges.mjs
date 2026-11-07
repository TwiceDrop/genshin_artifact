import {intervalMath} from './team-dps-numeric-program.mjs';

const unknown=()=>({lo:-Infinity,hi:Infinity,nan:true});
const point=value=>Number.isNaN(value)?unknown():({lo:value,hi:value,nan:false});
const includesZero=r=>r.lo<=0&&r.hi>=0;
const infinite=r=>!Number.isFinite(r.lo)||!Number.isFinite(r.hi);
export function numericRange(op,args,value,inputBounds){
 if(op==='literal')return point(value);
 if(op==='input'){const bounds=inputBounds?.[value];return bounds&&!bounds.some(Number.isNaN)?{lo:bounds[0],hi:bounds[1],nan:false}:unknown();}
 if(op==='bernoulli')return {lo:0,hi:1,nan:false};
 if(op==='choose'){
  const [condition,yes,no]=args;
  if(condition.lo===0&&condition.hi===0)return no;
  if(!condition.nan&&(condition.lo>0||condition.hi<0))return yes;
  return {lo:Math.min(yes.lo,no.lo),hi:Math.max(yes.hi,no.hi),nan:yes.nan||no.nan};
 }
 let nan=args.some(r=>r.nan);
 if(op==='mul')nan ||= (includesZero(args[0])&&infinite(args[1])||includesZero(args[1])&&infinite(args[0]));
 if(op==='div')nan ||= includesZero(args[0])&&includesZero(args[1])||infinite(args[0])&&infinite(args[1]);
 const bounds=intervalMath[op](...args.map(r=>[r.lo,r.hi]));
 if(bounds.some(Number.isNaN))return unknown();
 if(['lt','gt','ge','eq'].includes(op))return {lo:nan?0:bounds[0],hi:bounds[1],nan:false};
 return {lo:bounds[0],hi:bounds[1],nan};
}

export function rangeReplacement(op,args,nodes,ranges){
 const a=ranges[args[0]],b=ranges[args[1]];
 if(op==='choose'){
  if(a.lo===0&&a.hi===0)return args[2];
  if(!a.nan&&(a.lo>0||a.hi<0))return args[1];
 }
 if((op==='min'||op==='max')&&!a.nan&&!b.nan){
  const order=op==='min'?[a.hi<=b.lo,b.hi<=a.lo]:[a.lo>=b.hi,b.lo>=a.hi];
  for(let i=0;i<2;i++)if(order[i]){
   const winner=ranges[args[i]],other=ranges[args[1-i]],touchZero=op==='min'?winner.hi===0&&other.lo===0:winner.lo===0&&other.hi===0;
   const literal=nodes[args[i]],safeZero=literal.op==='literal'&&(op==='min'?Object.is(literal.value,-0):Object.is(literal.value,0));
   if(!touchZero||safeZero)return args[i];
  }
 }
}
