export const PANEL_STATS = [
    {key:'hp', label:'生命值'}, {key:'atk', label:'攻击力'}, {key:'def', label:'防御力'},
    {key:'elemental_mastery', label:'元素精通'}, {key:'recharge', label:'元素充能效率', percent:true},
    {key:'critical', label:'暴击率', percent:true}, {key:'critical_damage', label:'暴击伤害', percent:true},
];
export const PANEL_SLOTS = ['Flower','Feather','Sand','Goblet','Head'];
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
    if (difference) return difference;
    for (const slot of PANEL_SLOTS) {
        const difference = a[slot.toLowerCase()]-b[slot.toLowerCase()];
        if (difference) return difference;
    }
    return 0;
}

// A bounded heap, with the worst retained build at the root. Zero-valued
// results and ties are ranked by the same comparator used for the final list.
function createTopResults(limit, compare) {
    const heap = [];
    const swap = (a,b) => { [heap[a],heap[b]] = [heap[b],heap[a]]; };
    return {
        add(row) {
            if (heap.length < limit) {
                heap.push(row);
                let i=heap.length-1;
                while (i>0) {
                    const parent=(i-1)>>1;
                    if (compare(heap[i],heap[parent])<=0) break;
                    swap(i,parent);i=parent;
                }
            } else if (compare(row,heap[0])<0) {
                heap[0]=row;
                let i=0;
                while (2*i+1<heap.length) {
                    let child=2*i+1;
                    if (child+1<heap.length&&compare(heap[child+1],heap[child])>0) child++;
                    if (compare(heap[child],heap[i])<=0) break;
                    swap(child,i);i=child;
                }
            }
        },
        get size() { return heap.length; },
        get worst() { return heap[0]; },
        finish: () => heap.sort(compare),
    };
}

// The scalar reference search uses only set reachability pruning. It never
// assumes that a facade's panel is additive or monotone in artifact substats.
export function searchPanelBuilds(input, artifacts, evaluate, onProgress = () => {}, bound) {
    const {metric,direction,resultLimit,minArtifactLevel,bounds} = input.panel_search;
    const pools = PANEL_SLOTS.map(slot => artifacts.filter(a=>a.slot===slot&&!a.omit&&a.level>=minArtifactLevel));
    const order = pools.map((pool,index)=>({pool,index})).sort((a,b)=>a.pool.length-b.pool.length);
    const suffix = Array(6).fill(1);
    for (let i=4;i>=0;i--) suffix[i]=suffix[i+1]*order[i].pool.length;
    const mode=input.constraint?.set_mode;
    const required=mode?.Set4?[[mode.Set4,4]]:mode?.Set22?mode.Set22.map(name=>[name,2]):[];
    const selected=Array(5),counts=new Map();
    const domains=[...pools];
    const top=createTopResults(resultLimit,(a,b)=>comparePanelBuilds(a,b,metric,direction));
    let evaluated=0,covered=0,matched=0,prunedBySet=0,prunedByStats=0,prunedByRank=0,lastTime=Date.now(),lastCovered=0;
    const progress=(complete=false) => {
        const now=Date.now(),elapsed=now-lastTime;
        if (!complete&&elapsed<250) return;
        const rate=elapsed>0?(covered-lastCovered)/elapsed:0;
        onProgress({candidateSpace:suffix[0],evaluated,covered,matched,matchedIsExact:prunedByRank===0,prunedBySet,prunedByStats,prunedByRank,retained:top.size,
            remainingGroups:suffix[0]-covered,percent:complete?100:suffix[0]?covered/suffix[0]*100:0,
            searchStage:'enumeration',etaMs:complete?0:rate>0?(suffix[0]-covered)/rate:null,etaScope:'total'});
        lastTime=now;lastCovered=covered;
    };
    // Assign missing set pieces to distinct remaining slots. Counting each
    // set independently would miss conflicts between the two halves of 2+2.
    function reachable(depth) {
        const missing=required.map(([name,n])=>[name,Math.max(0,n-(counts.get(name)||0))]);
        function place(i,used) {
            if (i===missing.length) return true;
            const [name,count]=missing[i];
            function choose(start,left,mask) {
                if (!left) return place(i+1,mask);
                for (let j=start;j<=5-left;j++) if (!(mask&(1<<j))&&order[j].pool.some(a=>a.set_name===name)) {
                    if (choose(j+1,left-1,mask|(1<<j))) return true;
                }
                return false;
            }
            return choose(depth,count,used);
        }
        return place(0,0);
    }
    function visit(depth) {
        if (!reachable(depth)) { prunedBySet+=suffix[depth];covered+=suffix[depth];progress();return; }
        if (bound&&suffix[depth]) {
            const ranges=bound(domains);
            const impossible=PANEL_STATS.some(({key})=>(bounds[key]?.min!=null&&ranges[key][1]<bounds[key].min)||(bounds[key]?.max!=null&&ranges[key][0]>bounds[key].max));
            const inferior=top.size===resultLimit&&(direction==='asc'?ranges[metric][0]>top.worst.value:ranges[metric][1]<top.worst.value);
            if(impossible||inferior){
                if(impossible)prunedByStats+=suffix[depth];else prunedByRank+=suffix[depth];
                covered+=suffix[depth];progress();return;
            }
        }
        if (depth===5) {
            const panel=evaluate(selected);
            evaluated++;covered++;
            const fits=PANEL_STATS.every(({key}) => (bounds[key]?.min==null||panel[key]>=bounds[key].min)&&(bounds[key]?.max==null||panel[key]<=bounds[key].max));
            if (fits) {
                matched++;
                top.add({...Object.fromEntries(PANEL_SLOTS.map((slot,i)=>[slot.toLowerCase(),selected[i].id])),panel,value:panel[metric]});
            }
            progress();return;
        }
        const {pool,index}=order[depth];
        for (const artifact of pool) {
            selected[index]=artifact;
            domains[index]=[artifact];
            counts.set(artifact.set_name,(counts.get(artifact.set_name)||0)+1);
            visit(depth+1);
            counts.set(artifact.set_name,counts.get(artifact.set_name)-1);
        }
        domains[index]=pool;
    }
    onProgress({candidateSpace:suffix[0],evaluated:0,covered:0,matched:0,retained:0,remainingGroups:suffix[0],percent:0,etaMs:null,searchStage:'enumeration'});
    visit(0);progress(true);
    return top.finish();
}

export function optimizePanel(api,input,artifacts,onProgress) {
    return searchPanelBuilds(input,artifacts,build=>readPanel(api,input,build),onProgress);
}
