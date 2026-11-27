import {normalizeBonusInput} from './interface-contracts.mjs';
import {assertNoExplicitDamagePanel} from './lunar-context-facade.mjs';
import {searchSegmentBuilds} from './dsl-segment-search.mjs';
import {parseSegmentDsl} from './dsl-segment-source.mjs';
import {prepareDslSegmentTarget} from './dsl-segment-target.mjs';
import {rollValue, STATS} from '../src/algorithms/stat-gain/curve.mjs';

const statFields = {
    ATKFixed: 'atk', ATKPercentage: 'atk_percentage', DEFFixed: 'def', DEFPercentage: 'def_percentage',
    HPFixed: 'hp', HPPercentage: 'hp_percentage', CriticalRate: 'critical_rate',
    CriticalDamage: 'critical_damage', Recharge: 'recharge', ElementalMastery: 'elemental_mastery',
};
const emptyCarrier = {
    id: 0, set_name: 'Empty', slot: 'Flower', level: 0, star: 5, main_stat: ['HPFixed', 0], sub_stats: [],
};

function statGains(input, evaluate) {
    const baseline = evaluate(input.artifacts).result;
    if (baseline === 0) throw Error('当前逐段 DSL 目标的基准值为零，无法计算百分比收益');
    const [first = emptyCarrier, ...rest] = input.artifacts;
    return Object.fromEntries(STATS.map(stat => {
        const roll = rollValue(stat, 'max');
        const values = Array.from({length: 10}, (_, index) => {
            const sub_stats = [...first.sub_stats, [stat.key, roll * (index + 1)]];
            return evaluate([{...first, sub_stats}, ...rest]).result;
        });
        return [statFields[stat.key], values.some(value => value !== baseline)
            ? values.map(value => (value - baseline) / baseline) : []];
    }));
}

function segmentedSource(target) {
    return target?.use_dsl === true ? target.dsl_source : null;
}

export function withDslSegmentTargets(api, SegmentExpression, metadata) {
    function prepare(source, parsed, input) {
        assertNoExplicitDamagePanel(input);
        return prepareDslSegmentTarget(api, SegmentExpression, metadata, source, parsed, input);
    }

    function withTarget(source, parsed, input, run) {
        const target = prepare(source, parsed, input);
        try {
            return run(target.evaluate);
        } finally {
            target.close();
        }
    }

    const methods = {
        DSLInterface: {
            run(source, input, artifacts) {
                try {
                    const parsed = parseSegmentDsl(source);
                    if (parsed) {
                        const {output} = withTarget(source, parsed, input, evaluate => evaluate(artifacts, false));
                        return {is_error: false, error_msg: '', output};
                    }
                } catch (error) {
                    return {is_error: true, error_msg: error.message, output: ''};
                }
                return api.DSLInterface.run(source, input, artifacts);
            },
            prepareObjective(source, input) {
                const parsed = parseSegmentDsl(source);
                if (!parsed) return null;
                const target = prepare(source, parsed, input);
                return {evaluate: artifacts => target.evaluate(artifacts).result, close: target.close};
            },
        },
        OptimizeSingleWasm: {
            optimize(input, artifacts, onProgress) {
                const source = segmentedSource(input.target_function);
                const parsed = parseSegmentDsl(source);
                if (!parsed) return api.OptimizeSingleWasm.optimize(input, artifacts, onProgress);
                return withTarget(source, parsed, input, evaluate =>
                    searchSegmentBuilds(api, input, artifacts, build => evaluate(build).result, onProgress));
            },
        },
        BonusPerStat: {
            bonus_per_stat(input) {
                const source = segmentedSource(input.tf);
                const parsed = parseSegmentDsl(source);
                if (!parsed) return api.BonusPerStat.bonus_per_stat(input);
                const normalized = normalizeBonusInput(input);
                return withTarget(source, parsed, normalized, evaluate => statGains(normalized, evaluate));
            },
        },
    };

    return {...api, ...Object.fromEntries(Object.entries(methods).map(([name, overrides]) =>
        [name, new Proxy(api[name], {get: (target, method) =>
            Object.hasOwn(overrides, method) ? overrides[method] : Reflect.get(target, method)})]))};
}
