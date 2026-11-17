import test from 'node:test';
import assert from 'node:assert/strict';
import {pointerTime,edgeVelocity,stackBlocks} from '../src/pages/TeamOptimizationPage/timeline-layout.mjs';
import {createSkillMultiplierPreview} from '../beta-data/team-engine/multiplier-preview.mjs';
import {createActionAxis} from '../beta-data/team-engine/action-config.mjs';
import {api} from '../beta-tools/runtime.mjs';
import {createSkillPreviewProfiles} from '../beta-data/team-engine/action-cast-preview.mjs';
import {mergeBuffCoverage} from '../beta-data/team-engine/buff-window-preview.mjs';

test('timeline dragging accounts for scroll, grab offset and 100ms snapping',()=>{
 assert.equal(pointerTime(314,100,640,64),10000);
 assert.equal(pointerTime(100,100,0),0);
 assert.equal(pointerTime(257,100,0),100);
 assert.equal(edgeVelocity(400,150,800),0);
 assert.equal(edgeVelocity(800,150,800),18);
 assert.equal(edgeVelocity(150,150,800),-18);
});
test('overlapping blocks remain selectable without altering equal-time order',()=>{
 const input=[{id:'a',order:0,timeMs:0},{id:'b',order:1,timeMs:0},{id:'c',order:2,timeMs:3000}];
 const blocks=stackBlocks(input,132);
 assert.deepEqual(blocks.map(b=>[b.id,b.level]),[['a',0],['b',1],['c',0]]);
 assert.equal(input[0].level,undefined);
});
test('timeline preview uses engine window expiry and effect refresh times',()=>{
 const axis=createActionAxis('synthetic-editor',['Skirk','Furina','Escoffier','Vodyanitsa']);
 axis.timeline=[{id:'e',actor:'member4',kind:'action',action:'skill',timeMs:2000},{id:'q',actor:'member1',kind:'action',action:'burst',timeMs:5000}];
 const before=JSON.stringify(axis),preview=createSkillMultiplierPreview(api,axis,undefined,true);
 const {details,...song}=preview.windows.find(w=>w.key==='vodySong');
 assert.deepEqual(song,{key:'vodySong',role:3,start:2,end:18});
 assert.deepEqual(preview.windows.filter(w=>w.key==='vodyanitsa.skill.resistance').map(w=>[w.start,w.end]),[[2,5],[5,11]]);
 assert.equal(JSON.stringify(axis),before);
 assert.ok(preview.roles[0].hits.length>0);
});

test('Vodyanitsa displays one Tearsong coverage bar for its front/back pools',()=>{
 const axis=createActionAxis('synthetic-buff',['Skirk','Furina','Escoffier','Vodyanitsa']);
 axis.timeline=[{id:'e',actor:'member4',kind:'action',action:'skill',timeMs:0}];
 const preview=createSkillMultiplierPreview(api,axis,undefined,true);
 const bars=preview.windows.filter(w=>w.key==='vodyFlat'||w.key.startsWith('vodyanitsa.a4.'));
 assert.deepEqual(bars.map(w=>[w.key,w.role,w.start,w.end]),[['vodyFlat',3,0,30]]);
});

test('Escoffier displays resistance from the initial hit through the last refresh plus 12 seconds',()=>{
 const axis=createActionAxis('synthetic-buff',['Skirk','Furina','Escoffier','Vodyanitsa']);
 axis.timeline=[{id:'e',actor:'member3',kind:'action',action:'skill',timeMs:0}];
 const preview=createSkillMultiplierPreview(api,axis,undefined,true);
 const bars=preview.windows.filter(w=>w.key==='escoffier.a4');
 assert.equal(bars.length,1);
 assert.equal(bars[0].role,2);
 assert.ok(Math.abs(bars[0].start-23/60)<1e-9);
 assert.ok(Math.abs(bars[0].end-(83/60+12))<1e-9);
 assert.equal(bars[0].label,'爱可菲·灵感浸入调味');
});

test('coverage follows the last remaining pool and preserves gaps and source roles',()=>{
 const windows=[{key:'buff',role:3,start:0,end:2},{key:'buff',role:3,start:0,end:4},{key:'buff',role:3,start:8,end:38},{key:'buff',role:2,start:0,end:5}];
 const before=structuredClone(windows);
 assert.deepEqual(mergeBuffCoverage(windows),[{key:'buff',role:3,start:0,end:4},{key:'buff',role:3,start:8,end:38},{key:'buff',role:2,start:0,end:5}]);
 assert.deepEqual(windows,before);
});

test('locked talents do not display Escoffier resistance or a raw Tearsong placeholder',()=>{
 const axis=createActionAxis('synthetic-locked',['Skirk','Furina','Escoffier','Vodyanitsa']);
 axis.timeline=[{id:'e',actor:'member3',kind:'action',action:'skill',timeMs:0},{id:'v',actor:'member4',kind:'action',action:'skill',timeMs:2000}];
 const characters=createSkillPreviewProfiles(axis).map(p=>({...p.character,level:1}));
 const preview=createSkillMultiplierPreview(api,axis,characters,true);
 assert.equal(preview.windows.filter(w=>w.key==='escoffier.a4'||w.key==='vodyFlat'||w.key.startsWith('vodyanitsa.a4.')).length,0);
});

test('Escoffier burst resistance retains the gap after expiry',()=>{
 const axis=createActionAxis('synthetic-refresh',['Skirk','Furina','Escoffier','Vodyanitsa']);
 axis.timeline=[{id:'q1',actor:'member3',kind:'action',action:'burst',timeMs:0},{id:'q2',actor:'member3',kind:'action',action:'burst',timeMs:20000}];
 assert.deepEqual(createSkillMultiplierPreview(api,axis,undefined,true).windows.filter(w=>w.key==='escoffier.a4').map(w=>[w.start,w.end]),[[0,12],[20,32]]);
});

test('preview constellations change only BUFF windows and never saved characters, multipliers or cast timing',()=>{
 const axis=createActionAxis('synthetic-preview-cons',['Skirk','Furina','Escoffier','Vodyanitsa']);
 axis.timeline=axis.members.map((member,r)=>({id:'e'+r,actor:member.slot,kind:'action',action:'skill',timeMs:r*1000}));
 const characters=createSkillPreviewProfiles(axis).map(p=>p.character),before=structuredClone({axis,characters});
 const base=createSkillMultiplierPreview(api,axis,characters,true);
 const preview=createSkillMultiplierPreview(api,axis,characters,true,[6,6,6,6]);
 const {windows:baseWindows,...baseCalculation}=base,{windows,...previewCalculation}=preview;
 assert.deepEqual(previewCalculation,baseCalculation);
 assert.deepEqual({axis,characters},before);
 assert.equal(baseWindows.some(w=>w.key==='escoffier.c1'||w.key==='escoffier.c2'),false);
 assert.ok(windows.some(w=>w.key==='escoffier.c1'));
 assert.ok(windows.some(w=>w.key==='escoffier.c2'));
 assert.equal(baseWindows.find(w=>w.key==='vodySong').end,19);
 assert.equal(windows.find(w=>w.key==='vodySong').end,28);
 assert.deepEqual(createSkillMultiplierPreview(api,axis,characters,true,[0,0,0,0]),base);
});
