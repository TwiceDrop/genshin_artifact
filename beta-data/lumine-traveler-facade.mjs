import { dslTokens } from './dsl-tokens.mjs';
import { travelerModelName, LUMINE_CHARGED_SECOND, AETHER_CHARGED_FIRST, AETHER_CHARGED_SECOND } from './traveler-model.mjs';

const aliases = Object.fromEntries(['DendroDefault', 'CryoDefault', 'CryoTalent1', 'CryoC2', 'CryoC6'].map(suffix => ['Lumine' + suffix, 'Aether' + suffix]));
const modelName = name => aliases[name] || travelerModelName(name);
const female = character => travelerModelName(character?.name) !== character?.name;
const fields = { e: 'expectation', expect: 'expectation', expectation: 'expectation', c: 'critical', crit: 'critical', critical: 'critical', n: 'non_critical', non_crit: 'non_critical', non_critical: 'non_critical' };
const damageAliases = { n: 'normal', m: 'melt', v: 'vaporize' };
const sum = object => Object.values(object || {}).reduce((a, b) => a + b, 0);
const correction = character => {
    const level = character.skill1;
    return (LUMINE_CHARGED_SECOND[level] - AETHER_CHARGED_SECOND[level]) / (AETHER_CHARGED_SECOND[level] - AETHER_CHARGED_FIRST[level]);
};

// Saved/UI character names and original account IDs stay Lumine. Only values
// submitted to the published engine use its verified Aether kit and enum names.
function normalize(value) {
    if (!value || typeof value !== 'object' || ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return value;
    if (Array.isArray(value)) return value.map(normalize);
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [modelName(key), ['name', 'source_buff'].includes(key) ? modelName(item) : normalize(item)]));
}

const chargedPairs = {
    Anemo: { Charged12: ['Charged11', 6] },
    Geo: { Charged2: ['Charged1', 7] },
    Electro: { Charged2: ['Charged1', 6] },
    Dendro: { Charged2: ['Charged1', 6] },
    Hydro: { Charged2: ['Charged1', 6] },
    Pyro: { Charged12: ['Charged11', 6] },
    Cryo: { Charged2: ['Charged1', 6], ChargedIceCondensation2: ['ChargedIceCondensation1', 16] },
};

// Published AetherCryoDefault ($f312) reads the two private character-state
// attributes. Their sole writers ($f915/$f934) copy these configured values;
// equipment/BUFF attribute bridges cannot write either private slot.
function cryoDefaultSource(character) {
    const state = character.params[character.name];
    const mode = Math.max(0, Math.min(2, state.radiance_mode));
    const enhanced = mode !== 0;
    const kind = ['normal', 'direct_stellarconduct', 'direct_stellarswirl'][mode];
    const config = `({e_infusion: true, radiance_mode: ${mode}})`;
    const charged = enhanced ? 'ChargedIceCondensation' : 'Charged';
    const burst = ['Burst', 'StellarBurst', 'StellarSwirlBurst'][mode];
    return `dmg __lumine_n1 = LumineCryo.Normal1${config}
dmg __lumine_n2 = LumineCryo.Normal2${config}
dmg __lumine_p = LumineCryo.Plunging2${config}
dmg __lumine_c1 = LumineCryo.${charged}1${config}
dmg __lumine_c2 = LumineCryo.${charged}2${config}
dmg __lumine_q = LumineCryo.${burst}${config}
result = 3 * (__lumine_n1.normal.e + __lumine_n2.normal.e) + __lumine_p.normal.e + __lumine_c1.${kind}.e + __lumine_c2.${kind}.e + ${state.cold_glow_stacks >= 8 ? 5 : 3} * __lumine_q.${kind}.e`;
}

export function withLumineTraveler(base) {
    function adjustAnalysis(input, infusion) {
        const mapped = normalize(input);
        const second = base.CalculatorInterface.get_damage_analysis(mapped, infusion);
        const pairs = chargedPairs[input.character.name.slice('Lumine'.length)];
        if (!Object.values(pairs).some(pair => pair[1] === input.skill.index)) return second;
        const first = base.CalculatorInterface.get_damage_analysis({ ...mapped, skill: { ...mapped.skill, index: input.skill.index - 1 } }, infusion);
        const factor = correction(input.character);
        for (const [kind, result] of Object.entries(second)) {
            if (!result || typeof result !== 'object' || !('expectation' in result)) continue;
            for (const field of ['non_critical', 'critical', 'expectation']) result[field] += (result[field] - first[kind][field]) * factor;
        }
        // The two same-kind hits have identical flat additions and post factors.
        // Subtraction cancels those additions; only the skill ATK ratio changes.
        for (const key of ['atk_ratio', 'direct_stellarconduct_ratio', 'direct_stellarswirl_ratio']) {
            if (!sum(second[key]) && !sum(first[key])) continue;
            const delta = (sum(second[key]) - sum(first[key])) * factor;
            const label = key === 'atk_ratio' ? '技能倍率' : '重击·冰凝';
            second[key][label] += delta;
        }
        return second;
    }

    function adjustDsl(source, input) {
        const tokens = dslTokens(source), replacements = [], additions = [];
        const name = input.character.name, model = travelerModelName(name), element = name.slice('Lumine'.length);
        const factor = correction(input.character);
        const names = new Set(tokens.filter(token => token.type === 'id').map(token => token.value));
        const bindings = new Map(), aliases = new Map();
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            if (token.type === 'id' && ['dmg', 'prop'].includes(tokens[i - 3]?.value) && tokens[i - 1]?.value === '=' && travelerModelName(token.value) !== token.value && tokens[i + 1]?.value === '.') {
                replacements.push({ start: token.start, end: token.end, text: travelerModelName(token.value) });
            }
            if (token.value !== 'dmg') continue;
            bindings.delete(tokens[i + 1]?.value);
            if (![name, model].includes(tokens[i + 3]?.value)) continue;
            const hit = tokens[i + 1].value, pair = chargedPairs[element][tokens[i + 5]?.value];
            if (!pair) continue;
            let end = tokens[i + 5].end, configSource = '';
            if (tokens[i + 6]?.value === '(') {
                let close = i + 7, depth = 1;
                while (depth && close < tokens.length) { if (tokens[close].value === '(') depth++; if (tokens[close].value === ')') depth--; close++; }
                end = tokens[close - 1].end;
                configSource = source.slice(tokens[i + 6].start, end);
            }
            let first = '__lumine_first_' + hit;
            while (names.has(first)) first += '_';
            names.add(first);
            let snapshot = '__lumine_hit_' + hit;
            while (names.has(snapshot)) snapshot += '_';
            names.add(snapshot);
            bindings.set(hit, { hit: snapshot, first, path: [] });
            additions.push({ start: end, end, text: `\ndmg ${first} = ${model}.${pair[0]}${configSource}\ndmg ${snapshot} = ${model}.${tokens[i + 5].value}${configSource}\n` });
        }
        // The published DSL cannot construct mutable Damage objects. Resolve
        // supported object aliases and member access to live scalar formulas.
        // Both native hits remain evaluated for each optimization candidate.
        function access(index) {
            const parenthesized = tokens[index]?.value === '(' ? access(index + 1) : null;
            const identifier = tokens[index]?.value;
            const root = parenthesized && tokens[parenthesized.end]?.value === ')' ? parenthesized : aliases.has(identifier) ? aliases.get(identifier) : bindings.get(identifier);
            if (!root) return null;
            const path = [...root.path];
            let end = parenthesized ? parenthesized.end + 1 : index + 1;
            while (end < tokens.length) {
                if (tokens[end].value === '.' && tokens[end + 1]?.type === 'id') {
                    path.push(tokens[end + 1].value); end += 2;
                } else break;
            }
            return { ...root, path, end };
        }
        const operations = new Set(['+', '-', '*', '/', '^', '<', '>', '=', '&', '|', '!', '.', ',']);
        function assignmentEnd(start) {
            let depth = 0;
            for (let i = start; i < tokens.length; i++) {
                const token = tokens[i], previous = tokens[i - 1];
                if (!depth && i > start) {
                    const nextStatement = token.type === 'id' && (tokens[i + 1]?.value === '=' || ['dmg', 'prop'].includes(token.value));
                    const separated = /[\r\n]/.test(source.slice(previous.end, token.start)) && !operations.has(previous.value) && !operations.has(token.value);
                    const callStatement = token.type === 'id' && tokens[i + 1]?.value === '(' && !operations.has(previous.value);
                    if (nextStatement || separated || callStatement) return i;
                }
                if (['(', '[', '{'].includes(token.value)) depth++;
                else if ([')', ']', '}'].includes(token.value)) depth--;
            }
            return tokens.length;
        }
        const pending = new Map();
        for (let i = 0; i < tokens.length; i++) {
            for (const [key, value] of pending.get(i) || []) aliases.set(key, value);
            if (tokens[i].type !== 'id' && tokens[i].value !== '(') continue;
            if (tokens[i + 1]?.value === '=' && tokens[i - 1]?.value !== 'dmg' && tokens[i - 1]?.value !== 'prop') {
                const right = access(i + 2);
                const boundary = assignmentEnd(i + 2);
                const value = right && right.path.length < 2 && right.end === boundary ? right : null;
                if (!pending.has(boundary)) pending.set(boundary, []);
                pending.get(boundary).push([tokens[i].value, value]);
            }
            const ref = access(i);
            if (!ref || ref.path.length !== 2 || !fields[ref.path[1]]) continue;
            const kind = damageAliases[ref.path[0]] || ref.path[0];
            const field = fields[ref.path[1]] === 'expectation' ? 'e' : fields[ref.path[1]] === 'critical' ? 'c' : 'n';
            const second = `${ref.hit}.${kind}.${field}`, first = `${ref.first}.${kind}.${field}`;
            replacements.push({ start: tokens[i].start, end: tokens[ref.end - 1].end, text: `(${second} + (${second} - ${first}) * ${factor})` });
            i = ref.end - 1;
        }
        let result = source;
        for (const replacement of [...replacements, ...additions].sort((a, b) => b.start - a.start)) result = result.slice(0, replacement.start) + replacement.text + result.slice(replacement.end);
        return result;
    }

    function prepare(input) {
        if (typeof input === 'string') return modelName(input);
        if (input?.single_interfaces) return { ...normalize(input), single_interfaces: input.single_interfaces.map(prepare) };
        if (!female(input?.character)) return normalize(input);
        const result = normalize(input);
        for (const key of ['tf', 'target_function']) {
            const target = input[key];
            if (!target) continue;
            if (target.use_dsl) result[key] = { ...result[key], dsl_source: adjustDsl(target.dsl_source, input) };
            else if (input.character.name === 'LumineCryo' && ['LumineCryoDefault', 'AetherCryoDefault'].includes(target.name)) {
                result[key] = { ...result[key], use_dsl: true, dsl_source: adjustDsl(cryoDefaultSource(input.character), input) };
            }
        }
        return result;
    }

    return Object.fromEntries(Object.entries(base).map(([name, Class]) => [name, name === 'TransformativeDamage' ? Class : new Proxy(Class, { get(target, method) {
        const fn = Reflect.get(target, method);
        if (typeof fn !== 'function') return fn;
        return (...args) => {
            if (name === 'CalculatorInterface' && method === 'get_damage_analysis' && female(args[0]?.character)) return adjustAnalysis(args[0], args[1]);
            if (name === 'DSLInterface' && method === 'run' && female(args[1]?.character)) return fn(adjustDsl(args[0], args[1]), normalize(args[1]), ...args.slice(2));
            return fn(...args.map(prepare));
        };
    } })]));
}
