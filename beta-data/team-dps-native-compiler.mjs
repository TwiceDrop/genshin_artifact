import {scalarMath} from './team-dps-numeric-rules.mjs';
const numeric=text=>{
 if(!text.includes('0x'))return Number(text.replace('inf','Infinity'));
 const sign=text.startsWith('-')?-1:1,[mantissa,exponent]=text.replace(/^-?0x/,'').split('p'),[integer,fraction='']=mantissa.split('.');
 return sign*(parseInt(integer,16)+(fraction?parseInt(fraction,16)/16**fraction.length:0))*2**Number(exponent);
};
function parse(source){
 const lines=source.split('\n').slice(1).map(l=>l.trim()).filter(l=>l&&!l.startsWith('(local'));
 lines[lines.length-1]=lines.at(-1).replace(/\)$/,'');let at=0;
 function block(){const out=[];while(at<lines.length){
  const line=lines[at++],tokens=line.split(/\s+/),op=tokens[0];
  if(op==='end'||op==='else')return {body:out,end:op};
  if(op==='if'||op==='block'){
   const yes=block(),no=yes.end==='else'?block().body:[];
   out.push({op,label:tokens[1],result:line.includes('(result'),yes:yes.body,no});
  }else out.push({op,args:tokens.slice(1)});
 }return {body:out};}return block().body;
}
export function createNativeGraphCompiler(builder,library){
 const math=Object.fromEntries(Object.entries(scalarMath).map(([key,fn])=>[key,(...args)=>args.some(x=>typeof x==='object')?builder.resolve(builder.math[key](...args)):Number(fn(...args))]));
 const ast=new Map();
 const clone=s=>({...s,stack:[...s.stack],locals:{...s.locals}});
 const join=states=>{
  const groups=new Map();
  for(const state of states){
   const key=state.flow||'',prior=groups.get(key);
   if(!prior){groups.set(key,state);continue;}
   const condition=state.condition;
   prior.stack=prior.stack.map((v,i)=>math.choose(condition,state.stack[i],v));
   prior.locals=Object.fromEntries([...new Set([...Object.keys(prior.locals),...Object.keys(state.locals)])].map(k=>[k,math.choose(condition,state.locals[k]??0,prior.locals[k]??0)]));
   prior.condition=math.max(prior.condition,state.condition);
  }
  return [...groups.values()];
 };
 function invoke(name,parameters,data){
  if(!ast.has(name))ast.set(name,parse(library.funcs[name]));
  function branch(s,label,labels){
   const target=labels.findLast(l=>l.label===label),value=s.stack.at(-1);
   s.stack=s.stack.slice(0,target.height);if(target.result)s.stack.push(value);s.flow=label;return s;
  }
  function run(body,states,labels){
   for(const instruction of body){const next=[];
    for(const s of states){
     if(s.flow){next.push(s);continue;}
     const {op,args=[]}=instruction,stack=s.stack,locals=s.locals;
     if(op==='block'){
      const target={label:instruction.label,height:stack.length,result:instruction.result};
      const rows=run(instruction.yes,[s],[...labels,target]);
      for(const row of rows)if(row.flow===target.label)row.flow=null;
      next.push(...join(rows));continue;
     }
     if(op==='if'){
      const condition=stack.pop();
      if(typeof condition==='number'){next.push(...run(condition?instruction.yes:instruction.no,[s],labels));continue;}
      const yes=clone(s),no=clone(s);yes.condition=math.mul(s.condition,condition);no.condition=math.mul(s.condition,math.sub(1,condition));
      next.push(...join([...run(instruction.yes,[yes],labels),...run(instruction.no,[no],labels)]));continue;
     }
     if(op==='br'){next.push(branch(s,args[0],labels));continue;}
     if(op==='br_table'){const index=stack.pop();next.push(branch(s,args[Math.min(index,args.length-1)],labels));continue;}
     if(op==='br_if'){
      const condition=stack.pop();
      if(typeof condition==='number'){next.push(condition?branch(s,args[0],labels):s);continue;}
      const taken=clone(s);taken.condition=math.mul(s.condition,condition);s.condition=math.mul(s.condition,math.sub(1,condition));
      next.push(branch(taken,args[0],labels),s);continue;
     }
     if(op==='local.get')stack.push(locals[args[0]]??0);
     else if(op==='local.set')locals[args[0]]=stack.pop();
     else if(op==='local.tee')locals[args[0]]=stack.at(-1);
     else if(op==='f64.const')stack.push(numeric(args[0]));
     else if(op==='i32.const')stack.push(Number(args[0]));
     else if(op==='f64.load'||op==='i32.load'){
      const offset=stack.pop()+Number(args.find(a=>a.startsWith('offset='))?.slice(7)||0);
      stack.push(op==='f64.load'?data.getFloat64(offset,true):data.getUint32(offset,true));
     }else if(op==='select'){const condition=stack.pop(),no=stack.pop(),yes=stack.pop();stack.push(math.choose(condition,yes,no));}
     else if(op==='drop')stack.pop();
     else if(op==='f64.floor')stack.push(math.floor(stack.pop()));
     else if(op==='i32.eqz')stack.push(math.eq(stack.pop(),0));
     else if(op==='i32.sub'){const b=stack.pop(),a=stack.pop();stack.push((a-b)|0);}
     else if(op==='i32.add'){const b=stack.pop(),a=stack.pop();stack.push((a+b)|0);}
     else if(op==='f64.convert_i32_u')stack.push(stack.pop()>>>0);
     else if(op==='call'){
      const target=args[0].slice(1),count=[...library.funcs[target].split('\n')[0].matchAll(/\(param /g)].length;
      stack.push(invoke(target,stack.splice(stack.length-count,count),data));
     }
     else if(op.startsWith('f64.')){
      const b=stack.pop(),a=stack.pop(),key=op.slice(4);
      stack.push(key==='ne'?math.sub(1,math.eq(a,b)):key==='le'?math.ge(b,a):math[key](a,b));
     }else throw Error('Native forward operation: '+name+'/'+op);
     next.push(s);
    }states=join(next);
   }return states;
  }
  const states=run(ast.get(name),[{condition:1,stack:[],locals:Object.fromEntries(parameters.map((v,i)=>['$p'+i,v]))}],[]);
  return states[0].stack.at(-1);
 }
 const compile=(edge,a,b)=>invoke(library.table[edge.fn],[0,a,b],new DataView(Uint8Array.from(edge.data).buffer));
 function graph(snapshot,overrides=new Map()){
  const values=new Map(),sums=rows=>rows.reduce((n,v)=>math.add(n,v),0);
  const get=index=>{
   if(index===-1)return 0;if(values.has(index))return values.get(index);
   const sources=new Map();
   for(const edge of snapshot.edges.filter(e=>e.to===index)){
    let v=compile(edge,get(edge.from1),get(edge.from2));if(edge.scale!==undefined)v=math.mul(v,edge.scale);
    sources.set(edge.label,math.add(sources.get(edge.label)||0,v));
   }
   const self=snapshot.nodes[index].map(row=>row.value);
   if(overrides.has(index))self.push(overrides.get(index));
   const value=math.add(sums(self),sums([...sources.values()]));values.set(index,value);return value;
  };
  const named=(index,label)=>{
   const self=snapshot.nodes[index].filter(r=>r.label===label).map(r=>r.value),edges=snapshot.edges.filter(e=>e.to===index&&e.label===label).map(e=>math.mul(compile(e,get(e.from1),get(e.from2)),e.scale??1));
   return sums([...self,...edges]);
  };
  const sources=index=>Object.fromEntries([...new Set([...snapshot.nodes[index].map(row=>row.label),...snapshot.edges.filter(e=>e.to===index).map(e=>e.label)])].map(label=>[label,named(index,label)]));
  return {get,named,sources,math};
 }
 return {compile,graph,math};
}
