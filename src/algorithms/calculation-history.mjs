const copy=value=>JSON.parse(JSON.stringify(value));
export const historyKey=accountId=>`mona_account_calculation_history_${accountId}`;
const detailKey=(accountId,id)=>`${historyKey(accountId)}_${id}`;
const terminalStatuses=new Set(['completed','failed','cancelled','interrupted']);
const summaryFields=['kind','label','status','startedAt','finishedAt','elapsedMs','members','axisFileName','totalDamage','dps','axisDuration','error'];
const syncSummary=row=>copy(Object.fromEntries(summaryFields.filter(key=>row[key]!==undefined).map(key=>[key,row[key]])));
const canonical=value=>value&&typeof value==='object'?(Array.isArray(value)?value.map(canonical):Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]))):value;
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const busyError=()=>Object.assign(new Error('当前账号正在计算，历史同步将在计算结束后继续'),{code:'HISTORY_BUSY'});
export const calculationDuration=ms=>{const s=Math.max(0,Math.floor(ms/1000));return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;};
export const buildIds=build=>['flower','feather','sand','goblet','head'].map(key=>build[key]);
export function historyMembers(profiles,items,builds=profiles.map(p=>p.artifactIds||[])){
    return profiles.map((p,i)=>({character:copy(p.character),weapon:copy(p.weapon),buffs:copy(p.buffs||[]),artifacts:builds[i].map(id=>items[id]||null)}));
}

// A job owns its Worker lifetime independently of mounted calculator pages.
// Index rows contain display snapshots; full results are loaded only on demand.
export function createCalculationHistory({storage,state,notify=(_type,_message,_accountId)=>{}}){
    const loads=new Map(),writes=new Map(),details=new Map(),storageErrors=new Map(),dirtySyncIds=new Set();
    let activeJob=null;
    const queue=(accountId,write)=>{
        const pending=(writes.get(accountId)||Promise.resolve()).then(write);
        // Ordering barrier only: callers retain/report the original rejection.
        writes.set(accountId,pending.then(()=>undefined,()=>undefined));
        return pending;
    };
    async function load(accountId){
        if(!loads.has(accountId)){
            const pending=(async()=>{
                const saved=await storage.getItem(historyKey(accountId))||{nextId:1,entries:[]};
                for(const row of saved.entries)if(row.status==='running')row.status='interrupted';
                state.accounts[accountId]=saved;
                return saved;
            })();
            loads.set(accountId,pending);
            pending.catch(()=>loads.delete(accountId));
        }
        return loads.get(accountId);
    }
    async function flush(accountId){
        await loads.get(accountId);
        let pending=writes.get(accountId);
        while(pending){await pending;if(pending===writes.get(accountId))break;pending=writes.get(accountId);}
        if(storageErrors.has(accountId))throw storageErrors.get(accountId);
    }
    async function invalidate(accountId){
        if(activeJob?.accountId===accountId)throw busyError();
        await flush(accountId);
        if(activeJob?.accountId===accountId)throw busyError();
        loads.delete(accountId);delete state.accounts[accountId];
        const prefix=`${historyKey(accountId)}_`;
        for(const key of details.keys())if(key.startsWith(prefix))details.delete(key);
    }
    async function exportSync(accountId){
        await load(accountId);await flush(accountId);
        await queue(accountId,async()=>{
            const account=state.accounts[accountId];
            const rows=account.entries.filter(row=>terminalStatuses.has(row.status)&&!row.syncId);
            if(!rows.length&&!dirtySyncIds.has(accountId))return;
            dirtySyncIds.add(accountId);
            for(const row of rows)row.syncId=crypto.randomUUID();
            await storage.setItem(historyKey(accountId),copy(account));
            dirtySyncIds.delete(accountId);
        });
        const rows=copy(state.accounts[accountId].entries.filter(row=>terminalStatuses.has(row.status)));
        const result=[];
        for(const row of rows){
            const detail=await read(accountId,row.id);
            if(detail==null)throw new Error(`计算历史 ${row.id} 缺少正文`);
            result.push({syncId:row.syncId,summary:syncSummary(row),detail:copy(detail)});
        }
        return result;
    }
    async function importSync(accountId,entries,{assertCurrent=()=>{},beforeWrite=()=>{}}={}){
        if(activeJob?.accountId===accountId)throw busyError();
        await load(accountId);await flush(accountId);
        return queue(accountId,async()=>{
            await assertCurrent();
            if(activeJob?.accountId===accountId)throw busyError();
            const account=copy(state.accounts[accountId]),existing=new Map(account.entries.filter(row=>row.syncId).map(row=>[row.syncId,row]));
            const additions=[],updates=[],newDetails=new Map();
            for(const entry of entries){
                const summary=syncSummary(entry.summary);
                if(!terminalStatuses.has(summary.status))throw Object.assign(new Error('云端历史记录尚未结束'),{code:'HISTORY_NOT_TERMINAL'});
                const previous=existing.get(entry.syncId);
                if(previous){
                    const key=detailKey(accountId,previous.id),detail=newDetails.has(key)?newDetails.get(key):details.has(key)?details.get(key):await storage.getItem(key);
                    if(!same(syncSummary(previous),summary)||!same(detail,entry.detail))throw Object.assign(new Error(`历史记录 ${entry.syncId} 的内容冲突`),{code:'HISTORY_CONFLICT',syncId:entry.syncId});
                    continue;
                }
                const row={...summary,id:account.nextId++,accountId,syncId:entry.syncId};
                const value=copy(entry.detail),key=detailKey(accountId,row.id);
                existing.set(entry.syncId,row);additions.push(row);updates.push([key,value]);newDetails.set(key,value);
            }
            if(!additions.length)return {imported:0};
            account.entries=[...additions,...account.entries].sort((a,b)=>b.startedAt-a.startedAt||b.id-a.id);
            await assertCurrent();
            await storage.batch([...updates,[historyKey(accountId),account]],[],{source:'cloud-history',beforeWrite});
            state.accounts[accountId]=account;loads.set(accountId,Promise.resolve(account));
            for(const [key,value]of updates)details.set(key,value);
            return {imported:additions.length};
        });
    }
    async function persist(accountId,row,detail){
        const index=copy(state.accounts[accountId]),value=copy(detail);
        details.set(detailKey(accountId,row.id),value);
        try{await queue(accountId,async()=>{await storage.setItem(detailKey(accountId,row.id),value);await storage.setItem(historyKey(accountId),index);});storageErrors.delete(accountId);}
        catch(error){storageErrors.set(accountId,error);row.storageError=error.message||String(error);notify('error',`计算历史保存失败：${row.storageError}`,accountId);}
    }
    async function read(accountId,id){
        await load(accountId);await writes.get(accountId);
        return details.get(detailKey(accountId,id))||storage.getItem(detailKey(accountId,id));
    }
    function start(metadata,initialDetail,execute){
        if(activeJob)throw new Error('当前有计算线程正在进行');
        const controller=new AbortController(),job={controller,accountId:metadata.accountId,id:null};
        activeJob=job;state.active={accountId:metadata.accountId,id:null,kind:metadata.kind};
        job.promise=(async()=>{
            let row;
            try{
                await load(metadata.accountId);await writes.get(metadata.accountId);
                const account=state.accounts[metadata.accountId];
                job.id=account.nextId++;
                account.entries.unshift({...copy(metadata),id:job.id,status:'running',startedAt:Date.now(),elapsedMs:0,progress:null});
                row=account.entries[0];state.active.id=job.id;
                await persist(metadata.accountId,row,initialDetail);
                if(controller.signal.aborted)throw new DOMException('计算已取消','AbortError');
                const value=await execute({signal:controller.signal,onProgress:progress=>{row.progress=copy(progress);row.elapsedMs=Date.now()-row.startedAt;}});
                if(controller.signal.aborted)throw new DOMException('计算已取消','AbortError');
                Object.assign(row,copy(value.summary||{}),{status:'completed',finishedAt:Date.now(),elapsedMs:Date.now()-row.startedAt});
                await persist(metadata.accountId,row,value.detail);
                notify('success',`${row.label} ${row.kind==='single'?'单次计算':'多人配装计算'} 已完成 用时：${calculationDuration(row.elapsedMs)}`,metadata.accountId);
                return {entry:row,detail:value.detail};
            }catch(error){
                if(row){Object.assign(row,{status:error.name==='AbortError'?'cancelled':'failed',error:error.message||String(error),finishedAt:Date.now(),elapsedMs:Date.now()-row.startedAt});await persist(metadata.accountId,row,initialDetail);}
                throw error;
            }finally{if(activeJob===job){activeJob=null;state.active=null;}}
        })();
        return job;
    }
    function cancel(accountId,id){if(activeJob?.accountId===accountId&&activeJob.id===id)activeJob.controller.abort();}
    return {load,read,start,cancel,flush,invalidate,exportSync,importSync};
}
