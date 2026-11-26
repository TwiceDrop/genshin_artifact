import {validateCatalogAxis} from '../axis-format.mjs';
import {TEAM_ACTION_CATALOG} from './action-catalog.mjs';
import {defaultTeamCharacter} from '../team-dps-character-rules.mjs';
import {compileActionAxis} from './timeline.mjs';
export {TEAM_ACTION_CATALOG};
export {actionAxisTimeline} from './action-timing.mjs';
export const TEAM_ACTION_RULES_VERSION='mona-team-engine/58';
export function createActionAxis(id,characters){
 const members=characters.map((character,i)=>({slot:'member'+(i+1),character}));
 return {format:'mona-action-axis',formatVersion:1,rulesVersion:TEAM_ACTION_RULES_VERSION,id,title:'新动作轴',endHit:'include',initialActiveSlot:members[0].slot,members,timeline:[]};
}
export function actionAxisDurationMs(c,profiles){
 const members=profiles??c.members.map(m=>({character:defaultTeamCharacter(m.character),weapon:{name:''}}));
 return compileActionAxis(c,members).duration*1000;
}
// The action format has its own data contract; legacy coverage is not migrated.
export const validateActionAxis=c=>validateCatalogAxis(c,TEAM_ACTION_CATALOG);
