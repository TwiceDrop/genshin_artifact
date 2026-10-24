"""Apply the audited exact graph transform to the existing published effect bridge."""
import argparse
from pathlib import Path
import subprocess
import sys
from optimizer_graph_7112 import patch_wat

p=argparse.ArgumentParser()
p.add_argument('--wabt',required=True)
p.add_argument('--input',type=Path)
p.add_argument('--output',type=Path)
a=p.parse_args()
root=Path(__file__).resolve().parent.parent
source=a.input or root/'mona_wasm/pkg/mona_effect_bridge.wasm'
target=a.output or source
work=root/'.build-target/optimizer-graph-7112'
work.mkdir(parents=True,exist_ok=True)
tools=Path(a.wabt)
wat=work/'production-input.wat'
subprocess.run([str(tools/'wasm2wat.exe'),str(source),'--generate-names','-o',str(wat)],check=True)
s=wat.read_text(encoding='utf-8')
if '__mona_optimizer_graph_version' in s:
    raise SystemExit('Optimizer graph transform already present; rebuild from the preserved original bridge')
output=work/'production-optimized.wat'
output.write_text(patch_wat(s),encoding='utf-8')
subprocess.run([str(tools/'wat2wasm.exe'),str(output),'-o',str(target)],check=True)
subprocess.run([str(tools/'wasm-validate.exe'),str(target)],check=True)
print('Exact optimizer graph core:',target)

if target.resolve()==(root/'mona_wasm/pkg/mona_effect_bridge.wasm').resolve():
    subprocess.run([sys.executable,str(root/'script/build-optimizer-progress.py'),'--wabt',str(tools)],check=True)
