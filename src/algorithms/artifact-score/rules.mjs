// Five-star game roll tiers. Aggregate BEFORE rounding to Mona's displayed inputs.
// Sources: the miao-plugin section of THIRD_PARTY_NOTICES.md and tests/fixtures/dynamic-score-affix-source.json.
export const ROLLS = Object.freeze({
    HPFixed: [209.13,239,268.88,298.75], ATKFixed: [13.62,15.56,17.51,19.45],
    DEFFixed: [16.2,18.52,20.83,23.15], HPPercentage: [.0408,.0466,.0525,.0583],
    ATKPercentage: [.0408,.0466,.0525,.0583], DEFPercentage: [.051,.0583,.0656,.0729],
    ElementalMastery: [16.32,18.65,20.98,23.31], Recharge: [.0453,.0518,.0583,.0648],
    CriticalRate: [.0272,.0311,.035,.0389], CriticalDamage: [.0544,.0622,.0699,.0777],
})
export const SLOTS = ['Flower','Feather','Sand','Goblet','Head']
export const MAIN = Object.freeze({
    HPFixed:4780,ATKFixed:311,HPPercentage:.466,ATKPercentage:.466,DEFPercentage:.583,
    ElementalMastery:187,Recharge:.518,CriticalRate:.311,CriticalDamage:.622,HealingBonus:.359,
    PyroBonus:.466,HydroBonus:.466,CryoBonus:.466,ElectroBonus:.466,AnemoBonus:.466,GeoBonus:.466,DendroBonus:.466,PhysicalBonus:.583,
})
const base=['ATKPercentage','HPPercentage','DEFPercentage','ElementalMastery']
export const MAINS = Object.freeze({Flower:['HPFixed'],Feather:['ATKFixed'],Sand:[...base,'Recharge'],
    Goblet:[...base,'PyroBonus','HydroBonus','CryoBonus','ElectroBonus','AnemoBonus','GeoBonus','DendroBonus','PhysicalBonus'],
    Head:[...base,'CriticalRate','CriticalDamage','HealingBonus']})
export const isFlat = key => ['HPFixed','ATKFixed','DEFFixed','ElementalMastery'].includes(key)
export function displayValue(key,value) {
    const scale=isFlat(key)?1:1000,scaled=value*scale
    // At most six rolls are summed. Correct only their accumulated IEEE-754
    // roundoff at half-unit ties (e.g. 2.72% + 2.72% + 3.11% => 8.6%).
    // This is a few machine ulps, not a tolerance for an extra displayed tier.
    return Math.round(scaled+8*Number.EPSILON*Math.abs(scaled))/scale
}
// Imported raw stats can retain float32 rounding from up to six additions and
// a percent-unit conversion. Match only within that numerical error budget.
const sameFloat32Value=(value,expected)=>Number.isFinite(value)&&Math.abs(value-expected)<=8*2**-23*Math.abs(expected)
export const clone = value => JSON.parse(JSON.stringify(value))
export function toArtifact(piece,id=0) {
    return {id,slot:piece.slot,set_name:piece.set_name,star:5,level:20,main_stat:[...piece.main_stat],
        sub_stats:piece.lines.map(({key,tiers})=>[key,displayValue(key,tiers.reduce((sum,tier)=>sum+ROLLS[key][tier],0))])}
}
export function validatePiece(piece) {
    if(![3,4].includes(piece.initial)||!MAINS[piece.slot]?.includes(piece.main_stat?.[0])||!sameFloat32Value(piece.main_stat[1],MAIN[piece.main_stat[0]]))throw Error('理论装备主词条或初始副词条数不合法')
    const keys=piece.lines.map(line=>line.key)
    if(keys.length!==4||new Set(keys).size!==4||keys.includes(piece.main_stat[0]))throw Error('副词条必须四种、不重复且不与主词条同名')
    let count=0
    for(const {key,tiers} of piece.lines) {
        if(!ROLLS[key]||!tiers.length||tiers.some(t=>!Number.isInteger(t)||t<0||t>3))throw Error('副词条档位不合法')
        count+=tiers.length
    }
    if(count!==piece.initial+5)throw Error('五星 +20 副词条贡献次数不合法')
    return piece
}
const histories=new Map()
function matchingLines(key,value) {
    if(!histories.has(key)) {
        const sums=new Map(),raw=[]
        function visit(tiers,last,total) {
            if(tiers.length) {
                const shown=displayValue(key,total),rows=sums.get(shown)||[]
                // One witness per count is sufficient for legality and a search seed.
                if(!rows.some(a=>a.length===tiers.length))rows.push(tiers)
                sums.set(shown,rows)
                raw.push({value:total,tiers})
            }
            if(tiers.length===6)return
            for(let t=last;t<4;t++)visit([...tiers,t],t,total+ROLLS[key][t])
        }
        visit([],0,0);histories.set(key,{sums,raw})
    }
    // Keep the displayed-stat contract, and also match legal raw histories when
    // float32 tails land just below a display-rounding boundary. Do not rewrite
    // the equipped numbers used by the damage calculator.
    const {sums,raw}=histories.get(key),rows=[...(sums.get(displayValue(key,value))||[])]
    for(const entry of raw)if(!rows.some(t=>t.length===entry.tiers.length)&&sameFloat32Value(value,entry.value))rows.push(entry.tiers)
    return rows
}
export function inferPiece(artifact) {
    if(artifact.star!==5||artifact.level!==20||artifact.sub_stats.length!==4)throw Error(`${artifact.slot}：动态评分需要五星 +20 且四副词条的装备`)
    if(!MAINS[artifact.slot]?.includes(artifact.main_stat[0])||!sameFloat32Value(artifact.main_stat[1],MAIN[artifact.main_stat[0]]))throw Error(`${artifact.slot}：主词条不符合五星 +20 规则`)
    const keys=artifact.sub_stats.map(([key])=>key)
    if(new Set(keys).size!==4||keys.includes(artifact.main_stat[0])||keys.some(k=>!ROLLS[k]))throw Error(`${artifact.slot}：副词条重复、无效或与主词条冲突`)
    const choices=artifact.sub_stats.map(([key,value])=>matchingLines(key,value))
    function find(i,lines,count) {
        if(i===4)return count===8||count===9?{slot:artifact.slot,set_name:artifact.set_name,main_stat:[...artifact.main_stat],initial:count-5,lines}:null
        for(const tiers of choices[i]) {
            if(count+tiers.length>9)continue
            const result=find(i+1,[...lines,{key:keys[i],tiers:[...tiers]}],count+tiers.length)
            if(result)return result
        }
        return null
    }
    const piece=find(0,[],0)
    if(!piece)throw Error(`${artifact.slot}：副词条数值无法由 8／9 次合法档位贡献生成`)
    return validatePiece(piece)
}
export function normalizeBuild(artifacts) {
    if(artifacts.length!==5||new Set(artifacts.map(a=>a.slot)).size!==5)throw Error('动态评分需要五个不同部位的完整配装')
    const sorted=SLOTS.map(slot=>artifacts.find(a=>a.slot===slot))
    if(sorted.some(a=>!a))throw Error('圣遗物部位无效')
    sorted.forEach(inferPiece)
    return clone(sorted).map((a,i)=>({...a,id:i+1}))
}
export function* neighbors(piece,{mainStats=false}={}) {
    const keys=piece.lines.map(line=>line.key)
    for(let i=0;i<4;i++) {
        // Replace an entire stat, retaining its legal contribution history.
        for(const key of Object.keys(ROLLS))if(!keys.includes(key)&&key!==piece.main_stat[0]) {
            const next=clone(piece);next.lines[i].key=key;yield next
        }
        for(let j=0;j<piece.lines[i].tiers.length;j++)for(let tier=0;tier<4;tier++)if(tier!==piece.lines[i].tiers[j]) {
            const next=clone(piece);next.lines[i].tiers[j]=tier;yield next
        }
        // Transfer a reinforcement, never remove the first contribution of a line.
        if(piece.lines[i].tiers.length>1)for(let k=0;k<4;k++)if(i!==k)for(const tier of new Set(piece.lines[i].tiers)) {
            const next=clone(piece);next.lines[i].tiers.splice(next.lines[i].tiers.indexOf(tier),1);next.lines[k].tiers.push(tier);yield next
        }
        if(piece.initial===3)for(let tier=0;tier<4;tier++) {
            const next=clone(piece);next.initial=4;next.lines[i].tiers.push(tier);yield next
        }
        if(piece.initial===4&&piece.lines[i].tiers.length>1)for(const tier of new Set(piece.lines[i].tiers)) {
            const next=clone(piece);next.initial=3;next.lines[i].tiers.splice(next.lines[i].tiers.indexOf(tier),1);yield next
        }
    }
    if(mainStats)for(const key of MAINS[piece.slot])if(key!==piece.main_stat[0]) {
        const next=clone(piece),conflict=keys.indexOf(key)
        next.main_stat=[key,MAIN[key]]
        if(conflict<0)yield next
        else for(const replacement of Object.keys(ROLLS))if(replacement!==key&&!keys.includes(replacement)) {
            const repaired=clone(next);repaired.lines[conflict].key=replacement;yield repaired
        }
    }
}
export function seedPiece(template,index=0,initial=4) {
    const available=Object.keys(ROLLS).filter(k=>k!==template.main_stat[0])
    const keys=Array.from({length:4},(_,i)=>available[(index+i)%available.length])
    return validatePiece({...clone(template),initial,lines:keys.map((key,i)=>({key,tiers:Array(i===index%4?initial+2:1).fill(3)}))})
}
export function setPatterns(sets,mode='Any') {
    if(mode?.Set4)return [Array(5).fill(mode.Set4)]
    if(mode?.Set22)return [[mode.Set22[0],mode.Set22[0],mode.Set22[1],mode.Set22[1],mode.Set22[0]]]
    const patterns=sets.map(name=>Array(5).fill(name))
    for(let i=0;i<sets.length;i++)for(let j=i+1;j<sets.length;j++)patterns.push([sets[i],sets[i],sets[j],sets[j],sets[i]])
    // Representatives for a lone two-piece bonus and for no active bonus.
    // Distinct filler identities do not activate any second bonus.
    if(sets.length>=4)for(const name of sets)patterns.push([name,name,...sets.filter(s=>s!==name).slice(0,3)])
    if(sets.length>=5)patterns.push(sets.slice(0,5))
    return patterns
}
export function matchesSets(build,mode='Any') {
    const count=name=>build.filter(a=>a.set_name===name).length
    return mode?.Set4?count(mode.Set4)>=4:mode?.Set22?mode.Set22.every(name=>count(name)>=2):true
}
