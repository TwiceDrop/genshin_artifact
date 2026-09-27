// Debug records stay in page memory until the user explicitly downloads them.
const copy = value => JSON.parse(JSON.stringify(value))
export function createOptimizationDebug({version,environment}) {
    const started = Date.now()
    const record = {schema:'mona-optimization-debug/v1',version,createdAt:new Date(started).toISOString(),status:'preparing',environment,summary:null,input:null,artifacts:[],events:[],error:null}
    return {
        record,
        capture(input,artifacts,filters) {
            record.input=copy(input);record.artifacts=copy(artifacts)
            const slots={},sets={}
            for(const a of artifacts){slots[a.slot]=(slots[a.slot]||0)+1;sets[a.set_name]=(sets[a.set_name]||0)+1}
            record.summary={candidateCount:artifacts.length,slots,sets,filters:copy(filters)}
        },
        event(event){if(record.events.length<150)record.events.push({elapsedMs:Date.now()-started,...copy(event)})},
        fail(error){record.status='failed';record.error={name:error?.name||'Error',message:error?.message||String(error),stack:error?.stack||null};record.finishedAt=new Date().toISOString()},
        complete(results){record.status='completed';record.resultSummary={count:results.length,top:copy(results.slice(0,5))};record.finishedAt=new Date().toISOString()}
    }
}
