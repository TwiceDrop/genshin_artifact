import {defineActionRecipes} from '../../beta-data/team-engine/action-recipes.mjs';
// Test-only onboarding package: real native indices plus deliberately synthetic
// schedules/effects. Not a calibrated Kaeya adaptation or production registration.
export const recipeCharacter={
 id:'Kaeya',element:'Cryo',panelIndex:0,nativeBackend:'legacy',
 nativeDamage:{0:{category:'normal',element:'Physical'},10:{category:'skill',element:'Cryo'},11:{category:'burst',element:'Cryo'}},
 constellationTalents:{3:'skill2',5:'skill3'},
 defaultWeapon:'DullBlade',previewWeapon:'DullBlade',
 capabilities:{energy:60,shield:false,nightsoul:false,arkhe:false},
 ...defineActionRecipes([
  {id:'normal.1',label:'接入测试·普通攻击',events:[{kind:'hit',index:0,category:'normal',parts:1,element:'Physical'}]},
  {id:'skill',label:'接入测试·技能与治疗',endOffsetMs:250,events:[{kind:'hit',index:10,category:'skill',parts:1,element:'Cryo',delay:.2},{kind:'heal',delay:.25,recipients:'team'}]},
  {id:'burst',label:'接入测试·周期攻击',events:[{kind:'hit',index:11,category:'burst',parts:1,element:'Cryo',repeat:{start:.5,interval:.5,duration:2}}]},
 ]),
 effects:()=>[
  {id:'test.onboard.fixed',label:'接入测试·固定攻击',stage:'base',target:'team',trigger:{kind:'cast',action:'skill'},duration:3,reads:{},value:()=>({ATKPercentage:.1})},
  {id:'test.onboard.conversion',label:'接入测试·生命转攻击',stage:'attack',target:'other',trigger:{kind:'heal'},duration:5,reads:{hp:{stat:'hp',stage:'base',timing:'live'}},value:({m,read})=>({ATKFixed:m.mul(.001,read('hp'))})},
  {id:'test.onboard.limited',label:'接入测试·次数池',stage:'damage',target:'team',trigger:{kind:'cast',action:'burst'},duration:3,uses:2,targetAggregation:'linearFlat',filter:{element:'Cryo'},reads:{atk:{stat:'atk',stage:'attack',timing:'live'}},value:({m,read})=>({ExtraDmgBase:m.mul(.2,read('atk'))})},
 ],
 modeled:[],normalize:p=>{p.character.params='NoConfig';},create:({math:m})=>({healingBase:(_event,panel)=>({amount:m.mul(Object.values(panel.atk).reduce((n,v)=>m.add(n,v),0),.4),outgoing:Object.values(panel.healing_bonus).reduce((n,v)=>m.add(n,v),0)})}),
};
