// Numeric equipment effects shared by manual interfaces and axis rules.
import {scalarMath} from './team-dps-numeric-rules.mjs';
export const symphonistAttack=refine=>.24+.08*refine;
export const thrillingTalesAttack=refine=>.18+.06*refine;
export const floatingDreamsMastery=refine=>38+2*refine;
export const evenstarAttack=(em,refine,recipientRatio=1,m=scalarMath)=>m.mul(m.mul(em,.18+.06*refine),recipientRatio);
export const xiphosRecharge=(em,refine,recipientRatio=1,m=scalarMath)=>m.mul(m.mul(em,.00027+.00009*refine),recipientRatio);
export const keyMastery=(hp,refine,m=scalarMath)=>m.mul(hp,.0015+.0005*refine);
export const peakPatrolBonus=(def,refine,m=scalarMath)=>m.min(m.mul(m.div(def,1000),.06+.02*refine),.192+.064*refine);
export const cinderBonusValues=(elements,first,second)=>Object.fromEntries([...new Set(elements)].map(element=>['Bonus'+element,.12*first+.28*second]));
