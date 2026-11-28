import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { loadCloudUi } from './helpers/cloud-ui-fixture.mjs'
const require=createRequire(import.meta.url)
const {JSDOM}=require('jsdom')

test('cloud profile controls enable automatic sync, resolve conflicts and download revisions with bound identity',async()=>{
    const dom=new JSDOM('<html><body><div id="app"></div></body></html>',{url:'http://127.0.0.1',pretendToBeVisual:true})
    for(const key of ['window','document','HTMLElement','SVGElement','Element','Node','MutationObserver','getComputedStyle','Event','MouseEvent'])globalThis[key]=key==='getComputedStyle'?dom.window[key].bind(dom.window):dom.window[key]
    globalThis.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}}
    globalThis.requestAnimationFrame=dom.window.requestAnimationFrame.bind(dom.window)
    globalThis.cancelAnimationFrame=dom.window.cancelAnimationFrame.bind(dom.window)
    const Vue=require('vue'),calls=[]
    const account={currentAccountId:Vue.ref(7),currentAccountName:Vue.ref('合成档案')}
    const state=Vue.reactive({bindings:[],profiles:[{id:'profile-a',name:'另一台设备',revision:4,updatedAt:'2026-11-07T00:00:00Z'}],busy:false,error:''})
    let categorySettings={uid:true,history:true,artifacts:true,characters:true,teams:true}
    const sync={state,getSyncSettings:()=>({...categorySettings}),setSyncSettings:async value=>{categorySettings=value;calls.push(['categories',value])},refresh:async()=>calls.push(['refresh']),createCurrent:async()=>{calls.push(['create']);state.bindings.push({localAccountId:7,profileId:'profile-a',baseRevision:2,enabled:true,status:'synced'})},syncCurrent:async()=>calls.push(['sync']),setEnabled:async(...args)=>calls.push(['enabled',...args]),unlink:async()=>{calls.push(['unlink']);state.bindings=[]},downloadNew:async(...args)=>calls.push(['download',...args]),resolveCurrent:async(...args)=>calls.push(['resolve',...args]),deleteCloud:async(...args)=>calls.push(['delete',...args])}
    const cloudApi=async(...args)=>{calls.push(['api',...args]);return{revisions:[{revision:3,status:'conflict',createdAt:'2026-11-07T00:00:00Z'}],nextCursor:null}}
    const component=loadCloudUi('pages/OnlineAccountPage/CloudProfilesPanel.vue',{
        '@/store/pinia/account':{useAccountStore:()=>account},
        '@/cloud/profile-sync':{profileSync:sync},
        '@/platform/cloud.mjs':{cloudApi},
    })
    const app=Vue.createApp(component,{user:{id:'user-a'},serviceUrl:'https://fixture.example.test'})
    const settle=async()=>{for(let i=0;i<5;i++){await new Promise(r=>setImmediate(r));await Vue.nextTick()}}
    const click=async label=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===label);assert.ok(b,label);assert.equal(b.disabled,false);b.click();await settle()}
    try{
        app.mount('#app');await settle()
        state.profiles.push({ id: 'removed', deletedAt: '2026-11-19T00:00:00Z' });await settle()
        assert.equal(document.querySelectorAll('.cloud-profile').length,1)
        await click('关联当前账号并自动同步');assert.equal(state.bindings[0].enabled,true)
        assert.doesNotMatch(document.querySelector('.sync-categories').textContent, /Cookie/)
        const box=[...document.querySelectorAll('.sync-categories label')].find(x=>x.textContent.includes('圣遗物'));assert.ok(box);box.querySelector('[role="checkbox"]').click();await settle()
        assert.equal(calls.find(x=>x[0]==='categories')[1].artifacts,false)
        const autoSync=document.querySelector('[role="switch"]')
        assert.equal(autoSync.getAttribute('aria-checked'),'true')
        autoSync.click();await settle()
        assert.deepEqual(calls.at(-1),['enabled',7,false])
        await click('立即同步');assert.ok(calls.some(x=>x[0]==='sync'))
        state.bindings[0].status='conflict';state.bindings[0].conflictRevision=3;await settle()
        await click('另存为新云档案');assert.deepEqual(calls.at(-1),['resolve','copy'])
        await click('采用云端');assert.deepEqual(calls.at(-1),['resolve','remote'])
        await click('保留本机');assert.deepEqual(calls.at(-1),['resolve','local'])
        await click('查看修订');assert.deepEqual(calls.at(-1).at(-1),{url:'https://fixture.example.test',userId:'user-a'})
        await click('下载此修订');assert.deepEqual(calls.at(-1),['download','profile-a',3])
        await click('下载为新本地账号');assert.deepEqual(calls.at(-1),['download','profile-a'])
        await click('解除关联');assert.equal(state.bindings.length,0);assert.equal(account.currentAccountId.value,7)
        state.profiles.shift();await settle()
        assert.equal(document.querySelectorAll('.cloud-profile').length,0)
        assert.match(document.body.textContent,/暂无云档案/)
    }finally{app.unmount();dom.window.close()}
})
