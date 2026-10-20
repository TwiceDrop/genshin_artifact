import { defineComponent, h, ref, computed, inject, provide, nextTick } from 'vue'
import { CheckboxRoot, CheckboxIndicator, SwitchRoot, SwitchThumb, RadioGroupRoot, RadioGroupItem, RadioGroupIndicator, SliderRoot, SliderTrack, SliderRange, SliderThumb } from 'radix-vue'
import { Button, Sheet, cn, flatten, slotText, iconNode } from './ui'

const valueProps = {modelValue:{default:undefined},value:{default:undefined},disabled:Boolean}
const events = ['update:modelValue','input','change']
const current = p => p.modelValue === undefined ? p.value : p.modelValue
function update(emit,value) {emit('update:modelValue',value);emit('input',value);emit('change',value)}
export const ElButton = defineComponent({
  name:'ElButton',props:{type:String,icon:{},loading:Boolean,disabled:Boolean,text:Boolean,link:Boolean,plain:Boolean,circle:Boolean,size:String},emits:['click'],
  setup:(p,{attrs,slots,emit})=>()=>h(Button,{
    ...attrs,variant:p.link?'link':p.text?'ghost':p.type==='danger'?'destructive':p.type==='primary'&&!p.plain?'default':'outline',
    size:p.circle||(!slots.default&&p.icon)?'icon':'default',disabled:p.disabled||p.loading,
    'aria-busy':p.loading||undefined,class:cn('el-button',attrs.class),'aria-label':attrs['aria-label']||attrs.title,
    onClick:e=>emit('click',e),
  },()=>[p.loading?h('span',{class:'m-spinner','aria-hidden':true}):iconNode(p.icon),slots.default?.()]),
})
export const ElInput = defineComponent({
  name:'ElInput',inheritAttrs:false,props:{...valueProps,type:{default:'text'},rows:{default:3},clearable:Boolean,placeholder:String,label:String},emits:[...events,'clear','blur','focus'],
  setup(p,{attrs,slots,emit,expose}) {
    const input=ref();expose({focus:()=>input.value.focus(),blur:()=>input.value.blur()});
    return ()=>h('div',{class:cn('m-input-group el-input',attrs.class),style:attrs.style},[
      slots.prepend?h('div',{class:'m-input-addon'},slots.prepend()):null,
      h(p.type==='textarea'?'textarea':'input',{
        ...attrs,class:'m-input',style:undefined,ref:input,type:p.type,value:current(p),rows:p.rows,disabled:p.disabled,placeholder:p.placeholder,
        'aria-label':attrs['aria-label']||p.label||p.placeholder,
        onInput:e=>{emit('update:modelValue',e.target.value);emit('input',e.target.value)},onChange:e=>emit('change',e.target.value),
        onFocus:e=>emit('focus',e),onBlur:e=>emit('blur',e),
      }),
      p.clearable&&current(p)?h(Button,{variant:'ghost',size:'icon','aria-label':'清空',onClick:()=>{update(emit,'');emit('clear');input.value.focus()}},()=> '×'):null,
      slots.append?h('div',{class:'m-input-addon'},slots.append()):null,
    ])
  },
})
export const ElInputNumber = defineComponent({
  name:'ElInputNumber',props:{...valueProps,min:Number,max:Number,step:{default:1},precision:Number,controls:{default:true},size:String,label:String},emits:events,
  setup(p,{attrs,emit}) {
    const commit = v=> {
      let n=Number(v);if(p.min!==undefined)n=Math.max(p.min,n);if(p.max!==undefined)n=Math.min(p.max,n);
      if(p.precision!==undefined)n=Number(n.toFixed(p.precision));update(emit,n)
    }
    return ()=>h('div',{...attrs,class:cn('m-number el-input-number',attrs.class)},[
      p.controls?h(Button,{variant:'ghost',size:'icon',disabled:p.disabled||current(p)<=p.min,'aria-label':'减少',onClick:()=>commit(current(p)-p.step)},()=> '−'):null,
      h('input',{class:'m-input',type:'number',inputmode:p.step%1?'decimal':'numeric',value:current(p),min:p.min,max:p.max,step:p.step,disabled:p.disabled,
        'aria-label':attrs['aria-label']||p.label,onChange:e=>commit(e.target.value)}),
      p.controls?h(Button,{variant:'ghost',size:'icon',disabled:p.disabled||current(p)>=p.max,'aria-label':'增加',onClick:()=>commit(Number(current(p))+p.step)},()=> '+'):null,
    ])
  },
})
export const ElSwitch = defineComponent({
  name:'ElSwitch',props:{...valueProps,activeText:String,inactiveText:String},emits:events,
  setup:(p,{attrs,emit})=>()=>h('label',{class:cn('m-switch-label el-switch',attrs.class),style:attrs.style},[
    h(SwitchRoot,{class:'m-switch',checked:!!current(p),disabled:p.disabled,'aria-label':attrs['aria-label']||p.activeText,
      'onUpdate:checked':v=>update(emit,v)},()=>h(SwitchThumb,{class:'m-switch-thumb'})),
    p.activeText||p.inactiveText?h('span',{},p.activeText||p.inactiveText):null,
  ]),
})
const checkboxGroup=Symbol('mobile-checkbox-group'),radioGroup=Symbol('mobile-radio-group')
export const ElCheckboxGroup = defineComponent({
  name:'ElCheckboxGroup',props:{...valueProps,min:Number,max:Number},emits:events,
  setup(p,{attrs,slots,emit}) {
    provide(checkboxGroup,{value:computed(()=>current(p)),disabled:computed(()=>p.disabled),toggle(label,checked){
      const next=checked?[...current(p),label]:current(p).filter(v=>v!==label);
      if(p.min!==undefined&&next.length<p.min||p.max!==undefined&&next.length>p.max)return;
      update(emit,next)
    }});
    return ()=>h('div',{...attrs,class:cn('m-check-group el-checkbox-group',attrs.class),role:'group'},slots.default?.())
  },
})
function checkbox(name,button) {return defineComponent({
  name,props:{...valueProps,label:{}},emits:events,
  setup(p,{attrs,slots,emit}) {
    const group=inject(checkboxGroup,null), checked=computed(()=>group?group.value.value.includes(p.label):!!current(p));
    const disabled=computed(()=>p.disabled||group?.disabled.value);
    const toggle=v=>group?group.toggle(p.label,v):update(emit,v);
    return ()=>button?h(Button,{...attrs,variant:checked.value?'default':'outline',disabled:disabled.value,'aria-pressed':checked.value,
      class:cn('el-checkbox-button m-choice',attrs.class),onClick:()=>toggle(!checked.value)},slots.default||(()=>String(p.label))):
      h('label',{...attrs,class:cn('m-checkbox-label el-checkbox',attrs.class)},[
        h(CheckboxRoot,{class:'m-checkbox',checked:checked.value,disabled:disabled.value,'aria-label':attrs['aria-label']||String(p.label||slotText(slots.default?.())),
          'onUpdate:checked':toggle},()=>h(CheckboxIndicator,{class:'m-checkmark'},()=> '✓')),
        h('span',{},slots.default?.()||String(p.label||'')),
      ])
  },
})}
export const ElCheckbox=checkbox('ElCheckbox',false),ElCheckboxButton=checkbox('ElCheckboxButton',true)
export const ElRadioGroup = defineComponent({
  name:'ElRadioGroup',props:valueProps,emits:events,
  setup(p,{attrs,slots,emit}) {
    const options=new Map();provide(radioGroup,{value:computed(()=>current(p)),disabled:computed(()=>p.disabled),options});
    return ()=>h(RadioGroupRoot,{...attrs,class:cn('m-radio-group el-radio-group',attrs.class),modelValue:String(current(p)),disabled:p.disabled,
      'onUpdate:modelValue':v=>update(emit,options.get(v))},slots)
  },
})
function radio(name,button) {return defineComponent({
  name,props:{label:{},disabled:Boolean},
  setup(p,{attrs,slots}) {
    const group=inject(radioGroup);group.options.set(String(p.label),p.label);
    return ()=>h(RadioGroupItem,{...attrs,value:String(p.label),disabled:p.disabled||group.disabled.value,
      class:cn(button?'m-radio-button el-radio-button':'m-radio el-radio',attrs.class)},()=>[
      button?null:h('span',{class:'m-radio-circle'},[h(RadioGroupIndicator,{class:'m-radio-dot'})]),
      h('span',{class:button?'el-radio-button__inner':''},slots.default?.()||String(p.label)),
    ])
  },
})}
export const ElRadio=radio('ElRadio',false),ElRadioButton=radio('ElRadioButton',true)
export const ElSlider = defineComponent({
  name:'ElSlider',props:{...valueProps,min:{default:0},max:{default:100},step:{default:1},showInput:Boolean},emits:events,
  setup:(p,{attrs,emit})=>()=>h('div',{...attrs,class:cn('m-slider-field el-slider',attrs.class)},[
    h(SliderRoot,{class:'m-slider',modelValue:[Number(current(p))],min:p.min,max:p.max,step:p.step,disabled:p.disabled,
      'onUpdate:modelValue':v=>{emit('update:modelValue',v[0]);emit('input',v[0])},onValueCommit:v=>emit('change',v[0])},()=>[
      h(SliderTrack,{class:'m-slider-track'},()=>h(SliderRange,{class:'m-slider-range'})),
      h(SliderThumb,{class:'m-slider-thumb','aria-label':attrs['aria-label']||'数值'}),
    ]),
    h(ElInputNumber,{modelValue:current(p),min:p.min,max:p.max,step:p.step,controls:false,disabled:p.disabled,'aria-label':attrs['aria-label']||'数值',
      'onUpdate:modelValue':v=>update(emit,v)}),
  ]),
})
export const ElOption = defineComponent({name:'ElOption',props:{value:{},label:{},disabled:Boolean},setup:()=>()=>null})
export const ElOptionGroup = defineComponent({name:'ElOptionGroup',props:{label:String},setup:()=>()=>null})
function optionsFrom(nodes,group='') {
  return flatten(nodes).flatMap(node=> {
    if(node.type?.name==='ElOption')return [{value:node.props?.value,label:node.props?.label??node.props?.value,disabled:node.props?.disabled,group,slot:node.children?.default}];
    if(node.type?.name==='ElOptionGroup')return optionsFrom(node.children?.default?.(),node.props?.label);
    return []
  })
}
export const ElSelect = defineComponent({
  name:'ElSelect',inheritAttrs:false,props:{...valueProps,multiple:Boolean,multipleLimit:{default:0},placeholder:String,clearable:Boolean,filterable:Boolean},emits:[...events,'clear','visible-change'],
  setup(p,{slots,attrs,emit}) {
    const open=ref(false),query=ref('');
    const setOpen=v=>{open.value=v;emit('visible-change',v);if(!v)query.value=''};
    const selected=value=>p.multiple?current(p).includes(value):current(p)===value;
    const choose=option=> {
      if(p.multiple) {
        const values=current(p),next=selected(option.value)?values.filter(v=>v!==option.value):[...values,option.value];
        if(p.multipleLimit&&next.length>p.multipleLimit)return;
        update(emit,next)
      } else {update(emit,option.value);setOpen(false)}
    };
    return ()=>{
      const options=optionsFrom(slots.default?.()), chosen=options.filter(o=>selected(o.value));
      const values=(p.multiple?current(p):[current(p)]).filter(v=>v!==undefined&&v!==null&&v!=='');
      const labels=values.map(v=>options.find(o=>o.value===v)?.label??v);
      const shown=options.filter(o=>!query.value||String(o.label).toLocaleLowerCase().includes(query.value.toLocaleLowerCase()));
      return h('div',{...attrs,class:cn('m-select el-select',attrs.class)},[
        h(Button,{variant:'outline',disabled:p.disabled,class:'m-select-trigger',role:'combobox','aria-expanded':open.value,
          'aria-label':attrs['aria-label']||p.placeholder,onClick:()=>setOpen(true)},()=>[
          h('span',{class:labels.length?'':'m-placeholder'},labels.length?labels.join('、'):p.placeholder||'选择'),h('span',{'aria-hidden':true},'⌄'),
        ]),
        p.clearable&&chosen.length?h(Button,{variant:'ghost',size:'icon',class:'m-select-clear','aria-label':'清空',disabled:p.disabled,
          onClick:()=>{update(emit,p.multiple?[]:'');emit('clear')}},()=> '×'):null,
        h(Sheet,{open:open.value,title:p.placeholder||attrs['aria-label']||'选择','onUpdate:open':setOpen}, {
          default:()=>[
            (p.filterable||options.length>8)?h(ElInput,{modelValue:query.value,placeholder:'搜索',clearable:true,'onUpdate:modelValue':v=>query.value=v}):null,
            h('div',{class:'m-option-list',role:'listbox','aria-multiselectable':p.multiple||undefined},shown.flatMap((o,i)=>[
              o.group&&(i===0||shown[i-1].group!==o.group)?h('div',{class:'m-option-group'},o.group):null,
              h('button',{type:'button',class:cn('m-option',selected(o.value)&&'m-option-selected'),disabled:o.disabled,
                role:'option','aria-selected':selected(o.value),onClick:()=>choose(o)},[
                h('span',{class:'m-option-label'},o.slot?o.slot():String(o.label)),h('span',{'aria-hidden':true},selected(o.value)?'✓':''),
              ]),
            ])),
          ],
          footer:p.multiple?()=>h(Button,{onClick:()=>setOpen(false)},()=> '完成'):undefined,
        }),
      ])
    }
  },
})
export const ElCascader = defineComponent({
  name:'ElCascader',props:{...valueProps,options:Array,placeholder:String},emits:events,
  setup(p,{attrs,slots,emit}) {
    const open=ref(false),query=ref(''),group=ref('');
    return ()=>{
      const leaves=p.options.flatMap(parent=>parent.children.map(data=>({data,parent}))),chosen=leaves.find(o=>o.data.value===current(p));
      return h('div',{...attrs,class:cn('m-select el-cascader',attrs.class)},[
        h(Button,{variant:'outline',class:'m-select-trigger',disabled:p.disabled,role:'combobox','aria-expanded':open.value,'aria-label':p.placeholder,onClick:()=>open.value=true},()=>[chosen?.data.label||p.placeholder,'⌄']),
        h(Sheet,{open:open.value,title:p.placeholder,'onUpdate:open':v=>open.value=v},{default:()=>[
          h(ElInput,{modelValue:query.value,placeholder:'搜索角色',clearable:true,'onUpdate:modelValue':v=>query.value=v}),
          h('div',{class:'m-check-group'},[
            h(Button,{variant:group.value===''?'default':'outline',onClick:()=>group.value=''},()=> '全部'),
            ...p.options.map(o=>h(Button,{variant:group.value===o.value?'default':'outline',onClick:()=>group.value=o.value},()=>o.label)),
          ]),
          h('div',{class:'m-option-list',role:'listbox'},leaves.filter(o=>(!group.value||o.parent.value===group.value)&&(!query.value||o.data.label.toLowerCase().includes(query.value.toLowerCase()))).map(o=>
            h('button',{type:'button',class:'m-option',role:'option','aria-selected':o.data.value===current(p),onClick:()=>{update(emit,[o.parent.value,o.data.value]);open.value=false}},
              slots.default?slots.default({data:o.data,node:{isLeaf:true}}):o.data.label))),
        ]}),
      ])
    }
  },
})
export const ElRate = defineComponent({
  name:'ElRate',props:{...valueProps,max:{default:5}},emits:events,
  setup:(p,{attrs,emit})=>()=>h('div',{...attrs,class:cn('m-rating el-rate',attrs.class),role:'group','aria-label':'星级'},
    Array.from({length:p.max},(_,i)=>h('button',{type:'button',class:i<current(p)?'m-star-active':'',disabled:p.disabled,'aria-label':`${i+1}星`,'aria-pressed':i+1===current(p),onClick:()=>update(emit,i+1)},'★'))),
})
