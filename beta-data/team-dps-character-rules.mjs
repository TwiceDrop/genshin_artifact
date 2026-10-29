import {characterPackages} from './team-engine/character-packages.mjs';
export {teamTalentUnlocked} from './team-engine/character-levels.mjs';

export const TEAM_CONSTELLATION_TALENTS=Object.fromEntries(
 Object.values(characterPackages).map(character=>[character.id,character.constellationTalents]),
);

// Stored talents already include constellation levels. Apply only the change.
export function changeTeamConstellation(character,next){
 for(const [level,skill]of Object.entries(TEAM_CONSTELLATION_TALENTS[character.name])){
  const delta=3*(Number(next>=Number(level))-Number(character.constellation>=Number(level)));
  if(delta)character[skill]=Math.min(14,Math.max(0,character[skill]+delta));
 }
 character.constellation=next;
}
