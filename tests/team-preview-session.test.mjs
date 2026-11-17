import test from 'node:test';
import assert from 'node:assert/strict';
import {createTeamPreviewSession} from '../src/pages/TeamOptimizationPage/team-preview-session.mjs';
test('preview waits 50ms, reuses its worker, and never displays an obsolete result',t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const workers=[],sent=[],results=[],errors=[];
 const session=createTeamPreviewSession({createWorker:()=>{const w={postMessage:x=>sent.push(x),terminate(){this.closed=true}};workers.push(w);return w},onResult:x=>results.push(x),onError:x=>errors.push(x)});
 const reply=data=>workers[0].onmessage({data});
 session.update({axis:{id:'first'}});reply({type:'ready'});
 t.mock.timers.tick(49);assert.equal(sent.length,0);t.mock.timers.tick(1);assert.equal(sent.length,1);
 session.update({axis:{id:'second'}});session.update({axis:{id:'third'}});t.mock.timers.tick(50);
 assert.equal(workers.length,1);assert.equal(sent.length,1);
 reply({type:'result',requestId:sent[0].requestId,result:'obsolete'});
 assert.equal(results.length,0);assert.equal(sent.length,2);assert.equal(sent[1].axis.id,'third');
 reply({type:'result',requestId:sent[1].requestId,result:'latest'});assert.deepEqual(results,['latest']);
 session.update({axis:{id:'fourth'}});t.mock.timers.tick(50);reply({type:'error',requestId:sent[2].requestId,message:'bad axis'});assert.deepEqual(errors,['bad axis']);
 session.dispose();assert.equal(workers[0].closed,true);
});
test('empty worker load error is visible and a subsequent edit can retry',t=>{
 t.mock.timers.enable({apis:['setTimeout']});const workers=[],errors=[];
 const session=createTeamPreviewSession({createWorker:()=>{const w={terminate(){this.closed=true},postMessage(){}};workers.push(w);return w},onResult(){},onError:message=>errors.push(message)});
 session.update({axis:{}});workers[0].onerror({});assert.deepEqual(errors,['技能预览加载失败，请刷新页面后重试。']);assert.equal(workers[0].closed,true);
 session.update({axis:{}});assert.equal(workers.length,2);session.dispose();
});
