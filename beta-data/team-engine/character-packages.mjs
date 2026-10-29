import {skirk} from './characters/skirk.mjs';
import {furina} from './characters/furina.mjs';
import {escoffier} from './characters/escoffier.mjs';
import {vodyanitsa} from './characters/vodyanitsa.mjs';
import {mona} from './characters/mona.mjs';

// One registration point. Catalogs are projections of these packages, not
// independent character lists. The runtime and UI import the same definitions.
export const characterPackages=Object.fromEntries(
 [skirk,furina,escoffier,vodyanitsa,mona].map(character=>[character.id,character]),
);
