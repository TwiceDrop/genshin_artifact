import {scalarMath} from './team-dps-numeric-rules.mjs';
import {compactNumericProgram} from './team-dps-numeric-program.mjs';
import {numericRange,rangeReplacement} from './team-dps-expression-ranges.mjs';

// Eliminate stochastic inputs before the ordinary CPU/GPU program is emitted.
// A draw may depend on earlier draws. Linearity shares independent rewards;
// nonlinear expressions are conditioned before expectation is taken.
export function lowerExpectedProgram(program,{ratios=[],inputBounds,inputConstants}={}){
 const nodes=[],shared=new Map(),dependencies=[],drawIds=new Map(),ranges=[];let rangePruned=0;
 function make(op,args=[],value){
  if(op==='input'&&inputConstants?.has(value))return literal(inputConstants.get(value));
  if(op==='choose'){
   const condition=nodes[args[0]];
   if(condition.op==='literal')return args[condition.value?1:2];
   if(args[1]===args[2])return args[1];
  }
  if(op==='bernoulli'&&nodes[args[0]].op==='literal'&&[0,1].includes(nodes[args[0]].value))return args[0];
  if(scalarMath[op]&&args.every(i=>nodes[i].op==='literal'))return literal(Number(scalarMath[op](...args.map(i=>nodes[i].value))));
  const replacement=rangeReplacement(op,args,nodes,ranges);
  if(replacement!==undefined){rangePruned++;return replacement;}
  const range=numericRange(op,args.map(i=>ranges[i]),value,inputBounds);
  if(['lt','gt','ge','eq'].includes(op)&&range.lo===range.hi){rangePruned++;return literal(range.lo);}
  const key=op+'/'+args.join('/')+'/'+(Object.is(value,-0)?'-0':String(value));
  if(shared.has(key))return shared.get(key);
  const id=nodes.length;nodes.push({op,args,value});shared.set(key,id);
  let bits=args.reduce((v,i)=>v|dependencies[i],0n);
  if(op==='bernoulli'){if(!drawIds.has(value))drawIds.set(value,1n<<BigInt(drawIds.size));bits|=drawIds.get(value);}
  dependencies.push(bits);ranges.push(range);return id;
 }
 const literal=value=>make('literal',[],value),zero=literal(0),one=literal(1),mapped=[];
 for(const node of program.nodes)mapped.push(make(node.op,node.args.map(i=>mapped[i]),node.value));
 const cofactorCache=new Map(),expected=new Map();
 function cofactor(root,draw,value){
  const key=draw+'/'+value;
  let memo=cofactorCache.get(key);if(!memo){memo=new Map();cofactorCache.set(key,memo);}
  const pending=[[root,false]];
  while(pending.length){
   const [id,exit]=pending.pop();if(memo.has(id))continue;
   if(!(dependencies[id]&draw)){memo.set(id,id);continue;}
   const node=nodes[id];
   if(node.op==='bernoulli'&&drawIds.get(node.value)===draw){memo.set(id,literal(value));continue;}
   if(!exit){pending.push([id,true]);for(let j=node.args.length-1;j>=0;j--)if(!memo.has(node.args[j]))pending.push([node.args[j],false]);}
   else memo.set(id,make(node.op,node.args.map(i=>memo.get(i)),node.value));
  }
  return memo.get(root);
 }
 function plan(id){
  const {op,args}=nodes[id],random=i=>dependencies[i]!==0n;
  if(op==='bernoulli')return {deps:[args[0]],build:values=>values[0]};
  if(op==='add'||op==='sub')return {deps:args,build:values=>make(op,values)};
  if(op==='mul'&&(!random(args[0])||!random(args[1])))return {deps:args,build:values=>make(op,values)};
  if(op==='div'&&!random(args[1]))return {deps:args,build:values=>make(op,values)};
  if(op==='choose'&&!random(args[0]))return {deps:args,build:values=>make(op,values)};
  const draw=dependencies[id]&-dependencies[id],pending=[id];let chance;
  while(pending.length){const next=pending.pop(),node=nodes[next];if(!(dependencies[next]&draw))continue;if(node.op==='bernoulli'&&drawIds.get(node.value)===draw){chance=node.args[0];break;}pending.push(...node.args);}
  const no=cofactor(id,draw,0),yes=cofactor(id,draw,1);
  if(no===yes)return {deps:[no],build:values=>values[0]};
  // Probability-zero branches contribute zero even if their unreachable
  // arithmetic contains Infinity or NaN. No finite state is approximated.
  return {deps:[no,yes],build:([lostValue,wonValue])=>{
   const won=make('choose',[make('gt',[chance,zero]),make('mul',[chance,wonValue]),zero]);
   const lost=make('choose',[make('lt',[chance,one]),make('mul',[make('sub',[one,chance]),lostValue]),zero]);
   return make('add',[lost,won]);
  }};
 }
 function expectation(root){
  const pending=[{id:root}];
  while(pending.length){
   const frame=pending.at(-1),{id}=frame;
   if(expected.has(id)){pending.pop();continue;}
   if(dependencies[id]===0n){expected.set(id,id);pending.pop();continue;}
   if(!frame.rule)frame.rule=plan(id);
   const missing=frame.rule.deps.find(i=>!expected.has(i));
   if(missing!==undefined){pending.push({id:missing});continue;}
   expected.set(id,frame.rule.build(frame.rule.deps.map(i=>expected.get(i))));pending.pop();
  }
  return expected.get(root);
 }
 const ratioIndexes=new Set(ratios.map(r=>r.output));
 const outputs=program.outputs.map((id,i)=>ratioIndexes.has(i)?zero:expectation(mapped[id]));
 for(const ratio of ratios)outputs[ratio.output]=make('div',[outputs[ratio.numerator],outputs[ratio.denominator]]);
 const compact=compactNumericProgram({nodes,outputs});
 if(compact.nodes.some(n=>n.op==='bernoulli'))throw Error('Unresolved stochastic input');
 return {program:compact,stats:{sourceNodes:program.nodes.length,draws:program.nodes.filter(n=>n.op==='bernoulli').length,workingNodes:nodes.length,outputNodes:compact.nodes.length,cofactorEntries:[...cofactorCache.values()].reduce((n,map)=>n+map.size,0),rangePruned}};
}
