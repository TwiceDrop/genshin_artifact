// 旧便携版更新脚本会复制 server/。服务端和前端共用这份清单。
// 键与 composeKernelApi 的 data 参数一致；值是安装包里的原文件，补丁里同名的数据整份替换它。
// 只放纯数据，规则代码和 wasm 内核不在这里（见 docs/specs/content-patch/spec.md）。
export const PATCHABLE_DATA = Object.freeze({
    weapons: 'beta-data/weapons-release-71.json',
    signatureWeapons: 'beta-data/weapons-signature-release-71.json',
    vodyanitsa: 'beta-data/vodyanitsa.json',
    support: 'beta-data/extension-support.json',
    characters: 'src/assets/_gen_character.js',
})
