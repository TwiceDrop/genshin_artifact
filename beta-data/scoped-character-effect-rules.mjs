// Context-sensitive rules shared by the existing single-hit/optimizer facades.
// Output namespace is explicit: support-state versus native attributes.
import {R,E,P,I,op,mul,min,max,sub,eq,and,not,at,includes} from './rule-dsl.mjs';
const other=name=>not(eq(I('character.name'),name));
const damage=I('damage_scope'),relevant=includes(['Hydro','Cryo'],I('effect_element'));
const ordinary=not(eq(P('ordinary_mode'),false)),on=not(eq(P('on_field'),false));
export const STELLAR_SUPPORT_RULES={
 VodyanitsaA4:R([E('flat',min(mul(max(sub(P('hp'),40000),0),.26),6500))],{when:not(ordinary)}),
 VodyanitsaC2:R([E('crit_damage',.6)],{when:and(not(ordinary),op('gte',P('constellation'),2),op('or',on,op('gte',P('constellation'),6)))}),
 VodyanitsaC6:R([E('elevation',.25)],{when:op('gte',P('constellation'),6)}),
 QiqiTalent2StellarConduct:R([E('bonus',.5)]),
 QiqiC6StellarConduct:R([E('flat',mul(P('atk'),6))],{when:other('Qiqi')}),
 SandroneC1:R([E('bonus',.3)]),
 SandroneTalent1:R([E('base',min(mul(P('atk'),.00007),.14))]),
 VesnaTalent1:R([E('base',mul(min(mul(P('atk'),.00007),.14),P('coverage',1)))],{when:other('Vesna')}),
};
export const VODYANITSA_SUPPORT_RULES={
 VodyanitsaA1:R([E('ResMinusBase',.35)],{when:and(damage,eq(I('effect_element'),'Anemo'))}),
 VodyanitsaE:R([E('ResMinusBase',at([0.165, 0.18, 0.195, 0.21, 0.225, 0.24, 0.255, 0.27, 0.285, 0.3, 0.318, 0.336, 0.354, 0.372, 0.39],sub(P('e_level'),1)))],{when:and(damage,relevant)}),
 VodyanitsaA4:R([E('ExtraDmgBase',min(mul(max(sub(P('hp'),40000),0),.14),3500))],{when:and(damage,relevant,ordinary,on)}),
 VodyanitsaC1:R([E('ATKFixed',mul(P('hp'),.008))],{when:op('gte',P('constellation'),1)}),
 VodyanitsaC2:R([E('CriticalDamageBase',.5),E('StellarSwirlCritDamage',-.5,and(I('legacy_effect_graph'),eq(I('effect_element'),I('recipient_element')))),E('StellarConductCritDamage',-.5,and(I('legacy_effect_graph'),eq(I('effect_element'),I('recipient_element'))))],{when:and(op('gte',P('constellation'),2),op('or',on,op('gte',P('constellation'),6)),relevant,ordinary,damage)}),
 VodyanitsaC6:R([E('BonusHydro',.6),E('BonusCryo',.6)],{when:op('gte',P('constellation'),6)}),
};
