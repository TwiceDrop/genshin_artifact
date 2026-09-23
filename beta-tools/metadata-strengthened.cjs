const fs=require('node:fs'),path=require('node:path');
process.chdir(path.resolve(__dirname,'..'));
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^(?:\s*\/\/[^\n]*\n)*\s*export default\s*/,''));
const zh=read('src/i18n/generated/zh-cn.json'),en=read('src/i18n/generated/en.json'),targets=read('src/assets/_gen_tf.js');
function t(cn,english){let i=zh.indexOf(cn);if(i<0){i=zh.length;zh.push(cn);en[i]=english||cn;}return i;}
const name='YumemizukiMizukiStellarSwirl',old=targets.YumemizukiMizukiDefault;
const target={name,nameLocale:t('梦见月瑞希·星扩散伤害','Yumemizuki Mizuki: Stellar Swirl damage'),description:t('按所选星扩散伤害的期望值配装，计入精通、暴击、暴伤、抗性及星伤增益。选择对应的辉映强化状态；一命直伤需解锁一命。按单次伤害计算，不代表完整时间轴DPS。','Optimize expected Stellar Swirl damage, including EM, critical stats, resistance and Stellar bonuses. Select the matching enhanced state; C1 damage requires C1. This is one damage event, not rotation DPS.'),tags:['输出','星扩散'],for:'YumemizukiMizuki',badge:old.badge,config:[{name:'mode',title:t('星扩散目标','Stellar Swirl target'),type:'option',default:0,options:['廓然梦生·直接星扩散','一命·直接星扩散','反应星扩散·风','反应星扩散·冰']}]};
const ordered={};
for(const [key,value]of Object.entries(targets)){if(key===name)continue;if(key==='YumemizukiMizukiDefault')ordered[name]=target;ordered[key]=value;}
ordered.YumemizukiMizukiDefault.description=t('仅最大化元素精通，适合纯精通辅助；星扩散输出请选「梦见月瑞希·星扩散伤害」。','Maximize EM only for EM support. For Stellar Swirl damage, use the dedicated Stellar Swirl target.');
fs.writeFileSync('src/assets/_gen_tf.js','// Character targets: published catalog with strengthened character additions.\nexport default '+JSON.stringify(ordered,null,2)+'\n');
fs.writeFileSync('src/i18n/generated/zh-cn.json',JSON.stringify(zh,null,2)+'\n');fs.writeFileSync('src/i18n/generated/en.json',JSON.stringify(en,null,2)+'\n');
console.log('Mizuki Stellar Swirl damage target added.');
