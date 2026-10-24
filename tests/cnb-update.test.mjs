import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {UPDATE_SOURCES,sourceUrl,fetchReleaseMetadata,releaseAsset} from '../server/update-sources.mjs';
import {LocalUpdater} from '../server/updates.mjs';
const asset=(version,suffix,size=524288)=>({name:`genshin_artifact_V${version}_${suffix}`,size,browser_download_url:`https://github.com/TwiceDrop/genshin_artifact/releases/download/v${version}/genshin_artifact_V${version}_${suffix}`});
const release=(version='7.1.12')=>({tag_name:`v${version}`,html_url:`https://github.com/TwiceDrop/genshin_artifact/releases/tag/v${version}`,body:'Synthetic CNB update test',assets:['windows_x64_setup.exe','web.zip','android.apk','mobiletest_android.apk'].map(s=>asset(version,s))});
test('CNB uses exact release tag and asset name for EXE/ZIP/two APK channels',()=>{
 assert.equal(UPDATE_SOURCES[0].id,'github');assert.equal(UPDATE_SOURCES.filter(s=>s.id==='cnb').length,1);
 for(const version of ['7.1.11','7.1.12'])for(const kind of ['installer','portable','android','android-test']){
  const a=releaseAsset(release(version),kind);assert.equal(sourceUrl(a.browser_download_url,'cnb'),`https://cnb.cool/twicedrop/genshin_artifact/-/releases/download/v${version}/${a.name}`);
  if(kind==='android')assert.ok(!a.name.includes('mobiletest'));
 }
 assert.throws(()=>sourceUrl('https://github.com/other/repo/releases/download/v7.1.12/package.exe','cnb'),/本项目/);
 assert.equal(sourceUrl('https://github.com/a','github'),'https://github.com/a');
 assert.equal(sourceUrl('https://github.com/a','ghfast'),'https://ghfast.top/https://github.com/a');
});
test('CNB metadata uses its own public JSON endpoint instead of a GitHub proxy',async()=>{
 const calls=[];const fetcher=async url=>{calls.push(url);return new Response(JSON.stringify(release()))};
 assert.equal((await fetchReleaseMetadata(fetcher,true)).tag_name,'v7.1.12');assert.deepEqual(calls,['https://cnb.cool/twicedrop/genshin_artifact/-/releases/latest']);
 calls.length=0;await fetchReleaseMetadata(fetcher,false);assert.deepEqual(calls,['https://cnb.cool/twicedrop/genshin_artifact/-/releases/latest']);
});
test('actual local download follows CNB URL, probes, preserves full bytes, reports truncation and cancels',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'mona-cnb-')),payload=Buffer.alloc(524288,71),requests=[];let mode='complete';payload.write('PK');
 const fixture=http.createServer((req,res)=>{if(req.headers.range){res.writeHead(206,{'Content-Range':`bytes 0-262143/${payload.length}`});res.end(payload.subarray(0,262144));return}if(mode==='short'){res.end(payload.subarray(0,17));return}if(mode==='slow'){res.write(payload.subarray(0,17));return}res.end(payload)});
 await new Promise(r=>fixture.listen(0,'127.0.0.1',r));
 const updater=new LocalUpdater({root:dir,directory:dir,fetchImpl:async(url,options)=>{requests.push(url);if(url.includes('/releases/latest'))return new Response(JSON.stringify(release()));assert.ok(url.startsWith('https://cnb.cool/twicedrop/genshin_artifact/-/releases/download/v7.1.12/'));return fetch(`http://127.0.0.1:${fixture.address().port}/`,options)}});
 try{
  await updater.latest(true);const probe=await updater.probe('v7.1.12','cnb');assert.equal(probe.id,'cnb');assert.ok(probe.speed>0);
  await updater.start('v7.1.12','cnb');await updater.task;assert.equal(updater.status().phase,'ready');assert.deepEqual(await fs.readFile(updater.state.file),payload);await updater.cancel();assert.equal(updater.status().phase,'cancelled');
  mode='short';await updater.start('v7.1.12','cnb');await updater.task;assert.equal(updater.status().phase,'error');assert.match(updater.status().error,/下载不完整/);
  mode='slow';await updater.start('v7.1.12','cnb');await updater.cancel();assert.equal(updater.status().phase,'cancelled');assert.equal(updater.status().error,'');
  assert.ok(requests.filter(u=>u.includes('cnb.cool')).length>=4);
 }finally{fixture.closeAllConnections();await new Promise(r=>fixture.close(r));assert.ok(dir.startsWith(path.join(os.tmpdir(),'mona-cnb-')));await fs.rm(dir,{recursive:true,force:true})}
});
import {CNB_RELEASE_API, CNB_RELEASES, officialReleaseUrl, compareVersions} from '../server/update-sources.mjs';
test('CNB metadata works when every GitHub source is unavailable',async()=>{
 const seen=[];const actual=await fetchReleaseMetadata(async(url,options)=>{seen.push(url);if(url!==CNB_RELEASE_API)throw Error('GitHub unavailable');assert.equal(options.headers.Accept,'application/json');return new Response(JSON.stringify({tag_name:'v7.1.12',body:'CNB notes',assets:release().assets.map(({name,size})=>({name,size}))}));},true,'7.1.11');
 assert.equal(actual.tag_name,'v7.1.12');assert.equal(actual.html_url,CNB_RELEASES);assert.equal(actual.body,'CNB notes');assert.deepEqual(seen,[CNB_RELEASE_API]);
 for(const kind of ['installer','portable','android','android-test']){const a=releaseAsset(actual,kind);assert.ok(a.browser_download_url.startsWith(CNB_RELEASES+'/download/v7.1.12/'));assert.equal(sourceUrl(a.browser_download_url,'github'),releaseAsset(release(),kind).browser_download_url);assert.equal(sourceUrl(a.browser_download_url,'ghfast'),'https://ghfast.top/'+releaseAsset(release(),kind).browser_download_url);}
});
test('a current CNB version is followed by GitHub; no update chooses the higher known version',async()=>{
 let deliver;const newer=new Promise(r=>deliver=r),started=[];
 const p=fetchReleaseMetadata(async url=>{started.push(url);if(url===CNB_RELEASE_API)return new Response(JSON.stringify(release('7.1.11')));if(url.startsWith('https://api.github.com'))return newer;throw Error('unavailable');},true,'7.1.11');
 let done=false;p.then(()=>done=true);await new Promise(r=>setTimeout(r,5));assert.equal(done,false);deliver(new Response(JSON.stringify(release('7.1.12'))));assert.equal((await p).tag_name,'v7.1.12');
 const old=await fetchReleaseMetadata(async url=>new Response(JSON.stringify(release(url===CNB_RELEASE_API?'7.1.11':'7.1.10'))),true,'7.1.12');assert.equal(old.tag_name,'v7.1.11');
 assert.equal(compareVersions('v7.1.12','7.1.11'),1);assert.equal(compareVersions('v7.1.011','7.1.11'),0);
});
test('CNB trust remains restricted to this project; metadata failure retains all source errors',async()=>{
 for(const url of ['https://cnb.cool/other/repo/-/releases/latest','https://cnb.cool/twicedrop/genshin_artifact/-/settings','http://cnb.cool/twicedrop/genshin_artifact/-/releases','https://user:pass@cnb.cool/twicedrop/genshin_artifact/-/releases'])assert.equal(officialReleaseUrl(url),null);
 assert.equal(officialReleaseUrl(CNB_RELEASES),CNB_RELEASES);
 await assert.rejects(fetchReleaseMetadata(async()=>new Response('failed',{status:503}),true,'7.1.11'),error=>['GitHub','CNB.cool','503'].every(x=>error.message.includes(x)));
 await assert.rejects(fetchReleaseMetadata(async()=>new Response(JSON.stringify({tag_name:'invalid',html_url:release().html_url})),false,'7.1.11'),/版本号无法识别/);
});
test('CNB is preferred even with saved acceleration off; GitHub is queried only after CNB has no update or fails',async()=>{
 const calls=[];
 const current='7.1.11';
 let failCnb=false;
 const fetcher=async(url,options)=>{calls.push(url);if(url===CNB_RELEASE_API){assert.equal(options.headers.Accept,'application/json');if(failCnb)throw Error('CNB offline');return new Response(JSON.stringify(release('7.1.12')))}return new Response(JSON.stringify(release('7.1.13')))};
 assert.equal((await fetchReleaseMetadata(fetcher,false,current)).tag_name,'v7.1.12');
 assert.deepEqual(calls,[CNB_RELEASE_API]);
 calls.length=0;failCnb=true;
 assert.equal((await fetchReleaseMetadata(fetcher,false,current)).tag_name,'v7.1.13');
 assert.deepEqual(calls,[CNB_RELEASE_API,'https://api.github.com/repos/TwiceDrop/genshin_artifact/releases/latest']);
});
