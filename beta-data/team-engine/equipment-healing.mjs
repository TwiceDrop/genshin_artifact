import {numericSum} from './rule-utils.mjs';
export const equipmentObservesCritical=(profile,event)=>profile.weapon.name==='TheBlackSword'&&event.onField&&['normal','charged'].includes(event.category);
export function equipmentHealingBase(h,panel,profile,m){
 const sum=numericSum(m),outgoing=sum(panel.healing_bonus);
 if(['prototype_amber','traveling_doctor'].includes(h.healing))return {amount:0,outgoing};
 if(['black_sword','isshin'].includes(h.healing))return {amount:m.mul(sum(panel.atk),h.healing==='isshin'?1:.5+.1*profile.weapon.refine),outgoing};
}
export function equipmentRecipientHealing(h,value,panel,profile,m){
 const sum=numericSum(m);
 if(h.healing==='prototype_amber')return m.mul(sum(panel.hp),.035+.005*profile.weapon.refine);
 if(h.healing==='traveling_doctor')return m.mul(sum(panel.hp),.2);
 return value;
}
