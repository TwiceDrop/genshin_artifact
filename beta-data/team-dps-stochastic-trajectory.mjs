// A layered DAG retains the transitions that the numerical executor actually
// took before merging equal future states. It never reconstructs history from
// independent event marginals. Conditions may constrain past or future facts.
export function conditionStochasticTrajectory(trajectory,trace,{evidence=[],likelihoods=[],choices=[]}={}){
 const {layers}=trajectory,locations=new Map();
 layers.forEach((layer,index)=>layer.observations.forEach(observation=>locations.set(observation.group,{index,observation})));
 const factors=layers.map(layer=>new Float64Array(layer.count).fill(1));
 for(const condition of evidence){
  const {index,observation}=locations.get(condition.group),allowed=new Set(condition.states);
  for(let row=0;row<factors[index].length;row++)if(!allowed.has(observation.entries[row]))factors[index][row]=0;
 }
 // A branch likelihood appears once, even when several of its events are
 // queried. Event presence is a separate binary observation.
 for(const group of new Set(likelihoods)){
  const {index,observation}=locations.get(group);
  for(let row=0;row<factors[index].length;row++)factors[index][row]*=observation.masses[row];
 }
 const drawIds=new Set(layers.map(layer=>layer.draw)),required=new Map();
 for(const {id,value}of choices){
  if(id===null||!drawIds.has(id)||value!==0&&value!==1)throw Error('Unknown or invalid stochastic choice: '+id);
  if(required.has(id)&&required.get(id)!==value)throw Error('Conflicting stochastic choice: '+id);
  required.set(id,value);
 }
 const edges=(layer,row)=>[
  {to:layer.next0[row],probability:1-layer.chance[row],value:0},
  {to:layer.next1[row],probability:layer.chance[row],value:1},
 ].filter(edge=>edge.to>=0&&edge.probability>0&&(!required.has(layer.draw)||edge.value===required.get(layer.draw)));
 const forward=[new Float64Array([1])];
 for(const [i,layer]of layers.entries()){
  const next=new Float64Array(layer.nextCount);
  for(let row=0;row<layer.count;row++){
   const weight=forward[i][row]*factors[i][row];if(weight===0)continue;
   for(const edge of edges(layer,row))next[edge.to]+=weight*edge.probability;
  }
  forward.push(next);
 }
 const backward=[];backward[layers.length]=new Float64Array(layers.at(-1)?.nextCount??1).fill(1);
 for(let i=layers.length-1;i>=0;i--){
  const layer=layers[i],current=new Float64Array(layer.count);
  for(let row=0;row<layer.count;row++){
   if(factors[i][row]===0)continue;
   for(const edge of edges(layer,row))current[row]+=edge.probability*backward[i+1][edge.to];
   current[row]*=factors[i][row];
  }
  backward[i]=current;
 }
 const probability=backward[0][0];
 return {
  probability,
  marginals({groups=[...locations.keys()],weighted=true}={}){
   const output=trace.map(()=>[]);if(probability===0)return output;
   for(const group of groups){
    const {index,observation}=locations.get(group),weights=new Float64Array(trace[group].length);
    for(let row=0;row<observation.entries.length;row++){
     const entry=observation.entries[row];if(entry<0)continue;
     const weight=forward[index][row]*backward[index][row]/probability;
     if(weight!==0)weights[entry]+=weight*(weighted?observation.masses[row]:1);
    }
    output[group]=trace[group].flatMap((entry,index)=>weights[index]? [{values:entry.values,probability:weights[index],index}]:[]);
   }
   return output;
  },
  // Select one supported latent assignment. Greedy selection here provides a
  // witness, not a claim that it is the globally most probable trajectory.
  // Its assignment probability can include draws irrelevant to a chosen outer
  // branch; callers must not label it the probability of a unique combat path.
  witness(){
   if(probability===0)return null;
   const states=[],draws=[],output=trace.map(()=>[]);let row=0,weight=1;
   for(const [index,layer]of layers.entries()){
    states.push(row);weight*=factors[index][row];
    for(const observation of layer.observations){const entry=observation.entries[row];if(entry>=0)output[observation.group]=[{values:trace[observation.group][entry].values,probability:1,index:entry}];}
    const options=edges(layer,row).filter(edge=>backward[index+1][edge.to]>0);
    const selected=options.reduce((best,edge)=>!best||edge.probability*backward[index+1][edge.to]>best.probability*backward[index+1][best.to]?edge:best,null);
    if(!selected)return null;
    if(layer.draw!==null)draws.push({id:layer.draw,value:selected.value});
    weight*=selected.probability;row=selected.to;
   }
   return {states,draws,assignmentProbability:weight/probability,trace:output};
  },
 };
}
