import {BUILTIN_TEAM_DPS_AXES} from './team-dps-builtins.mjs';
import {parseTeamDpsConfiguration,validateTeamDpsConfiguration} from './team-dps-config.mjs';
export const teamDpsLibraryKey=accountId=>'mona_account_team_dps_configurations_'+accountId;
// Module lifetime keeps pending writes ordered across account changes/remounts.
const libraryWrites=new Map();
export function saveTeamDpsLibrary(backend,accountId,library){
 const key=teamDpsLibraryKey(accountId),snapshot=JSON.parse(JSON.stringify(library));
 const write=(libraryWrites.get(accountId)||Promise.resolve()).then(()=>backend.setItem(key,snapshot));
 // This is a settlement barrier only; callers receive the original rejection
 // and report it. A failed write must not prevent the next explicit retry.
 const settled=write.then(()=>undefined,()=>undefined);libraryWrites.set(accountId,settled);
 settled.then(()=>{if(libraryWrites.get(accountId)===settled)libraryWrites.delete(accountId);});
 return write;
}
export async function loadTeamDpsLibrary(backend,accountId){
 await libraryWrites.get(accountId);
 return backend.getItem(teamDpsLibraryKey(accountId));
}
export const emptyTeamDpsLibrary=()=>({entries:[],nextId:1,selectedId:null});
export function installTeamDpsBuiltins(library){
 if(library.builtinAxesVersion===1)return false;
 const wasEmpty=library.entries.length===0;
 for(const axis of BUILTIN_TEAM_DPS_AXES){
  if(!library.entries.some(entry=>entry.axis.id===axis.id&&entry.axis.format===axis.format))library.entries.push({key:library.nextId++,axis:JSON.parse(JSON.stringify(axis))});
 }
 if(wasEmpty&&library.selectedId===null)library.selectedId=library.entries[0].key;
 library.builtinAxesVersion=1;
 return true;
}
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
