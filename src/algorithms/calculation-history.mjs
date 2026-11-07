const copy=value=>JSON.parse(JSON.stringify(value));
export const historyKey=accountId=>`mona_account_calculation_history_${accountId}`;
const detailKey=(accountId,id)=>`${historyKey(accountId)}_${id}`;
export const calculationDuration=ms=>{const s=Math.max(0,Math.floor(ms/1000));return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;};
export const buildIds=build=>['flower','feather','sand','goblet','head'].map(key=>build[key]);
export function historyMembers(profiles,items,builds=profiles.map(p=>p.artifactIds||[])){
    return profiles.map((p,i)=>({character:copy(p.character),weapon:copy(p.weapon),buffs:copy(p.buffs||[]),artifacts:builds[i].map(id=>items[id]||null)}));
}

// A job owns its Worker lifetime independently of mounted calculator pages.
// Index rows contain display snapshots; full results are loaded only on demand.
export function createCalculationHistory({storage,state,notify=(_type,_message,_accountId)=>{}}){
    const loads=new Map(),writes=new Map(),details=new Map();
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
    async function persist(accountId,row,detail){
        const index=copy(state.accounts[accountId]),value=copy(detail);
        details.set(detailKey(accountId,row.id),value);
        try{await queue(accountId,async()=>{await storage.setItem(detailKey(accountId,row.id),value);await storage.setItem(historyKey(accountId),index);});}
        catch(error){row.storageError=error.message||String(error);notify('error',`计算历史保存失败：${row.storageError}`,accountId);}
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
                await load(metadata.accountId);
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
    return {load,read,start,cancel};
}
