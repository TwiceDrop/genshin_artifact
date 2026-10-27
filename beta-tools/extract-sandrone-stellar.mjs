// Extract data literals only; downloaded page scripts are never executed.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import parser from '@babel/parser'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const url='https://gi.gachabase.net/characters/10000133/sandrone/release?lang=en'
const source=path.join(root,'beta-data/sources-strengthened/sandrone-release-en.html')
if(process.argv.includes('--download')||!fs.existsSync(source)){
    const response=await fetch(url,{signal:AbortSignal.timeout(30000)})
    if(!response.ok)throw Error('Download failed: '+response.status)
    fs.mkdirSync(path.dirname(source),{recursive:true})
    fs.writeFileSync(source,await response.text())
}
const html=fs.readFileSync(source,'utf8')
const arrays=new Map(),talents=new Map()
const properties=node=>Object.fromEntries(node.properties.filter(p=>p.type==='ObjectProperty').map(p=>[p.key.name??p.key.value,p.value]))
function literal(node){
    if(['NumericLiteral','StringLiteral','BooleanLiteral'].includes(node.type))return node.value
    if(node.type==='NullLiteral')return null
    if(node.type==='UnaryExpression'&&node.operator==='-')return -literal(node.argument)
    if(node.type==='ArrayExpression')return node.elements.map(literal)
    if(node.type==='ObjectExpression')return Object.fromEntries(Object.entries(properties(node)).map(([key,value])=>[key,literal(value)]))
    if(node.type==='Identifier'&&arrays.has(node.name))return arrays.get(node.name)
    throw Error('Nonliteral data: '+node.type)
}
function walk(node,visit){
    if(!node||typeof node!=='object')return
    visit(node)
    for(const [key,child]of Object.entries(node))if(!['loc','start','end'].includes(key)){
        if(Array.isArray(child))child.forEach(value=>walk(value,visit))
        else if(child&&typeof child==='object')walk(child,visit)
    }
}
for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)){
    if(!match[1].includes('talents:'))continue
    const ast=parser.parse(match[1],{sourceType:'unambiguous'})
    walk(ast,node=>{
        if(node.type!=='AssignmentExpression'||node.operator!=='=')return
        const left=node.left
        if(left.type!=='MemberExpression'||!left.computed||left.object.type!=='Identifier'||left.property.type!=='NumericLiteral')return
        const name=left.object.name
        if(!arrays.has(name))arrays.set(name,[])
        arrays.get(name)[left.property.value]=literal(node.right)
    })
    walk(ast,node=>{
        if(node.type!=='ObjectExpression')return
        const props=properties(node)
        if(props.depot_id?.value!==13301)return
        if(!props.id||!props.name)return
        const entry={id:props.id.value,name:literal(props.name).text}
        if(props.levels)entry.levels=literal(props.levels)
        if(props.parameters)entry.parameters=literal(props.parameters)
        if(props.description)entry.description=literal(props.description).text
        talents.set(entry.id,entry)
    })
}
const ids={charged:11331,skill:11332,burst:11335}
const ratios={},parameters={}
for(const [name,id]of Object.entries(ids)){
    const levels=talents.get(id)?.levels?.filter(x=>x.level>=1&&x.level<=15).sort((a,b)=>a.level-b.level)
    if(levels?.length!==15)throw Error('Missing 1..15 levels for '+name)
    ratios[name]=levels.map((entry,index)=>{
        if(entry.level!==index+1)throw Error('Nonsequential skill levels')
        const descriptor=entry.descriptions.find(x=>x.text.includes('Stellar Swirl DMG'))
        const parameter=Number(descriptor?.text.match(/\{param(\d+):/)?.[1])
        const ratio=entry.parameters[parameter-1]
        if(!Number.isFinite(ratio)||ratio<=0)throw Error('Invalid stellar ratio for '+name+' level '+entry.level)
        return ratio
    })
    parameters[name]={talentId:id,levels:levels.map(x=>({level:x.level,parameters:x.parameters})),descriptions:levels[0].descriptions.map(x=>x.text)}
}
const c4=talents.get(1334).parameters,c6=talents.get(1336).parameters
if(c4[2]!==1.875||c6[3]!==1.2)throw Error('C4/C6 parameter layout changed; review source')
const output={
    source:{url,sha256:crypto.createHash('sha256').update(html).digest('hex'),retrievedAt:fs.statSync(source).mtime.toISOString(),snapshot:'beta-data/sources-strengthened/sandrone-release-en.html'},
    ...ratios,
    c4:1.875,c6:1.2,
    units:'ATK multiplier, arrays indexed by the final displayed talent level minus one (the existing skill1/skill2/skill3 interface value). Do not add C3/C5 again in the facade.',
    parameters,
    passivesAndConstellations:Object.fromEntries([1332101,1332201,1332301,1331,1332,1333,1334,1335,1336].map(id=>[id,talents.get(id)])),
}
fs.writeFileSync(path.join(root,'beta-data/sandrone-stellar-skills.json'),JSON.stringify(output,null,2)+'\n')
console.log(JSON.stringify({ratios,c4,c6,passive:talents.get(1332101)?.parameters},null,2))
