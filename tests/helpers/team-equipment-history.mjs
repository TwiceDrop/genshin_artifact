import {candidateCharacterInput,characterTeams} from './team-character-runtime.mjs';
import {action} from './team-effect-refactor.mjs';
import {weapon} from '../../beta-tools/interface-audit-7108.mjs';
export {historyAxis} from './team-equipment-history-axis.mjs';
export const historyCases=['PrototypeRancour','MistsplitterReforged','LightOfFoliarIncision','KeyOfKhajNisut','PeakPatrolSong','FreedomSworn','PaleFlame','NymphsDream','LongNightsOath','ScrollOfTheHeroOfCinderCity','Instructor','DawningFrost','NightweaversLookingGlass','SerenitysCall'];
export const historyTeams=characterTeams;
export function historyInput(name){
 const input=candidateCharacterInput('furina-gated');
 input.single_interfaces[2].character.constellation=0;
 for(const a of input.team_dps.axis.timeline)if(a.action==='plunge')a.action='normal.2';
 input.team_dps.axis.id='synthetic-history-'+name;
 if(['DawningFrost','NightweaversLookingGlass','SerenitysCall'].includes(name)){
  input.single_interfaces[3].weapon=weapon(name);input.single_interfaces[3].character.constellation=0;
  input.team_dps.axis.timeline=[action('probe','Vodyanitsa','skill',0),action('n','Vodyanitsa','normal.1',1000),action('c','Vodyanitsa','charged',2000),action('n2','Vodyanitsa','normal.1',3000)];
 }else if(['PaleFlame','NymphsDream','LongNightsOath','ScrollOfTheHeroOfCinderCity','Instructor'].includes(name)){
  input.single_interfaces[1].weapon=weapon('DullBlade');input.single_interfaces[1].artifacts.forEach(a=>a.set_name=name);
 }else input.single_interfaces[1].weapon=weapon(name);
 return input;
}
