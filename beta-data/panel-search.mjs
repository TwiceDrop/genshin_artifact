import {ARTIFACT_SLOTS, buildArtifactIds, compareArtifactBuildIds, createArtifactBuildTraversal, createTopResults} from './artifact-build-search.mjs';

export const PANEL_STATS = [
    {key:'hp', label:'生命值'}, {key:'atk', label:'攻击力'}, {key:'def', label:'防御力'},
    {key:'elemental_mastery', label:'元素精通'}, {key:'recharge', label:'元素充能效率', percent:true},
    {key:'critical', label:'暴击率', percent:true}, {key:'critical_damage', label:'暴击伤害', percent:true},
];
export const PANEL_SLOTS = ARTIFACT_SLOTS;
export const newPanelSearchOptions = () => ({metric:'critical_damage', direction:'desc', resultLimit:100, minArtifactLevel:16, bounds:{}});

// Read only named attribute compositions: facade metadata is not a stat.
// WASM maps can return sources in a different order between calls. Sum by
// source name so identical panels have identical comparisons at boundaries.
export function readPanel(api, input, artifacts) {
    const panel = api.CommonInterface.get_attribute({...input, artifacts});
    return Object.fromEntries(PANEL_STATS.map(({key}) => [key, Object.keys(panel[key]).sort().reduce((sum,source) => sum+panel[key][source], 0)]));
}

export function comparePanelBuilds(a, b, metric, direction = 'desc') {
    const difference = direction === 'desc' ? b.panel[metric]-a.panel[metric] : a.panel[metric]-b.panel[metric];
    return difference || compareArtifactBuildIds(a,b);
}

// The scalar reference search uses only set reachability pruning. It never
// assumes that a facade's panel is additive or monotone in artifact substats.
export function searchPanelBuilds(input, artifacts, evaluate, onProgress = () => {}, bound) {
    const {metric,direction,resultLimit,minArtifactLevel,bounds} = input.panel_search;
    const pools = PANEL_SLOTS.map(slot => artifacts.filter(a=>a.slot===slot&&!a.omit&&a.level>=minArtifactLevel));
    const mode=input.constraint?.set_mode;
    const required=mode?.Set4?[[mode.Set4,4]]:mode?.Set22?mode.Set22.map(name=>[name,2]):[];
    const traversal=createArtifactBuildTraversal(pools,required);
    const {candidateSpace}=traversal;
    const top=createTopResults(resultLimit,(a,b)=>comparePanelBuilds(a,b,metric,direction));
    let evaluated=0,covered=0,matched=0,prunedBySet=0,prunedByStats=0,prunedByRank=0,lastTime=Date.now(),lastCovered=0;
    const progress=(complete=false) => {
        const now=Date.now(),elapsed=now-lastTime;
        if (!complete&&elapsed<250) return;
        const rate=elapsed>0?(covered-lastCovered)/elapsed:0;
        onProgress({candidateSpace,evaluated,covered,matched,matchedIsExact:prunedByRank===0,prunedBySet,prunedByStats,prunedByRank,retained:top.size,
            remainingGroups:candidateSpace-covered,percent:complete?100:candidateSpace?covered/candidateSpace*100:0,
            searchStage:'enumeration',etaMs:complete?0:rate>0?(candidateSpace-covered)/rate:null,etaScope:'total'});
        lastTime=now;lastCovered=covered;
    };
    onProgress({candidateSpace,evaluated:0,covered:0,matched:0,retained:0,remainingGroups:candidateSpace,percent:0,etaMs:null,searchStage:'enumeration'});
    traversal.forEach({
        onSkipSet(count) { prunedBySet+=count;covered+=count;progress(); },
        prune: bound && ((domains,count) => {
            const ranges=bound(domains);
            const impossible=PANEL_STATS.some(({key})=>(bounds[key]?.min!=null&&ranges[key][1]<bounds[key].min)||(bounds[key]?.max!=null&&ranges[key][0]>bounds[key].max));
            const inferior=top.size===resultLimit&&(direction==='asc'?ranges[metric][0]>top.worst.value:ranges[metric][1]<top.worst.value);
            if (!impossible&&!inferior) return false;
            if(impossible)prunedByStats+=count;else prunedByRank+=count;
            covered+=count;progress();return true;
        }),
        onBuild(selected) {
            const panel=evaluate(selected);
            evaluated++;covered++;
            const fits=PANEL_STATS.every(({key}) => (bounds[key]?.min==null||panel[key]>=bounds[key].min)&&(bounds[key]?.max==null||panel[key]<=bounds[key].max));
            if (fits) {
                matched++;
                top.add({...buildArtifactIds(selected),panel,value:panel[metric]});
            }
            progress();
        },
    });
    progress(true);
    return top.finish();
}

export function optimizePanel(api,input,artifacts,onProgress) {
    return searchPanelBuilds(input,artifacts,build=>readPanel(api,input,build),onProgress);
}
