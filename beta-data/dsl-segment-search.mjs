import {ARTIFACT_SLOTS, buildArtifactIds, compareArtifactBuildIds, createArtifactBuildTraversal, createTopResults} from './artifact-build-search.mjs';
import {beginOptimizationProgress, reportOptimizationEnumeration} from './optimizer-progress.mjs';
import {PANEL_STATS, readPanel} from './panel-search.mjs';

const MAIN_STAT_FILTERS = {Sand: 'sand_main_stat', Goblet: 'goblet_main_stat', Head: 'head_main_stat'};
const ATTRIBUTE_MINIMUMS = {
    hp_min: 'hp', atk_min: 'atk', def_min: 'def', recharge_min: 'recharge',
    crit_min: 'critical', crit_dmg_min: 'critical_damage',
};
const RESULT_LIMIT = 100;

function requiredSets(mode) {
    if (mode?.Set4) return [[mode.Set4, 4]];
    if (mode?.Set2) return [[mode.Set2, 2]];
    if (!mode?.Set22) return [];
    const [first, second] = mode.Set22;
    return first === second ? [[first, 4]] : [[first, 2], [second, 2]];
}

function satisfiesMinimums(panel, minimums) {
    return minimums.every(([attribute, minimum]) => {
        const value = attribute === 'critical' ? Math.max(0, Math.min(1, panel.critical)) : panel[attribute];
        return value >= minimum;
    });
}

export function searchSegmentBuilds(api, input, artifacts, evaluate, onProgress) {
    const {constraint, filter, target_function, ...base} = input;
    const pools = ARTIFACT_SLOTS.map(slot => {
        const mainStats = filter?.[MAIN_STAT_FILTERS[slot]];
        return artifacts.filter(artifact => artifact.slot === slot && (!mainStats?.length || mainStats.includes(artifact.main_stat[0])));
    });
    const minimums = Object.entries(ATTRIBUTE_MINIMUMS)
        .filter(([field]) => constraint?.[field] != null)
        .map(([field, attribute]) => [attribute, constraint[field]]);
    const maximums = PANEL_STATS.filter(({key}) => constraint?.panel_max?.[key] != null);
    const needsPanel = minimums.length || maximums.length;
    // The published panel and DSL include reaction-only mastery. The native
    // constraint alone reads base mastery, so give it just this five-piece
    // build and a positive constant target. The emitted score is discarded.
    const masteryCheck = constraint?.em_min > 0 ? {...base,
        algorithm: 'Naive', filter: null, constraint: {set_mode: 'Any', em_min: constraint.em_min},
        target_function: {...target_function, dsl_source: 'result = 1'},
    } : null;
    const traversal = createArtifactBuildTraversal(pools, requiredSets(constraint?.set_mode));
    const {candidateSpace} = traversal;
    const results = createTopResults(RESULT_LIMIT, (a, b) => b.value - a.value || compareArtifactBuildIds(a, b));
    let evaluated = 0;
    let covered = 0;
    const report = () => reportOptimizationEnumeration(candidateSpace, covered, evaluated);

    // Whole-target conditions and comparisons can reverse the order of builds.
    // Only set reachability prunes partial builds, and every eligible build is scored.
    const progress = maximums.length && onProgress ? beginOptimizationProgress(input, artifacts, onProgress) : null;
    try {
        report();
        traversal.forEach({
            onSkipSet(count) { covered += count; report(); },
            onBuild(build) {
                covered++;
                const panel = needsPanel ? readPanel(api, base, build) : null;
                if (satisfiesMinimums(panel, minimums)
                    && maximums.every(({key}) => panel[key] <= constraint.panel_max[key])
                    && (!masteryCheck || api.OptimizeSingleWasm.optimize(masteryCheck, build).length)) {
                    const value = evaluate(build);
                    evaluated++;
                    results.add({...buildArtifactIds(build), value});
                }
                report();
            },
        });
        progress?.complete();
    } finally {
        progress?.dispose();
    }

    const ranked = results.finish();
    const best = ranked[0]?.value;
    return ranked.map(row => ({...row, ratio: best > 0 ? row.value / best : null}));
}
