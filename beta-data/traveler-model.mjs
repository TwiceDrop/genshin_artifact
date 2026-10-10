const elements = ['Anemo', 'Geo', 'Electro', 'Dendro', 'Hydro', 'Pyro', 'Cryo'];
const aliases = { Wind: 'Anemo', Rock: 'Geo', Electric: 'Electro', Grass: 'Dendro', Water: 'Hydro', Fire: 'Pyro', Ice: 'Cryo' };
export function travelerName(id, element) {
    if (id !== 10000005 && id !== 10000007) return undefined;
    return (id === 10000005 ? 'Aether' : 'Lumine') + (aliases[element] || element);
}
export function travelerModelName(name) {
    return elements.some(element => name === 'Lumine' + element) ? name.replace('Lumine', 'Aether') : name;
}
// Formal 7.1.0 D/R48145775: all seven elements share these sex differences.
// Other level/ascension stats, talent parameters, passives and constellations
// were compared separately. Published Aether coefficients use four decimals.
export const LUMINE_CHARGED_SECOND = [.7224,.7812,.84,.924,.9828,1.05,1.1424,1.2348,1.3272,1.428,1.5288,1.6296,1.7304,1.8312,1.932];
export const AETHER_CHARGED_FIRST = [.559,.6045,.65,.715,.7605,.8125,.884,.9555,1.027,1.105,1.183,1.261,1.339,1.417,1.495];
export const AETHER_CHARGED_SECOND = [.6072,.6566,.706,.7766,.826,.8825,.9602,1.0378,1.1155,1.2002,1.2849,1.3696,1.4544,1.5391,1.6238];
