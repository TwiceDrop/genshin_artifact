import test from 'node:test'
import {roundingBuild} from './fixtures/dynamic-score-rounding.mjs'
import assert from 'node:assert/strict'
import {SLOTS,MAIN,ROLLS,displayValue,isFlat,seedPiece,toArtifact,inferPiece,validatePiece,neighbors,normalizeBuild,clone} from '../src/algorithms/artifact-score/rules.mjs'
import {normalizeGain,shapley,pieceEfficiency} from '../src/algorithms/artifact-score/metrics.mjs'
import {enumerateOptimum} from '../src/algorithms/artifact-score/search.mjs'
import {createDynamicScoreService} from '../src/algorithms/artifact-score/service.mjs'
import {canonical,referenceKey,createScoreCache} from '../src/algorithms/artifact-score/cache.mjs'
import {createScoreWorkerClient} from '../src/algorithms/artifact-score/worker-client.mjs'

const mains=['HPFixed','ATKFixed','Recharge','PyroBonus','CriticalDamage']
const pieces=SLOTS.map((slot,i)=>seedPiece({slot,set_name:'GladiatorsFinale',main_stat:[mains[i],MAIN[mains[i]]]},i))
const gear=pieces.map(toArtifact)
const sum=(build,key)=>build.reduce((n,a)=>n+a.sub_stats.filter(t=>t[0]===key).reduce((s,t)=>s+t[1],0),0)
const request={input:{artifacts:gear,character:{name:'synthetic',constellation:0},weapon:{name:'fixture',refine:1},buffs:[]},basis:'A',objective:{kind:'skill',reaction:'normal'},sets:['GladiatorsFinale'],search:{passes:12}}

test('legal roll histories include 8/9 contributions, four tiers, per-slot mains and conflicts',()=>{
    for(const p of pieces) {
        assert.equal(p.lines.reduce((n,line)=>n+line.tiers.length,0),9)
        assert.doesNotThrow(()=>inferPiece(toArtifact(p)))
        // Check the actual generated neighborhood, including replacing a main.
        for(const next of neighbors(p,{mainStats:true})){validatePiece(next);inferPiece(toArtifact(next))}
    }
    const three=seedPiece(pieces[0],0,3)
    assert.equal(three.lines.reduce((n,line)=>n+line.tiers.length,0),8); assert.deepEqual(toArtifact(inferPiece(toArtifact(three))).sub_stats,toArtifact(three).sub_stats)
    assert.equal(toArtifact({...pieces[0],lines:[{key:'CriticalRate',tiers:[3,3,3,3,3,3]},{key:'CriticalDamage',tiers:[3]},{key:'ATKPercentage',tiers:[3]},{key:'Recharge',tiers:[3]}]}).sub_stats[0][1],.233)
    assert.throws(()=>validatePiece({...pieces[0],lines:pieces[0].lines.map((line,i)=>i?line:{key:'HPFixed',tiers:line.tiers})}),/同名/)
    assert.throws(()=>inferPiece({...gear[0],sub_stats:[['CriticalRate',.9],['CriticalDamage',.9],['ATKPercentage',.9],['Recharge',.9]]}),/8／9/)
    assert.throws(()=>normalizeBuild([...gear.slice(0,4),gear[0]]),/不同/)
    assert.equal(ROLLS.CriticalDamage[2],.0699)
})

test('independent analytic and complete finite-domain oracle: two-stat product, cap and nonmonotone threshold',()=>{
    const domains=pieces.map(p=>[p])
    for(let i=0;i<2;i++)domains[i]=Array.from({length:6},(_,j)=>({...pieces[i],initial:4,lines:[
        {key:'CriticalRate',tiers:Array(j+1).fill(3)},{key:'CriticalDamage',tiers:Array(6-j).fill(3)},
        {key:'ATKPercentage',tiers:[3]},{key:'Recharge',tiers:[3]}]}))
    const evaluate=build=>{
        const x=Math.round(sum(build.slice(0,2),'CriticalRate')/.0389)
        const y=Math.round(sum(build.slice(0,2),'CriticalDamage')/.0777)
        return 100*(1+x*y)
    }
    const result=enumerateOptimum(domains,{evaluate})
    assert.equal(result.evaluations,36)
    // x+y=14 => xy <= 49, attained at x=y=7. Derived independently.
    assert.equal(result.best.damage,5000)
    const capped=build=>Math.min(3,Math.round(sum(build.slice(0,2),'CriticalRate')/.0389))
    assert.equal(enumerateOptimum(domains,{evaluate:capped}).best.damage,3)
    const threshold=build=>Math.round(sum(build.slice(0,2),'CriticalRate')/.0389)===9?1000:0
    assert.equal(enumerateOptimum(domains,{evaluate:threshold}).best.damage,1000)
    assert.equal(result.certified,true)
})

test('increment normalization, exact Shapley efficiency, LOO double counting and undefined boundaries',()=>{
    const build=[{sub_stats:[['x',1]]},{sub_stats:[['x',2]]},{sub_stats:[]},{sub_stats:[]},{sub_stats:[]}]
    const evaluate=items=>100*items.reduce((n,a)=>n*(1+(a.sub_stats[0]?.[1]||0)),1)
    const result=shapley(build,evaluate,'B')
    assert.equal(result.damage-result.baseline,500)
    assert.ok(Math.abs(result.contributions.reduce((a,b)=>a+b,0)-500)<1e-10)
    const loo=build.reduce((n,a,i)=>n+evaluate(build)-evaluate(build.filter((_,j)=>i!==j)),0)
    assert.equal(loo,700)
    assert.equal(normalizeGain(600,100,600),350)
    assert.equal(normalizeGain(100,100,100),null)
    assert.equal(normalizeGain(50,100,600),-35)
    assert.equal(normalizeGain(1100,100,600),700)
    assert.equal(pieceEfficiency(100,100,100).score,null)
    assert.equal(pieceEfficiency(90,100,200).score,null)
    assert.equal(pieceEfficiency(150,100,200).score,35)
})

test('legal theoretical optimum obtains 350 / five 70, repeatable cache and non-damage boundary',()=>{
    const evaluator={evaluate:build=>100+sum(build,'ATKPercentage')*100,panel:()=>({})}
    const service=createDynamicScoreService(()=>evaluator)
    const first=service.score(request)
    // Every slot permits ATK%, maximum 6 top rolls => displayed 35.0% per slot.
    assert.equal(first.referenceDamage,275)
    const perfect=service.score({...request,input:{...request.input,artifacts:first.reference.build}})
    assert.equal(perfect.score,350)
    assert.deepEqual(perfect.rows.map(row=>row.score),[70,70,70,70,70])
    assert.equal(perfect.qualityTotal,350)
    assert.equal(perfect.reference.certified,false)
    const again=service.score(request)
    assert.equal(again.score,first.score);assert.deepEqual(again.reference,first.reference)
    assert.equal(again.timing.resultCacheHit,true)
    const flat=createDynamicScoreService(()=>({evaluate:()=>42,panel:()=>({})})).score({...request,search:{starts:1,passes:1}})
    assert.equal(flat.score,null);assert.equal(flat.qualityTotal,null)
})

test('canonical cache depends on complete environment; worker invalidation discards late results',async()=>{
    assert.equal(canonical({b:1,a:2}),canonical({a:2,b:1}))
    const key=referenceKey(request,'A')
    for(const alter of [r=>r.input.weapon.refine++,r=>r.input.character.constellation++,r=>r.input.buffs.push({name:'new'}),r=>r.objective.reaction='melt',r=>r.constraints={recharge_min:2}]) {
        const changed=clone(request);alter(changed);assert.notEqual(referenceKey(changed,'A'),key)
    }
    const changed=clone(request);changed.input.artifacts[0].sub_stats[0][1]=1
    assert.equal(referenceKey(changed,'A'),key)
    const cache=createScoreCache(1);cache.set('a',{n:1});cache.set('b',{n:2});assert.equal(cache.get('a'),undefined)
    const workers=[]
    const client=createScoreWorkerClient(()=>{const w={postMessage(data){this.data=data},terminate(){this.terminated=true}};workers.push(w);return w})
    const pending=client.run(request),rejected=assert.rejects(pending,{name:'AbortError'})
    client.cancel();await rejected
    assert.equal(workers[0].terminated,true)
    const next=client.run({...request,basis:'B'})
    workers[0].onmessage({data:{type:'result',id:workers[0].data.id,result:{stale:true}}})
    workers[1].onmessage({data:{type:'result',id:workers[1].data.id,result:{timing:{},fresh:true}}})
    assert.equal((await next).fresh,true)
    client.clear()
})

test('constraint infeasibility and batch reference identity remain explicit',()=>{
    const evaluator={evaluate:build=>100+sum(build,'ATKPercentage')*100,panel:()=>({}),violation:()=>1}
    const result=createDynamicScoreService(()=>evaluator).score({...request,search:{passes:1,starts:1}})
    assert.equal(result.score,null);assert.equal(result.qualityTotal,null);assert.equal(result.referenceFeasible,false)
    const service=createDynamicScoreService(()=>({...evaluator,violation:()=>0})),base=service.score(request)
    const candidate=toArtifact([...neighbors(pieces[0])][0],77)
    const changed=clone(request);changed.input.artifacts[0]=candidate
    assert.equal(service.scoreBatch(changed,[candidate],base)[0].gain,0)
    assert.throws(()=>service.scoreBatch({...request,basis:'B'},[candidate],base),/计算条件/)
    const otherMain=toArtifact([...neighbors(pieces[2],{mainStats:true})].find(p=>p.main_stat[0]!==pieces[2].main_stat[0]),78)
    const row=service.scoreBatch(request,[otherMain],base)[0]
    assert.equal(row.comparable,false);assert.equal(row.score,null);assert.ok(Number.isFinite(row.damage))
    const constrained=clone(request);constrained.basis='B';constrained.sets.push('WanderersTroupe');constrained.constraints={set_mode:{Set4:'GladiatorsFinale'}}
    constrained.input.artifacts[4].set_name='WanderersTroupe';constrained.search={starts:1,passes:1,finalists:1}
    const setService=createDynamicScoreService(()=>({evaluate:build=>100+sum(build,'ATKPercentage')+(build.filter(a=>a.set_name==='WanderersTroupe').length>=2?10000:0)}))
    const setResult=setService.score(constrained)
    assert.ok(setResult.rows.every(r=>r.replacementFeasible),'a forbidden two-piece bonus must not displace the valid four-piece replacement')
    const pair=clone(constrained);pair.input.artifacts[2].set_name=pair.input.artifacts[3].set_name='WanderersTroupe';pair.constraints.set_mode={Set22:['GladiatorsFinale','WanderersTroupe']}
    assert.ok(setService.score(pair).rows.every(r=>r.replacementFeasible))
})

test('display-rounding ties: reported five pieces stay legal, exact integer oracle covers every ordered 1–6-roll sequence',()=>{
    const reported=roundingBuild(),goblet=reported[3],before=clone(reported)
    assert.ok((.0272+.0272+.0311)*1000<85.5,'reproduces the IEEE-754 underflow at the tie')
    assert.equal(displayValue('CriticalRate',.0272+.0272+.0311),.086)
    const witness=validatePiece({slot:'Goblet',set_name:'BlizzardStrayer',main_stat:['ATKPercentage',.466],initial:4,lines:[
        {key:'CriticalRate',tiers:[0,0,1]},{key:'DEFFixed',tiers:[2,2]},
        {key:'CriticalDamage',tiers:[0,1,3]},{key:'HPFixed',tiers:[2]},
    ]})
    assert.deepEqual(toArtifact(witness).sub_stats,goblet.sub_stats)
    assert.deepEqual(normalizeBuild(reported),reported)
    for(const item of reported)assert.deepEqual(toArtifact(inferPiece(item)).sub_stats,item.sub_stats)
    assert.deepEqual(reported,before,'validation never rewrites actual equipped values')
    const bad=clone(goblet);bad.sub_stats[0][1]=.084
    assert.throws(()=>inferPiece(bad),/8／9/,'a different unattainable displayed value remains invalid')
    let checked=0
    for(const [key,tiers] of Object.entries(ROLLS)) {
        const flat=isFlat(key),factor=flat?100:10000,divisor=flat?100n:10n,shownScale=flat?1:1000
        const units=tiers.map(v=>BigInt(Math.round(v*factor)))
        function visit(depth,raw,integer) {
            if(depth) {
                // Independent decimal half-up oracle, using exact integer arithmetic.
                const expected=Number((integer+divisor/2n)/divisor)/shownScale
                assert.equal(displayValue(key,raw),expected,`${key}: ${depth} contributions / ${integer} units`)
                checked++
            }
            if(depth===6)return
            for(let t=0;t<4;t++)visit(depth+1,raw+tiers[t],integer+units[t])
        }
        visit(0,0,0n)
    }
    assert.equal(checked,54600)
})
