const fs=require('node:fs'),path=require('node:path');
process.chdir(path.resolve(__dirname,'..'));
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^(?:\s*\/\/[^\n]*\n)*\s*export default\s*/,''));
const buffs=read('src/assets/_gen_buff.js'),characters=read('src/assets/_gen_character.js'),targets=read('src/assets/_gen_tf.js');
const zh=read('src/i18n/generated/zh-cn.json'),en=read('src/i18n/generated/en.json');
function t(cn,english=cn){let i=zh.indexOf(cn);if(i<0){i=zh.length;zh.push(cn);en[i]=english;}return i;}
function describe(name,title,description){buffs[name].nameLocale=t(title);buffs[name].description=t(description);}
describe('QiqiTalent2StellarConduct','七七·七宝奉真（辉映·星烁）','寒病鬼差在场期间，对应辉映状态使队伍超导/星超导或冰扩散/星扩散伤害提升50%。此BUFF已接入星扩散；持续时间与在场条件由选择BUFF表示。');
describe('QiqiC6StellarConduct','七七六命·洞玄（直接星烁伤害）','施放Q后获得4层洞玄，持续12秒。除七七以外的前台角色通过天赋或技能造成直接星超导/星扩散伤害时，消耗1层，基础伤害增加来源七七最终攻击力的600%。填写七七最终攻击力。本项不增加反应星扩散·风/冰，不增加角色面板攻击力。');
describe('SandroneTalent1','桑多涅·星耀祝礼·唯理为光','桑多涅将超导/冰扩散转为星超导/星扩散；每100点来源桑多涅攻击力提升对应星烁反应基础伤害0.7%，至多14%。填写来源桑多涅最终攻击力。');
describe('SandroneC1','桑多涅一命·鎏金未凋，夕暮已远','解算模式期间，队伍所有角色造成的星烁反应伤害提升30%，包含星超导与星扩散。');
const sand=characters.Sandrone;
const entries=[['skillMap1',18,'重击冷凝射线·星扩散伤害'],['skillMap2',19,'棱晶弹·星扩散伤害'],['skillMap3',20,'聚能光束·星扩散伤害'],['skillMap2',21,'四命：棱晶谐振炮·星扩散伤害'],['skillMap3',22,'六命：集束射线·星扩散（单段）']];
for(const [map,index,label]of entries){sand[map]=sand[map].filter(row=>row.index!==index);sand[map].push({index,text:t(label)});}
sand.config.find(c=>c.name==='c1_team_stellar').title=t('一命：队伍星烁反应+30%（解算模式）');
sand.config.find(c=>c.name==='c6_elevate_active').title=t('六命：所有星烁伤害擢升20%');
// The coordinated Herald hit remains ordinary Cryo damage in the public kit.
characters.Qiqi.skillMap2.find(x=>x.index===16).text=t('寒病鬼差协同攻击伤害');
const name='SandroneStellarSwirl';
targets[name]={name,nameLocale:t('桑多涅·星扩散伤害'),description:t('按选定单次直接星扩散伤害的期望值配装。精确计入各天赋等级、命座、改进战术、原生武器/圣遗物与队友增益；不代表完整时间轴DPS。输入天赋为界面显示的最终等级，勿重复叠加三命/五命等级。'),tags:['输出','星扩散'],for:'Sandrone',badge:targets.SandroneDefault.badge,config:[
    {name:'mode',title:t('星扩散技能'),type:'option',default:0,options:['重击冷凝射线','棱晶弹','聚能光束','四命协同攻击','六命集束射线（单段）']},
    {name:'c2_ray_stacks',title:t('二命：冷凝射线暴伤层数'),type:'int',default:0,min:0,max:3},
    {name:'prism_overcharge',title:t('棱晶弹：解算功率>50（第二发400%）'),type:'bool',default:false},
    {name:'burst_tactics_stacks',title:t('改进战术层数'),type:'int',default:0,min:0,max:10},
]};
for(const [file,data]of [['src/assets/_gen_buff.js',buffs],['src/assets/_gen_character.js',characters],['src/assets/_gen_tf.js',targets]])fs.writeFileSync(file,'// Published metadata with verified Stellar Swirl support.\nexport default '+JSON.stringify(data,null,2)+'\n');
fs.writeFileSync('src/i18n/generated/zh-cn.json',JSON.stringify(zh,null,2)+'\n');fs.writeFileSync('src/i18n/generated/en.json',JSON.stringify(en,null,2)+'\n');
console.log('Verified Qiqi/Sandrone support and Sandrone skill/target metadata updated.');
