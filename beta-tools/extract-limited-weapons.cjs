// Extract literal game data from saved public pages. Never evaluate downloaded JavaScript.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const parser = require('@babel/parser');

const root = path.resolve(__dirname, '..');
const sourceDir = path.join(root, 'beta-data/sources-limited-71');
const outputPath = path.join(root, 'beta-data/weapons-limited-71.json');
const catalogUrl = 'https://gi.gachabase.net/weapons/beta?lang=chs';
const definitions = [
    [11435, 'HereticsMoltenBlade', 'heretics-molten-blade', 'battle-pass'],
    [11436, 'Emberwell', 'emberwell', 'snezhnaya-forging'],
    [11437, 'NewBough', 'new-bough', 'limited'],
    [12435, 'ForgedByTheGoldenMelody', 'forged-by-the-golden-melody', 'battle-pass'],
    [12436, 'BladeOfAtonement', 'blade-of-atonement', 'snezhnaya-forging'],
    [13435, 'Frostbreath', 'frostbreath', 'battle-pass'],
    [13436, 'SongOfTheVigil', 'song-of-the-vigil', 'snezhnaya-forging'],
    [14435, 'ClashOfKings', 'clash-of-kings', 'battle-pass'],
    [14436, 'EchoesOfTheHeart', 'echoes-of-the-heart', 'snezhnaya-forging'],
    [14437, 'WintersHeavyHeart', 'winters-heavy-heart', 'limited'],
    [15435, 'JadeVista', 'jade-vista', 'battle-pass'],
    [15436, 'CovenantOfFrostAndSnow', 'covenant-of-frost-and-snow', 'snezhnaya-forging'],
    [15437, 'BreezeborneRefrain', 'breezeborne-refrain', 'limited'],
];
const typeNames = {1:'Sword', 11:'Claymore', 13:'Polearm', 10:'Catalyst', 12:'Bow'};
const statNames = {4:'ATK', 6:'ATKPercentage', 9:'DEFPercentage', 20:'Critical', 22:'CriticalDamage', 23:'Recharge', 28:'ElementalMastery'};

function literal(node) {
    if (!node) throw new Error('Missing literal node');
    if (['NumericLiteral', 'StringLiteral', 'BooleanLiteral'].includes(node.type)) return node.value;
    if (node.type === 'NullLiteral') return null;
    if (node.type === 'UnaryExpression' && node.operator === '-') return -literal(node.argument);
    if (node.type === 'ArrayExpression') return node.elements.map(literal);
    if (node.type === 'ObjectExpression') {
        return Object.fromEntries(node.properties.map(property => {
            if (property.type !== 'ObjectProperty' || property.computed) throw new Error('Nonliteral property');
            return [property.key.name ?? property.key.value, literal(property.value)];
        }));
    }
    throw new Error('Nonliteral data: ' + node.type);
}
function readPage(filename) {
    const raw = fs.readFileSync(filename);
    const html = raw.toString('utf8');
    const weapons = new Map();
    const curves = {};
    function visit(node) {
        if (!node || typeof node !== 'object') return;
        if (node.type === 'ObjectExpression') {
            const props = Object.fromEntries(node.properties.filter(p => p.type === 'ObjectProperty').map(p => [p.key.name ?? p.key.value, p.value]));
            // Ignore lighter mirror objects without refinements/promotions.
            if (props.id && props.refinements && props.attributes && props.promotions) {
                const weapon = literal(node);
                if (weapons.has(weapon.id)) throw new Error('Duplicate full weapon object: ' + weapon.id);
                weapons.set(weapon.id, weapon);
            }
            if (props.id && props.operation && props.values) {
                const curve = literal(node);
                if (curves[curve.id] && JSON.stringify(curves[curve.id]) !== JSON.stringify(curve)) throw new Error('Conflicting curve: ' + curve.id);
                curves[curve.id] = curve;
            }
        }
        for (const [key, child] of Object.entries(node)) if (!['loc', 'start', 'end'].includes(key)) {
            if (Array.isArray(child)) child.forEach(visit);
            else if (child && typeof child === 'object') visit(child);
        }
    }
    for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) {
        if (match[1].includes('refinements:')) visit(parser.parse(match[1], {sourceType:'unambiguous'}));
    }
    const revisionMatch = html.match(/revisions:\{latest:\{branch:"([^"]+)",version:"([^"]+)",design_revision:(\d+),resource_revision:(\d+)/);
    if (!revisionMatch) throw new Error('Missing source revision: ' + filename);
    return {
        weapons, curves,
        sha256: crypto.createHash('sha256').update(raw).digest('hex'),
        retrievedAt: fs.statSync(filename).mtime.toISOString(),
        revision: {branch: revisionMatch[1], version:revisionMatch[2], designRevision:Number(revisionMatch[3]), resourceRevision:Number(revisionMatch[4])},
        imageUrl: html.match(/<meta property="og:image" content="([^"]+)"/)?.[1] || null,
    };
}
async function download(url, filename) {
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const response = await fetch(url, {signal: AbortSignal.timeout(60000)});
            if (!response.ok) throw new Error('HTTP ' + response.status);
            const body = await response.text();
            if (!body.includes('refinements:')) throw new Error('Missing weapon data');
            fs.writeFileSync(filename, body);
            return;
        } catch (error) {
            if (attempt === 3) throw error;
            await new Promise(resolve => setTimeout(resolve, 1500));
        }
    }
}
async function main() {
    if (process.argv.includes('--download')) {
        fs.mkdirSync(sourceDir, {recursive:true});
        await download(catalogUrl, path.join(sourceDir, 'catalog.html'));
        for (const [id, , slug] of definitions) {
            await download('https://gi.gachabase.net/weapons/' + id + '/' + slug + '/beta?lang=chs', path.join(sourceDir, id + '.html'));
        }
    }
    const catalog = readPage(path.join(sourceDir, 'catalog.html'));
    const weapons = [];
    for (const [id, name, slug, category] of definitions) {
        const source = readPage(path.join(sourceDir, id + '.html'));
        const weapon = source.weapons.get(id);
        const english = catalog.weapons.get(id);
        if (!weapon || !english || weapon.slug !== slug || weapon.rarity !== 4) throw new Error('Incorrect weapon source: ' + id);
        if (JSON.stringify(weapon.refinements.map(r => r.parameters)) !== JSON.stringify(english.refinements.map(r => r.parameters))) throw new Error('Detail/catalog parameter mismatch: ' + id);
        if (weapon.refinements.length !== 5 || weapon.promotions.length !== 7 || weapon.promotions.at(-1).maximum_level !== 90) throw new Error('Incomplete weapon data: ' + id);
        const base = weapon.attributes.find(a => a.attribute_id === 4);
        const sub = weapon.attributes.find(a => a.attribute_id !== 4);
        if (!base || !sub || !statNames[sub.attribute_id]) throw new Error('Unknown attributes: ' + id);
        const curves = Object.fromEntries([...new Set(weapon.attributes.map(a => a.curve_id))].map(curveId => {
            const curve = source.curves[curveId];
            if (!curve || curve.values.length < 90 || curve.values.slice(0,90).some(v => !Number.isFinite(v))) throw new Error('Missing/nonfinite curve: ' + curveId);
            return [curveId, curve];
        }));
        const rechargeByRefine = id === 15437 ? weapon.refinements.map((r, index) => {
            const zh = r.description.text.match(/^元素充能效率提升<color=[^>]+>([\d.]+)%/);
            const en = english.refinements[index].description.text.match(/^Increases Energy Recharge by <color=[^>]+>([\d.]+)%/);
            if (!zh || !en || zh[1] !== en[1]) throw new Error('Missing/mismatched Recharge description: ' + id);
            return Number(zh[1]) / 100;
        }) : null;
        const levels = [];
        for (let level = 1; level <= 90; level++) {
            for (const ascend of [false, ...([20,40,50,60,70,80].includes(level) ? [true] : [])]) {
                const promotion = weapon.promotions.find(p => level < p.maximum_level || (level === p.maximum_level && !ascend));
                if (!promotion) throw new Error('Missing promotion: ' + id + '/' + level);
                const addedAttack = promotion.stat_additions.find(s => s.stat_id === 4)?.value || 0;
                const attackRaw = base.value * curves[base.curve_id].values[level - 1] + addedAttack;
                const subStatRaw = sub.value * curves[sub.curve_id].values[level - 1];
                levels.push({level, ascend, attack:Math.round(attackRaw), subStat:Number(subStatRaw.toFixed(4)), attackRaw, subStatRaw});
            }
        }
        if (levels.length !== 96) throw new Error('Incorrect level row count: ' + id);
        weapons.push({
            id, name, slug, displayName:weapon.name.text, englishName:english.name.text, category,
            rarity:weapon.rarity, weaponType:typeNames[weapon.weapon_type_id], weaponTypeId:weapon.weapon_type_id,
            maximumLevel:90, secondaryStat:statNames[sub.attribute_id],
            url:'https://gi.gachabase.net/weapons/' + id + '/' + slug + '/beta?lang=chs',
            snapshot:'beta-data/sources-limited-71/' + id + '.html', sha256:source.sha256, retrievedAt:source.retrievedAt, revision:source.revision,
            imageUrl:source.imageUrl, assets:weapon.assets, attributes:weapon.attributes, promotions:weapon.promotions, curves,
            refinements:weapon.refinements.map(r => r.parameters),
            refinementDetails:weapon.refinements.map((r, index) => ({
                refine:index + 1, id:r.id, name:r.name.text, description:r.description.text, descriptionEnglish:english.refinements[index].description.text, parameters:r.parameters,
                ...(rechargeByRefine ? {recharge:rechargeByRefine[index]} : {}),
            })),
            ...(rechargeByRefine ? {rechargeByRefine} : {}),
            levels,
        });
    }
    const result = {
        schemaVersion:1, checkedAt:new Date().toISOString(),
        note:'Public beta data snapshot; source currently identifies itself as 7.0.54, not an official 7.1 release. attack/subStat follow the existing calculator display rounding; attackRaw/subStatRaw and raw curves are retained.',
        revision:catalog.revision,
        catalog:{url:catalogUrl, snapshot:'beta-data/sources-limited-71/catalog.html', sha256:catalog.sha256, retrievedAt:catalog.retrievedAt},
        semanticNotes:{
            NewBough:'Stellar Glimmer mode replaces normal Verdant: it grants ATK + Stellar Glimmer damage per stack, without retaining normal-mode Elemental Mastery.',
            WintersHeavyHeart:'Stellar Glimmer mode replaces the normal Cryo/Electro effects. Count all Cryo/Electro party members including the wielder, at most four total.',
            BreezeborneRefrain:'Energy Recharge increases by refinement: 20%/25%/30%/35%/40%. This stat is omitted from the source parameters array, so it is extracted from and cross-checked between the Chinese and English descriptions. The stack-triggered 12-second Stellar Glimmer damage buff applies to nearby party members; triggering is possible off field.',
            ForgedByTheGoldenMelody:'The extra Contrapuntal movement snapshots the movement at its trigger and lasts 12 seconds. It need not match the currently cycling base movement.',
            Frostbreath:'Flat energy regeneration is for the other party members, not the wielder; it must not be converted into an Energy Recharge statistic.',
            SongOfTheVigil:'Flat energy regeneration is for the wielder and must not be converted into an Energy Recharge statistic.',
            JadeVista:'At most three other party members; same-element Elemental Mastery stacks take priority if given an overfull composition.',
        },
        weapons,
    };
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(weapons.map(w => ({id:w.id, name:w.name, displayName:w.displayName, levelRows:w.levels.length, level90:w.levels.at(-1), r1:w.refinements[0], r5:w.refinements[4]})), null, 2));
}
main().catch(error => {console.error(error); process.exitCode = 1;});
