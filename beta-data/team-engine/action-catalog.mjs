import {characterPackages} from './character-packages.mjs';

export const TEAM_ACTION_CATALOG=Object.fromEntries(
 Object.values(characterPackages).map(character=>[character.id,character.actions]),
);
