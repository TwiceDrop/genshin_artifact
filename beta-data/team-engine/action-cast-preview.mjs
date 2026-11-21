import {characterPackages} from './character-packages.mjs';
import {normalizeTeamProfiles} from './registry.mjs';
import {compileActionAxis} from './timeline.mjs';
import {defaultTeamCharacter} from '../team-dps-character-rules.mjs';
import {castDurationMs} from './action-timing.mjs';

// Shared preview context: animation sizing and the native coefficient preview
// must use the same character configuration and character-state resolution.
export function createSkillPreviewProfiles(axis,characters){
 return axis.members.map(({character},r)=>({
  character:structuredClone(characters?.[r]??defaultTeamCharacter(character)),
  weapon:{name:characterPackages[character].previewWeapon,level:1,ascend:false,refine:1,params:'NoConfig'},
  artifacts:[],artifact_config:{},buffs:[],
 }));
}
export function actionCastTimings(rotation,profiles){
 return rotation.roots.filter(a=>a.kind==='cast'||a.kind==='action').flatMap(a=>{
  const {character}=profiles[a.role];
  const frames=characterPackages[character.name].castFrames?.(a,rotation,character);
  return frames===undefined?[]:[{id:a.id,frames,durationMs:castDurationMs(frames)}];
 });
}
// No WASM is needed to determine the width of a tentative drag placement.
export function previewActionCasts(axis,characters){
 const profiles=normalizeTeamProfiles(createSkillPreviewProfiles(axis,characters));
 return actionCastTimings(compileActionAxis(axis,profiles),profiles);
}
