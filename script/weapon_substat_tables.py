"""Correct the pinned HP77 table without recompiling the original release core."""
import struct


def correct_hp77_level90(wasm: bytes, row_stride: int) -> bytes:
    # LLVM stores the eight level anchors as parallel tables of stat families.
    # Match every HP77 anchor, including the bad final value, before changing it.
    anchors = [struct.pack('<d', value) for value in
               (.077, .135, .197, .228, .259, .29, .321, .413)]
    matches = []
    start = wasm.find(anchors[0])
    while start != -1:
        if all(wasm[start + i * row_stride:start + i * row_stride + 8] == anchor
               for i, anchor in enumerate(anchors)):
            matches.append(start)
        start = wasm.find(anchors[0], start + 1)
    if len(matches) != 1:
        raise ValueError(f'Pinned HP77 table changed: found {len(matches)} matches')
    offset = matches[0] + 7 * row_stride
    return wasm[:offset] + struct.pack('<d', .352) + wasm[offset + 8:]
