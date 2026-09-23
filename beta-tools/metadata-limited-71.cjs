// Rebuild only the 7.1 four-star weapon catalog and localized descriptions.
const fs = require('node:fs');
const path = require('node:path');
process.chdir(path.resolve(__dirname, '..'));
const read = p => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^(?:\s*\/\/[^\n]*\n)*\s*export default\s*/, ''));
const write = (p, value, js = false) => fs.writeFileSync(p, (js ? '// Weapon metadata: published catalog with 7.1 beta additions.\nexport default ' : '') + JSON.stringify(value, null, 2) + '\n');
const source = read('beta-data/weapons-release-71.json');
const weapons = read('src/assets/_gen_weapon.js');
const buffs = read('src/assets/_gen_buff.js');
const zh = read('src/i18n/generated/zh-cn.json'), en = read('src/i18n/generated/en.json');
function t(cn, english = cn) {
    let index = zh.indexOf(cn);
    if (index < 0) { index = zh.length; zh.push(cn); en[index] = english; }
    return index;
}
const escape = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function mergedDescription(details, field) {
    const all = details.map(row => row[field]);
    if (all.some(text => typeof text !== 'string')) throw Error('Missing refinement descriptions: ' + field);
    const marked = all.map(text => [...text.matchAll(/<color=[^>]*>(.*?)<\/color>/g)].map(match => match[1]));
    if (marked.some(values => values.length !== marked[0].length)) throw Error('Refinement description structure differs');
    let index = 0, last = 0, result = '';
    for (const match of all[0].matchAll(/<color=[^>]*>(.*?)<\/color>/g)) {
        result += escape(all[0].slice(last, match.index));
        result += '<span style="color: #409EFF;">' + [...new Set(marked.map(values => values[index]))].map(escape).join('/') + '</span>';
        index++;
        last = match.index + match[0].length;
    }
    return (result + escape(all[0].slice(last))).replace(/\\n/g, '<br>').replace(/\n/g, '<br>');
}
const bool = (name, cn, english, value = false) => ({name, title:t(cn, english), type:'bool', default:value});
const count = (name, cn, english, max, value = 0) => ({name, title:t(cn, english), type:'int', min:0, max, default:value});
const rate = (name, cn, english, value) => ({name, title:t(cn, english), type:'float', min:0, max:1, default:value});
for (const row of source.weapons) {
    const current = weapons[row.name] || {};
    weapons[row.name] = {
        ...current,
        name:row.name,
        internalName:current.internalName || ({Sword:'Sword',Catalyst:'Catalyst',Bow:'Bow',Claymore:'Claymore',Polearm:'Pole'}[row.weaponType] + '_' + row.name),
        nameLocale:current.nameLocale ?? t(row.displayName, row.englishName),
        id:row.id,
        star:row.rarity,
        type:row.weaponType,
        url:current.url || row.imageUrl,
        effect:t(mergedDescription(row.refinementDetails, 'description'), mergedDescription(row.refinementDetails, 'descriptionEnglish')),
    };
}
weapons.NewBough.configs = [
    count('stacks', '蓊郁层数（最多3层）', 'Verdant stacks (up to 3)', 3),
    bool('radiance', '辉映·星烁（替换普通效果，不保留普通精通）', 'Radiance: Stellar Glimmer (replaces the normal effect)'),
    rate('rate', '蓊郁覆盖率（0～1，1＝100%）', 'Verdant uptime (0–1; 1 = 100%)', 1),
];
weapons.WintersHeavyHeart.configs = [
    count('cryo_count', '队伍冰元素角色数（含装备者，冰雷合计至多4人）', 'Cryo party members (including equipper; Cryo + Electro ≤ 4)', 4),
    count('electro_count', '队伍雷元素角色数（含装备者，冰雷合计至多4人）', 'Electro party members (including equipper; Cryo + Electro ≤ 4)', 4),
    bool('radiance', '辉映·星烁（改为每位冰/雷角色提供精通与星伤）', 'Radiance: Stellar Glimmer (EM and Stellar damage per Cryo/Electro member)'),
];
weapons.BreezeborneRefrain.configs = [
    rate('rate', '蛇信的死毒覆盖率（0～1，1＝100%）', 'Thus Lied the Viper uptime (0–1; 1 = 100%)', 0),
];
weapons.JadeVista.configs = [
    count('same_count', '其他同元素队员数（优先生效，合计最多3层）', 'Other same-element members (priority; 3 total stacks)', 3, 2),
    count('diff_count', '其他异元素队员数（与同元素合计最多3层）', 'Other different-element members (3 total stacks)', 3, 1),
];
weapons.HereticsMoltenBlade.configs = [
    rate('movement_rate', '生效时加成强度（0＝关闭，0.5＝最低加成，1＝最高加成）', 'Active ATK strength (0 = off; 0.5 = minimum; 1 = maximum)', 1),
];
weapons.ForgedByTheGoldenMelody.configs = [
    ...weapons.ForgedByTheGoldenMelody.configs.filter(config => config.name !== 'counterpoint_state'),
    {name:'counterpoint_state', title:t('仍在持续的复调乐章（保留触发时类型）', 'Active counterpoint (keeps its type when triggered)'), type:'option', default:0, options:['跟随当前乐章','攻击力复调','元素精通复调','星烁反应复调']},
];
// Keep uptime separate from effect strength and from direct-energy trigger use.
const uptime = (name, cn, english) => rate(name, cn + '（0～1，1＝100%）', english + ' (0–1; 1 = 100%)', 1);
function appendRates(name, configs) {
    weapons[name].configs = [...(weapons[name].configs || []).filter(old => !configs.some(item => item.name === old.name)), ...configs];
}
for (const name of ['WintersHeavyHeart','JadeVista']) appendRates(name, [uptime('rate', '所选队伍状态覆盖率', 'Selected party-state uptime')]);
for (const name of ['HereticsMoltenBlade','ClashOfKings','CovenantOfFrostAndSnow']) appendRates(name, [uptime('rate', '特效覆盖率', 'Effect uptime')]);
for (const name of ['Emberwell','BladeOfAtonement','EchoesOfTheHeart']) appendRates(name, [
    uptime('reaction_rate', '元素反应触发效果覆盖率', 'Elemental-reaction effect uptime'),
    uptime('stellar_rate', '星烁反应触发效果覆盖率', 'Stellar-reaction effect uptime'),
]);
appendRates('ForgedByTheGoldenMelody', [
    uptime('rate', '当前普通乐章覆盖率', 'Current movement uptime'),
    uptime('counterpoint_rate', '复调乐章覆盖率', 'Counterpoint uptime'),
]);
for (const name of ['Frostbreath','SongOfTheVigil']) appendRates(name, [
    uptime('rate', '攻击加成覆盖率', 'ATK-bonus uptime'),
    uptime('energy_rate', '直接回能触发机会利用率', 'Direct-energy trigger utilization'),
]);
buffs.BreezeborneRefrainSupport = {
    name:'BreezeborneRefrainSupport',
    nameLocale:t('柔风游弦·蛇信的死毒', 'Breezeborne Refrain: Thus Lied the Viper'),
    description:t('队友柔风游弦触发「蛇信的死毒」后，星超导与星扩散伤害提升24%/30%/36%/42%/48%，持续12秒，按覆盖率折算。同名效果不叠加；自己已装备柔风游弦时，不再重复加入这项队友BUFF。武器的充能加成只属于装备者，不会传给队友。', 'After a teammate triggers Thus Lied the Viper, Stellar Conduct and Stellar Swirl damage increases by 24%/30%/36%/42%/48% for 12s, weighted by uptime. Identical effects do not stack. Do not add this teammate buff again when the character already equips Breezeborne Refrain. The weapon’s Energy Recharge bonus belongs only to its wielder.'),
    badge:weapons.BreezeborneRefrain.url,
    genre:'Weapon',
    config:[
        {name:'refine', title:t('精炼等级', 'Refinement rank'), type:'intInput', min:1, max:5, default:1},
        rate('rate', '蛇信的死毒覆盖率（0～1，1＝100%）', 'Thus Lied the Viper uptime (0–1; 1 = 100%)', 1),
    ],
};
write('src/assets/_gen_weapon.js', weapons, true);
write('src/assets/_gen_buff.js', buffs, true);
write('src/i18n/generated/zh-cn.json', zh);
write('src/i18n/generated/en.json', en);
console.log('7.1 metadata updated: ' + source.weapons.length + ' weapons and Breezeborne Refrain support buff.');
