export async function syncHistory({history,accountId,request,profileId,metadata={},onMetadata=async()=>{},assertCurrent=()=>{},beforeWrite=()=>{}}){
    const known=new Set(metadata.uploaded||[]);
    let cursor=metadata.cursor||0,uploaded=0,downloaded=0;
    const base=`/v1/profiles/${encodeURIComponent(profileId)}/history`;
    const snapshot=()=>({cursor,uploaded:[...known]});
    async function checkpoint(){await assertCurrent();await onMetadata(snapshot());}
    let hasMore=true;
    while(hasMore){
        await assertCurrent();
        const page=await request(`${base}?limit=100&after=${encodeURIComponent(cursor)}`,{method:'GET'});
        await assertCurrent();
        for(const item of page.entries){
            const {entry}=await request(`${base}/${encodeURIComponent(item.syncId)}`,{method:'GET'});
            await assertCurrent();
            const result=await history.importSync(accountId,[entry],{assertCurrent,beforeWrite});
            downloaded+=result.imported;
            known.add(entry.syncId);cursor=entry.sequence;
            await checkpoint();
        }
        hasMore=page.nextCursor!==null;
    }
    await assertCurrent();
    const local=await history.exportSync(accountId);
    for(const entry of local){
        if(known.has(entry.syncId))continue;
        await assertCurrent();
        await request(base,{method:'POST',body:entry});
        await assertCurrent();
        known.add(entry.syncId);uploaded++;
        await checkpoint();
    }
    return {metadata:snapshot(),uploaded,downloaded};
}
