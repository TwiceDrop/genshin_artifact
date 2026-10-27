// Extract the requested sword and catalyst records from the saved 7.1 release catalog.
// The downloaded JavaScript is parsed as literal data; it is never evaluated.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const parser = require('@babel/parser');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'beta-data/sources-release-71/catalog.html');
const sourceDir = path.join(root, 'beta-data/sources-expanded-release-71');
const output = path.join(root, 'beta-data/weapons-expanded-release-71.json');
const definitions = [
  [11419, 'PrizedIsshinBlade', '「一心传」名刀', 'Sword'],
  [11518, 'AthameArtis', '黑蚀', 'Sword'],
  [11434, 'MoonweaverDawn', '织月者的曙色', 'Sword'],
  [11433, 'SerenitysCall', '谧音吹哨', 'Sword'],
  [11519, 'LightbearingMoonshard', '朏魄含光', 'Sword'],
  [11520, 'WhitelakeFrostfeather', '白湖冬羽', 'Sword'],
  [11521, 'ExaiphanesBlade', '星锋剑', 'Sword'],
  [14306, 'AmberBead', '琥珀玥', 'Catalyst'],
  [14520, 'NightweaversLookingGlass', '纺夜天镜', 'Catalyst'],
  [14521, 'ReliquaryOfTruth', '真语秘匣', 'Catalyst'],
  [14434, 'DawningFrost', '霜辰', 'Catalyst'],
  [14432, 'EtherlightSpindlelute', '天光的纺琴', 'Catalyst'],
  [14433, 'BlackmarrowLantern', '乌髓孑灯', 'Catalyst'],
  [14522, 'NocturnesCurtainCall', '帷间夜曲', 'Catalyst'],
  [14523, 'AngelosHeptades', '尘光七谕', 'Catalyst'],
];
const statNames = {4:'ATK',6:'ATKPercentage',9:'DEFPercentage',20:'Critical',22:'CriticalDamage',23:'Recharge',28:'ElementalMastery'};
function literal(node) {
  if (!node) throw Error('Missing literal');
  if (['NumericLiteral','StringLiteral','BooleanLiteral'].includes(node.type)) return node.value;
  if (node.type==='NullLiteral') return null;
  if (node.type==='UnaryExpression'&&node.operator==='-') return -literal(node.argument);
  if (node.type==='ArrayExpression') return node.elements.map(literal);
  if (node.type==='ObjectExpression') return Object.fromEntries(node.properties.map(p=>{
    if (p.type!=='ObjectProperty'||p.computed) throw Error('Nonliteral property');
    return [p.key.name??p.key.value,literal(p.value)];
  }));
  throw Error('Nonliteral source node: '+node.type);
}
const raw = fs.readFileSync(source);
const html = raw.toString('utf8');
const selected = new Set(definitions.map(([id])=>id));
const weapons = new Map(), curves = new Map();
function visit(node) {
  if (!node||typeof node!=='object') return;
  if (node.type==='ObjectExpression') {
    const props = Object.fromEntries(node.properties.filter(p=>p.type==='ObjectProperty').map(p=>[p.key.name??p.key.value,p.value]));
    if (props.id&&props.refinements&&props.attributes&&props.promotions) {
      const id=literal(props.id);
      if (selected.has(id)) weapons.set(id,literal(node));
    }
    if (props.id&&props.operation&&props.values) {
      const id=literal(props.id);
      curves.set(id,literal(node));
    }
  }
  for (const [key,child] of Object.entries(node)) if (!['loc','start','end'].includes(key)) {
    if (Array.isArray(child)) child.forEach(visit);
    else if (child&&typeof child==='object') visit(child);
  }
}
function parseHtml(page) {
  for (const match of page.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) {
    if (match[1].includes('refinements:')) visit(parser.parse(match[1],{sourceType:'unambiguous'}));
  }
}
async function download(url,filename) {
  const response=await fetch(url,{signal:AbortSignal.timeout(60000)});
  if (!response.ok) throw Error(url+' returned HTTP '+response.status);
  const body=await response.text();
  if (!body.includes('refinements:')) throw Error('Missing game data: '+url);
  fs.writeFileSync(filename,body);
}
async function main() {
parseHtml(html);
const catalogWeapons=new Map(weapons);
if (process.argv.includes('--download')) {
  fs.mkdirSync(sourceDir,{recursive:true});
  for (const [id] of definitions) {
    const slug=catalogWeapons.get(id)?.slug;
    if (!slug) throw Error('Missing catalog slug '+id);
    await download('https://gi.gachabase.net/weapons/'+id+'/'+slug+'/release?lang=chs',path.join(sourceDir,id+'.html'));
  }
}
const snapshots=new Map();
for (const [id] of definitions) {
  const file=path.join(sourceDir,id+'.html');
  const bytes=fs.readFileSync(file);
  const detailHtml=bytes.toString('utf8');
  parseHtml(detailHtml);
  snapshots.set(id,{snapshot:'beta-data/sources-expanded-release-71/'+id+'.html',sha256:crypto.createHash('sha256').update(bytes).digest('hex'),imageUrl:detailHtml.match(/<meta property="og:image" content="([^"]+)"/)?.[1]||null});
  if (JSON.stringify(weapons.get(id)?.refinements.map(r=>r.parameters))!==JSON.stringify(catalogWeapons.get(id)?.refinements.map(r=>r.parameters))) throw Error('Detail/catalog mismatch '+id);
}
const entries=definitions.map(([id,name,displayName,weaponType])=>{
  const w=weapons.get(id);
  if (!w) throw Error('Missing weapon '+id);
  if (w.weapon_type_id!==(weaponType==='Sword'?1:10)) throw Error('Wrong weapon type '+id);
  const base=w.attributes.find(a=>a.attribute_id===4);
  const sub=w.attributes.find(a=>a.attribute_id!==4);
  if (!base||!sub||!statNames[sub.attribute_id]) throw Error('Invalid attributes '+id);
  const baseCurve=curves.get(base.curve_id),subCurve=curves.get(sub.curve_id);
  if (!baseCurve||!subCurve||baseCurve.values.length<90||subCurve.values.length<90) throw Error('Missing curve '+id);
  const levels=[];
  let incompleteReason=null;
  levelLoop: for (let level=1;level<=90;level++) for (const ascend of [false,...([20,40,50,60,70,80].includes(level)?[true]:[])]) {
    const promotion=w.promotions.find(p=>level<p.maximum_level||(level===p.maximum_level&&!ascend));
    if (!promotion) {incompleteReason='Missing promotion for level '+level+'/'+ascend;break levelLoop;}
    const attackRaw=base.value*baseCurve.values[level-1]+(promotion.stat_additions.find(s=>s.stat_id===4)?.value||0);
    const subStatRaw=sub.value*subCurve.values[level-1];
    levels.push({level,ascend,attack:Math.round(attackRaw),subStat:Number(subStatRaw.toFixed(4)),attackRaw,subStatRaw});
  }
  if (levels.length!==96) incompleteReason??='Only '+levels.length+' level rows';
  return {id,name,displayName,englishName:catalogWeapons.get(id).name.text,slug:w.slug,weaponType,rarity:w.rarity,...snapshots.get(id),
    secondaryStat:statNames[sub.attribute_id],attributes:w.attributes,promotions:w.promotions,
    curves:{[base.curve_id]:baseCurve,[sub.curve_id]:subCurve},
    refinements:w.refinements.map(r=>r.parameters),
    refinementDetails:w.refinements.map((r,i)=>({refine:i+1,name:r.name?.text,description:r.description?.text,descriptionEnglish:catalogWeapons.get(id).refinements[i]?.description?.text,parameters:r.parameters})),
    levels,...(incompleteReason?{incompleteReason}:{})};
});
const revision=html.match(/revisions:\{latest:\{branch:"([^"]+)",version:"([^"]+)",design_revision:(\d+),resource_revision:(\d+)/);
if (!revision) throw Error('Missing catalog revision');
const document={schemaVersion:1,revision:{branch:revision[1],version:revision[2],designRevision:Number(revision[3]),resourceRevision:Number(revision[4])},
  catalog:{snapshot:'beta-data/sources-release-71/catalog.html',sha256:crypto.createHash('sha256').update(raw).digest('hex')},weapons:entries};
fs.writeFileSync(output,JSON.stringify(document,null,2)+'\n');
const runtime={revision:document.revision,weapons:entries.map(w=>({id:w.id,name:w.name,displayName:w.displayName,
  weaponType:w.weaponType,rarity:w.rarity,secondaryStat:w.secondaryStat,refinements:w.refinements,levels:w.levels}))};
fs.writeFileSync(path.join(root,'beta-data/weapons-expanded-runtime.mjs'),'// Generated by beta-tools/extract-expanded-weapons.cjs from pinned release snapshots.\nexport default '+JSON.stringify(runtime)+';\n');
console.log(JSON.stringify(entries.map(w=>({id:w.id,name:w.name,displayName:w.displayName,rarity:w.rarity,secondaryStat:w.secondaryStat,level90:w.levels.at(-1),refinements:w.refinements.length,r1:w.refinementDetails[0]})),null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1});
