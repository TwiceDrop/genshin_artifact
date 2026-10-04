"""Bridge the published core at its verified native write and dependency sites."""
import argparse, pathlib, re, subprocess
parser=argparse.ArgumentParser(); parser.add_argument('--wabt',required=True); args=parser.parse_args()
root=pathlib.Path(__file__).resolve().parent.parent
src=root/'mona_wasm/pkg/mona_wasm_bg.wasm'
work=root/'.build-target/effect-bridge';work.mkdir(parents=True,exist_ok=True)
wat=work/'input.wat';output=work/'output.wat';tools=pathlib.Path(args.wabt)
subprocess.run([str(tools/'wasm2wat.exe'),str(src),'--generate-names','-o',str(wat)],check=True)
s=wat.read_text(); signature='  (func $f2436 (type $t0) (param $p0 i32) (param $p1 i32)\n    local.get $p1\n    i32.const 66\n    i32.const 1183370\n    i32.const 18\n    local.get $p0\n    f64.load\n    call $f430)'
if s.count(signature)!=1:raise SystemExit('Pinned CustomBonus write site changed')
replacement='  (func $f2436 (type $t0) (param $p0 i32) (param $p1 i32)\n    (local $bridge_value f64) (local $bridge_index i32) (local $bridge_record i32)\n    local.get $p0\n    f64.load\n    local.set $bridge_value\n    global.get $effect_count\n    if\n      local.get $bridge_value\n      f64.const -1099511627776\n      f64.le\n      if\n        f64.const -1099511627776\n        local.get $bridge_value\n        f64.sub\n        local.tee $bridge_value\n        f64.const 0\n        f64.ge\n        local.get $bridge_value\n        global.get $effect_count\n        f64.convert_i32_u\n        f64.lt\n        i32.and\n        if\n          local.get $bridge_value\n          i32.trunc_f64_u\n          local.tee $bridge_index\n          f64.convert_i32_u\n          local.get $bridge_value\n          f64.eq\n          if\n            global.get $effect_records\n            local.get $bridge_index\n            i32.const 24\n            i32.mul\n            i32.add\n            local.set $bridge_record\n            local.get $p1\n            local.get $bridge_record\n            i32.load\n            local.get $bridge_record\n            i32.load offset=16\n            local.get $bridge_record\n            i32.load offset=20\n            local.get $bridge_record\n            f64.load offset=8\n            call $f430\n            return\n          end\n        end\n      end\n    end\n    local.get $p1\n    i32.const 66\n    i32.const 1183370\n    i32.const 18\n    local.get $p0\n    f64.load\n    call $f430)'
dynamic_site='            local.set $bridge_record\n'
dynamic_write='''            local.get $bridge_record
            i32.load
            i32.const -1
            i32.eq
            if
              local.get $p1
              local.get $bridge_record
              i32.const 0
              call $hymn_install_edge
              return
            end
'''
replacement=replacement.replace(dynamic_site,dynamic_site+dynamic_write)
s=s.replace(signature,replacement)
plain_signature=signature.replace('$f2436','$f2435').replace('    i32.const 1183370\n    i32.const 18\n','').replace('$f430','$f1883')
plain_replacement=replacement.replace('$f2436','$f2435').replace('            local.get $bridge_record\n            i32.load offset=16\n            local.get $bridge_record\n            i32.load offset=20\n','').replace('    i32.const 1183370\n    i32.const 18\n','').replace('$f430','$f1883')
plain_replacement=plain_replacement.replace('              i32.const 0\n              call $hymn_install_edge','              i32.const 1\n              call $hymn_install_edge')
if s.count(plain_signature)!=1:raise SystemExit('Pinned optimizer write site changed')
s=s.replace(plain_signature,plain_replacement)

# The published single optimizer and stat-gain entry points construct Enemy::default.
# Replace only the two full native construction blocks. A transaction supplies
# the actual Enemy bytes before candidate evaluation; no damage formula is replaced.
for function, local, offset in [('optimizesinglewasm_optimize', '$l2', 3720),
                                ('bonusperstat_bonus_per_stat', '$l1', 1040)]:
    start=s.index('  (func $'+function+' '); end=s.index('\n  (',start+1)
    body=s[start:end]
    indent='        ' if function=='optimizesinglewasm_optimize' else '                          '
    lines=[]
    for i in reversed(range(8)):
        lines += ['local.get '+local, 'i64.const 4591870180066957722', 'i64.store offset='+str(offset+8*i)]
    lines += ['local.get '+local, 'i32.const 90', 'i32.store offset='+str(offset+64)]
    site='\n'.join(indent+line for line in lines)
    if body.count(site)!=1:raise SystemExit('Pinned Enemy construction changed: '+function)
    inject='\n'.join(indent+line for line in [
        'global.get $enemy_record', 'if', '  local.get '+local,
        '  i32.const '+str(offset), '  i32.add', '  global.get $enemy_record',
        '  i32.const 72', '  call $f579', '  drop', 'end'])
    s=s[:start]+body.replace(site,site+'\n'+inject)+s[end:]

# Both direct-hit builders scale their live skill branch before fixed additions.
# The transaction multiplier is constant; candidate ATK/EM and CRIT remain live.
def patch_stellar_body(function, instructions, position):
    global s
    start=s.index('  (func $'+function+' '); end=s.index('\n  (',start+1)
    body=s[start:end]
    lines=body.splitlines(keepends=True)
    sites=[i for i in range(len(lines)-len(instructions)+1)
           if [line.strip() for line in lines[i:i+len(instructions)]]==instructions]
    if len(sites)!=1:raise SystemExit('Pinned Stellar Swirl base changed: '+function)
    at=sites[0]+position
    indent=lines[at][:len(lines[at])-len(lines[at].lstrip())]
    lines[at:at]=[indent+'global.get $stellar_swirl_multiplier\n',indent+'f64.mul\n']
    s=s[:start]+''.join(lines)+s[end:]

patch_stellar_body('f54',[
    'local.get $l130', 'local.get $l129', 'f64.add',
    'local.get $l132', 'f64.mul', 'local.get $l127',
    'f64.const 0x1p+0 (;=1;)', 'f64.add', 'f64.mul',
    'local.get $l128', 'f64.mul', 'local.set $l135'],3)
patch_stellar_body('f72',[
    'local.get $p1', 'f64.load offset=320', 'f64.mul',
    'local.get $p1', 'f64.load offset=304', 'f64.add', 'f64.mul',
    'local.get $l45', 'local.get $l21', 'f64.add'],6)
s=s.rstrip()[:-1]+'\n  (global $stellar_swirl_multiplier (mut f64) (f64.const 1))\n  (func (export "__mona_stellar_swirl_multiplier_set") (param $value f64) local.get $value global.set $stellar_swirl_multiplier)\n)\n'

s=s.rstrip()[:-1]+'\n  (global $effect_records (mut i32) (i32.const 0))\n  (global $effect_count (mut i32) (i32.const 0))\n  (func (export "__mona_effect_bridge_set") (param $ptr i32) (param $count i32)\n    local.get $ptr global.set $effect_records\n    local.get $count global.set $effect_count)\n  (func (export "__mona_effect_bridge_version") (result i32) i32.const 2)\n)\n'
s=s.rstrip()[:-1]+"\n  (global $enemy_record (mut i32) (i32.const 0))\n  (func (export \"__mona_enemy_bridge_set\") (param $ptr i32) local.get $ptr global.set $enemy_record)\n  (func (export \"__mona_enemy_bridge_version\") (result i32) i32.const 1)\n)\n"
# HP and base ATK are native dependency nodes 26 and 27; ATKPercentage is 29.
# The closure ABI is the same t7/t9 pair used by the published weapon edges.
table=re.search(r'\(table \$T0 (\d+) (\d+) funcref\)',s)
forward_index=int(table[1]); backward_index=forward_index+1
s=s.replace(table[0],f'(table $T0 {forward_index+2} {forward_index+2} funcref)')
edge_args='''      local.get $graph
      i32.const 26
      i32.const 27
      i32.const 29
      local.get $forward
      global.get $hymn_forward_table
      local.get $backward
      global.get $hymn_backward_table
      local.get $record
      i32.load offset=16
      local.get $record
      i32.load offset=20
'''
s=s.rstrip()[:-1]+f'''
  (global $hymn_forward_table (mut i32) (i32.const 0))
  (global $hymn_backward_table (mut i32) (i32.const 0))
  (func (export "__mona_hp_to_atk_tables_set") (param $forward i32) (param $backward i32)
    local.get $forward global.set $hymn_forward_table
    local.get $backward global.set $hymn_backward_table)
  (func (export "__mona_hp_to_atk_forward_index") (result i32) i32.const {forward_index})
  (func (export "__mona_hp_to_atk_backward_index") (result i32) i32.const {backward_index})
  (func $hymn_hp_atk_forward (type $t7) (param $data i32) (param $hp f64) (param $atk f64) (result f64)
    local.get $hp
    f64.const 40000
    f64.sub
    f64.const 0
    f64.max
    f64.const 20000
    f64.min
    local.get $data
    f64.load
    f64.mul
    local.get $atk
    f64.mul)
  (func $hymn_hp_atk_backward (type $t9) (param $out i32) (param $data i32) (param $grad f64) (param $hp f64) (param $atk f64)
    local.get $out
    local.get $hp
    f64.const 40000
    f64.gt
    local.get $hp
    f64.const 60000
    f64.lt
    i32.and
    if (result f64)
      local.get $grad
      local.get $atk
      f64.mul
      local.get $data
      f64.load
      f64.mul
    else
      f64.const 0
    end
    f64.store
    local.get $out
    local.get $grad
    local.get $hp
    f64.const 40000
    f64.sub
    f64.const 0
    f64.max
    f64.const 20000
    f64.min
    f64.mul
    local.get $data
    f64.load
    f64.mul
    f64.store offset=8)
  (func $hymn_install_edge (param $graph i32) (param $record i32) (param $simple i32)
    (local $forward i32) (local $backward i32)
    i32.const 8
    i32.const 8
    call $f2308
    local.tee $forward
    local.get $record
    f64.load offset=8
    f64.store
    i32.const 8
    i32.const 8
    call $f2308
    local.tee $backward
    local.get $record
    f64.load offset=8
    f64.store
    local.get $simple
    if
{edge_args}      call $f433
    else
{edge_args}      call $f653
    end)
  (elem (i32.const {forward_index}) $hymn_hp_atk_forward $hymn_hp_atk_backward)
)
'''
output.write_text(s)
target=root/'mona_wasm/pkg/mona_effect_bridge.wasm'
subprocess.run([str(tools/'wat2wasm.exe'),str(output),'-o',str(target)],check=True)
subprocess.run([str(tools/'wasm-validate.exe'),str(target)],check=True)
print('Effect bridge:',target)
