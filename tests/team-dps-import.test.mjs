import test from 'node:test';
import assert from 'node:assert/strict';
import {api} from '../beta-tools/runtime-7106.mjs';
import {fixture} from '../beta-tools/interface-audit-7108.mjs';
import {importedAxis} from './helpers/team-dps-configuration.mjs';
import {compileTeamDpsAxis} from '../beta-data/team-dps-rotation.mjs';
import {parseTeamDpsConfiguration,TEAM_DPS_ROLES} from '../beta-data/team-dps-config.mjs';
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';
import {optimizeTeamDps} from '../beta-data/team-dps-optimizer.mjs';
import {emptyTeamDpsLibrary,importTeamDpsConfiguration,updateTeamDpsConfiguration,deleteTeamDpsConfiguration,exportTeamDpsConfiguration} from '../beta-data/team-dps-library.mjs';

test('imported data changes actual events, coverage, duration and joint scores',()=>{
 const profiles=TEAM_DPS_ROLES.map((name,r)=>{const p=fixture(name);p.artifacts=p.artifacts.map(a=>({...a,id:a.id+r*100}));return p;});
 const builds=profiles.map(p=>p.artifacts),input={single_interfaces:profiles,team_dps:{axis:importedAxis(),enemy:{level:100,hydro_res:.1,cryo_res:.1},initial_ids:builds.map(b=>b.map(a=>a.id)),result_count:2,max_evaluations:20,metric:'expectation'}};
 const base=createTeamDpsEvaluator(api,input).evaluate(builds,true);
 const changed=structuredClone(input);changed.team_dps.axis.durationMs=21000;changed.team_dps.axis.coverage.fanfare.endMs=1000;
 const hit=changed.team_dps.axis.timeline.find(e=>e.action==='skirk.normal.1');hit.timeMs=7250;
 const result=createTeamDpsEvaluator(api,changed).evaluate(builds,true);
 assert.equal(result.duration,21);assert.equal(result.dps,result.expectation/21);assert.ok(result.expectation<base.expectation);
 assert.ok(result.hits.some(h=>h.role===0&&h.time===7.25&&!h.onField));
 assert.equal(result.hits.find(h=>h.role===1&&h.time===2.5).bonus<base.hits.find(h=>h.role===1&&h.time===2.5).bonus,true);
 const finite=structuredClone(input);finite.team_dps.axis.coverage.vodyFlat.frontUses=1;finite.team_dps.axis.coverage.vodyFlat.backUses=2;
 const events=compileTeamDpsAxis(finite.team_dps.axis,profiles).events;
 assert.equal(events.filter(e=>e.onField&&e.vodyFlat).length,1);assert.equal(events.filter(e=>!e.onField&&e.vodyFlat).length,2);
 const tied=importedAxis(),switchIndex=tied.timeline.findIndex(e=>e.kind==='switch'&&e.actor==='carry'),switchEvent=tied.timeline.splice(switchIndex,1)[0];switchEvent.timeMs=7750;tied.timeline.push(switchEvent);
 assert.equal(compileTeamDpsAxis(tied,profiles).events.find(e=>e.role===0).onField,false);
 const optimized=optimizeTeamDps(api,input,builds.flat());assert.ok(optimized.results.length>0);assert.equal(new Set(optimized.results[0].artifacts.flatMap(Object.values)).size,20);
 assert.equal(optimized.results[0].hits.length,83);
 assert.throws(()=>parseTeamDpsConfiguration(JSON.stringify({...importedAxis(),mechanics:'missing/1'})),/未实现的机制/);
});

test('configuration library starts empty and round-trips without preset or result data',()=>{
 const library=emptyTeamDpsLibrary();assert.equal(library.entries.length,0);
 const text=exportTeamDpsConfiguration(importedAxis()),entry=importTeamDpsConfiguration(library,text);assert.equal(library.selectedId,entry.key);
 const invalid=JSON.parse(text);invalid.timeline[0].kind='execute';const before=JSON.stringify(library);
 assert.throws(()=>importTeamDpsConfiguration(library,JSON.stringify(invalid)),/未实现的事件类型/);assert.equal(JSON.stringify(library),before);
 const changed=structuredClone(entry.axis);changed.title='合成修订';changed.durationMs=21000;updateTeamDpsConfiguration(library,entry.key,changed);
 const other=emptyTeamDpsLibrary();importTeamDpsConfiguration(other,exportTeamDpsConfiguration(entry.axis));assert.deepEqual(other.entries[0].axis,changed);
 assert.equal('single_interfaces' in other.entries[0].axis,false);assert.equal('artifacts' in other.entries[0].axis,false);
 deleteTeamDpsConfiguration(library,entry.key);assert.deepEqual(library.entries,[]);assert.equal(library.selectedId,null);
});
