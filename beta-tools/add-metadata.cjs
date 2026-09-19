const fs=require('fs'),path=require('path');const root=path.resolve(__dirname,'..');process.chdir(root);
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^(?:\s*\/\/[^\n]*\n)*\s*export default\s*/,'').replace(/;\s*$/,''));
const write=(p,v,js=false)=>fs.writeFileSync(p,(js?'// Mona v5.33.58 catalog with beta1 Vodyanitsa extension.\nexport default ':'')+JSON.stringify(v,null,2)+'\n');
const zh=read('src/i18n/generated/zh-cn.json'),en=read('src/i18n/generated/en.json');
function t(s){const i=zh.indexOf(s);if(i>=0)return i;const index=zh.length;zh.push(s);en[index]=s;return index;}
const bool=(name,title,value=false)=>({name,title:t(title),type:'bool',default:value});
const int=(name,title,min,max,value=min)=>({name,title:t(title),type:'int',min,max,default:value});
const float=(name,title,value)=>({name,title:t(title),type:'floatInput',default:value});
const image='/beta/vodyanitsa.svg';fs.mkdirSync('public/beta',{recursive:true});
fs.writeFileSync('public/beta/vodyanitsa.svg','<svg xmlns="http://www.w3.org/2000/svg" width="320" height="400" viewBox="0 0 320 400"><defs><linearGradient id="b" x2="1" y2="1"><stop stop-color="#162d57"/><stop offset="1" stop-color="#468eb8"/></linearGradient></defs><rect width="320" height="400" rx="32" fill="url(#b)"/><path d="M160 60C130 120 95 152 95 194a65 65 0 00130 0c0-42-35-74-65-134" fill="#a9eaff" opacity=".7"/><text x="160" y="315" fill="white" text-anchor="middle" font-size="32" font-family="sans-serif">沃雅妮莎</text><text x="160" y="356" fill="#c5ecff" text-anchor="middle" font-size="20">beta1 · 测试服</text></svg>');
const chars=read('src/assets/_gen_character.js');chars.Vodyanitsa={name:'Vodyanitsa',nameLocale:t('沃雅妮莎'),element:'Hydro',weapon:'Catalyst',star:5,avatar:image,splash:image,
 skillName1:t('普通攻击·水色咏叹'),skillName2:t('宣叙·晨声纷流'),skillName3:t('终奏·伴尔沉沦'),
 skillMap1:['一段伤害','二段伤害','三段伤害','四段伤害','重击伤害','下落期间伤害','低空坠地冲击伤害','高空坠地冲击伤害'].map((s,index)=>({index,text:t(s)})),
 skillMap2:['施放伤害','角笛伤害','单次治疗'].map((s,index)=>({index:index+8,text:t(s)})),skillMap3:[{index:11,text:t('元素爆发伤害')}],
 config:[bool('e_active','E 减抗已触发'),bool('song_active','本次命中可消耗领唱 / 和声'),bool('ordinary_mode','普通水 / 冰模式（关闭为星扩散模式）',true),bool('c1_active','C1 治疗加攻已触发'),bool('c2_active','C2 号角暴伤已触发'),int('c4_stacks','C4 生命层数',0,3),bool('on_field','当前在场',true)],
 configSkill:[bool('low_hp_heal','C4 本次治疗前目标生命低于 40%'),bool('q_song_bonus','应用歌声状态 Q 增伤（乘区待校准）')]};
const weapons=read('src/assets/_gen_weapon.js');weapons.HymnOfTheMaelstrom={name:'HymnOfTheMaelstrom',internalName:'Catalyst_HymnOfTheMaelstrom',nameLocale:t('漩流颂歌'),star:5,type:'Catalyst',url:image,
 effect:t('测试服 v7.0.54 D48100502：治疗加成提高4%/5%/6%/7%/8%。治疗后叠加生命加成，至多3层。依据超过40000的生命上限为当前场上角色提供攻击加成；冻结或星扩散后，生命与攻击加成提高75%。治疗加成不放大。'),
 configs:[int('stacks','治疗触发层数',0,3),bool('boosted','冻结 / 星扩散强化已触发'),bool('on_field','装备者在场（专武加攻仅场上目标）',true)]};
const targets=read('src/assets/_gen_tf.js');targets.VodyanitsaDefault={name:'VodyanitsaDefault',nameLocale:t('沃雅妮莎-终奏（测试服）'),description:t('最大化单次元素爆发伤害；不包含未校准的歌声乘区。辅助配装可选通用最大生命目标。'),tags:[],for:'Vodyanitsa',badge:image,config:[]};
const buffs=read('src/assets/_gen_buff.js'),ownership=read('src/algorithms/buff-groups/ownership.json');
const common=[float('hp','来源沃雅妮莎最终生命上限（含 C4 / 武器）',60000),int('constellation','命座',0,6),int('e_level','E 显示等级（含命座）',1,15,10),bool('on_field','目标角色在场',true),bool('ordinary_mode','普通水 / 冰模式',true)];
const defs=[['E','宣叙·晨声纷流',0,'E 命中后降低水抗与冰抗，按 E 等级计算。'],['A4','十二弦的泪歌',0,'本次命中尚有领唱 / 和声次数时，普通模式提高水 / 冰基础伤害，星扩散模式只提高星扩散基础伤害。来源需已解锁突破四。'],['C1','聚光灯下的水华',1,'治疗触发后，固定攻击力提高来源角色生命上限的0.8%。'],['C2','穿彻风雪的余响',2,'角笛触发后，普通模式目标水 / 冰暴伤提高50%，星扩散模式星扩散暴伤提高60%。六命前仅场上目标。'],['C6','永不落幕的盛歌',6,'歌声期间提高水 / 冰伤害60%，星扩散伤害擢升25%。'],['Signature','漩流颂歌',0,'当前场上目标获得专武加攻。来源生命填最终值，避免重复添加生命加成。']];
for(const [id,label,min,description] of defs){const name='Vodyanitsa'+id;buffs[name]={name,nameLocale:t('沃雅妮莎-「'+label+'」'),description:t(description),genre:'Character',badge:image,config:common.map(x=>({...x}))};if(id==='Signature')buffs[name].config.push(int('refine','专武精炼',1,5,1),int('stacks','专武层数',0,3,3),bool('boosted','冻结 / 星扩散强化',true));ownership[name]={character:'Vodyanitsa',minConstellation:min};}
for(const [p,v]of [['src/assets/_gen_character.js',chars],['src/assets/_gen_weapon.js',weapons],['src/assets/_gen_tf.js',targets],['src/assets/_gen_buff.js',buffs]])write(p,v,true);
write('src/algorithms/buff-groups/ownership.json',ownership);write('src/i18n/generated/zh-cn.json',zh);write('src/i18n/generated/en.json',en);
// Capture exactly which enums the extension can read; never silently strip unknown effects.
const variants=(file,enumName)=>fs.readFileSync(file,'utf8').split('pub enum '+enumName+' {')[1].split('\n}')[0].split('\n').map(s=>s.trim().match(/^([A-Z]\w*)\s*[,\{]/)?.[1]).filter(Boolean);
write('beta-data/extension-support.json',{characters:variants('mona_core/src/character/character_name.rs','CharacterName'),weapons:variants('mona_core/src/weapon/weapon_name.rs','WeaponName'),artifacts:variants('mona_core/src/artifacts/artifact.rs','ArtifactSetName'),buffs:variants('mona_core/src/buffs/buff_name.rs','BuffName')});
fs.writeFileSync('.env.development.yaml',fs.readFileSync('.env.development.yaml','utf8').replace('MONA_TITLE: 莫娜占卜铺','MONA_TITLE: 莫娜占卜铺 beta1'));
for(const file of ['script/start-local.mjs','server/local.mjs'])fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace(/MONA_PORT \|\| 4174/g,'MONA_PORT || 4178'));
fs.writeFileSync('启动beta1.bat',fs.readFileSync('启动莫娜.bat','utf8').replace('title 莫娜占卜铺','title 莫娜占卜铺 beta1').replace('setlocal','setlocal\r\nset MONA_PORT=4178'));
