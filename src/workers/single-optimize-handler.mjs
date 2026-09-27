// Explicit messages preserve validation errors across the Worker boundary.
export async function initializeSingleOptimizeWorker(scope, loadMona) {
    const started=Date.now()
    const fail = (error, phase) => scope.postMessage({type:'error',error:{phase,name:error?.name||'Error',message:error?.message||String(error),stack:error?.stack||null}})
    try {
        const mona = await loadMona()
        scope.onmessage = ({data}) => {
            const debug = event => { if(data.debug) scope.postMessage({type:'debug',event}) }
            const originalError=console.error, originalWarn=console.warn
            let logCount=0
            const logged = (level,original) => (...args) => {
                original.apply(console,args)
                if(logCount++<30){const message=args.map(x=>{try{return typeof x==='string'?x:JSON.stringify(x)}catch{return String(x)}}).join(' ').slice(0,8000);debug({phase:'kernel-console',level,message})}
            }
            if(data.debug){console.error=logged('error',originalError);console.warn=logged('warn',originalWarn)}
            try {
                debug({phase:'optimization-started',candidateCount:data.artifacts?.length,algorithm:data.optimizeConfig?.algorithm})
                const begin=Date.now()
                const results = mona.OptimizeSingleWasm.optimize(data.optimizeConfig, data.artifacts)
                debug({phase:'optimization-finished',elapsedMs:Date.now()-begin,resultCount:results?.length})
                scope.postMessage({type:'results',data:{results}})
            } catch (error) { fail(error,'optimization') }
            finally {console.error=originalError;console.warn=originalWarn}
        }
        scope.postMessage({type:'ready',initializationMs:Date.now()-started})
    } catch (error) { fail(error,'initialization') }
}
