import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {BUILTIN_TEAM_DPS_AXES} from '../beta-data/team-dps-builtins.mjs';
import {emptyTeamDpsLibrary,installTeamDpsBuiltins} from '../beta-data/team-dps-library.mjs';
import {validateTeamDpsConfiguration} from '../beta-data/team-dps-config.mjs';
import {actionAxisDurationMs} from '../beta-data/team-engine/action-config.mjs';
test('built-in axes initialize once and preserve existing axes and selection',()=>{
 const library={entries:[{key:8,axis:{id:'custom',title:'user draft'}},{key:9,axis:{id:BUILTIN_TEAM_DPS_AXES[0].id,format:'mona-action-axis',title:'user edit'}}],nextId:10,selectedId:8};
 const before=JSON.stringify(library.entries);assert.equal(installTeamDpsBuiltins(library),true);assert.equal(JSON.stringify(library.entries.slice(0,2)),before);assert.equal(library.selectedId,8);assert.equal(library.entries.length,3);assert.equal(library.entries[2].axis.id,BUILTIN_TEAM_DPS_AXES[1].id);
 const snapshot=JSON.stringify(library);assert.equal(installTeamDpsBuiltins(library),false);assert.equal(JSON.stringify(library),snapshot);
 const fresh=emptyTeamDpsLibrary();installTeamDpsBuiltins(fresh);assert.equal(fresh.entries.length,2);assert.equal(fresh.selectedId,fresh.entries[0].key);fresh.entries[0].axis.title='edited';assert.notEqual(fresh.entries[0].axis.title,BUILTIN_TEAM_DPS_AXES[0].title);
});
test('two built-in action axes match shipped JSON and use current rules',()=>{
 const files=['skirk-vodyanitsa-actions.json','skirk-mona-actions-22s.json'];
 for(let i=0;i<files.length;i++){const axis=BUILTIN_TEAM_DPS_AXES[i];assert.deepEqual(axis,JSON.parse(fs.readFileSync('examples/team-dps/'+files[i],'utf8')));validateTeamDpsConfiguration(axis);assert.equal(axis.rulesVersion,'mona-team-engine/28');assert.equal(axis.members.length,4);assert.ok(actionAxisDurationMs(axis)>0);}
 assert.equal(actionAxisDurationMs(BUILTIN_TEAM_DPS_AXES[0]),20500);assert.deepEqual(BUILTIN_TEAM_DPS_AXES.map(a=>a.members[3].character),['Vodyanitsa','Mona']);
});
