import test from 'node:test';
import assert from 'node:assert/strict';
import {PANEL_STATS,PANEL_SLOTS,newPanelSearchOptions,readPanel,optimizePanel,searchPanelBuilds} from '../beta-data/panel-search.mjs';
import {api,vesna} from '../beta-tools/runtime-7106.mjs';
import {fixture,weapon} from '../beta-tools/interface-audit-7108.mjs';
import {initializePanelOptimizeWorker} from '../src/workers/panel-optimize-handler.mjs';
import {runSingleOptimizeWorker} from '../src/wasm/single-optimize-task.mjs';

const inventory=PANEL_SLOTS.flatMap((slot,i)=>[0,1].map(n=>({id:10*i+n+1,slot,set_name:n?'WanderersTroupe':'GladiatorsFinale',star:5,level:20,
    main_stat:[i===0?'HPFixed':i===1?'ATKFixed':'ATKPercentage',i===0?4780:i===1?311:.466],sub_stats:[['CriticalRate',.03*n],['CriticalDamage',.07*(1-n)],['ElementalMastery',20*n],['Recharge',.05*n]]})));
function allBuilds(artifacts) {
    const pools=PANEL_SLOTS.map(s=>artifacts.filter(a=>a.slot===s)),out=[];
    for(const a of pools[0])for(const b of pools[1])for(const c of pools[2])for(const d of pools[3])for(const e of pools[4])out.push([a,b,c,d,e]);
    return out;
}
function expected(rows,mode,options) {
    return rows.filter(({build,panel})=>{
        const count=name=>build.filter(a=>a.set_name===name).length;
        if(mode?.Set4&&count(mode.Set4)<4)return false;
        if(mode?.Set22&&!mode.Set22.every(name=>count(name)>=2))return false;
        return PANEL_STATS.every(({key})=>(options.bounds[key]?.min==null||panel[key]>=options.bounds[key].min)&&(options.bounds[key]?.max==null||panel[key]<=options.bounds[key].max));
    }).sort((a,b)=>{
        const score=(options.direction==='asc'?1:-1)*(a.panel[options.metric]-b.panel[options.metric]);
        if(score)return score;
        for(let i=0;i<5;i++)if(a.build[i].id!==b.build[i].id)return a.build[i].id-b.build[i].id;
        return 0;
    }).slice(0,options.resultLimit).map(({build,panel})=>({...Object.fromEntries(build.map(a=>[a.slot.toLowerCase(),a.id])),panel,value:panel[options.metric]}));
}

test('precise top K and set reachability agree with independent 32-build enumeration',()=>{
    const panel=build=>Object.fromEntries(PANEL_STATS.map(({key},i)=>[key,build.reduce((n,a)=>n+((a.id+i)%3),0)]));
    const rows=allBuilds(inventory).map(build=>({build,panel:panel(build)}));
    const modes=['Any',{Set4:'GladiatorsFinale'},{Set22:['GladiatorsFinale','WanderersTroupe']}];
    for(const metric of ['hp','critical_damage'])for(const direction of ['asc','desc'])for(const mode of modes){
        const options={...newPanelSearchOptions(),metric,direction,resultLimit:7,bounds:{recharge:{min:4,max:6},hp:{max:7}}},events=[];
        const actual=searchPanelBuilds({panel_search:options,constraint:{set_mode:mode}},[...inventory].reverse(),panel,p=>events.push(p));
        assert.deepEqual(actual,expected(rows,mode,options));
        assert.equal(events.at(-1).covered,32);assert.equal(events.at(-1).percent,100);
    }
    const zero=()=>Object.fromEntries(PANEL_STATS.map(({key})=>[key,0]));
    const options={...newPanelSearchOptions(),resultLimit:100,bounds:{hp:{min:0,max:0}}};
    const tied=searchPanelBuilds({panel_search:options,constraint:{set_mode:{Set4:'GladiatorsFinale'}}},[...inventory].reverse(),zero);
    assert.equal(tied.length,6); // Five possible off-pieces and five-of-a-kind.
    assert.deepEqual(tied.map(r=>PANEL_SLOTS.map(s=>r[s.toLowerCase()])),[[1,11,21,31,41],[1,11,21,31,42],[1,11,21,32,41],[1,11,22,31,41],[1,12,21,31,41],[2,11,21,31,41]]);
    assert.deepEqual(searchPanelBuilds({panel_search:options},inventory.filter(a=>a.slot!=='Head'),zero),[]);
    const filtered=inventory.map(a=>({...a,omit:a.id===1,level:a.id===11?0:a.level}));
    assert.equal(searchPanelBuilds({panel_search:options},filtered,zero).length,8);
});

test('seven field rankings use real legacy and extension public panels, including EM conversion',()=>{
    const legacy=fixture('Kaeya');legacy.weapon=weapon('XiphosMoonlight');
    const without=readPanel(api,legacy,inventory.filter(a=>a.id%10===1));
    const withEM=readPanel(api,legacy,inventory.filter(a=>a.id===2||a.id>2&&a.id%10===1));
    assert.equal(withEM.elemental_mastery-without.elemental_mastery,20);
    assert.ok(Math.abs(withEM.recharge-without.recharge-(.05+20*.00036))<1e-12);
    const extended=structuredClone(vesna);
    for(const input of [legacy,extended]) {
        const {target_function,skill,...base}=input; // Panel queries do not select a damage target.
        const candidates=input===extended?inventory.map(a=>({...a,set_name:'GladiatorsFinale'})):inventory;
        const rows=allBuilds(candidates).map(build=>{
            const panel=api.CommonInterface.get_attribute({...base,artifacts:build});
            return {build,panel:Object.fromEntries(PANEL_STATS.map(({key})=>[key,Object.entries(panel[key]).sort(([a],[b])=>a<b?-1:a>b?1:0).reduce((sum,[,value])=>sum+value,0)]))};
        });
        for(const {key:metric} of PANEL_STATS) {
            const options={...newPanelSearchOptions(),metric,resultLimit:5,bounds:{critical:{min:rows[0].panel.critical},recharge:{max:rows.at(-1).panel.recharge}}};
            const results=optimizePanel(api,{...base,panel_search:options,constraint:{set_mode:'Any'}},candidates);
            assert.deepEqual(results,expected(rows,'Any',options));
        }
        const repeated=readPanel(api,base,rows[0].build);
        assert.deepEqual(repeated,rows[0].panel);
    }
});

test('panel worker protocol reports real results/errors and cancellation releases its worker',async()=>{
    const {target_function,skill,...input}=fixture('Kaeya');input.panel_search=newPanelSearchOptions();
    let controller;
    const scope={postMessage(data){queueMicrotask(()=>worker.onmessage?.({data}));}};
    const worker={postMessage(data){queueMicrotask(()=>scope.onmessage({data}));},terminate(){this.terminated=true;}};
    const events=[],pending=runSingleOptimizeWorker(worker,input,inventory,{onProgress:p=>events.push(p)});
    await initializePanelOptimizeWorker(scope,async()=>api);
    const results=await pending;
    assert.equal(results.length,32);assert.equal(events.at(-1).evaluated,32);assert.equal(worker.terminated,true);
    const messages=[];
    await initializePanelOptimizeWorker({postMessage:m=>messages.push(m)},async()=>{throw Error('panel kernel unavailable');});
    assert.equal(messages[0].type,'error');assert.equal(messages[0].error.message,'panel kernel unavailable');
    controller=new AbortController();const idle={postMessage(){},terminate(){this.terminated=true;}};
    const cancelled=runSingleOptimizeWorker(idle,input,inventory,{signal:controller.signal});controller.abort();
    await assert.rejects(cancelled,{name:'AbortError'});assert.equal(idle.terminated,true);
});
