// 内容补丁能替换的数据，以及把补丁数据盖到安装包原数据上的唯一入口。
// 键与 composeKernelApi 的 data 参数一致；值是安装包里的原文件，补丁里同名的数据整份替换它。
// 只放纯数据，规则代码和 wasm 内核不在这里（见 docs/specs/content-patch/spec.md）。
export const PATCHABLE_DATA = Object.freeze({
    weapons: 'beta-data/weapons-release-71.json',
    signatureWeapons: 'beta-data/weapons-signature-release-71.json',
    vodyanitsa: 'beta-data/vodyanitsa.json',
    support: 'beta-data/extension-support.json',
    characters: 'src/assets/_gen_character.js',
})

const invalid = reason => Object.assign(new Error('内容补丁数据无效：' + reason), {code: 'DATA_OVERLAY_INVALID', stage: 'overlay'})

// overlay 为空时原样返回 data，计算结果与没有补丁完全一致。
export function applyDataOverlay(data, overlay) {
    if (overlay === null || overlay === undefined) return data
    if (typeof overlay !== 'object' || Array.isArray(overlay)) throw invalid('覆盖数据必须是对象')
    for (const [key, value] of Object.entries(overlay)) {
        if (!Object.hasOwn(PATCHABLE_DATA, key)) throw invalid('不可替换的数据 ' + key)
        if (value === null || typeof value !== 'object') throw invalid(key + ' 必须是对象或数组')
    }
    return {...data, ...overlay}
}
