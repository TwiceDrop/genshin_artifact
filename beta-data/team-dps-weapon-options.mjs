// Calculation inputs belong to the TeamDPS task, leaving saved presets intact.
const rate=(key,label)=>({key,label,min:0,max:100,initial:0,scale:100});
const stacks={key:'stack',label:'平均层数',min:0,max:3,initial:0,scale:1};
export const MANUAL_WEAPON_OPTIONS={
 HereticsMoltenBlade:[rate('movement_rate','移动加攻覆盖率（满额为100%）')],
 WavebreakersFin:[rate('rate','爆发增伤强度（满额为100%）')],
 MouunsMoon:[rate('rate','爆发增伤强度（满额为100%）')],Akuoumaru:[rate('rate','爆发增伤强度（满额为100%）')],
 AmosBow:[{key:'stack',label:'箭矢飞行增伤层数',min:0,max:5,initial:0,scale:1}],
 Slingshot:[rate('close_rate','0.3秒内命中覆盖率 %')],
 TalkingStick:[rate('rate1','火附着加攻覆盖率 %'),rate('rate2','水冰雷草附着增伤覆盖率 %')],
 UltimateOverlordsMegaMagicSword:[rate('rate','美露莘任务完成比例 %')],
 Deathmatch:[rate('ge2_rate','附近至少两名敌人覆盖率 %')],
 BlackcliffLongsword:[stacks],BlackcliffPole:[stacks],BlackcliffAgate:[stacks],
 TwinNephrite:[rate('rate','击杀增益覆盖率 %')],ToukabouShigure:[rate('rate','纸伞作祟覆盖率 %')],
};
export function defaultWeaponOptions(){return Object.fromEntries(Object.entries(MANUAL_WEAPON_OPTIONS).map(([n,rows])=>[n,Object.fromEntries(rows.map(f=>[f.key,f.initial/f.scale]))]));}
export const WIDSITH_THEMES=[['average','随机期望'],['t1_rate','宣叙调'],['t2_rate','咏叹调'],['t3_rate','间奏曲']];
export function widsithTriggers(rotation,role){
 let ready=-Infinity;
 return rotation.switches.filter(s=>{if(s.role!==role||s.from===role||s.time<ready)return false;ready=s.time+30;return true;});
}
