"""7.1.12 published-core transform: exact numeric graph construction only.

The published character implementation is not recoverable from current Rust.
Keep native scoring, set application and search/heap functions unchanged.
The template contains only the 13 inline constant edges (zero-size environments).
Dynamic character/weapon/artifact/buff graphs are never shared or shallow-cloned.
"""

def patch_wat(s):
    if '__mona_optimizer_graph_version' in s:
        raise ValueError('Optimizer graph transform already applied')
    if '(func $f117 (type $t25)' not in s or '(func $f355 (type $t27)' not in s:
        raise ValueError('7.1.12 native graph signatures changed')
    a=s.index('  (func $f117 ');b=s.index('\n  (',a+1);body=s[a:b]
    alloc='global.get $g0\n    i32.const 10688\n    i32.sub';free='local.get $l8\n    i32.const 10688\n    i32.add\n    global.set $g0'
    assert body.count(alloc)==1 and body.count(free)==1
    body=body.replace(alloc,alloc.replace('10688','11008')).replace(free,free.replace('10688','11008'))
    site='    call $f1075\n';assert body.count(site)==1
    body=body.replace(site,site+'    (memory.fill (i32.add (local.get $l8) (i32.const 10688)) (i32.const 0) (i32.const 304))\n')
    start='        local.get $l15\n        f64.load offset=8\n        local.set $l26\n';end='        local.get $l18\n        local.get $p1\n        i32.const 4\n'
    x=body.index(start);y=body.index(end,x)
    body=body[:x]+'        (call $optimizer_dense_art (local.get $l15) (i32.add (local.get $l8) (i32.const 10688)))\n'+body[y:]
    start='      local.get $l8\n      i32.load offset=10620\n      local.tee $l9\n';end='    end\n    local.get $l8\n    i32.load offset=10640\n'
    x=body.index(start);y=body.index(end,x)
    body=body[:x]+'      (call $optimizer_dense_apply (i32.add (local.get $l8) (i32.const 10688)) (i32.add (local.get $l8) (i32.const 24)))\n'+body[y:]
    s=s[:a]+body+s[b:]
    helpers='''
      (func $optimizer_dense_add (param $array i32) (param $key i32) (param $value f64)
        (local $entry i32)
        (local.set $entry (i32.add (local.get $array) (i32.mul (local.get $key) (i32.const 16))))
        (i32.store8 (local.get $entry) (i32.const 1))
        (f64.store offset=8 (local.get $entry) (f64.add (local.get $value) (f64.load offset=8 (local.get $entry)))))
      (func $optimizer_dense_art (param $art i32) (param $array i32)
        (local $sub i32) (local $end i32)
        (call $optimizer_dense_add (local.get $array) (i32.load8_u (local.get $art)) (f64.load offset=8 (local.get $art)))
        (local.set $sub (i32.load offset=36 (local.get $art)))
        (local.set $end (i32.add (local.get $sub) (i32.shl (i32.load offset=40 (local.get $art)) (i32.const 4))))
        (block $done
          (br_if $done (i32.eq (local.get $sub) (local.get $end)))
          (loop $each
            (call $optimizer_dense_add (local.get $array) (i32.load8_u (local.get $sub)) (f64.load offset=8 (local.get $sub)))
            (local.set $sub (i32.add (local.get $sub) (i32.const 16)))
            (br_if $each (i32.ne (local.get $sub) (local.get $end))))))
      (func $optimizer_dense_apply (param $array i32) (param $graph i32)
        (local $i i32) (local $entry i32)
        (loop $each
          (local.set $entry (i32.add (local.get $array) (i32.shl (local.get $i) (i32.const 4))))
          (if (i32.load8_u (local.get $entry))
            (then (call $f355 (local.get $i) (local.get $graph) (i32.const 1438744) (i32.const 15) (f64.load offset=8 (local.get $entry)))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br_if $each (i32.lt_u (local.get $i) (i32.const 19)))))
    '''
    a=s.index('  (func $f433 ');b=s.index('\n  (',a+1);body=s[a:b]
    site='    block $B0 (result i32)\n';assert body.count(site)==1
    body=body.replace(site,'    i32.const 0\n    local.set $p9\n'+site);s=s[:a]+body+s[b:]
    a=s.index('  (func $f300 ');b=s.index('\n  (',a+1);constructor=s[a:b]
    assert constructor.count('call $f433')==13
    assert constructor.count('i32.const 20464')==2
    s=s[:a]+s[a:].replace('  (func $f300 ', '  (func $optimizer_base_initialize ',1)
    base_helpers="""
      (global $optimizer_base_template (mut i32) (i32.const 0))
      (func $f300 (param $out i32)
        (local $cached i32)
        (local.set $cached (global.get $optimizer_base_template))
        (if (i32.eqz (local.get $cached)) (then
          (local.set $cached (call $f2308 (i32.const 10584) (i32.const 8)))
          (if (i32.eqz (local.get $cached)) (then
            (call $f2393 (i32.const 8) (i32.const 10584))
            unreachable))
          (call $optimizer_base_initialize (local.get $cached))
          (global.set $optimizer_base_template (local.get $cached))))
        (memory.copy (local.get $out) (local.get $cached) (i32.const 10584)))
      (func (export "__mona_optimizer_graph_version") (result i32) i32.const 1)
    """
    pos=s.rfind(')');return s[:pos]+helpers+base_helpers+s[pos:]
