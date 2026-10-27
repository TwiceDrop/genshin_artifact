// Enemy fields follow the pinned published Enemy layout: eight f64 values,
// then an i32 level. Only the two entry points that used a default Enemy are patched.
export const ENEMY_RESISTANCES = Object.freeze([
    'electro_res', 'pyro_res', 'hydro_res', 'cryo_res',
    'anemo_res', 'geo_res', 'dendro_res', 'physical_res',
]);
export function normalizeEnemy(enemy) {
    if (enemy == null) return null;
    if (typeof enemy !== 'object' || Array.isArray(enemy)) throw Error('敌人设置须为对象');
    const level = enemy.level ?? 90;
    if (!Number.isInteger(level) || level < 1 || level > 2147483647) throw Error('敌人等级须为正整数');
    const result = {level};
    for (const key of ENEMY_RESISTANCES) {
        const value = enemy[key] ?? .1;
        if (typeof value !== 'number' || !Number.isFinite(value)) throw Error('敌人抗性无效：' + key);
        result[key] = value;
    }
    return result;
}
export function withLegacyEnemyBridge(api, wasm) {
    if (wasm.__mona_enemy_bridge_version?.() !== 1) throw Error('7.1.08 敌人参数桥接内核不匹配');
    let busy = false;
    return Object.fromEntries(Object.entries(api).map(([name, Class]) => [name,
        !['OptimizeSingleWasm', 'BonusPerStat'].includes(name) ? Class : new Proxy(Class, {get(target, method) {
            const fn = Reflect.get(target, method);
            if (typeof fn !== 'function') return fn;
            return (...args) => {
                const enemy = normalizeEnemy(args[0]?.enemy);
                if (!enemy) return fn(...args);
                if (busy) throw Error('不支持嵌套的敌人参数事务');
                const ptr = wasm.__wbindgen_export_0(72, 8);
                if (!ptr) throw Error('敌人参数内存分配失败');
                busy = true;
                try {
                    const view = new DataView(wasm.memory.buffer);
                    ENEMY_RESISTANCES.forEach((key, index) => view.setFloat64(ptr + 8 * index, enemy[key], true));
                    view.setInt32(ptr + 64, enemy.level, true);
                    view.setInt32(ptr + 68, 0, true);
                    wasm.__mona_enemy_bridge_set(ptr);
                    return fn(...args);
                } finally {
                    wasm.__mona_enemy_bridge_set(0);
                    wasm.__wbindgen_export_2(ptr, 72, 8);
                    busy = false;
                }
            };
        }})]));
}
