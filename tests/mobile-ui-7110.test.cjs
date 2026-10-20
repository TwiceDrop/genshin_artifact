const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs'), path = require('path'), Module = require('module')
const root = path.resolve(__dirname,'..')
const {JSDOM} = require('../mobile/node_modules/jsdom')
const dom = new JSDOM('<!doctype html><html class="mona-mobile"><body></body></html>',{url:'http://localhost',pretendToBeVisual:true})
for(const name of ['window','document','Node','Element','HTMLElement','HTMLInputElement','HTMLButtonElement','NodeFilter','SVGElement','DocumentFragment','CustomEvent','Event','MouseEvent','MutationObserver','getComputedStyle']) global[name]=name==='getComputedStyle'?dom.window.getComputedStyle:dom.window[name]
global.navigator=dom.window.navigator
global.ResizeObserver=class {observe(){}unobserve(){}disconnect(){}}
global.requestAnimationFrame=dom.window.requestAnimationFrame.bind(dom.window)
global.cancelAnimationFrame=dom.window.cancelAnimationFrame.bind(dom.window)
const resolve=Module._resolveFilename
const mobileAliases=Object.fromEntries(['radix-vue','class-variance-authority','clsx','tailwind-merge'].map(name=>[name,require.resolve(name,{paths:[path.join(root,'mobile/node_modules')]} )]))
Module._resolveFilename=(name,parent,...args)=>resolve(mobileAliases[name]||name,parent,...args)
const ts=require('../node_modules/typescript')
const original=Module._extensions['.js']
Module._extensions['.js']=(module,filename)=>{
  if(filename.startsWith(path.join(root,'src/mobile'))) module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,filename)
  else original(module,filename)
}
const {createApp,h,ref,nextTick}=require('../node_modules/vue')
const ui=require('../src/mobile/index')
const flush=async()=>{await nextTick();await new Promise(r=>setTimeout(r,20));await nextTick()}
function mount(render){const host=document.createElement('div');document.body.appendChild(host);const app=createApp({render});app.mount(host);return {host,close:()=>{app.unmount();host.remove()}}}
const click=element=>{assert.ok(element,'target must exist');element.click()}

test('mobile controls preserve the page models, option values and selection APIs',async()=>{
  const single=ref(true),multi=ref(['a']),number=ref(.1),tree=ref(),table=ref(),selected=ref([]),tab=ref('one')
  const entries=[{id:1,label:'本人'},{id:2,label:'队友'}]
  const dialogOpen=ref(false),tableRows=ref(entries)
  const app=mount(()=>h('main',{},[
    h(ui.ElDialog,{modelValue:dialogOpen.value,title:'编辑','onUpdate:modelValue':v=>dialogOpen.value=v},{default:()=>h('input',{class:'dialog-memory'})}),
    h(ui.ElRadioGroup,{modelValue:single.value,'onUpdate:modelValue':v=>single.value=v},{default:()=>[h(ui.ElRadioButton,{label:true},()=> '普通'),h(ui.ElRadioButton,{label:false},()=> '另一项')]}),
    h(ui.ElSelect,{multiple:true,filterable:true,modelValue:multi.value,placeholder:'选择套装','onUpdate:modelValue':v=>multi.value=v},{default:()=>[h(ui.ElOption,{value:'a',label:'套装 A'}),h(ui.ElOption,{value:'b',label:'套装 B'})]}),
    h(ui.ElInputNumber,{modelValue:number.value,min:0,max:1,step:.1,precision:2,'onUpdate:modelValue':v=>number.value=v}),
    h(ui.ElTree,{ref:tree,data:[{id:0,label:'收藏夹',children:entries}],defaultCheckedKeys:[1],nodeKey:'id',showCheckbox:true,filterNodeMethod:(q,n)=>n.label.includes(q)}),
    h(ui.ElTable,{ref:table,data:tableRows.value,'onSelection-change':v=>selected.value=v},{default:()=>[h(ui.ElTableColumn,{type:'selection'}),h(ui.ElTableColumn,{prop:'label',label:'角色'})]}),
    h(ui.ElTabs,{modelValue:tab.value,'onUpdate:modelValue':v=>tab.value=v},{default:()=>[h(ui.ElTabPane,{name:'one',label:'一'},()=>h('input',{value:'保留状态'})),h(ui.ElTabPane,{name:'two',label:'二'},()=> '内容二')]}),
  ]))
  await flush()
  click(app.host.querySelector('[role=radio][value=false]'));await flush();assert.equal(single.value,false);assert.equal(typeof single.value,'boolean')
  click(app.host.querySelector('.m-number button:last-child'));await flush();assert.equal(number.value,.2)
  click(app.host.querySelector('.m-select-trigger'));await flush()
  assert.equal(document.querySelectorAll('.m-option').length,2)
  click(document.querySelectorAll('.m-option')[1]);await flush();assert.deepEqual(multi.value,['a','b'])
  click(document.querySelector('.m-sheet-footer button'));await flush()
  assert.deepEqual(tree.value.getCheckedKeys(),[1])
  tree.value.filter('队友');await flush();assert.deepEqual(tree.value.getCheckedKeys(),[1]);assert.ok(app.host.textContent.includes('队友'))
  const parentCheck=app.host.querySelector('.m-tree [role=checkbox]');click(parentCheck);await flush();assert.deepEqual(tree.value.getCheckedKeys(),[0,1,2])
  tree.value.filter('');await flush();assert.equal(tree.value.getCheckedNodes().filter(n=>!n.children).length,2)
  table.value.toggleRowSelection(entries[1],true);await flush();assert.equal(selected.value.length,1);assert.equal(selected.value[0].label,'队友');tableRows.value=[entries[0]];await flush();assert.equal(selected.value.length,0)
  const preserved=app.host.querySelector('.m-tab-content input');preserved.value='已输入';click(app.host.querySelectorAll('[role=tab]')[1]);await flush();assert.equal(tab.value,'two');assert.equal(app.host.querySelector('.m-tab-content input'),preserved)
  dialogOpen.value=true;await flush();const memory=document.querySelector('.m-sheet .dialog-memory');memory.value='保留编辑';
  click(document.querySelector('.m-sheet-header button'));await flush();assert.equal(dialogOpen.value,false)
  dialogOpen.value=true;await flush();assert.equal(document.querySelector('.m-sheet .dialog-memory'),memory);assert.equal(memory.value,'保留编辑')
  dialogOpen.value=false;await flush()
  const prompt=ui.ElMessageBox.prompt('名称','保存',{inputValue:'预设',inputPattern:/[^\s]+$/,confirmButtonText:'保存'})
  await flush();click(document.querySelector('.m-sheet-footer button:last-child'));assert.equal((await prompt).value,'预设')
  const toast=ui.ElMessage({title:'导入阶段',message:new Error('读取失败'),type:'error',duration:0});await flush();assert.ok(document.querySelector('.m-toast').textContent.includes('导入阶段'));assert.ok(document.querySelector('.m-toast').textContent.includes('读取失败'));toast.close()
  app.close()
})
