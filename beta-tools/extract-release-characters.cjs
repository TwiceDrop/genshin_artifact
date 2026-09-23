// Parse the published character data literals; do not execute page scripts.
const fs = require('node:fs');
const path = require('node:path');
const parser = require('@babel/parser');
const root = path.resolve(__dirname, '..');
let indexedLiterals = new Map();
function literal(node) {
    if (!node) return null;
    if (['NumericLiteral', 'StringLiteral', 'BooleanLiteral'].includes(node.type)) return node.value;
    if (node.type === 'NullLiteral') return null;
    if (node.type === 'UnaryExpression' && node.operator === '-') return -literal(node.argument);
    if (node.type === 'ArrayExpression') return node.elements.map(literal);
    if (node.type === 'ObjectExpression') return Object.fromEntries(node.properties.map(p => [p.key.name ?? p.key.value, literal(p.value)]));
    if (node.type === 'Identifier' && indexedLiterals.has(node.name)) return indexedLiterals.get(node.name);
    return {unparsed:node.type};
}
function character(id) {
    const file = path.join(root, `beta-data/sources-release-71/${id}.html`);
    const html = fs.readFileSync(file, 'utf8');
    let found;
    function visit(node) {
        if (!node || typeof node !== 'object' || found) return;
        if (node.type === 'ObjectExpression') {
            const props = Object.fromEntries(node.properties.filter(p => p.type === 'ObjectProperty').map(p => [p.key.name ?? p.key.value, p.value]));
            if (props.id?.value === id && props.talents && props.promotions) {
                found = Object.fromEntries(['id','name','attributes','promotions','talents','passives','constellations','assets'].map(key => [key,literal(props[key])]));
                return;
            }
        }
        for (const [key, child] of Object.entries(node)) if (!['loc','start','end'].includes(key)) {
            if (Array.isArray(child)) child.forEach(visit);
            else if (child && typeof child === 'object') visit(child);
        }
    }
    for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) if (match[1].includes('talents:[')) {
        const tree = parser.parse(match[1], {sourceType:'unambiguous'});
        indexedLiterals = new Map();
        function collect(node) {
            if (!node || typeof node !== 'object') return;
            if (node.type === 'AssignmentExpression' && node.operator === '=' && node.left.type === 'MemberExpression'
                && node.left.object.type === 'Identifier' && node.left.property.type === 'NumericLiteral') {
                const name = node.left.object.name;
                if (!indexedLiterals.has(name)) indexedLiterals.set(name, []);
                indexedLiterals.get(name)[node.left.property.value] = literal(node.right);
            }
            for (const [key, child] of Object.entries(node)) if (!['loc','start','end'].includes(key)) {
                if (Array.isArray(child)) child.forEach(collect);
                else if (child && typeof child === 'object') collect(child);
            }
        }
        collect(tree);
        visit(tree);
    }
    if (!found) throw Error('Missing character ' + id);
    return found;
}
const data = {revision:'7.1.0 D48145775', characters:[character(10000140),character(10000143)]};
fs.writeFileSync(path.join(root, 'beta-data/characters-release-71.json'), JSON.stringify(data,null,2)+'\n');
console.log(data.characters.map(c => [c.id,c.name.text,c.talents.length,c.passives.length,c.constellations.length]));
