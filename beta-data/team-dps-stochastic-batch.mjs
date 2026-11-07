import {lowerExpectedProgram} from './team-dps-expectation-program.mjs';

// Specialize one already compiled combat expression for this exact candidate
// batch. Only columns identical in every row become constants. Other columns
// retain their input references and a conservative min/max domain. This model
// must not be reused for another batch without proving that domain membership.
export function specializeStochasticBatch(program,inputs,count,{ratios=[]}={}){
 const stride=inputs.length/count,inputBounds=[],inputConstants=new Map();
 for(let field=0;field<stride;field++){
  const first=inputs[field];let lo=first,hi=first,same=true;
  for(let row=1;row<count;row++){const value=inputs[row*stride+field];lo=Math.min(lo,value);hi=Math.max(hi,value);same&&=Object.is(first,value);}
  inputBounds.push([lo,hi]);if(same)inputConstants.set(field,first);
 }
 const lowered=lowerExpectedProgram(program,{ratios,inputBounds,inputConstants});
 return {...lowered,inputBounds,inputConstants,stats:{...lowered.stats,constantInputs:inputConstants.size,inputCount:stride}};
}
