import {defineActionRecipes} from '../../beta-data/team-engine/action-recipes.mjs';
// Test-only onboarding package. This is one real native formula, not a full
// Kaeya adaptation and must not be added to the application's registration.
export const recipeCharacter={
 id:'Kaeya',element:'Cryo',panelIndex:0,nativeBackend:'legacy',
 nativeDamage:{0:{category:'normal',element:'Physical'}},
 constellationTalents:{3:'skill2',5:'skill3'},
 defaultWeapon:'DullBlade',previewWeapon:'DullBlade',
 capabilities:{energy:60,shield:false,nightsoul:false,arkhe:false},
 ...defineActionRecipes([{id:'normal.1',label:'接入测试·普通攻击',events:[{kind:'hit',index:0,category:'normal',parts:1,element:'Physical'}]}]),
 modeled:[],normalize:p=>{p.character.params='NoConfig';},create:()=>({}),
};
