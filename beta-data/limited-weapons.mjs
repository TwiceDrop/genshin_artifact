// Input validation and effect summaries shared by the UI and both calculation cores.
export const LIMITED_WEAPONS = {
    NewBough: {type:'Sword', label:'新枝', defaults:{stacks:0, radiance:false, rate:1}},
    WintersHeavyHeart: {type:'Catalyst', label:'凝雪沉心', defaults:{cryo_count:0, electro_count:0, radiance:false, rate:1}},
    BreezeborneRefrain: {type:'Bow', label:'柔风游弦', defaults:{rate:0}},
    HereticsMoltenBlade: {type:'Sword', label:'熔猎异端之刃', defaults:{movement_rate:1, rate:1}},
    Emberwell: {type:'Sword', label:'引火之源', defaults:{reaction_active:true, stellar_active:true, reaction_rate:1, stellar_rate:1}},
    ForgedByTheGoldenMelody: {type:'Claymore', label:'金律铸影', defaults:{state:0, counterpoint_active:true, counterpoint_state:0, rate:1, counterpoint_rate:1}},
    BladeOfAtonement: {type:'Claymore', label:'救赎之斩', defaults:{reaction_active:true, stellar_active:true, reaction_rate:1, stellar_rate:1}},
    Frostbreath: {type:'Polearm', label:'寒息', defaults:{active:true, rate:1, energy_rate:1}},
    SongOfTheVigil: {type:'Polearm', label:'戍望谣歌', defaults:{stellar_active:true, rate:1, energy_rate:1}},
    ClashOfKings: {type:'Catalyst', label:'群王局戏', defaults:{active:true, rate:1}},
    EchoesOfTheHeart: {type:'Catalyst', label:'寸心余响', defaults:{reaction_active:true, stellar_active:true, reaction_rate:1, stellar_rate:1}},
    JadeVista: {type:'Bow', label:'悬黎千钧', defaults:{same_count:2, diff_count:1, rate:1}},
    CovenantOfFrostAndSnow: {type:'Bow', label:'霜雪誓约', defaults:{active:true, rate:1}},
};
export const isLimitedWeapon = w => Boolean(LIMITED_WEAPONS[w?.name]);
export function bounded(value, min, max, label, integer=false) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value<min || value>max || (integer && !Number.isInteger(value))) throw Error(`${label}应为 ${min}～${max}${integer?' 的整数':''}`);
    return value;
}
export function normalizeLimitedWeapon(w) {
    if (!isLimitedWeapon(w)) return w;
    bounded(w.level,1,90,'武器等级',true); bounded(w.refine,1,5,'武器精炼',true);
    if (typeof w.ascend!=='boolean') throw Error('武器突破状态应为开关');
    if (w.ascend && ![20,40,50,60,70,80].includes(w.level)) throw Error('只有突破等级可以选择突破后');
    const p={...LIMITED_WEAPONS[w.name].defaults,...w.params?.[w.name]};
    for (const [key, value] of Object.entries(p)) {
        if (typeof LIMITED_WEAPONS[w.name].defaults[key]==='boolean' && typeof value!=='boolean') throw Error('武器特效开关无效');
        if (key==='rate'||key.endsWith('_rate')) bounded(value,0,1,key==='movement_rate'?'效果比例':'覆盖率');
    }
    if (w.name==='NewBough') bounded(p.stacks,0,3,'蓊郁层数',true);
    if (w.name==='WintersHeavyHeart') {
        bounded(p.cryo_count,0,4,'冰元素角色数',true); bounded(p.electro_count,0,4,'雷元素角色数',true);
        if (p.cryo_count+p.electro_count>4) throw Error('冰、雷角色合计不能超过4位（含装备者）');
    }
    if (w.name==='ForgedByTheGoldenMelody') { bounded(p.state,0,2,'当前乐章',true); bounded(p.counterpoint_state,0,3,'复调乐章',true); }
    if (w.name==='JadeVista') {
        // Old saved defaults were 2+2. Honor same-element priority when migrating.
        bounded(p.same_count,0,4,'同元素队友数',true); bounded(p.diff_count,0,4,'异元素队友数',true);
        p.same_count=Math.min(p.same_count,3); p.diff_count=Math.min(p.diff_count,3-p.same_count);
    }
    return {...w,params:{[w.name]:p}};
}
export function limitedWeaponEffects(weapon) {
    const w=normalizeLimitedWeapon(weapon); if(!isLimitedWeapon(w)) return null;
    const p=w.params[w.name], k=1+(w.refine-1)/4;
    const e={attack:0,em:0,stellar:0,recharge:0};
    switch(w.name) {
    case 'NewBough':
        e.attack=(p.radiance ? .06 : .04)*k*p.stacks*p.rate;
        if(p.radiance)e.stellar=.08*k*p.stacks*p.rate;else e.em=20*k*p.stacks*p.rate;
        break;
    case 'WintersHeavyHeart':
        if(p.radiance){e.em=20*k*(p.cryo_count+p.electro_count)*p.rate;e.stellar=.06*k*(p.cryo_count+p.electro_count)*p.rate;}
        else{e.em=24*k*p.cryo_count*p.rate;e.attack=.048*k*p.electro_count*p.rate;} break;
    case 'BreezeborneRefrain': e.recharge=.2*k;e.stellar=.24*k*p.rate;break;
    case 'HereticsMoltenBlade': e.attack=.36*k*p.movement_rate*p.rate;break;
    case 'Emberwell':e.attack=p.reaction_active ? .16*k*p.reaction_rate : 0;e.stellar=p.stellar_active ? .16*k*p.stellar_rate : 0;break;
    case 'ForgedByTheGoldenMelody': {
        const add=(state,rate)=>{if(state===0)e.attack+=.18*k*rate;else if(state===1)e.em+=120*k*rate;else e.stellar+=.28*k*rate;};
        add(p.state,p.rate); if(p.counterpoint_active)add(p.counterpoint_state===0?p.state:p.counterpoint_state-1,p.counterpoint_rate); break;
    }
    case 'BladeOfAtonement':e.em=p.reaction_active?64*k*p.reaction_rate:0;e.attack=p.stellar_active ? .16*k*p.stellar_rate : 0;break;
    case 'Frostbreath':e.attack=p.active ? .2*k*p.rate : 0; e.energyPerTrigger=6*k; e.energyInterval=16; e.energyTarget='队伍中其他角色';break;
    case 'SongOfTheVigil':e.attack=p.stellar_active ? .2*k*p.rate : 0; e.energyPerTrigger=4*k; e.energyInterval=9; e.energyTarget='装备者';break;
    case 'ClashOfKings':e.attack=p.active ? .2*k*p.rate : 0;e.em=p.active?100*k*p.rate:0;break;
    case 'EchoesOfTheHeart':e.em=p.reaction_active?60*k*p.reaction_rate:0;e.stellar=p.stellar_active ? .16*k*p.stellar_rate : 0;break;
    case 'JadeVista':e.em=64*k*p.same_count*p.rate;e.attack=.12*k*p.diff_count*p.rate;break;
    case 'CovenantOfFrostAndSnow':e.em=p.active?120*k*p.rate:0;break;
    }
    if(e.energyPerTrigger!==undefined)e.energyPerInterval=e.energyPerTrigger*p.energy_rate;
    return e;
}
