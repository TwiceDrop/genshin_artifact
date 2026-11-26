import {validateActionAxis} from './team-engine/action-config.mjs';
import {characterPackages} from './team-engine/character-packages.mjs';
import {validateLegacyAxis} from './axis-format.mjs';
export {TEAM_DPS_ROLES,TEAM_DPS_SLOTS,TEAM_DPS_MECHANICS,TEAM_DPS_ACTIONS,TEAM_DPS_REACTIONS} from './axis-format.mjs';
export const TEAM_DPS_CHARACTER_CAPABILITIES={
 ...Object.fromEntries(Object.values(characterPackages).map(character=>[character.id,character.capabilities])),
 Mavuika:{energy:0,shield:false,nightsoul:true,arkhe:false},
 Amber:{energy:40,shield:false,nightsoul:false,arkhe:false},Noelle:{energy:60,shield:true,nightsoul:false,arkhe:false},
 Kirara:{energy:60,shield:true,nightsoul:false,arkhe:false},
};
export function parseTeamDpsConfiguration(text){return validateTeamDpsConfiguration(JSON.parse(text));}
export const validateTeamDpsConfiguration=c=>c?.format==='mona-action-axis'?validateActionAxis(c):validateLegacyAxis(c);
