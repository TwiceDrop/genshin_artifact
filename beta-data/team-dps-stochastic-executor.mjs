import {scalarMath} from './team-dps-numeric-rules.mjs';
import {createNumericProgram,compactNumericProgram} from './team-dps-numeric-program.mjs';
import {createCpuNumericExecutor} from './team-dps-cpu-numeric.mjs';
import {createExactVector} from './team-dps-exact-vector.mjs';

const linear=(node,random)=>node.op==='add'||node.op==='sub'||
 node.op==='mul'&&node.args.some(id=>!random[id])||
 node.op==='div'&&!random[node.args[1]]||node.op==='choose'&&!random[node.args[0]];

// A candidate reuses this compiled schedule. Nonlinear observations are taken
// before histories merge; only values used by a future instruction enter the
// exact state key. No probability threshold or approximate numeric key is used.
export function createStochasticExecutor(program,{ratios=[],trace=[],trajectory=false}={}){
 const {nodes,outputs}=program,random=[],drawNames=new Set();
 for(const node of nodes){
  if(node.op==='bernoulli'){
   if(drawNames.has(node.value))throw Error('Duplicate stochastic identity: '+node.value);
   drawNames.add(node.value);
  }
  random.push(node.op==='bernoulli'||node.args.some(id=>random[id]));
 }
 const ratioIndexes=new Set(ratios.map(r=>r.output)),expected=new Set(),observations=new Set();
 const pending=outputs.filter((_,i)=>!ratioIndexes.has(i));
 while(pending.length){
  const id=pending.pop();if(expected.has(id))continue;expected.add(id);
  if(!random[id])continue;
  const node=nodes[id];
  if(node.op==='bernoulli'||linear(node,random))pending.push(...node.args);
  else observations.add(id);
 }
 const traceNodes=group=>[...group.nodes,...(group.mass?.node===undefined?[]:[group.mass.node])];
 const actual=new Set(),ancestors=[...observations,...trace.flatMap(traceNodes)];
 while(ancestors.length){
  const id=ancestors.pop();if(!random[id]||actual.has(id))continue;
  actual.add(id);ancestors.push(...nodes[id].args);
 }
 // Observe an expression as soon as all of its causal draws exist, even if
 // the evaluator built it late (for example max over a health trace). This
 // changes scheduling only, never arithmetic order or stochastic identities.
 const draws=[...actual].filter(id=>nodes[id].op==='bernoulli').sort((a,b)=>a-b);
 const drawStage=new Map(draws.map((id,i)=>[id,i+1])),stageOf=new Int32Array(nodes.length);
 const stages=Array.from({length:draws.length+1},(_,i)=>({operations:[],draw:draws[i],trace:[]}));
 for(let id=0;id<nodes.length;id++)if(actual.has(id)){
  stageOf[id]=drawStage.get(id)??Math.max(0,...nodes[id].args.map(arg=>stageOf[arg]));
  if(nodes[id].op!=='bernoulli')stages[stageOf[id]].operations.push(id);
 }
 const schedule=stages.flatMap(s=>[...s.operations,...(s.draw===undefined?[]:[s.draw])]),position=new Int32Array(nodes.length),lastUse=new Int32Array(nodes.length);
 schedule.forEach((id,i)=>position[id]=i);
 for(const id of actual){lastUse[id]=Math.max(lastUse[id],position[id]);for(const arg of nodes[id].args)if(random[arg])lastUse[arg]=Math.max(lastUse[arg],position[id]);}
 trace.forEach((group,index)=>{
  const ids=traceNodes(group),at=Math.max(0,...ids.map(id=>stageOf[id])),stage=stages[at];stage.trace.push(index);
  const end=stage.draw===undefined?schedule.length:position[stage.draw];
  for(const id of ids)if(random[id])lastUse[id]=Math.max(lastUse[id],end);
 });
 let previous=[];
 for(const stage of stages){
  const end=stage.draw===undefined?schedule.length:position[stage.draw];
  stage.inputs=previous;stage.carry=[...actual].filter(id=>position[id]<=end&&lastUse[id]>end).sort((a,b)=>a-b);previous=stage.carry;
  stage.drawPosition=stage.carry.indexOf(stage.draw);
 }
 const deterministic=nodes.flatMap((_,i)=>random[i]?[]:[i]),expectedOrder=[...expected].sort((a,b)=>a-b);
 const run=(id,values)=>{const n=nodes[id];return Number(scalarMath[n.op](...n.args.map(i=>values[i])));};
 const plan={nodes:nodes.length,draws:stages.length-1,observations:observations.size,traceGroups:trace.length,actual:actual.size,peakLive:Math.max(0,...stages.map(s=>s.carry.length))};
 // Each segment is an ordinary numerical program. The same controller below
 // accepts CPU or GPU segment results; neither backend implements combat rules.
 const models=stages.map(stage=>{
  const cuts=new Set();
  for(const id of stage.operations)for(const arg of nodes[id].args)if(!random[arg])cuts.add(arg);
  if(stage.draw!==undefined&&!random[nodes[stage.draw].args[0]])cuts.add(nodes[stage.draw].args[0]);
  stage.constants=[...cuts];stage.observations=stage.operations.filter(id=>observations.has(id));
  const builder=createNumericProgram(),mapped=new Map([...stage.inputs,...stage.constants].map((id,i)=>[id,builder.input(i)]));
  for(const id of stage.operations){const node=nodes[id];mapped.set(id,builder.math[node.op](...node.args.map(arg=>mapped.get(arg))));}
  const result=[...stage.carry.map(id=>id===stage.draw?0:mapped.get(id)),...stage.observations.map(id=>mapped.get(id))];
  const columns=new Map(result.flatMap((value,i)=>typeof value==='object'?[[value.index,i]]:[]));
  const traceColumn=id=>{
   if(!random[id])return {node:id};
   const ref=mapped.get(id);if(!columns.has(ref.index)){columns.set(ref.index,result.length);result.push(ref);}
   return {column:columns.get(ref.index)};
  };
  stage.traceReads=stage.trace.map(index=>{
   const group=trace[index];
   return {fields:group.nodes.map(traceColumn),mass:group.mass?.node===undefined?{constant:group.mass?.constant??1}:traceColumn(group.mass.node)};
  });
  if(stage.draw!==undefined)result.push(mapped.get(nodes[stage.draw].args[0]));
  return {program:compactNumericProgram(builder.finish(result)),stride:stage.inputs.length+stage.constants.length};
 });
 function* session(input){
   const values=new Float64Array(nodes.length),means=new Float64Array(nodes.length);
   for(const id of deterministic){const node=nodes[id];values[id]=node.op==='literal'?node.value:node.op==='input'?input[node.value]:run(id,values);means[id]=values[id];}
   let states=[{weight:1,values:[]}],peakStates=1,merged=0,visited=0,operations=0;const sizes=[],distributions=trace.map(()=>new Map()),layers=[];
   for(const [index,stage]of stages.entries()){
    if(!stage.operations.length&&stage.draw===undefined&&!stage.trace.length)continue;
    const model=models[index],encoded=new Float64Array(states.length*model.stride),constants=stage.constants.map(id=>values[id]);
    states.forEach((state,i)=>{encoded.set(state.values,i*model.stride);encoded.set(constants,i*model.stride+stage.inputs.length);});
    const width=model.program.outputs.length;
    const result=width?yield {index,inputs:encoded,count:states.length}:new Float64Array();
    const next=new Map(),carry=createExactVector(stage.carry.length),traceVectors=stage.traceReads.map(group=>createExactVector(group.fields.length));
    const layer=trajectory?{draw:stage.draw===undefined?null:nodes[stage.draw].value,count:states.length,next0:new Int32Array(states.length).fill(-1),next1:new Int32Array(states.length).fill(-1),chance:new Float64Array(states.length),observations:stage.trace.map(group=>({group,entries:new Int32Array(states.length).fill(-1),masses:new Float64Array(states.length)}))}:null;
    function put(weight,draw){
     if(weight===0)return -1;
     if(stage.drawPosition>=0)carry.values[stage.drawPosition]=draw;
     const key=carry.key(),old=next.get(key);
     if(old){old.weight+=weight;merged++;return old.index;}
     const index=next.size;next.set(key,{weight,values:carry.values.slice(),index});return index;
    }
    const read=(source,offset)=>source.column!==undefined?result[offset+source.column]:source.node!==undefined?values[source.node]:source.constant;
    for(const [rowIndex,state]of states.entries()){
     visited++;operations+=stage.operations.length;const offset=rowIndex*width;
     stage.observations.forEach((id,i)=>means[id]+=state.weight*result[offset+stage.carry.length+i]);
     for(let i=0;i<stage.trace.length;i++){
      const groupIndex=stage.trace[i],group=stage.traceReads[i],mass=read(group.mass,offset),probability=state.weight*mass;
      if(probability===0)continue;
      const vector=traceVectors[i];
      for(let field=0;field<group.fields.length;field++)vector.values[field]=read(group.fields[field],offset);
      const key=vector.key(),distribution=distributions[groupIndex],old=distribution.get(key);
      let entry;
      if(old){old.probability+=probability;entry=old.index;}else{entry=distribution.size;distribution.set(key,{probability,values:vector.values.slice(),index:entry});}
      if(layer){layer.observations[i].entries[rowIndex]=entry;layer.observations[i].masses[rowIndex]=mass;}
     }
     carry.values.set(result.subarray(offset,offset+stage.carry.length));
     if(stage.draw===undefined){const target=put(state.weight);if(layer)layer.next0[rowIndex]=target;}
     else{
      const chance=result[offset+width-1];
      if(!(chance>=0&&chance<=1))throw Error('Invalid stochastic probability: '+nodes[stage.draw].value+'/'+chance);
      if(layer)layer.chance[rowIndex]=chance;
      if(chance<1){const target=put(state.weight*(1-chance),0);if(layer)layer.next0[rowIndex]=target;}
      if(chance>0){const target=put(state.weight*chance,1);if(layer)layer.next1[rowIndex]=target;}
     }
    }
    states=[...next.values()];peakStates=Math.max(peakStates,states.length);sizes.push(states.length);if(layer){layer.nextCount=states.length;layers.push(layer);}
   }
   for(const id of expectedOrder)if(random[id]&&!observations.has(id))means[id]=nodes[id].op==='bernoulli'?means[nodes[id].args[0]]:run(id,means);
   const result=outputs.map(id=>means[id]);
   for(const ratio of ratios)result[ratio.output]=result[ratio.numerator]/result[ratio.denominator];
   return {values:result,...(trace.length?{trace:distributions.map(distribution=>[...distribution.values()].map(entry=>({probability:entry.probability,values:Array.from(entry.values)})))}:{}),...(trajectory?{trajectory:{layers}}:{}),stats:{...plan,peakStates,merged,visited,operations,stageStates:sizes,weight:states.reduce((n,s)=>n+s.weight,0)}};
 }
 const cpuModels=new Map();
 const runCpuSegment=(index,inputs,count,outputs,outputOffset=0)=>{
  if(!cpuModels.has(index))cpuModels.set(index,createCpuNumericExecutor(models[index].program));
  return cpuModels.get(index).evaluateBatch(inputs,count,models[index].stride,outputs,outputOffset);
 };
 return {
  plan,models,session,runCpuSegment,cpuStats:()=>[...cpuModels].map(([index,backend])=>({index,...backend.stats})),clearCpuCache:()=>cpuModels.clear(),
  evaluate(input){
   const iterator=session(input);let step=iterator.next();
   while(!step.done){
    const {index,inputs,count}=step.value;step=iterator.next(runCpuSegment(index,inputs,count));
   }
   return step.value;
  },
 };
}

// Batch only numerical segments; all candidates retain separate distributions.
export async function executeStochasticBatch(executor,inputs,count,runSegment){
 const stride=inputs.length/count,iterators=Array.from({length:count},(_,i)=>executor.session(inputs.subarray(i*stride,(i+1)*stride)));
 let steps=iterators.map(iterator=>iterator.next()),peakRows=0,dispatches=0;
 while(steps.some(step=>!step.done)){
  const jobs=steps.flatMap((step,i)=>step.done?[]:[{...step.value,candidate:i}]),index=jobs[0].index,model=executor.models[index],rows=jobs.reduce((n,j)=>n+j.count,0);
  const data=new Float64Array(rows*model.stride);let offset=0;
  for(const job of jobs){data.set(job.inputs,offset);offset+=job.inputs.length;}
  peakRows=Math.max(peakRows,rows);dispatches++;
  const result=await runSegment(index,model,data,rows),width=model.program.outputs.length;offset=0;
  for(const job of jobs){steps[job.candidate]=iterators[job.candidate].next(result.subarray(offset,offset+job.count*width));offset+=job.count*width;}
 }
 return {results:steps.map(step=>step.value),peakRows,dispatches};
}
