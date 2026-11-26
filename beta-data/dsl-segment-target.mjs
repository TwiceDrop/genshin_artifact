import {normalizeBuffParameters} from './buff-rule-registry.mjs';
import {assertDirectReactionDsl} from './direct-reaction-scope.mjs';
import {segmentDslError} from './dsl-segment-source.mjs';

const elements = ['None', 'Pyro', 'Hydro', 'Electro', 'Cryo', 'Anemo', 'Geo', 'Dendro', 'Physical'];
const panelProperties = new Map(Object.entries({
    atk: 'atk', def: 'def', hp: 'hp', recharge: 'recharge', em_all: 'elemental_mastery',
    crit0: 'critical', cd0: 'critical_damage', heal: 'healing_bonus',
}));
// The panel composition API combines both forms of mastery and omits these
// extension-only properties. Read their values through the existing DSL adapter.
const nativeProperties = new Set(['em', 'stellar_swirl_bonus', 'stellar_swirl_flat', 'stellar_swirl_base_bonus',
    'stellar_swirl_crit_damage', 'stellar_swirl_elevation', 'vesna_discipline']);
const reactions = ['normal', 'melt', 'vaporize', 'spread', 'aggravate', 'direct_moonelectro', 'direct_moonbloom',
    'direct_mooncrystallize', 'direct_stellarconduct', 'direct_stellarswirl'];
const legacyStellarNormal = {Mitya: 'direct_stellarconduct', Vesna: 'direct_stellarswirl'};
const transformativeSkill = {index: 0, config: 'NoConfig'};

export function applyDslSegmentState(input, state) {
    if (!state) return input;
    const next = {...input, buffs: state.buffs};
    for (const key of ['character', 'weapon']) {
        if (!state[key] || !Object.keys(state[key]).length) continue;
        const current = input[key];
        next[key] = {...current, params: {[current.name]: {...current.params?.[current.name], ...state[key]}}};
    }
    return next;
}

function validateFields(fields, definitions, kind) {
    for (const [name, value] of Object.entries(fields)) {
        const field = definitions.find(item => item.name === name);
        if (!field) throw Error(kind + '没有效果字段 ' + name);
        const valid = field.type === 'bool' ? typeof value === 'boolean'
            : Number.isFinite(value) && (field.type === 'float' || Number.isInteger(value));
        if (!valid) throw Error(kind + '参数类型无效 ' + name);
    }
}

function stage(phase, position, operation) {
    try {
        return operation();
    } catch (cause) {
        throw segmentDslError(phase, position, cause.message ?? String(cause), cause);
    }
}

function expressionPosition(source) {
    const lines = source.split(/\r\n?|\n/);
    const line = lines.findIndex(text => /^\s*result\s*=(?!=)/.test(text));
    return line < 0 ? {line: 1, column: 1} : {line: line + 1, column: lines[line].indexOf('result') + 1};
}

function prepareDeclaration(declaration, input, character, skillNames) {
    const {member, character: name, position, params, kind} = declaration;
    return stage('准备声明', position, () => {
        if (name !== input.character.name) throw Error('声明角色 ' + name + ' 与当前角色 ' + input.character.name + ' 不一致');
        if (kind === 'prop') {
            if (!panelProperties.has(member) && !nativeProperties.has(member)) throw Error('未知属性 ' + member);
            return {...declaration, panelKey: panelProperties.get(member)};
        }
        if (member === 'transformative') return {...declaration, transformative: true};
        const index = Object.keys(skillNames[name] ?? {}).find(key => skillNames[name][key] === member);
        if (index === undefined) throw Error('未知技能 ' + name + '.' + member);
        const {fumo, ...settings} = params;
        if (Object.hasOwn(params, 'fumo') && !elements.includes(fumo)) throw Error('附魔元素无效 ' + fumo);
        validateFields(settings, character?.configSkill ?? [], name + '.' + member + ' 技能');
        const skill = {index: Number(index), config: Object.keys(settings).length ? {[name]: settings} : 'NoConfig'};
        return {...declaration, skill, infusion: fumo && fumo !== 'None' ? fumo : null,
            key: JSON.stringify([skill, fumo])};
    });
}

function nativePropertySource(declarations) {
    return declarations.map(({source}) => source).join('\n') +
        '\nprint(' + declarations.map(({name}) => name).join(', ') + ')';
}

function readDslNativeValues(api, config, artifacts, source) {
    const result = api.DSLInterface.run(source, config, artifacts);
    if (result.is_error) throw Error(result.error_msg);
    return result.output.trim().split(/\r?\n/).map(line => Number(line.replace(/^MONA: /, '')));
}

export function prepareDslSegmentTarget(api, SegmentExpression, metadata, source, parsed, input) {
    const position = expressionPosition(parsed.expressionSource);
    stage('解析表达式', position, () => assertDirectReactionDsl(source));
    const {target_function, tf, ...base} = input;
    const character = metadata.characters[input.character.name];
    const weapon = metadata.weapons[input.weapon.name];
    for (const [alias, buff] of parsed.buffs) {
        const {name, config} = buff.input;
        if (config?.[name]?.active !== false) {
            stage('准备 BUFF ' + alias, buff.position, () => normalizeBuffParameters(name, config?.[name]));
        }
    }
    const configs = new Map([[null, base]]);
    for (const [name, state] of parsed.states) {
        const config = stage('准备状态 ' + name, state.position, () => {
            validateFields(state.character ?? {}, character?.config ?? [], input.character.name);
            validateFields(state.weapon ?? {}, weapon?.configs ?? [], input.weapon.name);
            return applyDslSegmentState(base, state);
        });
        configs.set(name, config);
    }

    const groups = new Map();
    for (const declaration of parsed.declarations) {
        const key = declaration.state;
        if (!groups.has(key)) groups.set(key, {config: configs.get(key), declarations: [], native: []});
        const group = groups.get(key);
        const prepared = prepareDeclaration(declaration, base, character, metadata.skillNames);
        if (prepared.kind === 'prop' && !prepared.panelKey) group.native.push(prepared);
        else group.declarations.push(prepared);
    }
    for (const group of groups.values()) {
        if (group.native.length) group.propertySource = nativePropertySource(group.native);
    }
    let expression;
    try {
        expression = new SegmentExpression(parsed.expressionSource);
    } catch (cause) {
        const message = cause.message ?? String(cause);
        const location = message.match(/(?:-->|at)\s+(\d+):(\d+)/);
        const reported = location ? {line: Number(location[1]), column: Number(location[2])} : position;
        throw segmentDslError('解析表达式', reported, message, cause);
    }

    return {
        evaluate(artifacts, requireResult = true) {
            const bindings = new Map();
            for (const group of groups.values()) {
                const config = {...group.config, artifacts};
                const hits = new Map();
                let panel;
                let transformative;
                if (group.native.length) {
                    const values = stage('读取属性', group.native[0].position,
                        () => readDslNativeValues(api, config, artifacts, group.propertySource));
                    group.native.forEach((declaration, i) => {
                        if (!Number.isFinite(values[i])) throw segmentDslError('读取属性', declaration.position, '属性值不是有限数 ' + declaration.member);
                        bindings.set(declaration.name, values[i]);
                    });
                }
                for (const {name, position, panelKey, skill, infusion, transformative: isTransformative, key} of group.declarations) {
                    const value = stage('结算 ' + name, position, () => {
                        if (panelKey) {
                            panel ??= api.CommonInterface.get_attribute(config);
                            return Object.values(panel[panelKey]).reduce((sum, part) => sum + part, 0);
                        }
                        if (isTransformative) {
                            transformative ??= {...api.CalculatorInterface.get_transformative_damage({...config, skill: transformativeSkill})};
                            return {transformative};
                        }
                        if (!hits.has(key)) {
                            const analysis = api.CalculatorInterface.get_damage_analysis({...config, skill}, infusion);
                            const results = Object.fromEntries(reactions.filter(reaction => analysis[reaction] != null)
                                .map(reaction => [reaction, analysis[reaction]]));
                            // Their legacy DSL also exposes the direct Stellar hit under normal.
                            const legacyNormal = results[legacyStellarNormal[config.character.name]];
                            if (legacyNormal) results.normal = legacyNormal;
                            hits.set(key, {damage: results});
                        }
                        return hits.get(key);
                    });
                    bindings.set(name, value);
                }
            }
            return stage('执行表达式', position, () => expression.evaluate(bindings, requireResult));
        },
        close() {expression.free();},
    };
}
