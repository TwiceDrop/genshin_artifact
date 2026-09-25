import {deriveTeamBuffs,TEAM_BUFF_SOURCES} from '../../beta-data/hybrid-team-optimizer.mjs';

const clone = value => JSON.parse(JSON.stringify(value));
const SUPPORTED_SOURCES = new Set(TEAM_BUFF_SOURCES);

export function createTeamContextSource(presetName, preset) {
    const item = preset?.item || preset;
    const name = item?.character?.name;
    const characterParams = item?.character?.params?.[name] || {};
    const weaponParams = item?.weapon?.params?.HymnOfTheMaelstrom || {};
    return {
        presetName,
        sourceId: item?.miyousheKey ? `miyoushe:${item.miyousheKey}` : `preset:${presetName}`,
        triggers: {
            eActive: characterParams.e_active === true,
            songActive: characterParams.song_active === true,
            a1Active: false,
            a4Active: false,
            c1Active: characterParams.c1_active === true,
            c2Active: characterParams.c2_active === true,
            vesnaRadiance: characterParams.radiance === true,
            vesnaTalentActive: false,
            vesnaTalentCoverage: 1,
            signatureStacks: Number(weaponParams.stacks || 0),
            signatureBoosted: weaponParams.boosted === true,
            signatureOnField: weaponParams.on_field !== false,
            recipientOnField: true,
            odetteRadianceMode: characterParams.radiance_mode ?? 0,
            odetteStacks: 0, odetteBlessing: false, odetteSplendor: false, odetteDouble: false, odetteDream: false,
            qiqiTalisman: false, qiqiC6: false, sandroneBlessing: false, sandroneC1: false,
        },
    };
}

function sourceInterface(item, sourceId, triggers) {
    const character = clone(item.character);
    const weapon = clone(item.weapon);
    if (character.name === 'Vodyanitsa') {
        character.params = {Vodyanitsa:{...(character.params?.Vodyanitsa || {}),
            e_active: triggers.eActive === true,
            song_active: triggers.songActive === true,
            c1_active: triggers.c1Active === true,
            c2_active: triggers.c2Active === true}};
        if (weapon.name === 'HymnOfTheMaelstrom') {
            weapon.params = {HymnOfTheMaelstrom:{...(weapon.params?.HymnOfTheMaelstrom || {}),
                stacks: Number(triggers.signatureStacks || 0), boosted: triggers.signatureBoosted === true,
                on_field:triggers.signatureOnField !== false}};
        }
    } else if (character.name === 'Vesna') {
        character.params = {Vesna:{...(character.params?.Vesna || {}),radiance:triggers.vesnaRadiance === true}};
    }
    return {
        character, weapon, source_id:sourceId,
        buffs:(item.buffs || []).filter(buff => !buff.lock).map(buff => ({name:buff.name,config:clone(buff.config)})),
        artifact_config:item.artifactEffectMode === 'custom' ? clone(item.artifactConfig || null) : null,
        team_effects:{
            support_triggers:clone(triggers),
            a1_active:triggers.a1Active === true,
            a4_active:triggers.a4Active === true,
            vesna_talent_active:triggers.vesnaTalentActive === true,
            vesna_talent_coverage:Number(triggers.vesnaTalentCoverage ?? 1),
        },
    };
}

function manualOverrides(auto, manual) {
    return manual.some(buff => {
        if (buff.source_effect) return buff.source_effect === auto.source_effect;
        if (buff.source_id) return buff.source_id === auto.source_id && buff.name === auto.name;
        // Old presets do not have source IDs. The character-specific name
        // uniquely identifies the calibrated source when only one is selected.
        return buff.name === auto.name && TEAM_BUFF_SOURCES.some(name=>auto.name.startsWith(name));
    });
}

export function deriveSingleTeamContext(api, recipient, selectedSources, presets, getArtifact, convertArtifact) {
    const manual = recipient.buffs || [];
    const result = {buffs:[...manual], automatic:[], sources:[], issues:[], team_context:[]};
    if (!selectedSources?.length) return result;
    if(selectedSources.length>3){result.issues.push('单支队伍最多关联三名队友。');return result;}
    const sourceIds = new Set(), characterNames = new Set();
    const recipientGear = new Set((recipient.equipped_artifact_ids || []).filter(id => Number.isInteger(id) && id >= 0));
    const occupiedGear = new Set(recipientGear);
    for (const selected of selectedSources) {
        const {presetName, sourceId, triggers = {}} = selected;
        const entry = presets?.[presetName], item = entry?.item || entry;
        if (!item) {result.issues.push(`队友预设「${presetName}」已不存在，请重新选择。`);continue;}
        const name = item.character?.name;
        if (!SUPPORTED_SOURCES.has(name)) {result.issues.push(`队友预设「${presetName}」的角色效果尚未校准。`);continue;}
        if (!item.weapon) {result.issues.push(`队友预设「${presetName}」缺少武器，请重新保存。`);continue;}
        if (name === recipient.character?.name) {result.issues.push(`队伍不能重复使用 ${name}。`);continue;}
        if (!sourceId || sourceIds.has(sourceId)) {result.issues.push(`队友「${presetName}」的来源 ID 为空或重复。`);continue;}
        if (characterNames.has(name)) {result.issues.push(`当前仅支持一名 ${name} 作为 BUFF 来源。`);continue;}
        sourceIds.add(sourceId);characterNames.add(name);
        if (!Array.isArray(item.artifactIds)) {
            result.issues.push(`队友预设「${presetName}」没有保存当前装备；请打开该预设并重新保存。`);continue;
        }
        const ids = item.artifactIds.filter(id => Number.isInteger(id) && id >= 0);
        if (new Set(ids).size !== ids.length) {result.issues.push(`队友预设「${presetName}」重复使用了圣遗物。`);continue;}
        if (ids.some(id => occupiedGear.has(id))) {result.issues.push(`队友预设「${presetName}」与当前角色或其他队友占用了同一件圣遗物。`);continue;}
        const gear = ids.map(getArtifact);
        if (gear.some(artifact => !artifact)) {result.issues.push(`队友预设「${presetName}」有圣遗物已从库存删除，请重新保存装备。`);continue;}
        const recipientWithMode = {...recipient, team_effects:{...(recipient.team_effects || {}),
            on_field:triggers.recipientOnField !== false,
            stellar_mode:recipient.team_effects?.stellar_mode}};
        try {
            const source = sourceInterface(item, sourceId, triggers);
            const effects = deriveTeamBuffs(api,[recipientWithMode,source],
                [recipient.artifacts || [],gear.map(convertArtifact)],0);
            ids.forEach(id=>occupiedGear.add(id));
            result.automatic.push(...effects.filter(effect => !manualOverrides(effect,manual)));
            result.sources.push({presetName,sourceId,characterName:name,artifactCount:gear.length,effectNames:effects.map(e=>e.name)});
            result.team_context.push({source_id:sourceId,preset_name:presetName,triggers:clone(triggers)});
        } catch (error) {
            result.issues.push(`队友预设「${presetName}」无法计算来源面板：${error?.message || error}`);
        }
    }
    result.buffs.push(...result.automatic);
    return result;
}
