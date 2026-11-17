import test from 'node:test';
import assert from 'node:assert/strict';
import {api} from '../beta-tools/runtime.mjs';
import {createSkillMultiplierPreview} from '../beta-data/team-engine/multiplier-preview.mjs';
import {createActionAxis} from '../beta-data/team-engine/action-config.mjs';
import {createSkillPreviewProfiles} from '../beta-data/team-engine/action-cast-preview.mjs';

const action=(id,actor,skill,timeMs)=>({id,actor,kind:'action',action:skill,timeMs});
const details=(preview,key)=>preview.windows.find(w=>w.key===key).details.join('\n');
function fixture(){
 const axis=createActionAxis('synthetic-details',['Skirk','Furina','Escoffier','Vodyanitsa']);
 axis.timeline=[action('q','member2','burst',0),action('e','member3','skill',2100),action('v','member4','skill',3000)];
 return axis;
}
test('hover details expose rule values and panel-dependent formulas without changing coefficient output',()=>{
 const axis=fixture(),characters=createSkillPreviewProfiles(axis).map(p=>p.character),before=structuredClone({axis,characters});
 const c0=createSkillMultiplierPreview(api,axis,characters,true),c2=createSkillMultiplierPreview(api,axis,characters,true,[0,2,2,2]);
 assert.match(details(c0,'escoffier.a4'),/55%/);
 assert.match(details(c0,'vodyanitsa.skill.resistance'),/31\.8%/);
 assert.match(details(c0,'fanfare'),/0\.25%/);
 assert.match(details(c0,'fanfare'),/75%/);
 assert.match(details(c2,'fanfare'),/100%/);
 assert.match(details(c2,'escoffier.c1'),/60%/);
 assert.match(details(c2,'escoffier.c2'),/240%/);
 assert.match(details(c2,'vodyanitsa.c1'),/0\.8%/);
 const flat=details(c2,'vodyFlat');
 for(const value of ['40000','14%','3500','26%','6500','25','10'])assert.ok(flat.includes(value),value);
 assert.deepEqual(c2.roles,c0.roles);
 assert.deepEqual({axis,characters},before);
 for(const window of c2.windows){assert.ok(window.details.length>0,window.key);assert.doesNotMatch(window.details.join('\n'),/作用对象/);}
});

test('Escoffier resistance detail follows the actual Hydro/Cryo count',()=>{
 const axis=fixture();axis.members[0].character='Sucrose';
 const preview=createSkillMultiplierPreview(api,axis,undefined,true);
 assert.match(details(preview,'escoffier.a4'),/15%/);
 assert.doesNotMatch(details(preview,'escoffier.a4'),/55%/);
});

test('Skirk burst window describes its own absorbed-rift value and constellation',()=>{
 const axis=fixture();axis.timeline=[action('e','member1','skill',0),{...action('q','member1','burst',1000),params:{absorbedRifts:3}}];
 const c0=createSkillMultiplierPreview(api,axis,undefined,true),c2=createSkillMultiplierPreview(api,axis,undefined,true,[2,0,0,0]);
 assert.match(details(c0,'skirkC2'),/20%/);
 assert.match(details(c0,'skirkC2'),/最多 10 次普攻命中生效/);
 assert.doesNotMatch(details(c0,'skirkC2'),/70%/);
 assert.match(details(c2,'skirkC2'),/70%/);
 assert.ok(details(c2,'skirkPhase').length>0);
});
