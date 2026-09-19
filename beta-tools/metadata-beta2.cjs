const fs=require('fs'),path=require('path');process.chdir(path.resolve(__dirname,'..'));if(path.basename(process.cwd())!=='beta2')throw Error('beta2 only');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^(?:\s*\/\/[^\n]*\n)*\s*export default\s*/,''));
const put=(p,v,js=false)=>fs.writeFileSync(p,(js?'// beta2 preview catalog\nexport default ':'')+JSON.stringify(v,null,2));
const zh=read('src/i18n/generated/zh-cn.json'),en=read('src/i18n/generated/en.json');const t=s=>{let i=zh.indexOf(s);if(i<0){i=zh.length;zh.push(s);en[i]=s}return i};
const bool=(name,title,value=false)=>({name,title:t(title),type:'bool',default:value}),int=(name,title,min,max,value=min)=>({name,title:t(title),type:'int',min,max,default:value});
const chars=read('src/assets/_gen_character.js'),weapons=read('src/assets/_gen_weapon.js'),targets=read('src/assets/_gen_tf.js'),buffs=read('src/assets/_gen_buff.js'),ownership=read('src/algorithms/buff-groups/ownership.json');
const image='/beta/vesna.webp';
chars.Vesna={name:'Vesna',nameLocale:t('薇斯纳'),element:'Anemo',weapon:'Sword',star:5,avatar:image,splash:image,skillName1:t('巡风剑舞'),skillName2:t('操典·制胜有道'),skillName3:t('致礼·献予女皇陛下'),
skillMap1:['一段伤害','二段伤害','三段伤害（两次合计）','四段伤害','五段伤害','六段伤害','重击伤害','下落途中伤害','低空落地伤害','高空落地伤害'].map((s,index)=>({index,text:t(s)})),
skillMap2:['E 初始伤害','翔风剑一阶本体','翔风剑二阶本体','二阶灵剑（随辉映转换）','三阶灵剑（单次，共四次）','三阶灵剑最终段','风翎伤害','六命变移本体（标签待实测）','六命变移灵剑'].map((s,i)=>({index:i<7?i+10:i+11,text:t(s)})),skillMap3:[{index:17,text:t('Q 灵剑（随辉映转换）')}],
config:[bool('stance','巡风列装',true),bool('radiance','辉映·星扩散（需已触发冰扩散）'),int('disciplinary_stacks','整肃层数（二命列装自动满层）',0,6),int('anemo_cryo_count','队伍冰/风人数（包含薇斯纳）',1,4,1),int('other_count','队伍其他元素人数',0,3,1),bool('flat_inside_discipline','定额加值也乘整肃（替代模型，待实测）')],configSkill:[]};
weapons.BeyondTheChrysalis={name:'BeyondTheChrysalis',internalName:'Sword_BeyondTheChrysalis',nameLocale:t('蝶变'),star:5,type:'Sword',url:'/beta/chrysalis.webp',effect:t('测试服 7.0.54 D48100502。E/Q每次施放依次触发：暴伤+56%/72%/88%/104%/120%（10秒）；星扩散伤害+36%/45%/54%/63%/72%（10秒）；回能5/5.5/6/6.5/7点（4秒冷却）。退场清除效果并重置顺序。下方开关代表命中时有效状态，前两种效果可在持续期内共存。'),configs:[bool('loyal_wind','忠忱之风：暴伤已生效'),bool('rebel_wind','叛弃之风：星扩散增伤已生效'),bool('on_field','装备者在场',true)]};
targets.VesnaDefault={name:'VesnaDefault',nameLocale:t('薇斯纳-灵剑·爆发（测试服）'),description:t('最大化单次Q灵剑期望伤害，按角色的辉映状态切换普通风伤/直接星扩散；读取整肃、命座、队友BUFF。不是整轮DPS。乘区模型可在角色配置切换。'),tags:[],for:'Vesna',badge:image,config:[]};
// Her non-shareable passives are applied by character state, avoiding duplicate buffs.
const template=structuredClone(buffs.VodyanitsaA4);template.name='VodyanitsaA1';template.nameLocale=t('沃雅妮莎-「最后的塑诗者」');template.description=t('仅在创造/引爆流荡风旋后的6秒内启用：降低敌人风抗35%。遥久之歌期间可延长新获得的辉映4秒。需要来源角色已突破一次；持续时间请按战斗状态确认。');buffs.VodyanitsaA1=template;ownership.VodyanitsaA1={character:'Vodyanitsa',minConstellation:0};
for(const [p,v]of [['src/assets/_gen_character.js',chars],['src/assets/_gen_weapon.js',weapons],['src/assets/_gen_tf.js',targets],['src/assets/_gen_buff.js',buffs]])put(p,v,true);
put('src/algorithms/buff-groups/ownership.json',ownership);put('src/i18n/generated/zh-cn.json',zh);put('src/i18n/generated/en.json',en);
const support=read('beta-data/extension-support.json');for(const [k,names]of Object.entries({characters:['Vesna'],weapons:['BeyondTheChrysalis'],artifacts:['ScarletProof','HeartOfTheFurnace'],buffs:['VesnaSupport']}))support[k]=[...new Set([...support[k],...names])];put('beta-data/extension-support.json',support);
let index=fs.readFileSync('mona_wasm/pkg/index.js','utf8');index=index.replace("import { createFacade }", "import { createBeta2 } from '../../beta-data/vesna-facade.mjs';\nimport { createFacade }");index=index.replace('const api = createFacade','const baseApi = createFacade').replace('export const {BonusPerStat','const api = createBeta2(baseApi,extension,support);\nexport const {BonusPerStat');fs.writeFileSync('mona_wasm/pkg/index.js',index);
let ui=fs.readFileSync('src/pages/NewArtifactPlanPage/NewArtifactPlanPage.vue','utf8');ui=ui.replace('        <nav class="calc-mobile-tabs"',`        <el-alert v-if="characterName === 'Vesna'" type="warning" :closable="false" show-icon style="margin-bottom:16px"
            title="薇斯纳 · beta2 · 测试服 7.0.54 / D48100502"
            description="已接入角色、蝶变、普通/星扩散伤害、单人配装和词条曲线。辉映需先触发冰扩散；二命列装自动满层整肃。定额与整肃乘区可切换，仍待实测；天赋填游戏显示等级。自身被动由下方角色配置控制。新角色配装仅使用扩展已支持的套装，未支持套装不纳入候选。" />
        <nav class="calc-mobile-tabs"`);fs.writeFileSync('src/pages/NewArtifactPlanPage/NewArtifactPlanPage.vue',ui);
let dmg=fs.readFileSync('src/pages/NewArtifactPlanPage/DamagePanel.vue','utf8').replace('push("normal", this.normalDamageTitle)','if (!this.analysisFromWasm.beta2_model) push("normal", this.normalDamageTitle)');fs.writeFileSync('src/pages/NewArtifactPlanPage/DamagePanel.vue',dmg);
console.log('beta2 metadata written');
