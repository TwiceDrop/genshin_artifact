import {optimizePanel} from '../../beta-data/panel-search.mjs';

export async function initializePanelOptimizeWorker(scope,loadMona,optimize=optimizePanel) {
    const start=Date.now();
    const fail=(error,phase)=>scope.postMessage({type:'error',error:{phase,name:error.name,message:error.message,stack:error.stack}});
    try {
        const api=await loadMona();
        scope.onmessage=({data})=>{
            try {
                const progress=value=>{if(data.progress)scope.postMessage({type:'progress',data:value});};
                if(data.debug)scope.postMessage({type:'debug',event:{phase:'panel-search-started',candidateCount:data.artifacts.length}});
                const results=optimize(api,data.optimizeConfig,data.artifacts,progress);
                scope.postMessage({type:'results',data:{results}});
            } catch(error) { fail(error,'optimization'); }
        };
        scope.postMessage({type:'ready',initializationMs:Date.now()-start});
    } catch(error) { fail(error,'initialization'); }
}
