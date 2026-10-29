import {scheduleNumericProgram} from './team-dps-numeric-program.mjs';

// Compile only the numerical IR's fixed operation vocabulary. Formula values
// enter a constant buffer, never executable source. No operation is reassociated
// or approximated; the register schedule is shared with the GPU backend.
export function createCpuNumericExecutor(program){
 const started=performance.now(),scheduled=scheduleNumericProgram(program,{streamOutputs:true}),constants=[],width=scheduled.outputCount;
 const lines=['"use strict";return function(input,count,stride,output,outputOffset,inputOffset){'];
 if(scheduled.registerCount)lines.push('let '+Array.from({length:scheduled.registerCount},(_,i)=>'r'+i).join(',')+';');
 lines.push(`for(let row=0;row<count;row++){const src=inputOffset+row*stride,dst=outputOffset+row*${width};`);
 for(const node of scheduled.nodes){
  const [a,b,c]=node.args.map(index=>'r'+index);let expression;
  switch(node.op){
   case 'literal':
    if(typeof node.value!=='number')throw Error('Invalid numeric literal');
    expression='constants['+constants.length+']';constants.push(node.value);break;
   case 'input':
    if(!Number.isSafeInteger(node.value)||node.value<0)throw Error('Invalid numeric input index');
    expression=`input[src+${node.value}]`;break;
   case 'add':expression=a+'+'+b;break;case 'sub':expression=a+'-'+b;break;
   case 'mul':expression=a+'*'+b;break;case 'div':expression=a+'/'+b;break;
   case 'min':expression=`Math.min(${a},${b})`;break;case 'max':expression=`Math.max(${a},${b})`;break;
   case 'abs':expression=`Math.abs(${a})`;break;case 'floor':expression=`Math.floor(${a})`;break;
   case 'lt':expression=`+(${a}<${b})`;break;case 'gt':expression=`+(${a}>${b})`;break;
   case 'ge':expression=`+(${a}>=${b})`;break;case 'eq':expression=`+(${a}===${b})`;break;
   case 'choose':expression=`${a}?${b}:${c}`;break;
   default:throw Error('Unsupported CPU numerical operation: '+node.op);
  }
  lines.push(`r${node.target}=${expression};`);
  node.emits.forEach(index=>lines.push(`output[dst+${index}]=r${node.target};`));
 }
 lines.push('}return output;}');
 const source=lines.join('\n'),run=new Function('constants',source)(new Float64Array(constants));
 return {
  stats:{nodes:scheduled.nodes.length,registers:scheduled.registerCount,sourceBytes:source.length,compileMs:performance.now()-started},
  evaluateBatch(input,count,stride,output=new Float64Array(count*width),outputOffset=0,inputOffset=0){
   // Early output must not overwrite an input that this batch has yet to read.
   const source=input===output||input.buffer&&input.buffer===output.buffer?input.slice():input;
   return run(source,count,stride,output,outputOffset,inputOffset);
  },
  evaluate(input){return run(input,1,input.length,new Float64Array(width),0,0);},
 };
}
