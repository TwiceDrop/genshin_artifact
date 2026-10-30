import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url)),wabt=process.argv[2];
const out=path.join(root,'beta-data/team-dps-native'),work=path.join(root,'.build-target/team-dps-native-graph');
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(work,{recursive:true});
for(const [name,input]of [['native','mona_wasm/pkg/mona_effect_bridge.wasm'],['extension','mona_wasm/extension/mona_extension_bg.wasm']]){
 const watPath=path.join(work,name+'.wat');
 execFileSync(path.join(wabt,'wasm2wat.exe'),[path.join(root,input),'--generate-names','-o',watPath]);
 let wat=fs.readFileSync(watPath,'utf8');
 const imports=name==='native'?`  (import "mona_trace" "write" (func $trace_write (param i32 i32 i32 i32 f64)))
  (import "mona_trace" "edge" (func $trace_edge (param i32 i32 i32 i32 i32 i32 i32 i32 i32 i32)))
  (import "mona_trace" "read" (func $trace_read (param i32 i32)))\n`:`  (import "mona_trace_ext" "read" (func $trace_read (param i32 i32)))
  (import "mona_trace_ext" "leave" (func $trace_leave))\n`;
 const first=wat.indexOf('  (func ');wat=wat.slice(0,first)+imports+wat.slice(first);
 if(name==='native'){
  for(const [fn,count,hook]of [['f430',5,'trace_write'],['f653',10,'trace_edge']]){
   const start=wat.indexOf('  (func $'+fn+' '),body=wat.indexOf('\n    global.get ',start);
   const code=Array.from({length:count},(_,i)=>'    local.get $p'+i).join('\n')+'\n    call $'+hook;
   wat=wat.slice(0,body)+'\n'+code+wat.slice(body);
  }
  const start=wat.indexOf('  (func $f258 '),body=wat.indexOf('\n    local.get $p1',start);
  wat=wat.slice(0,body)+'\n    local.get $p0\n    local.get $p1\n    call $trace_read'+wat.slice(body);
 }else{
  const start=wat.indexOf('  (func $f729 '),end=wat.indexOf('\n  (',start+1);
  let body=wat.slice(start,end);const pos=body.indexOf('\n    block ');
  body=body.slice(0,pos)+'\n    local.get $p0\n    local.get $p1\n    call $trace_read'+body.slice(pos);
  body=body.replace(/\n(\s*)return\b/g,'\n$1call $trace_leave\n$1return');wat=wat.slice(0,start)+body+wat.slice(end);
 }
 const traced=path.join(work,name+'-traced.wat');fs.writeFileSync(traced,wat);
 execFileSync(path.join(wabt,'wat2wasm.exe'),[traced,'-o',path.join(out,name+'-graph.wasm')]);
 const funcs={},table={};
 for(const match of wat.matchAll(/^  \(func \$(\w+) \(type \$\w+\) \(param \$p0 i32\) \(param \$p1 f64\) \(param \$p2 f64\) \(result f64\)/mg)){
  const end=wat.indexOf('\n  (',match.index+1);funcs[match[1]]=wat.slice(match.index,end).replace(/\(;[\s\S]*?;\)/g,'');
 }
 for(const match of wat.matchAll(/^  \(elem \$\w+ \(i32.const (\d+)\) func ([^\n]+)\)/mg)){let index=+match[1];for(const name of match[2].trim().split(/\s+/))table[index++]=name.slice(1);}
 const pending=Object.keys(funcs);
 while(pending.length){const fn=pending.pop();for(const match of funcs[fn].matchAll(/\bcall \$(\w+)/g))if(!funcs[match[1]]){
  const start=wat.indexOf('  (func $'+match[1]+' '),end=wat.indexOf('\n  (',start+1);funcs[match[1]]=wat.slice(start,end).replace(/\(;[\s\S]*?;\)/g,'');pending.push(match[1]);
 }}
 fs.writeFileSync(path.join(out,name+'-functions.json'),JSON.stringify({table,funcs}));
 console.log({name,functions:Object.keys(funcs).length});
}
let bindings=fs.readFileSync(path.join(root,'mona_wasm/extension/mona_extension.js'),'utf8');
bindings="import {extensionGraphImports,bindExtensionGraphMemory} from '../team-dps-graph-reader.mjs';\n"+bindings;
bindings=bindings.replace('const imports = {};','const imports = {};\n    imports.mona_trace_ext=extensionGraphImports;');
bindings=bindings.replace('wasm = instance.exports;','wasm = instance.exports;\n    bindExtensionGraphMemory(()=>wasm.memory);');
bindings=bindings.replace("new URL('mona_extension_bg.wasm', import.meta.url)","new URL('extension-graph.wasm?raw-wasm', import.meta.url)");
fs.writeFileSync(path.join(out,'extension-bindings.mjs'),bindings);
