import { h, ref, render, defineComponent } from 'vue'
import { Sheet, Button } from './ui'
import { ElInput } from './controls'

function mountService(component) {
  const host=document.createElement('div');document.body.appendChild(host);
  const close=()=>{render(null,host);host.remove()};render(h(component),host);return close
}
export function ElMessage(input) {
  const options=typeof input==='string'?{message:input}:input;
  let close;
  close=mountService(defineComponent({setup:()=>()=>h('div',{class:`m-toast m-toast-${options.type||'info'}`,role:options.type==='error'?'alert':'status'},[
    h('span',{},[options.title?h('strong',{},options.title):null,h('span',{},options.message instanceof Error?options.message.message:options.message)]),h(Button,{variant:'ghost',size:'icon','aria-label':'关闭',onClick:()=>close()},()=> '×'),
  ])}));
  if(options.duration!==0)setTimeout(close,options.duration??4000);
  return {close}
}
for(const type of ['success','error','warning','info'])ElMessage[type]=input=>ElMessage(typeof input==='string'?{message:input,type}:{...input,type})
function messageBox(message,title,options={},prompt=false) {
  return new Promise((resolve,reject)=>{
    let close;
    const value=ref(options.inputValue||''),error=ref('');
    const done=confirm=>{
      if(confirm&&prompt&&options.inputPattern&&!options.inputPattern.test(value.value)){error.value=options.inputErrorMessage||'输入不符合要求';return}
      close();confirm?resolve(prompt?{value:value.value,action:'confirm'}:'confirm'):reject('cancel')
    };
    close=mountService(defineComponent({setup:()=>()=>h(Sheet,{open:true,title,'onUpdate:open':()=>done(false)}, {
      default:()=>[h('p',{class:'m-confirm-message'},message),prompt?h(ElInput,{modelValue:value.value,'aria-label':title,'onUpdate:modelValue':v=>value.value=v,onKeydown:e=>{if(e.key==='Enter')done(true)}}):null,error.value?h('p',{role:'alert'},error.value):null],
      footer:()=>[options.showCancelButton===false?null:h(Button,{variant:'outline',onClick:()=>done(false)},()=>options.cancelButtonText||'取消'),h(Button,{onClick:()=>done(true)},()=>options.confirmButtonText||'确认')],
    })}));
  })
}
export const ElMessageBox={confirm:messageBox,prompt:(m,t,o)=>messageBox(m,t,o,true),alert:(m,t,o)=>messageBox(m,t,{...o,showCancelButton:false})}
export const ElLoading={service(options={}) {
  const close=mountService(defineComponent({setup:()=>()=>h(Sheet,{open:true,title:options.text||'加载中',showClose:false,closeOnClickModal:false,closeOnPressEscape:false}, {default:()=>h('div',{class:'m-loading',role:'status'},[h('span',{class:'m-spinner','aria-hidden':true}),options.text])})}));
  return {close}
}}
export const ElNotification=ElMessage
