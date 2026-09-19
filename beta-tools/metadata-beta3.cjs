const fs = require('node:fs'), path = require('node:path');
process.chdir(path.resolve(__dirname, '..'));
if (path.basename(process.cwd()) !== 'beta3') throw Error('Run inside beta3');
const read = p => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^(?:\s*\/\/[^\n]*\n)*\s*export default\s*/, ''));
const write = (p, value, js = false) => fs.writeFileSync(p, (js ? '// beta3 weapon catalog\nexport default ' : '') + JSON.stringify(value, null, 2) + '\n');
const zh = read('src/i18n/generated/zh-cn.json'), en = read('src/i18n/generated/en.json');
function t(s) { let i = zh.indexOf(s); if (i < 0) { i = zh.length; zh.push(s); en[i] = s; } return i; }
const bool = (name, title, value) => ({name, title:t(title), type:'bool', default:value});
const rate = (name, title) => ({name, title:t(title), type:'float', min:0, max:100, default:0});
const weapons = read('src/assets/_gen_weapon.js');
weapons.BeyondTheChrysalis.id = 11522;
weapons.BeyondTheChrysalis.configs = [
    rate('loyal_rate', '忠忱之风：暴伤覆盖率（%）'),
    rate('rebel_rate', '叛弃之风：星扩散增伤覆盖率（%）'),
    rate('plenty_rate', '丰获之风：回能覆盖率（%，按4秒触发机会折算）'),
    bool('on_field', '装备者在场', true),
];
weapons.BeyondTheChrysalis.effect = t('E/Q依次触发：暴击伤害提高56%/72%/88%/104%/120%，持续10秒；星扩散伤害提高36%/45%/54%/63%/72%，持续10秒；回复5/5.5/6/6.5/7点元素能量，每4秒至多一次。退场清除并重置顺序。三项覆盖率独立设置；前两项折算平均属性，回能单独统计。');
weapons.HymnOfTheMaelstrom.configs = [
    {name:'hp', title:t('特效来源最终生命值（0＝使用装备者面板）'), type:'intInput', min:0, max:500000, default:0},
    {name:'stacks', title:t('告真的蜜酿层数'), type:'int', min:0, max:3, default:0},
    bool('boosted', '冻结/星扩散触发后5秒内（生命与加攻效果×1.75）', false),
    bool('on_field', '装备者在场（自身获得加攻；后台仍可叠生命）', true),
];
weapons.HymnOfTheMaelstrom.effect = t('治疗加成提高4%/5%/6%/7%/8%。治疗后每层生命上限提高4%/5%/6%/7%/8%；最终生命超过40000的部分，每1000点为己方前台角色提供0.4%/0.5%/0.6%/0.7%/0.8%攻击，每层上限8%/10%/12%/14%/16%。持续10秒，至多3层；冻结或星扩散触发后5秒内，生命与加攻效果额外提高75%。后台可触发。');
write('src/assets/_gen_weapon.js', weapons, true);
write('src/i18n/generated/zh-cn.json', zh); write('src/i18n/generated/en.json', en);
console.log('beta3 weapon metadata generated');
