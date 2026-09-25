import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateStellarSwirlIndividual,calculateStellarSwirlTeam,
    vodyanitsaStellarExtra} from '../beta-data/stellar-swirl-reaction.mjs';
import {createFacade} from '../beta-data/facade.mjs';

// Formula provenance: KQM original 7.0 research
// https://keqingmains.com/misc/stellar-reaction-guide/
// and the 2026-09-23 worked formulas/A4 values
// https://www.taptap.cn/moment/851912127529616541 .
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<=1e-6,
    `${actual} != ${expected}`);
const damage=value=>({non_critical:value,critical:value,expectation:value,is_heal:false,is_shield:false});

test('沃雅妮莎 A4 生命门槛、6500 上限与平均覆盖率',()=>{
    close(vodyanitsaStellarExtra(40000),0);
    close(vodyanitsaStellarExtra(50000),2600);
    close(vodyanitsaStellarExtra(65000),6500);
    close(vodyanitsaStellarExtra(80000),6500);
    close(vodyanitsaStellarExtra(80000,true,.4),2600);
    close(vodyanitsaStellarExtra(80000,false),0);
});

test('个人星扩反应先算基础，再加定额，最后乘抗性暴击擢升',()=>{
    const result=calculateStellarSwirlIndividual({levelMultiplier:1446.85,
        reactionMultiplier:.75,elementalMastery:500,baseIncrease:.1,
        reactionBonus:.3,extraIncrease:6500,resistanceMultiplier:.9,
        criticalRate:.5,criticalDamage:1,elevation:.25});
    const raw=1446.85*.75*1.1*(1+6*500/2500+.3)+6500;
    close(result.non_critical,raw*.9*1.25);
    close(result.critical,raw*.9*1.25*2);
    close(result.expectation,raw*.9*1.25*1.5);
    const noEm=calculateStellarSwirlIndividual({levelMultiplier:1446.85,
        reactionMultiplier:.75,extraIncrease:6500,resistanceMultiplier:1});
    close(noEm.non_critical,1446.85*.75+6500);
});

const participants=()=>[
    {id:'wind',element:'Anemo',levelMultiplier:1446.85,elementalMastery:0,
        anemoResistanceMultiplier:1,cryoResistanceMultiplier:1},
    {id:'ice1',element:'Cryo',levelMultiplier:1446.85,elementalMastery:500,
        anemoResistanceMultiplier:1,cryoResistanceMultiplier:1},
    {id:'ice2',element:'Cryo',levelMultiplier:1446.85,reactionBonus:.5,
        anemoResistanceMultiplier:1,cryoResistanceMultiplier:1},
    {id:'wind2',element:'Anemo',levelMultiplier:1446.85,
        anemoResistanceMultiplier:1,cryoResistanceMultiplier:1},
];

test('星扩·风和星扩·冰各自先算个人贡献，再按 0.6/0.3/0.05/0.05 合成',()=>{
    const result=calculateStellarSwirlTeam({participants:participants(),triggerId:'wind',
        vortexMultiplier:2,vodyanitsaA4:{hp:65000,active:true,recipientId:'wind'}});
    const anemoBase=1446.85*.75,cryoBase=1446.85*2;
    const anemoExpected=.6*(anemoBase+6500)+.3*(anemoBase*2.2)
        +.05*(anemoBase*1.5)+.05*anemoBase;
    const cryoExpected=.6*(cryoBase*2.2)+.3*(cryoBase+6500)
        +.05*(cryoBase*1.5)+.05*cryoBase;
    close(result.stellarswirl_anemo.expectation,anemoExpected);
    close(result.stellarswirl_cryo.expectation,cryoExpected);
    const large=calculateStellarSwirlTeam({participants:participants(),triggerId:'wind',
        vortexMultiplier:3});
    close(large.individual.cryo[0].damage.non_critical,1446.85*3);
});

test('缺少真实挂风/挂冰者、档位或受益角色时拒绝假造队伍结果',()=>{
    assert.throws(()=>calculateStellarSwirlTeam({participants:[],triggerId:'wind',vortexMultiplier:2}));
    assert.throws(()=>calculateStellarSwirlTeam({participants:participants(),triggerId:'wind',vortexMultiplier:1}));
    assert.throws(()=>calculateStellarSwirlTeam({participants:participants().map(x=>({...x,element:'Cryo'})),triggerId:'wind',vortexMultiplier:2}));
    assert.throws(()=>calculateStellarSwirlTeam({participants:[...participants().slice(0,1),
        {...participants()[1],id:'vodyanitsa',element:'Hydro'}],triggerId:'wind',vortexMultiplier:2}));
    assert.throws(()=>calculateStellarSwirlTeam({participants:participants(),triggerId:'wind',vortexMultiplier:2,
        vodyanitsaA4:{hp:65000,active:true,recipientId:'missing'}}));
});

test('Vodyanitsa 包装器在缺队伍条件时隐藏预览值，显式参与者时给出队伍结果',()=>{
    let received;
    const engine={CalculatorInterface:{get_damage_analysis:x=>{
        received=x;
        return {element:'Hydro',normal:damage(100),stellarswirl_anemo:damage(999),
            stellarswirl_cryo:damage(999)};
    }}};
    const facade=createFacade(engine,engine,{},
        {characters:['Vodyanitsa'],weapons:['TestCatalyst'],artifacts:[],buffs:[]},{});
    const input={character:{name:'Vodyanitsa',params:{Vodyanitsa:{song_active:false}}},
        weapon:{name:'TestCatalyst'},skill:{index:11,config:{Vodyanitsa:{q_song_bonus:true}}},buffs:[]};
    const hidden=facade.CalculatorInterface.get_damage_analysis(input,null);
    assert.equal(hidden.stellarswirl_anemo,undefined);
    assert.equal(hidden.reaction_availability.stellarswirl_anemo.status,'uncalibrated');
    assert.equal(received.skill.config.Vodyanitsa.q_song_bonus,false);
    assert.equal(hidden.q_song_status.reason,'未配置遥久之歌状态');
    const configured={...input,character:{...input.character,
        params:{Vodyanitsa:{song_active:true}}},
        stellar_swirl_context:{participants:participants(),triggerId:'wind',vortexMultiplier:2}};
    const shown=facade.CalculatorInterface.get_damage_analysis(configured,null);
    close(shown.stellarswirl_anemo.expectation,
        calculateStellarSwirlTeam(configured.stellar_swirl_context).stellarswirl_anemo.expectation);
    assert.equal(shown.reaction_availability.stellarswirl_cryo.status,'calibrated');
    assert.equal(shown.q_song_status.active,true);
    assert.equal(received.skill.config.Vodyanitsa.q_song_bonus,true);
});
