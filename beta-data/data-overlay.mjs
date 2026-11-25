import {PATCHABLE_DATA} from '../server/patchable-data.mjs'
export {PATCHABLE_DATA}

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
