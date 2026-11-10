import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
const require=createRequire(import.meta.url)
const {JSDOM}=require('../mobile/node_modules/jsdom')
const {parse,compileScript,compileTemplate}=require('@vue/compiler-sfc')

test('cloud profile controls enable automatic sync, resolve conflicts and download revisions with bound identity',async()=>{
    const dom=new JSDOM('<html><body><div id="app"></div></body></html>',{url:'http://127.0.0.1',pretendToBeVisual:true})
    for(const key of ['window','document','HTMLElement','SVGElement','Element','Node','MutationObserver','getComputedStyle','Event','MouseEvent'])globalThis[key]=key==='getComputedStyle'?dom.window[key].bind(dom.window):dom.window[key]
    globalThis.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}}
    globalThis.requestAnimationFrame=dom.window.requestAnimationFrame.bind(dom.window)
    globalThis.cancelAnimationFrame=dom.window.cancelAnimationFrame.bind(dom.window)
    const Vue=require('vue'),ElementPlus=require('element-plus'),calls=[]
    const account={currentAccountId:Vue.ref(7),currentAccountName:Vue.ref('合成档案')}
    const state=Vue.reactive({bindings:[],profiles:[{id:'profile-a',name:'另一台设备',revision:4,updatedAt:'2026-11-07T00:00:00Z'}],busy:false,error:''})
    const sync={state,refresh:async()=>calls.push(['refresh']),createCurrent:async()=>{calls.push(['create']);state.bindings.push({localAccountId:7,profileId:'profile-a',baseRevision:2,enabled:true,status:'synced'})},syncCurrent:async()=>calls.push(['sync']),setEnabled:async(...args)=>calls.push(['enabled',...args]),unlink:async()=>{calls.push(['unlink']);state.bindings=[]},downloadNew:async(...args)=>calls.push(['download',...args]),resolveCurrent:async(...args)=>calls.push(['resolve',...args]),deleteCloud:async(...args)=>calls.push(['delete',...args])}
    const cloudApi=async(...args)=>{calls.push(['api',...args]);return{revisions:[{revision:3,status:'conflict',createdAt:'2026-11-07T00:00:00Z'}],nextCursor:null}}
    const filename='src/pages/OnlineAccountPage/CloudProfilesPanel.vue'
    const {descriptor}=parse(fs.readFileSync(new URL('../'+filename,import.meta.url),'utf8'),{filename})
    const script=compileScript(descriptor,{id:'profiles'}),template=compileTemplate({source:descriptor.template.content,filename,id:'profiles',compilerOptions:{bindingMetadata:script.bindings}})
    assert.deepEqual(template.errors,[])
    const code=script.content.replace(/^import .*\r?\n/gm,'').replace('export default','const component =')
    const render=template.code.replace(/import \{([^}]+)\} from "vue"/g,(_,names)=>`const {${names.replace(/\s+as\s+/g,':')}}=Vue`).replace('export function render','function render')
    const component=new Function('Vue','sync','cloudApi','useAccountStore',`const {computed,onMounted,onBeforeUnmount,ref,watch}=Vue;${code}\n${render}\ncomponent.render=render;return component`)(Vue,sync,cloudApi,()=>account)
    const app=Vue.createApp(component,{user:{id:'user-a'},serviceUrl:'https://fixture.example.test'}).use(ElementPlus)
    const settle=async()=>{for(let i=0;i<5;i++){await new Promise(r=>setImmediate(r));await Vue.nextTick()}}
    const click=async label=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===label);assert.ok(b,label);assert.equal(b.disabled,false);b.click();await settle()}
    try{
        app.mount('#app');await settle()
        await click('关联当前账号并自动同步');assert.equal(state.bindings[0].enabled,true)
        await click('立即同步');assert.ok(calls.some(x=>x[0]==='sync'))
        state.bindings[0].status='conflict';state.bindings[0].conflictRevision=3;await settle()
        await click('另存为新云档案');assert.deepEqual(calls.at(-1),['resolve','copy'])
        await click('采用云端');assert.deepEqual(calls.at(-1),['resolve','remote'])
        await click('保留本机');assert.deepEqual(calls.at(-1),['resolve','local'])
        await click('查看修订');assert.deepEqual(calls.at(-1).at(-1),{url:'https://fixture.example.test',userId:'user-a'})
        await click('下载此修订');assert.deepEqual(calls.at(-1),['download','profile-a',3])
        await click('下载为新本地账号');assert.deepEqual(calls.at(-1),['download','profile-a'])
        await click('解除关联');assert.equal(state.bindings.length,0);assert.equal(account.currentAccountId.value,7)
    }finally{app.unmount();dom.window.close()}
})
