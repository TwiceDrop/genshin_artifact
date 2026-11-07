import test from 'node:test';import assert from 'node:assert/strict';
import {compareTeamResults,compareNativeTeamResults,compareEventValues,nativeEventTrace} from './helpers/team-dps-result-comparison.mjs';
function fixture(){
 const hit={eventId:'hit-1',kind:'hit',time:1,role:0,expectation:10,critical:20,non_critical:5,analysis:{atk:{base:80,buff:20},normal:{expectation:10,critical:20,non_critical:5}}},row={expectation:10,critical:20,non_critical:5,total_damage:10,duration:2,dps:5,profiles:[],panels:[{atk:{base:80,buff:20}}],artifacts:[{flower:1}],hits:[hit],health:[{eventId:'health-1',kind:'heal',time:1,role:0,hp:[80],ratios:[.8],maxHP:[100],fanfare:100,overflow:0}]},native={results:[row],baseline:row,artifacts:[row.artifacts],evaluated_teams:1,elapsed_ms:10};
 const compiled=structuredClone(native);for(const value of [compiled.results[0],compiled.baseline]){value.eventTrace=nativeEventTrace(value);value.panels=[{atk:{compiled:100}}];for(const e of value.eventTrace.events)if(e.channel==='hits')for(const s of e.states)s.value.analysis.atk={compiled:100};}for(const value of [compiled.results[0],compiled.baseline]){delete value.hits;delete value.health;}compiled.compile_ms=3;compiled.compute_backend='cpu';return {native,compiled};
}
test('native-to-compiled comparison checks rankings, panels and actual state values',()=>{
 const {native,compiled}=fixture();compareNativeTeamResults(compiled,native);
 for(const mutate of [x=>x.results[0].expectation++,x=>x.results[0].panels[0].atk.compiled++,x=>x.results[0].eventTrace.events[0].states[0].probability=.5,x=>x.results[0].eventTrace.events[0].eventId='wrong-hit',x=>delete x.results[0].eventTrace]){const bad=structuredClone(compiled);mutate(bad);assert.throws(()=>compareNativeTeamResults(bad,native));}
});
test('equal marginals cannot conceal a different HP/fanfare correlation',()=>{
 const trace={events:[{channel:'health',eventId:'health',states:[{probability:.5,value:{kind:'heal',time:1,hp:[80],fanfare:100}},{probability:.5,value:{kind:'heal',time:1,hp:[100],fanfare:150}}]}]},wrong=structuredClone(trace);[wrong.events[0].states[0].value.fanfare,wrong.events[0].states[1].value.fanfare]=[150,100];assert.throws(()=>compareEventValues(wrong,trace));compareEventValues(structuredClone(trace),trace);
});
test('same-format comparison ignores timing only and retains the full tree',()=>{
 const {compiled}=fixture(),other=structuredClone(compiled);other.elapsed_ms=20;other.compile_ms=5;compareTeamResults(other,compiled);other.results[0].eventTrace.events[0].states[0].value.analysis.atk.compiled++;assert.throws(()=>compareTeamResults(other,compiled));
});
