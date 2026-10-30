import {NUMERIC_OPS,scheduleNumericProgram} from './team-dps-numeric-program.mjs';
import {teamF64Wgsl} from './team-dps-f64-wgsl.mjs';

const main=String.raw`
struct Settings { count:u32, stride:u32, instructions:u32, outputs:u32 }
struct Instruction { op:u32, a:u32, b:u32, c:u32, destination:u32, firstOutput:u32, outputCount:u32 }
@group(0) @binding(0) var<uniform> settings:Settings;
@group(0) @binding(1) var<storage,read> instructions:array<Instruction>;
@group(0) @binding(2) var<storage,read> inputs:array<vec2<u32>>;
@group(0) @binding(3) var<storage,read_write> registers:array<vec2<u32>>;
@group(0) @binding(4) var<storage,read> selected:array<u32>;
@group(0) @binding(5) var<storage,read_write> outputs:array<vec2<u32>>;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id:vec3<u32>){
 let lane=id.x;if(lane>=settings.count){return;}
 for(var i=0u;i<settings.instructions;i++){
  let instruction=instructions[i];var result:vec2<u32>;
  if(instruction.op==0u){result=vec2<u32>(instruction.a,instruction.b);}
  else if(instruction.op==1u){result=inputs[lane*settings.stride+instruction.a];}
  else{
   let a=registers[instruction.a*settings.count+lane];let b=registers[instruction.b*settings.count+lane];
   switch instruction.op {
    case 2u:{result=fp_add(a,b);}case 3u:{result=fp_sub(a,b);}case 4u:{result=fp_mul(a,b);}case 5u:{result=fp_div(a,b);}
    case 6u:{result=fp_min(a,b);}case 7u:{result=fp_max(a,b);}case 8u:{result=vec2<u32>(a.x,a.y&0x7fffffffu);}
    case 9u:{result=fp_bool(fp_lt(a,b));}case 10u:{result=fp_bool(fp_lt(b,a));}
    case 11u:{result=fp_bool(!nan(a)&&!nan(b)&&!fp_lt(a,b));}case 12u:{result=fp_bool(fp_eq(a,b));}
    case 13u:{result=select(registers[instruction.c*settings.count+lane],b,!zero(a)&&!nan(a));}
    case 14u:{result=fp_floor(a);}
    default:{result=fp_nan();}
   }
  }
  if(instruction.destination!=0xffffffffu){registers[instruction.destination*settings.count+lane]=result;}
  for(var j=0u;j<instruction.outputCount;j++){
   outputs[lane*settings.outputs+selected[instruction.firstOutput+j]]=result;
  }
 }
}`;
// All numerical segments use the same interpreter shader; only their data
// buffers differ. Share its pending compilation across scorers on one device.
const devicePipelines=new WeakMap();
export async function createWebGpuNumericExecutor(device,program){
 program=scheduleNumericProgram(program,{streamOutputs:true});
 const words=new Uint32Array(program.nodes.length*7),emissions=[],bits=new Uint32Array(2),value=new Float64Array(bits.buffer);
 program.nodes.forEach((node,i)=>{
  const row=[NUMERIC_OPS.indexOf(node.op),...(node.args),0,0,0];
  if(node.op==='literal'){value[0]=node.value;row[1]=bits[0];row[2]=bits[1];}
  if(node.op==='input')row[1]=node.value;
  words.set([...row.slice(0,4),node.retain?node.target:0xffffffff,emissions.length,node.emits.length],i*7);
  emissions.push(...node.emits);
 });
 if(!devicePipelines.has(device)){
  const module=device.createShaderModule({code:teamF64Wgsl+main});
  devicePipelines.set(device,device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}}));
 }
 const pipeline=await devicePipelines.get(device);
 const buffer=(data,usage)=>{const b=device.createBuffer({size:data.byteLength,usage:usage|GPUBufferUsage.COPY_DST});device.queue.writeBuffer(b,0,data);return b;};
 const code=buffer(words,GPUBufferUsage.STORAGE),selected=buffer(new Uint32Array(emissions),GPUBufferUsage.STORAGE);
 return {
  stats:{nodes:program.nodes.length,registers:program.registerCount,outputs:program.outputCount,instructionBytes:words.byteLength},
  async evaluate(inputs,count){
   const settings=buffer(new Uint32Array([count,inputs.length/count,program.nodes.length,program.outputCount]),GPUBufferUsage.UNIFORM);
   const data=buffer(inputs,GPUBufferUsage.STORAGE);
   const registers=device.createBuffer({size:program.registerCount*count*8,usage:GPUBufferUsage.STORAGE});
   const size=program.outputCount*count*8,outputs=device.createBuffer({size,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC});
   const readback=device.createBuffer({size,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});
   const bindings=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[settings,code,data,registers,selected,outputs].map((b,binding)=>({binding,resource:{buffer:b}}))});
   const encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,bindings);pass.dispatchWorkgroups(Math.ceil(count/64));pass.end();
   encoder.copyBufferToBuffer(outputs,0,readback,0,size);device.queue.submit([encoder.finish()]);await readback.mapAsync(GPUMapMode.READ);
   const result=new Float64Array(readback.getMappedRange()).slice();readback.unmap();
   for(const b of [settings,data,registers,outputs,readback])b.destroy();return result;
  },
  destroy(){code.destroy();selected.destroy();},
 };
}
