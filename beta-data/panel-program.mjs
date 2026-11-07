import {createNumericProgram,compactNumericProgram,executeNumericProgram,boundNumericProgram,intervalMath} from './team-dps-numeric-program.mjs';
import {createPortableNativeQuery} from './team-dps-native-query.mjs';
import {capturedNativeBackend,capturedTeamGraph} from './team-dps-graph-reader.mjs';
import {TEAM_PROGRAM_STATS} from './team-dps-program.mjs';
import {artifactProgramRow} from './team-dps-program-inputs.mjs';
import {PANEL_STATS,readPanel,searchPanelBuilds} from './panel-search.mjs';

// The single-character facade chooses its real native backend. TeamDPS's
// character package registry is not the list of supported single characters.
export function compilePanelProgram(api,input,artifacts,resources) {
    api.CommonInterface.get_attribute({...input,artifacts:[]});
    const nativeBackend=capturedNativeBackend();
    const sets=[...new Set(artifacts.map(a=>a.set_name))].filter(name=>name!=='Empty'&&new Set(artifacts.filter(a=>a.set_name===name).map(a=>a.slot)).size>=2);
    const builder=createNumericProgram(),stride=TEAM_PROGRAM_STATS.length+sets.length;
    const query=createPortableNativeQuery({...resources,api,builder,sets,capture:capturedTeamGraph,
        nativeBinding:()=>({nativeBackend}),
        stats:(_,name)=>builder.input(TEAM_PROGRAM_STATS.indexOf(name)),
        setCount:(_,name)=>builder.input(TEAM_PROGRAM_STATS.length+sets.indexOf(name)),
    });
    const panel=query.query(input,0,{},false);
    const program=compactNumericProgram(builder.finish(PANEL_STATS.map(({key})=>panel[key].compiled)));
    const rows=new Map(artifacts.map(a=>[a.id,artifactProgramRow(a,TEAM_PROGRAM_STATS,sets)]));
    function encode(build) {
        const values=new Float64Array(stride);
        for(const artifact of build){const row=rows.get(artifact.id);for(let i=0;i<stride;i++)values[i]+=row[i];}
        return values;
    }
    return {program,sets,stride,rows,nativeBackend,encode,
        evaluate:build=>{const values=executeNumericProgram(program,encode(build));return Object.fromEntries(PANEL_STATS.map(({key},i)=>[key,values[i]]));},
        bounds:inputs=>Object.fromEntries(boundNumericProgram(program,inputs).map((range,i)=>[PANEL_STATS[i].key,range])),
    };
}

// Cover all remaining artifact sums, including floating-point addition. Set
// counts are exact integers; scalar stats keep outward-rounded intervals.
export function panelInputBounds(compiled,domains,rangeCache=new WeakMap()) {
    const perSlot=domains.map(pool=>{
        if(rangeCache.has(pool))return rangeCache.get(pool);
        const ranges=Array.from({length:compiled.stride},(_,i)=>{
            const values=pool.map(a=>compiled.rows.get(a.id)[i]);
            return [Math.min(...values),Math.max(...values)];
        });
        rangeCache.set(pool,ranges);return ranges;
    });
    return Array.from({length:compiled.stride},(_,i)=>{
        const ranges=perSlot.map(row=>row[i]);
        if(i>=TEAM_PROGRAM_STATS.length)return [ranges.reduce((n,r)=>n+r[0],0),ranges.reduce((n,r)=>n+r[1],0)];
        let range=[0,0];
        for(const value of ranges)range=intervalMath.add(range,value);
        return range;
    });
}

export function optimizePanelWithBounds(api,input,artifacts,resources,onProgress=()=>{}) {
    const candidates=artifacts.filter(a=>!a.omit&&a.level>=input.panel_search.minArtifactLevel);
    onProgress({candidateSpace:null,evaluated:0,remainingGroups:null,percent:null,etaMs:null,searchStage:'panelCompile'});
    const compiled=compilePanelProgram(api,input,candidates,resources),cache=new WeakMap();
    // This score only changes visitation order; every artifact stays eligible.
    const scores=new Map(candidates.map(a=>[a.id,compiled.evaluate([a])[input.panel_search.metric]]));
    const sign=input.panel_search.direction==='asc'?1:-1;
    candidates.sort((a,b)=>sign*(scores.get(a.id)-scores.get(b.id))||a.id-b.id);
    return searchPanelBuilds(input,candidates,build=>readPanel(api,input,build),onProgress,
        domains=>compiled.bounds(panelInputBounds(compiled,domains,cache)));
}
