import {BUFF_RULE_SCHEMA} from './buff-rule-schema.mjs';
import {dslTokens} from './dsl-tokens.mjs';

const opening = new Map([['(', ')'], ['[', ']'], ['{', '}']]);
const literalTypes = {true: true, false: false, null: null};
const declarationKeywords = new Set(['buff', 'state', 'dmg', 'prop']);
const expressionPrefixes = new Set('=+-*/^<>!&|.,');
const stateFields = new Set(['buffs', 'character', 'weapon']);
const decimal = /\d+(?:\.\d*)?(?:[eE][+-]?\d+)?/y;
const segmentMarker = /@|\b(?:buff|state)\b/;
const skillOperators = new Map([
    ['||', [1, 'boolean', (a, b) => a || b]],
    ['&&', [2, 'boolean', (a, b) => a && b]],
    ['==', [3, 'equality', (a, b) => a === b]],
    ['!=', [3, 'equality', (a, b) => a !== b]],
    ['<', [4, 'number', (a, b) => Number(a < b)]],
    ['<=', [4, 'number', (a, b) => Number(a <= b)]],
    ['>', [4, 'number', (a, b) => Number(a > b)]],
    ['>=', [4, 'number', (a, b) => Number(a >= b)]],
    ['+', [5, 'number', (a, b) => a + b]],
    ['-', [5, 'number', (a, b) => a - b]],
    ['*', [6, 'number', (a, b) => a * b]],
    ['/', [6, 'number', (a, b) => a / b]],
    ['^', [7, 'number', (a, b) => a ** b]],
]);

function declarationAt(tokens, index) {
    const keyword = tokens[index];
    return keyword?.type === 'id' && declarationKeywords.has(keyword.value)
        && !expressionPrefixes.has(tokens[index - 1]?.value) && tokens[index + 1]?.type === 'id'
        && tokens[index + 2]?.value === '=' && tokens[index + 3]?.value !== '=';
}

function containsSegmentSyntax(tokens) {
    const stack = [];
    for (const [index, token] of tokens.entries()) {
        if (token.value === '@') return true;
        if (!stack.length && (token.value === 'buff' || token.value === 'state') && declarationAt(tokens, index)) {
            return true;
        }
        if (opening.has(token.value)) stack.push(opening.get(token.value));
        else if (token.value === stack.at(-1)) stack.pop();
    }
    return false;
}

export function segmentDslError(phase, position, reason, cause) {
    const error = new Error(
        '逐段 DSL ' + phase + '（第 ' + position.line + ' 行，第 ' + position.column + ' 列）：' + reason,
        {cause},
    );
    error.phase = phase;
    error.position = position;
    return error;
}

export function parseSegmentDsl(source) {
    if (typeof source !== 'string' || !segmentMarker.test(source)) return null;
    const tokens = dslTokens(source);
    if (!containsSegmentSyntax(tokens)) return null;

    let index = 0;
    const buffDefinitions = new Map();
    const stateDefinitions = new Map();
    const declarations = [];
    const declarationNames = new Set();
    const removed = [];

    function position(token) {
        const lines = source.slice(0, token?.start ?? source.length).split(/\r\n?|\n/);
        return {line: lines.length, column: [...lines.at(-1)].length + 1};
    }

    function fail(reason, token = tokens[index], cause) {
        throw segmentDslError('解析', position(token), reason, cause);
    }

    function accept(value) {
        if (tokens[index]?.value !== value) return false;
        index++;
        return true;
    }

    function expect(value) {
        if (!accept(value)) fail('应为 ' + value);
    }

    function identifier(label) {
        const token = tokens[index];
        if (token?.type !== 'id') fail('应为' + label);
        index++;
        return token;
    }

    function stringValue(token) {
        try {
            return JSON.parse(token.value);
        } catch (cause) {
            fail('字符串无效', token, cause);
        }
    }

    function list(open, close, readItem) {
        expect(open);
        const items = [];
        while (!accept(close)) {
            items.push(readItem());
            if (!accept(',')) {
                expect(close);
                break;
            }
        }
        return items;
    }

    function readObject(readField = readValue) {
        const names = new Set();
        const entries = list('{', '}', () => {
            const key = tokens[index];
            let name;
            if (key?.type === 'string') {
                name = stringValue(key);
                index++;
            } else {
                name = identifier('字段名').value;
            }
            if (names.has(name)) fail('重复字段 ' + name, key);
            names.add(name);
            expect(':');
            return [name, readField(name, key)];
        });
        return Object.fromEntries(entries);
    }

    function readNumber() {
        const negative = accept('-');
        const token = tokens[index];
        if (token?.type !== 'number') fail('应为数字');
        decimal.lastIndex = token.start;
        const match = decimal.exec(source);
        const end = token.start + match[0].length;
        while (tokens[index]?.end <= end) index++;
        if (tokens[index - 1]?.end !== end) fail('数字无效', token);
        const value = Number(match[0]);
        if (!Number.isFinite(value)) fail('数字必须为有限数值', token);
        return negative ? -value : value;
    }

    function readValue() {
        const token = tokens[index];
        if (token?.value === '{') return readObject();
        if (token?.value === '[') return list('[', ']', readValue);
        if (token?.value === '-' || token?.type === 'number') return readNumber();
        if (token?.type === 'string') {
            index++;
            return stringValue(token);
        }
        if (token?.type === 'id' && Object.hasOwn(literalTypes, token.value)) {
            index++;
            return literalTypes[token.value];
        }
        fail('应为常量值');
    }

    // The old DSL folds skill parameters before running the program. Keep
    // those constant expressions local to the declaration.
    function readSkillValue(minimum = 1) {
        const start = tokens[index];
        let value;
        if (accept('-')) {
            value = readSkillValue(skillOperators.get('^')[0]);
            if (typeof value !== 'number') fail('负号需要数字', start);
            value = -value;
        } else if (accept('(')) {
            value = readSkillValue();
            expect(')');
        } else {
            value = readValue();
        }

        while (tokens[index]?.type === 'symbol') {
            const token = tokens[index];
            const next = tokens[index + 1];
            const pair = token.end === next?.start && token.value + next.value;
            const operator = skillOperators.has(pair) ? pair : token.value;
            const spec = skillOperators.get(operator);
            if (!spec || spec[0] < minimum) break;

            const [precedence, type, apply] = spec;
            index += operator.length;
            const right = readSkillValue(operator === '^' ? precedence : precedence + 1);
            const numeric = typeof value === 'number';
            const compatible = typeof value === typeof right
                && (type === 'number' ? numeric : typeof value === 'boolean' || type === 'equality' && numeric);
            if (!compatible) fail('技能参数运算类型不匹配 ' + operator, token);
            if (operator === '/' && right === 0) fail('技能参数不能除以零', token);
            const result = apply(value, right);
            value = type === 'equality' && numeric ? Number(result) : result;
            if (typeof value === 'number' && !Number.isFinite(value)) fail('技能参数必须为有限数值', token);
        }
        return value;
    }

    function readBuff(alias) {
        if (buffDefinitions.has(alias.value)) fail('重复 BUFF 别名 ' + alias.value, alias);
        const rule = identifier('BUFF 规则名');
        if (!Object.hasOwn(BUFF_RULE_SCHEMA, rule.value)) fail('未知 BUFF 规则 ' + rule.value, rule);
        expect('(');
        const params = readObject();
        expect(')');
        const config = BUFF_RULE_SCHEMA[rule.value].fields.length || Object.keys(params).length
            ? {[rule.value]: params}
            : 'NoConfig';
        buffDefinitions.set(alias.value, {
            input: {name: rule.value, config},
            position: position(alias),
        });
    }

    function readState(name) {
        if (stateDefinitions.has(name.value)) fail('重复状态 ' + name.value, name);
        const fields = readObject((field, key) => {
            if (!stateFields.has(field)) fail('未知状态字段 ' + field, key);
            if (field === 'buffs') return list('[', ']', () => identifier('BUFF 别名'));
            return readObject();
        });
        if (!Object.hasOwn(fields, 'buffs')) fail('状态 ' + name.value + ' 缺少 buffs 列表', name);
        stateDefinitions.set(name.value, {...fields, position: position(name)});
    }

    function readDeclaration(keyword, name) {
        if (declarationNames.has(name.value)) fail('重复声明 ' + name.value, name);
        declarationNames.add(name.value);
        const character = identifier('角色标识').value;
        expect('.');
        const member = identifier(keyword.value === 'dmg' ? '技能标识' : '属性标识').value;
        let params = {};
        if (keyword.value === 'dmg' && accept('(')) {
            if (!accept(')')) {
                params = readObject(() => readSkillValue());
                expect(')');
            }
        }
        const declarationSource = source.slice(keyword.start, tokens[index - 1].end);
        const state = accept('@') ? identifier('状态名') : null;
        declarations.push({
            kind: keyword.value,
            name: name.value,
            character,
            member,
            state: state?.value ?? null,
            statePosition: state && position(state),
            params,
            source: declarationSource,
            position: position(keyword),
        });
    }

    const stack = [];
    while (index < tokens.length) {
        const token = tokens[index];
        if (!stack.length && declarationAt(tokens, index)) {
            const keyword = token;
            index++;
            const name = identifier('声明名称');
            expect('=');
            if (keyword.value === 'buff') readBuff(name);
            else if (keyword.value === 'state') readState(name);
            else readDeclaration(keyword, name);
            removed.push([keyword.start, tokens[index - 1].end]);
            continue;
        }
        if (token.value === '@') fail('状态标记应放在 dmg 或 prop 声明末尾', token);
        if (opening.has(token.value)) stack.push(opening.get(token.value));
        else if (token.value === stack.at(-1)) stack.pop();
        index++;
    }

    const states = new Map();
    for (const [name, state] of stateDefinitions) {
        const buffs = state.buffs.map(alias => {
            const buff = buffDefinitions.get(alias.value);
            if (!buff) fail('状态 ' + name + ' 引用了未声明的 BUFF 别名 ' + alias.value, alias);
            return buff.input;
        });
        states.set(name, {...state, buffs});
    }
    for (const declaration of declarations) {
        if (declaration.state !== null && !states.has(declaration.state)) {
            throw segmentDslError('解析', declaration.statePosition,
                '声明 ' + declaration.name + ' 引用了未声明的状态 ' + declaration.state);
        }
    }

    // Leave every other statement for the MONA VM. Preserve its line and
    // column offsets so errors in the expression still refer to the script.
    let expressionSource = '';
    let start = 0;
    for (const [from, to] of removed) {
        expressionSource += source.slice(start, from);
        expressionSource += source.slice(from, to).replace(/[^\r\n]/gu, ' ');
        start = to;
    }
    expressionSource += source.slice(start);
    return {buffs: buffDefinitions, states, declarations, expressionSource};
}
