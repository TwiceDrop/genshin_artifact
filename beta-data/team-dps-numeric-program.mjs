import {scalarMath} from './team-dps-numeric-rules.mjs';

export const NUMERIC_OPS=['literal','input','add','sub','mul','div','min','max','abs','lt','gt','ge','eq','choose','floor'];
// The same expression DAG supplies CPU execution, interval bounds, and WGSL.
export function createNumericProgram(){
 const nodes=[],shared=new Map();
 const node=(op,args,value)=>{
  const key=op+'/'+args.map(a=>a.index).join('/')+'/'+(Object.is(value,-0)?'-0':String(value));
  if(shared.has(key))return shared.get(key);
  const ref={index:nodes.length};nodes.push({op,args:args.map(a=>a.index),value});shared.set(key,ref);return ref;
 };
 const literal=value=>node('literal',[],Number(value));
 const ref=value=>typeof value==='object'?value:literal(value);
 const math=Object.fromEntries(Object.keys(scalarMath).map(op=>[op,(...args)=>{
  const refs=args.map(ref),constants=refs.map(a=>nodes[a.index]);
  if(op==='choose'&&constants[0].op==='literal')return refs[constants[0].value?1:2];
  if(op==='choose'&&refs[1].index===refs[2].index)return refs[1];
  if(constants.every(n=>n.op==='literal'))return literal(scalarMath[op](...constants.map(n=>n.value)));
  return node(op,refs);
 }]));
 return {math,input:index=>node('input',[],index),literal,resolve:ref=>nodes[ref.index].op==='literal'?nodes[ref.index].value:ref,
  bernoulli:(id,probability)=>{const p=ref(probability),n=nodes[p.index];return n.op==='literal'&&(n.value===0||n.value===1)?p:node('bernoulli',[p],id);},
  finish:outputs=>({nodes,outputs:outputs.map(ref).map(r=>r.index)}),
 };
}
export function executeNumericProgram(program,inputs){
 const values=[];
 for(const node of program.nodes)values.push(node.op==='literal'?node.value:node.op==='input'?inputs[node.value]:Number(scalarMath[node.op](...node.args.map(i=>values[i]))));
 return program.outputs.map(i=>values[i]);
}

export function compactNumericProgram(program){
 const needed=new Set(),pending=[...program.outputs];
 while(pending.length){const i=pending.pop();if(needed.has(i))continue;needed.add(i);pending.push(...program.nodes[i].args);}
 const indexes=new Map(),nodes=[];
 program.nodes.forEach((node,i)=>{if(needed.has(i)){indexes.set(i,nodes.length);nodes.push({...node,args:node.args.map(j=>indexes.get(j))});}});
 return {nodes,outputs:program.outputs.map(i=>indexes.get(i))};
}

export function scheduleNumericProgram(program,{streamOutputs=false}={}){
 const compact=compactNumericProgram(program),original=compact.nodes.map((_,i)=>i);
 const emissions=compact.nodes.map(()=>[]);
 if(streamOutputs)compact.outputs.forEach((id,index)=>emissions[id].push(index));
 const rank=compact.nodes.map(()=>1);
 compact.nodes.forEach((node,i)=>{const children=node.args.map(j=>rank[j]).sort((a,b)=>b-a);rank[i]=Math.max(1,...children.map((value,j)=>value+j));});
 // Deferred outcome weights can be created after many damage coefficients.
 // Reorder dependencies, never arithmetic operands or operations. Keep the
 // original schedule unless a dependency-first order uses fewer registers.
 function dependencyOrder(heavy){
  const seen=new Uint8Array(compact.nodes.length),order=[],pending=[...compact.outputs].reverse();
  while(pending.length){
   const id=pending.pop();
   if(id<0){order.push(-id-1);continue;}
   if(seen[id])continue;seen[id]=1;pending.push(-id-1);
   const args=[...compact.nodes[id].args];if(heavy)args.sort((a,b)=>rank[b]-rank[a]);
   for(let j=args.length-1;j>=0;j--)pending.push(args[j]);
  }
  return order;
 }
 function lastUses(order){
  const last=new Int32Array(compact.nodes.length);
  order.forEach((id,i)=>last[id]=i);
  order.forEach((id,i)=>compact.nodes[id].args.forEach(j=>last[j]=i));
  if(!streamOutputs)compact.outputs.forEach(j=>last[j]=order.length);return last;
 }
 function pressure(order,last){
  let live=0,peak=0;
  order.forEach((id,i)=>{for(const arg of new Set(compact.nodes[id].args))if(last[arg]===i)live--;live++;peak=Math.max(peak,live);if(last[id]===i)live--;});return peak;
 }
 let order=original,last=lastUses(order),peak=pressure(order,last);
 for(const heavy of [false,true]){
  const candidate=dependencyOrder(heavy),uses=lastUses(candidate),count=pressure(candidate,uses);
  if(count<peak){order=candidate;last=uses;peak=count;}
 }
 const registers=[],free=[],nodes=[];let registerCount=0;
 order.forEach((id,i)=>{
  const node=compact.nodes[id];
  const args=node.args.map(j=>registers[j]);
  for(const j of new Set(node.args))if(last[j]===i)free.push(registers[j]);
  const target=free.length?free.pop():registerCount++;registers[id]=target;
  nodes.push({...node,args,target,...(streamOutputs?{emits:emissions[id],retain:last[id]>i}:{})});
  if(last[id]===i)free.push(target);
 });
 // An emitted value may immediately lose its register. A final register map
 // would be invalid for this schedule, so consumers must use node emissions.
 return streamOutputs?{nodes,outputCount:compact.outputs.length,registerCount,streamOutputs:true}
  :{nodes,outputs:compact.outputs.map(i=>registers[i]),outputCount:compact.outputs.length,registerCount};
}

// Bounds use outward rounding at each arithmetic operation. Selection unions
// both branches when its condition can be either true or false.
const storage=new ArrayBuffer(8),number=new Float64Array(storage),bits=new BigUint64Array(storage);
const next=(value,direction)=>{
 if(value===direction*Infinity)return value;
 if(value===0)return direction*Number.MIN_VALUE;
 number[0]=value;bits[0]+=value*direction>0?1n:-1n;return number[0];
};
const down=value=>next(value,-1),up=value=>next(value,1);
export const intervalMath={
 add:([a,b],[c,d])=>[down(a+c),up(b+d)],
 sub:([a,b],[c,d])=>[down(a-d),up(b-c)],
 mul:([a,b],[c,d])=>{
  if(a===0&&b===0||c===0&&d===0)return [0,0];
  const product=(x,y)=>x===0||y===0?0:x*y,v=[product(a,c),product(a,d),product(b,c),product(b,d)];
  return [down(Math.min(...v)),up(Math.max(...v))];
 },
 div:([a,b],[c,d])=>{if(c<=0&&d>=0)return [-Infinity,Infinity];const v=[a/c,a/d,b/c,b/d];return [down(Math.min(...v)),up(Math.max(...v))];},
 min:([a,b],[c,d])=>[Math.min(a,c),Math.min(b,d)],max:([a,b],[c,d])=>[Math.max(a,c),Math.max(b,d)],
 abs:([a,b])=>a>=0?[a,b]:b<=0?[-b,-a]:[0,Math.max(-a,b)],
 floor:([a,b])=>[Math.floor(a),Math.floor(b)],
 lt:([a,b],[c,d])=>b<c?[1,1]:a>=d?[0,0]:[0,1],
 gt:([a,b],[c,d])=>a>d?[1,1]:b<=c?[0,0]:[0,1],
 ge:([a,b],[c,d])=>a>=d?[1,1]:b<c?[0,0]:[0,1],
 eq:([a,b],[c,d])=>a===b&&a===c&&c===d?[1,1]:b<c||a>d?[0,0]:[0,1],
 choose:([a,b],yes,no)=>a>0?yes:b===0?no:[Math.min(yes[0],no[0]),Math.max(yes[1],no[1])],
};
export function boundNumericProgram(program,inputs){
 const values=[];
 for(const node of program.nodes)values.push(node.op==='literal'?[node.value,node.value]:node.op==='input'?inputs[node.value]:intervalMath[node.op](...node.args.map(i=>values[i])));
 return program.outputs.map(i=>values[i]);
}
