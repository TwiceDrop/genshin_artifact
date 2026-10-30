"""Add read-only optimizer progress imports to copies of both deployed kernels."""
import pathlib,re,subprocess,argparse
p=argparse.ArgumentParser();p.add_argument('--wabt',default='D:/Documents/ChatGPT/kernel-recovery-lab/tools/wabt-1.0.42/bin');args=p.parse_args()
root=pathlib.Path(__file__).resolve().parent.parent;work=root/'.build-target/progress-results-7201';work.mkdir(parents=True,exist_ok=True)
for kind,source,group,loop,leaf in [('published','mona_wasm/pkg/mona_effect_bridge','f119','L7','f91'),('extension','mona_wasm/extension/mona_extension_bg','f109','L4','f1491')]:
 wat=work/(kind+'.wat');subprocess.run([args.wabt+'/wasm2wat.exe',str(root/(source+'.wasm')),'--generate-names','-o',str(wat)],check=True);s=wat.read_text(encoding='utf-8')
 # Named references keep function/table indices correct when adding an import.
 at=s.index('  (func ');s=s[:at]+'  (import "mona_progress" "observe" (func $mona_observe (param i32 i32 i32)))\n'+s[at:]
 def edit(name,fn):
  global s
  a=s.index('  (func $'+name+' ');b=s.index('\n  (',a+1);s=s[:a]+fn(s[a:b])+s[b:]
 def entry(body,code):
  lines=body.splitlines();at=next(i for i,x in enumerate(lines[1:],1) if not x.lstrip().startswith('(local '));lines[at:at]=code.splitlines();return '\n'.join(lines)
 def group_patch(body):
  assert all('i32.load offset='+str(n) in body for n in [164,176,188])
  body=entry(body,'    i32.const 0\n    local.get $p0\n    local.get $p2\n    call $mona_observe')
  marker='loop $'+loop+'\n';assert body.count(marker)==1
  return body.replace(marker,marker+'    i32.const 1\n    i32.const 0\n    i32.const 0\n    call $mona_observe\n')
 edit(group,group_patch)
 if kind=='published':
  def leaf_patch(body):
   marker='call $f117';assert body.count(marker)==1
   return body.replace(marker,'i32.const 2\n    i32.const 0\n    i32.const 0\n    call $mona_observe\n    '+marker)
  edit(leaf,leaf_patch)
 else:edit(leaf,lambda b:entry(b,'    i32.const 2\n    i32.const 0\n    i32.const 0\n    call $mona_observe'))
 # Upper-bound evaluations also keep the UI alive during large pruned branches.
 edit('f113' if kind=='published' else 'f1997',lambda b:entry(b,'    i32.const 3\n    i32.const 0\n    i32.const 0\n    call $mona_observe'))
 # Naive uses the recursive enumerator; its second check is the terminal real build.
 def call_hook(body,target,index,event):
  matches=list(re.finditer(r'call \$'+target+r'\b',body));assert len(matches)>index
  at=matches[index].start();return body[:at]+f'i32.const {event}\n    i32.const 0\n    i32.const 0\n    call $mona_observe\n    '+body[at:]
 edit('f80' if kind=='published' else 'f110',lambda b:call_hook(b,'f437' if kind=='published' else 'f1281',1,2))
 edit('f437' if kind=='published' else 'f1281',lambda b:entry(b,'    i32.const 3\n    i32.const 0\n    i32.const 0\n    call $mona_observe'))
 if kind=='published':
  edit('f314',lambda b:entry(b,'    i32.const 5\n    i32.const 0\n    i32.const 0\n    call $mona_observe'))
  edit('f61',lambda b:call_hook(b,'f189',0,5))
 else:
  for name in ['f86','f98','f105']:edit(name,lambda b:call_hook(b,'f1281',0,5))
  edit('f71',lambda b:call_hook(b,'f647',0,5))
 output=work/(kind+'-progress.wat');output.write_text(s,encoding='utf-8');subprocess.run([args.wabt+'/wat2wasm.exe',str(output),'-o',str(root/(source+'_progress.wasm'))],check=True)
 print(kind,'progress copy generated')

# wasm-bindgen regenerates this file when rebuilding the extension.
binding=root/'mona_wasm/extension/mona_extension.js'
js=binding.read_text(encoding='utf-8')
if 'imports.mona_progress' not in js:
 js="import {progressImports} from '../../beta-data/optimizer-progress.mjs';\n"+js
 js=js.replace('const imports = {};','const imports = {};\n    imports.mona_progress = progressImports(()=>wasm.memory);')
 binding.write_text(js,encoding='utf-8')
