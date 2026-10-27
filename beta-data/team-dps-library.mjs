import {parseTeamDpsConfiguration,validateTeamDpsConfiguration} from './team-dps-config.mjs';
export const teamDpsLibraryKey=accountId=>'mona_account_team_dps_configurations_'+accountId;
export const emptyTeamDpsLibrary=()=>({entries:[],nextId:1,selectedId:null});
export function importTeamDpsConfiguration(library,text){
 const axis=parseTeamDpsConfiguration(text),entry={key:library.nextId++,axis};
 library.entries.push(entry);library.selectedId=entry.key;return entry;
}
export function updateTeamDpsConfiguration(library,key,axis){
 validateTeamDpsConfiguration(axis);
 library.entries.find(e=>e.key===key).axis=JSON.parse(JSON.stringify(axis));
}
export function deleteTeamDpsConfiguration(library,key){
 library.entries.splice(library.entries.findIndex(e=>e.key===key),1);
 if(library.selectedId===key)library.selectedId=null;
}
export const exportTeamDpsConfiguration=axis=>JSON.stringify(validateTeamDpsConfiguration(axis),null,2)+'\n';
