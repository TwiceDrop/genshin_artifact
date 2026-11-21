import test from 'node:test';
import assert from 'node:assert/strict';
import {characterPackages} from '../beta-data/team-engine/character-packages.mjs';
import {stackBlocks,snapToTimelineEdge,findTimelineSnap,nudgeActionTime,actionBlockWidth} from '../src/pages/TeamOptimizationPage/timeline-layout.mjs';

test('unmeasured normal attacks snap to their visible end on the tenth-second grid',()=>{
 const width=actionBlockWidth(undefined),row={id:'normal',timeMs:0,width};
 assert.equal(findTimelineSnap(2300,[row],'new',500),2100);
 assert.equal(width,2.1*64);
 assert.equal(row.durationMs,undefined);
});

test('drag magnets capture cross-role edges and ignore the moving block',()=>{
 const rows=[{id:'a',actor:'member1',timeMs:1000,durationMs:2000},{id:'b',actor:'member2',timeMs:3200}];
 assert.equal(findTimelineSnap(3218.75,rows,'b',250),3000);
 assert.equal(findTimelineSnap(3251,rows,'b',250),undefined);
 assert.equal(findTimelineSnap(781.25,rows,'b',250),1000);
 assert.equal(findTimelineSnap(3000,rows,'b',250),3000);
 assert.equal(findTimelineSnap(3200,rows,'a',250),3200);
});
test('32px snapping prefers a nearby skill end over a closer start',()=>{
 const rows=[{id:'previous',timeMs:0,durationMs:2000},{id:'next',timeMs:2400,durationMs:2000},{id:'moving',timeMs:2450,durationMs:600}];
 assert.equal(findTimelineSnap(2450,rows,'moving',500),2000);
 assert.equal(findTimelineSnap(1550,rows,'moving',500),2000);
 assert.equal(findTimelineSnap(501,rows,'moving',500),undefined);
 assert.equal(findTimelineSnap(2501,[rows[0],rows[2]],'moving',500),undefined);
});
import {previewActionCasts} from '../beta-data/team-engine/action-cast-preview.mjs';
import {castDurationMs} from '../beta-data/team-engine/action-timing.mjs';
import {createActionAxis} from '../beta-data/team-engine/action-config.mjs';
import {createSkillMultiplierPreview} from '../beta-data/team-engine/multiplier-preview.mjs';
import {api} from '../beta-tools/runtime.mjs';
test('cast animation metadata is distinct from delayed damage completion',()=>{
 assert.equal(characterPackages.Furina.castFrames?.({action:'skill',arkhe:'ousia'}),54);
 assert.equal(characterPackages.Furina.castFrames?.({action:'burst'}),121);
 assert.equal(characterPackages.Escoffier.castFrames?.({action:'skill'}),35);
 assert.equal(characterPackages.Escoffier.castFrames?.({action:'burst'}),110);
});
test('seconds round to tenths; snapping and keyboard movement do not shift other actions',()=>{
 assert.equal(castDurationMs(53),900);assert.equal(castDurationMs(121),2000);
 const rows=[{id:'e',timeMs:0,durationMs:900},{id:'q',timeMs:3000,durationMs:2000}];
 assert.equal(snapToTimelineEdge(800,rows,'q'),900);assert.equal(snapToTimelineEdge(1100,rows,'q'),1100);
 assert.equal(nudgeActionTime(900,1),1000);assert.equal(nudgeActionTime(900,-1),800);assert.equal(nudgeActionTime(0,-1),0);
 assert.equal(rows[1].timeMs,3000);
 const team=[{id:'a',actor:'member1',timeMs:1000,durationMs:2500},{id:'b',actor:'member2',timeMs:5000,durationMs:900}];
 assert.equal(snapToTimelineEdge(3400,team,'b'),3500);
 assert.equal(snapToTimelineEdge(1100,team,'b'),1000);
 assert.equal(snapToTimelineEdge(5900,team,'b'),5900);
});
test('public preview resolves Skirk burst state and Furina Arkhe without replacing damage clocks',()=>{
 const axis=createActionAxis('synthetic-casts',['Skirk','Furina','Escoffier','Vodyanitsa']);
 const row=(id,actor,action,timeMs)=>({id,actor,action,timeMs,kind:'action'});
 axis.timeline=[row('q','member1','burst',0)];
 let preview=createSkillMultiplierPreview(api,axis);
 assert.equal(preview.casts[0].durationMs,2500);assert.ok(Math.abs(preview.duration-158/60)<1e-10);
 axis.timeline=[row('e','member1','skill',0),row('q','member1','burst',1000)];
 preview=createSkillMultiplierPreview(api,axis);assert.equal(preview.casts.find(c=>c.id==='q').durationMs,700);
 axis.timeline=[row('c','member2','charged',0),row('e','member2','skill',1000),row('v','member4','skill',2000)];
 preview=createSkillMultiplierPreview(api,axis);assert.equal(preview.casts.find(c=>c.id==='e').frames,57);assert.equal(preview.casts.find(c=>c.id==='v').frames,59);
});

test('documented skill, burst and normal timings reach tentative and committed previews',()=>{
 const groups=[
  [['Mona',50,127,29],['YaeMiko',37,114,28],['Qiqi',58,115,21],['Sucrose',68,65,28]],
  [['Alyosha',31,55,34],['Odette',42,126,25],['Sandrone',46,128,53],['Vodyanitsa',59,102,26]],
  [['Skirk',43,151,27],['Escoffier',35,110,22],['Furina',54,121,34],['Faruzan',35,71,26]],
 ];
 for(const group of groups){
  const axis=createActionAxis('synthetic-frame-table',group.map(([name])=>name));
  for(const [index,action] of ['skill','burst','normal.1'].entries()){
   axis.timeline=group.map(([id],role)=>({id,actor:'member'+(role+1),action,kind:'action',timeMs:role*3000}));
   const casts=previewActionCasts(axis);
   assert.deepEqual(casts.map(row=>[row.id,row.frames]),group.map(row=>[row[0],row[index+1]]));
   assert.deepEqual(createSkillMultiplierPreview(api,axis).casts,casts);
  }
 }
});

test('cast variants follow hold input, recasts and quick-arrow consumption',()=>{
 const axis=createActionAxis('synthetic-variants',['Mona','Alyosha','Odette','Faruzan']);
 const rows=[[1,'skill.hold',0],[2,'skill.hold',2],[3,'skill',5],[3,'skill',6],[3,'skill',7],
  [3,'burst',9],[3,'skill',15],[4,'skill',18],[4,'charged',19],[4,'charged',21],[4,'aimed',23]];
 axis.timeline=rows.map(([role,action,t],i)=>({id:String(i),actor:'member'+role,action,kind:'action',timeMs:t*1000}));
 const casts=previewActionCasts(axis);
 assert.deepEqual(casts.map(row=>row.frames),[80,142,42,76,42,126,42,35,60,96,26]);
 assert.deepEqual(createSkillMultiplierPreview(api,axis).casts,casts);
});

test('phase changes size normal attacks and unmeasured actions have no numeric duration',()=>{
 const axis=createActionAxis('synthetic-unknown',['Skirk','Sandrone','Vesna','Mitya']);
 const rows=[[1,'normal.2'],[1,'skill'],[1,'normal.2'],[1,'skill.hold'],[2,'charged'],[3,'skill'],[4,'burst']];
 axis.timeline=rows.map(([role,action],i)=>({id:String(i),actor:'member'+role,action,kind:'action',timeMs:i*1000}));
 assert.deepEqual(previewActionCasts(axis).map(c=>[c.id,c.frames]),[['0',25],['1',43],['2',43]]);
});
test('timeline packing uses each block width, with adjoining blocks on one level',()=>{
 const rows=[{id:'e',timeMs:0,order:0,width:57.6},{id:'q',timeMs:900,order:1,width:128}];
 assert.deepEqual(stackBlocks(rows,row=>row.width).map(r=>r.level),[0,0]);
});
test('tentative and committed animation widths agree without waiting for native preview',()=>{
 const axis=createActionAxis('synthetic-width',['Skirk','Furina','Escoffier','Vodyanitsa']);
 const row=(id,actor,action,timeMs)=>({id,actor,action,timeMs,kind:'action'});
 for(const timeline of [
  [row('e','member2','skill',0)],
  [row('c','member2','charged',0),row('e','member2','skill',2000)],
  [row('e','member1','skill',0),row('q','member1','burst',1000)],
  [row('q','member1','burst',0),row('e','member1','skill',3000)],
  [row('v','member4','skill',0)],
 ]){
  const input={...axis,timeline},before=JSON.stringify(input),casts=previewActionCasts(input);
  assert.deepEqual(casts,createSkillMultiplierPreview(api,input).casts);
  assert.equal(JSON.stringify(input),before);
 }
 assert.equal(actionBlockWidth(900),57.6);assert.equal(actionBlockWidth(700),44.8);assert.equal(actionBlockWidth(undefined),134.4);
 const old={...axis,timeline:[row('q','member1','burst',0),row('e','member1','skill',3000)]};
 const moved={...old,timeline:old.timeline.map(a=>a.id==='q'?{...a,timeMs:4000}:a)};
 assert.equal(previewActionCasts(old).find(a=>a.id==='q').durationMs,2500);
 assert.equal(previewActionCasts(moved).find(a=>a.id==='q').durationMs,700);
});
