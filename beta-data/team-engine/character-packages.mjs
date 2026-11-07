import {skirk} from './characters/skirk.mjs';
import {furina} from './characters/furina.mjs';
import {escoffier} from './characters/escoffier.mjs';
import {vodyanitsa} from './characters/vodyanitsa.mjs';
import {mona} from './characters/mona.mjs';
import {alyosha} from './characters/alyosha.mjs';
import {yaeMiko} from './characters/yae-miko.mjs';
import {qiqi} from './characters/qiqi.mjs';
import {odette} from './characters/odette.mjs';
import {sandrone} from './characters/sandrone.mjs';
import {mitya} from './characters/mitya.mjs';
import {valeriy} from './characters/valeriy.mjs';
import {sucrose} from './characters/sucrose.mjs';
import {vesna} from './characters/vesna.mjs';
import {faruzan} from './characters/faruzan.mjs';

// One registration point. Catalogs are projections of these packages, not
// independent character lists. The runtime and UI import the same definitions.
export const characterPackages=Object.fromEntries(
 [skirk,furina,escoffier,vodyanitsa,mona,alyosha,yaeMiko,qiqi,odette,sandrone,mitya,valeriy,sucrose,vesna,faruzan].map(character=>[character.id,character]),
);
