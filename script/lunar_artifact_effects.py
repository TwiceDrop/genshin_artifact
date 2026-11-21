"""Restore missing lunar reaction bonuses in the detailed and optimizer graphs."""
import re


def add_lunar_bloom_write(wat, *, extension=False):
    # The detailed and optimizer graphs both cache the ordinary Bloom bonus in l2.
    # The extension enum is defined in attribute_name.rs, the release enum in legacy-effect-slots.mjs.
    bloom, hyperbloom, lunar, label = (107, 106, 198, 1243007) if extension else (83, 82, 102, 1381987)
    # Ignore function indices. Progress and trace imports shift them in derived kernels.
    sites = re.compile(
        rf"    local.get \$p1\n    i32.const {hyperbloom}\n"
        rf"(?P<label>    i32.const {label}\n    i32.const 19\n|)"
        r"    local.get \$l2\n    call (?P<writer>\$f\d+)\)"
    )
    matches = list(sites.finditer(wat))
    if len(matches) != 2:
        raise ValueError("Expected two Paradise Lost four-piece write sites")
    for site in reversed(matches):
        start = wat.rindex("\n  (func ", 0, site.start())
        body = wat[start:site.start()]
        if (f"i32.const {bloom}\n" not in body
                or "(;=0.25;)" not in body or "(;=0.4;)" not in body
                or "local.tee $l2" not in body):
            raise ValueError("Paradise Lost stack formula changed")
        write = (f"\n    local.get $p1\n    i32.const {lunar}\n{site['label']}"
                 f"    local.get $l2\n    f64.const 0.25\n    f64.mul\n    call {site['writer']}")
        wat = wat[:site.end()-1] + write + wat[site.end()-1:]
    return wat


def add_thundering_fury_write(wat, *, extension=False):
    # Pin the complete sequence of four 40% writes and the 20% Aggravate write.
    # Retain the original writer and label in each graph when adding Lunar-Charged.
    slots, lunar, label = ((108, 111, 112, 106, 120), 123, 1134606) if extension else ((84, 87, 88, 82, 96), 98, 1363926)
    pattern = []
    for index, slot in enumerate(slots):
        percentage = "0x1.999999999999ap-3 (;=0.2;)" if index == 4 else "0x1.999999999999ap-2 (;=0.4;)"
        label_args = rf"(?P<label>    i32.const {label}\n    i32.const 16\n|)" if index == 0 else r"(?P=label)"
        writer = r"(?P<writer>\$f\d+)" if index == 0 else r"(?P=writer)"
        pattern.append(rf"    local.get \$p1\n    i32.const {slot}\n{label_args}    f64.const {re.escape(percentage)}\n    call {writer}")
    def extend(site):
        return (site[0][:-1] + f"\n    local.get $p1\n    i32.const {lunar}\n{site['label']}"
                + f"    f64.const 0.2\n    call {site['writer']})")
    patched, count = re.subn("\n".join(pattern) + r"\)", extend, wat)
    if count != 2:
        raise ValueError("Expected two Thundering Fury four-piece write sites")
    return patched
