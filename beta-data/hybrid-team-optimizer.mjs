import {expandedWeaponEffects} from './expanded-weapons.mjs';

export const TEAM_BUFF_SOURCES = Object.freeze(['Vodyanitsa','Vesna','Odette','Qiqi','Sandrone']);

const SLOTS = ['Flower', 'Feather', 'Sand', 'Goblet', 'Head'];
const RESULT_SLOT = Object.fromEntries(SLOTS.map(slot => [slot, slot.toLowerCase()]));
const MAX_EXACT_BUILDS_PER_MEMBER = 64;
const MAX_TEAM_EVALUATIONS = 200000;
const MAX_SEARCH_NODES = 1000000;
const MAX_SEARCH_MS = 30000;
const MAX_CANDIDATES_PER_MEMBER = 100;

const slotId = (entry, slot) => entry[RESULT_SLOT[slot]] ?? entry[slot];
const ids = entry => SLOTS.map(slot => slotId(entry, slot)).filter(id => id != null);
const keyOf = entry => ids(entry).join(':');
const sum = values => Object.values(values || {}).reduce((a, b) => a + Number(b || 0), 0);

function candidatesBySlot(artifacts) {
    const bySlot = SLOTS.map(slot => artifacts.filter(a => a.slot === slot));
    const count = bySlot.reduce((n, group) => n * group.length, 1);
    return {bySlot, count};
}

function* allBuilds(bySlot, index = 0, current = []) {
    if (index === bySlot.length) { yield current; return; }
    for (const artifact of bySlot[index]) yield* allBuilds(bySlot, index + 1, [...current, artifact]);
}

export function deriveTeamBuffs(api, interfaces, selected, recipientIndex) {
    const out = [];
    const recipient = interfaces[recipientIndex];
    const target = recipient.target_function || recipient.tf;
    const stellarTarget = recipient.team_effects?.stellar_mode === 'stellar' ||
        (recipient.team_effects?.stellar_mode !== 'ordinary' &&
            (['SandroneStellarSwirl','YumemizukiMizukiStellarSwirl'].includes(target?.name)
                || (recipient.character?.name === 'Vesna' && recipient.character.params?.Vesna?.radiance === true)));
    for (let index = 0; index < interfaces.length; index++) {
        if (index === recipientIndex) continue;
        const source = interfaces[index], character = source.character, name = character?.name;
        const sourceId = source.source_id || name;
        if (!TEAM_BUFF_SOURCES.includes(name)) continue;
        const panel = api.CommonInterface.get_attribute({
            character, weapon: source.weapon, artifacts: selected[index],
            artifact_config: source.artifact_config, buffs: source.buffs || [],
        });
        const weaponEffects = expandedWeaponEffects(source.weapon,{characterName:name,sourceAttack:sum(panel.atk)});
        for (const effect of weaponEffects?.teamEffects || []) {
            if (effect.kind === 'reactionBonus') {
                throw Error(`${source.weapon.name} 的队友绽放／月绽放增伤尚未接入目标反应乘区，不能用于队伍配装。`);
            }
            if (recipient.team_effects?.on_field === false || !Number.isFinite(effect.amount)) continue;
            if (effect.kind === 'attackPercentage') out.push({
                name:'ATKPercentage',source_character:name,source_id:sourceId,
                source_effect:`${sourceId}:${source.weapon.name}:team-attack`,
                config:{ATKPercentage:{p:effect.amount*100}},
            });
            if (effect.kind === 'damageBonus') out.push({
                name:'CustomBonus',source_character:name,source_id:sourceId,
                source_effect:`${sourceId}:${source.weapon.name}:team-damage`,
                config:{CustomBonus:{p:effect.amount*100}},
            });
        }
        const triggers=source.team_effects?.support_triggers || {};
        const talent=character.level>20 || (character.level===20 && character.ascend);
        const addSupport=(buff,config={})=>out.push({name:buff,source_character:name,source_id:sourceId,
            source_effect:sourceId+':'+buff,config:Object.keys(config).length?{[buff]:config}:'NoConfig'});
        if(name==='Odette'){
            const mode=Number(triggers.odetteRadianceMode ?? 0);
            if(!Number.isInteger(mode)||mode<0||mode>2)throw Error('奥黛塔辉映状态无效');
            const stacks=Number(triggers.odetteStacks ?? 0),limit=character.constellation>=1?6:4;
            if(!Number.isInteger(stacks)||stacks<0||stacks>limit)throw Error('奥黛塔受益华彩层数超出当前命座上限');
            if(triggers.odetteBlessing && mode) addSupport('OdetteTalent1',{atk:sum(panel.atk),radiance_mode:mode});
            if(talent && triggers.odetteSplendor && stacks>0){
                addSupport('OdetteMarvelousSplendor',{stacks});
                if(character.constellation>=2)addSupport('OdetteC2MarvelousSplendor',{stacks});
                if(character.constellation>=6)addSupport('OdetteC6MarvelousSplendor');
            }
            if(character.constellation>=2 && triggers.odetteDouble && mode)addSupport('OdetteC2SoloDance',{radiance_mode:mode});
            if(character.constellation>=4 && triggers.odetteDream)addSupport('OdetteC4SnowSwanDream',{burst_level:character.skill3+1});
            continue;
        }
        if(name==='Qiqi'){
            if(triggers.qiqiTalisman)addSupport('QiqiTalent2StellarConduct');
            if(character.constellation>=6 && triggers.qiqiC6)addSupport('QiqiC6StellarConduct',{atk:sum(panel.atk)});
            continue;
        }
        if(name==='Sandrone'){
            if(triggers.sandroneBlessing)addSupport('SandroneTalent1',{atk:sum(panel.atk)});
            if(character.constellation>=1 && triggers.sandroneC1)addSupport('SandroneC1');
            continue;
        }
        if (name === 'Vesna') {
            const active = character.params?.Vesna?.radiance === true
                && source.team_effects?.vesna_talent_active === true;
            if (active) out.push({name:'VesnaTalent1', source_character:name,source_id:sourceId,
                config:{VesnaTalent1:{atk:sum(panel.atk), coverage:source.team_effects.vesna_talent_coverage ?? 1}}});
            continue;
        }
        const p = character.params?.Vodyanitsa || {}, hp = sum(panel.hp), constellation = character.constellation;
        const shared = {hp, constellation, e_level:character.skill2 + 1,
            on_field:recipient.team_effects?.on_field !== false, ordinary_mode:!stellarTarget};
        const add = (suffix, extra = {}) => out.push({name:'Vodyanitsa' + suffix, source_character:name,source_id:sourceId,
            config:{['Vodyanitsa' + suffix]:{...shared,...extra}}});
        if (p.e_active) add('E');
        if (p.song_active && source.team_effects?.a4_active === true) add('A4');
        if (source.team_effects?.a1_active === true) add('A1');
        if (constellation >= 1 && p.c1_active) add('C1');
        if (constellation >= 2 && p.c2_active) add('C2');
        if (constellation >= 6 && p.song_active) add('C6');
        if (source.weapon?.name === 'HymnOfTheMaelstrom') {
            const cfg = source.weapon.params?.HymnOfTheMaelstrom || {};
            if (cfg.stacks > 0 && cfg.on_field !== false)
                add('Signature',{refine:source.weapon.refine,stacks:cfg.stacks,boosted:cfg.boosted === true});
        }
    }
    return out;
}

function withAutomaticBuffs(api, interfaces, selected, index) {
    const own = interfaces[index], manual = own.buffs || [];
    const identity = b => b.source_effect || `${b.source_id}:${b.name}`;
    const manualNames = new Set(manual.filter(b=>b.source_id||b.source_effect).map(identity));
    const legacyNames = new Set(manual.filter(b=>!b.source_id&&!b.source_effect).map(b=>b.name));
    const automatic = deriveTeamBuffs(api, interfaces, selected, index)
        .filter(b => !manualNames.has(identity(b)) && !legacyNames.has(b.name));
    return {...own, buffs:[...manual,...automatic]};
}

function evaluate(api, config, artifacts) {
    const ranked = api.OptimizeSingleWasm.optimize({...config, algorithm:config.algorithm || 'AStar'}, artifacts);
    const wanted = artifacts.map(a => a.id).sort((a,b) => a-b).join(':');
    const match = ranked.find(row => ids(row).sort((a,b) => a-b).join(':') === wanted);
    return match && Number.isFinite(match.value) ? match.value : null;
}

export function optimizeHybridTeam(api, input, artifacts) {
    const interfaces = input.single_interfaces || [], weights = input.weights || [];
    if (!interfaces.length || interfaces.length !== weights.length || interfaces.length > 8)
        throw Error('多人配装的角色与权重数量无效');
    const {bySlot,count} = candidatesBySlot(artifacts);
    if (!count) return {artifacts:[],search_complete:true,evaluated_teams:0};
    const exact = count <= MAX_EXACT_BUILDS_PER_MEMBER;
    const pools = interfaces.map(config => {
        if (exact) {
            const rows = [];
            for (const build of allBuilds(bySlot)) {
                const value = evaluate(api, config, build);
                if (value !== null) rows.push({build, value, entry:Object.fromEntries(build.map(a => [RESULT_SLOT[a.slot],a.id]))});
            }
            return rows.sort((a,b) => b.value-a.value || keyOf(a.entry).localeCompare(keyOf(b.entry)));
        }
        const ranked = api.OptimizeSingleWasm.optimize(config,artifacts).slice(0,MAX_CANDIDATES_PER_MEMBER);
        const catalog = new Map(artifacts.map(a => [a.id,a]));
        return ranked.map(row => ({build:ids(row).map(id => catalog.get(id)),value:row.value,entry:Object.fromEntries(SLOTS.map(s=>[RESULT_SLOT[s],slotId(row,s)]))}))
            .filter(row => row.build.length === 5 && row.build.every(Boolean));
    });
    if (pools.some(pool => !pool.length)) return {artifacts:[],search_complete:exact,evaluated_teams:0};
    const found = [], selected = Array(interfaces.length), entries = Array(interfaces.length);
    const requested = Number(input.hyper_param?.count);
    const resultLimit = Number.isInteger(requested) && requested > 0 ? Math.min(requested,1000) : 100;
    let evaluated = 0, visited = 0, truncated = false;
    const deadline = Date.now() + MAX_SEARCH_MS;
    const order = (a,b) => b.score-a.score || JSON.stringify(a.entries).localeCompare(JSON.stringify(b.entries));
    function walk(index, occupied) {
        if (++visited > MAX_SEARCH_NODES || evaluated >= MAX_TEAM_EVALUATIONS || Date.now() > deadline) {
            truncated = true; return;
        }
        if (index === interfaces.length) {
            evaluated++;
            let score = 0;
            for (let i = 0; i < interfaces.length; i++) {
                const value = evaluate(api,withAutomaticBuffs(api,interfaces,selected,i),selected[i]);
                if (value === null) return;
                score += weights[i] * value;
            }
            found.push({score,entries:entries.map(x=>({...x}))});
            if (found.length > resultLimit * 2) { found.sort(order); found.length = resultLimit; }
            return;
        }
        for (const candidate of pools[index]) {
            const candidateIds = ids(candidate.entry);
            if (candidateIds.some(id => occupied.has(id))) continue;
            selected[index] = candidate.build; entries[index] = candidate.entry;
            walk(index + 1,new Set([...occupied,...candidateIds]));
            if (truncated) break;
        }
    }
    walk(0,new Set());
    found.sort(order);
    return {artifacts:found.slice(0,resultLimit).map(x=>x.entries),
        search_complete:exact && !truncated,evaluated_teams:evaluated,visited_nodes:visited};
}

export function withHybridTeamOptimization(api) {
    return {...api,TeamOptimizationWasm:new Proxy(api.TeamOptimizationWasm,{get(target,method) {
        if (method !== 'optimize_team2') return Reflect.get(target,method);
        return (input,artifacts) => input?.single_interfaces?.some(x => ['Vesna','Vodyanitsa'].includes(x.character?.name))
            ? optimizeHybridTeam(api,input,artifacts) : target.optimize_team2(input,artifacts);
    }})};
}
