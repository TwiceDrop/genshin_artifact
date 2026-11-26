import {DAMAGE_REACTION_LABELS,damageReactionOptions} from './reaction-labels.mjs';
export {applyDslSegmentState as dslGeneratorInput} from '../../beta-data/dsl-segment-target.mjs';

export const DSL_VALUES=[{key:'e',label:'期望'},{key:'c',label:'暴击'},{key:'n',label:'非暴击'}];
export const DSL_DAMAGE_TYPES=Object.entries(DAMAGE_REACTION_LABELS).map(([key,label])=>({key,label}));
export function skillRows(character,names){return [1,2,3].flatMap(group=>character['skillMap'+group].map(skill=>({...skill,group,title:character['skillName'+group],token:names[skill.index]})));}
export function availableDamageTypes(mona,input,skill,config,infusion){return damageReactionOptions(mona.CalculatorInterface.get_damage_analysis({...input,skill:{index:skill.index,config}},infusion==='None'?null:infusion));}

function formatObject(fields) {
    const contents = Object.entries(fields).map(([key, value]) => {
        const name = /^[A-Za-z_][A-Za-z_0-9]*$/.test(key) ? key : JSON.stringify(key);
        return `${name}: ${JSON.stringify(value)}`;
    }).join(', ');
    return contents ? `{ ${contents} }` : '{}';
}

export function generateDsl(state) {
    const aliases = new Map();
    const states = (state.states ?? []).map(segment => {
        const buffs = segment.buffs.map(({name, config}) => {
            const call = `${name}(${formatObject(config === 'NoConfig' ? {} : config[name])})`;
            if (!aliases.has(call)) aliases.set(call, `buff${aliases.size + 1}`);
            return aliases.get(call);
        });
        const fields = [`buffs: [${buffs.join(', ')}]`];
        for (const key of ['character', 'weapon']) {
            if (segment[key] && Object.keys(segment[key]).length) fields.push(`${key}: ${formatObject(segment[key])}`);
        }
        return `state ${segment.name} = { ${fields.join(', ')} }`;
    });
    const buffs = [...aliases].map(([call, alias]) => `buff ${alias} = ${call}`);
    const hits = [];
    const terms = [];
    for (const [index, entry] of state.entries.entries()) {
        const name = `hit${index + 1}`;
        const params = {...entry.params};
        if (entry.infusion !== 'None') params.fumo = entry.infusion;
        const config = Object.keys(params).length ? `(${formatObject(params)})` : '';
        const segment = entry.state ? ` @${entry.state}` : '';
        hits.push(`dmg ${name} = ${state.character}.${entry.token}${config}${segment}`);
        terms.push(`${name}.${entry.reaction}.${entry.value} * ${entry.count} * ${entry.weight}`);
    }
    return [...buffs, ...states, ...hits, `result = ${terms.join(' + ') || '0'}`].join('\n');
}
