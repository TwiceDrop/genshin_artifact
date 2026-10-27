import { defineComponent, h, ref, computed, watch, provide, inject } from 'vue'
import { TabsRoot, TabsList, TabsTrigger, TabsContent, AccordionRoot, AccordionItem, AccordionHeader, AccordionTrigger, AccordionContent, CheckboxRoot, CheckboxIndicator } from 'radix-vue'
import { Button, Sheet, cn, flatten, iconNode } from './ui'
import { ElCheckbox, ElInput } from './controls'

function panel(name) {return defineComponent({
  name,inheritAttrs:false,
  props:{modelValue:Boolean,title:String,showClose:{default:true},closeOnClickModal:{default:true},closeOnPressEscape:{default:true},destroyOnClose:Boolean,width:{},size:{},direction:String,top:String},
  emits:['update:modelValue','open','opened','close','closed'],
  setup(p,{attrs,slots,emit}) {
    watch(()=>p.modelValue,v=>{emit(v?'open':'close');emit(v?'opened':'closed')});
    return ()=>h(Sheet,{...attrs,open:p.modelValue,title:p.title,showClose:p.showClose,closeOnClickModal:p.closeOnClickModal,closeOnPressEscape:p.closeOnPressEscape,destroyOnClose:p.destroyOnClose,
      'onUpdate:open':v=>emit('update:modelValue',v),class:cn('m-panel',attrs.class)},slots)
  },
})}
export const ElDialog=panel('ElDialog'),ElDrawer=panel('ElDrawer')
function container(name,tag,className,props={}) {return defineComponent({name,props,setup:(p,{attrs,slots})=>()=>h(tag,{...attrs,class:cn(className,attrs.class)},slots.default?.())})}
export const ElRow=container('ElRow','div','m-row el-row',{gutter:{}})
export const ElCol=container('ElCol','div','m-col el-col',{span:{},xs:{},sm:{},md:{},lg:{}})
export const ElButtonGroup=container('ElButtonGroup','div','m-button-group el-button-group')
export const ElCard=container('ElCard','section','m-card el-card',{shadow:String})
export const ElIcon=defineComponent({name:'ElIcon',props:{size:{}},setup:(p,{attrs,slots})=>()=>h('span',{...attrs,class:cn('m-icon el-icon',attrs.class),style:[attrs.style,{fontSize:p.size?`${p.size}px`:undefined}],'aria-hidden':true},slots.default?.())})
export const ElDivider=container('ElDivider','div','m-divider el-divider')
export const ElTag=container('ElTag','span','m-tag el-tag',{type:String,size:String})
export const ElForm=container('ElForm','form','m-form el-form',{labelWidth:String,labelPosition:String})
export const ElFormItem=defineComponent({name:'ElFormItem',props:{label:String},setup:(p,{attrs,slots})=>()=>h('div',{...attrs,class:cn('m-form-item el-form-item',attrs.class)},[
  h('div',{class:'m-form-label'},slots.label?.()||p.label),h('div',{},slots.default?.()),
])})
export const ElBreadcrumb=container('ElBreadcrumb','nav','m-breadcrumb el-breadcrumb')
export const ElBreadcrumbItem=container('ElBreadcrumbItem','span','el-breadcrumb-item')
export const ElDescriptions=container('ElDescriptions','dl','m-descriptions el-descriptions',{column:{},border:Boolean})
export const ElDescriptionsItem=defineComponent({name:'ElDescriptionsItem',props:{label:String},setup:(p,{slots})=>()=>h('div',{class:'m-description'},[h('dt',{},p.label),h('dd',{},slots.default?.())])})
export const ElImage=defineComponent({name:'ElImage',props:{src:String},setup:(p,{attrs})=>()=>h('img',{...attrs,src:p.src,class:cn('el-image',attrs.class),alt:attrs.alt||''})})
export const ElEmpty=defineComponent({name:'ElEmpty',props:{description:{default:'暂无数据'},imageSize:{}},setup:(p,{attrs,slots})=>()=>h('div',{...attrs,class:cn('m-empty el-empty',attrs.class)},[h('span',{'aria-hidden':true},'◇'),h('p',{},p.description),slots.default?.()])})
export const ElAlert=defineComponent({
  name:'ElAlert',props:{title:String,description:String,type:String,closable:{default:true},showIcon:Boolean},emits:['close'],
  setup(p,{attrs,slots,emit}) {
    const visible=ref(true);
    return ()=>visible.value?h('div',{...attrs,class:cn('m-alert el-alert',`m-alert-${p.type||'info'}`,attrs.class),role:p.type==='error'?'alert':'status'},[
      h('div',{},[h('strong',{},p.title),p.description?h('p',{},p.description):null,slots.default?.()]),
      p.closable?h(Button,{variant:'ghost',size:'icon','aria-label':'关闭',onClick:()=>{visible.value=false;emit('close')}},()=> '×'):null,
    ]):null
  },
})
export const ElProgress=defineComponent({name:'ElProgress',props:{percentage:Number,showText:{default:true},status:String},setup:(p,{attrs})=>()=>h('div',{...attrs,class:cn('m-progress el-progress',attrs.class)},[
  h('progress',{max:100,value:p.percentage,'aria-label':'进度'}),p.showText?h('span',{},`${p.percentage}%`):null,
])})
export const ElTabPane=defineComponent({name:'ElTabPane',props:{name:{},label:String},setup:()=>()=>null})
export const ElTabs=defineComponent({
  name:'ElTabs',props:{modelValue:{}},emits:['update:modelValue','tab-click'],
  setup(p,{attrs,slots,emit}) {
    let start=null,dragged=false;
    const select=value=>{emit('update:modelValue',value);emit('tab-click',{paneName:value})};
    const pan={
      onPointerdown:e=>{dragged=false;if(e.pointerType==='mouse'&&e.button===0)start={x:e.clientX,left:e.currentTarget.scrollLeft}},
      onPointermove:e=>{
        if(!start)return;
        const distance=e.clientX-start.x;
        if(!dragged&&Math.abs(distance)<5)return;
        dragged=true;e.currentTarget.setPointerCapture(e.pointerId);
        e.currentTarget.scrollLeft=start.left-distance;e.preventDefault();
      },
      onPointerup:()=>{start=null},onPointercancel:()=>{start=null},onLostpointercapture:()=>{start=null},
    };
    return ()=>{
    const panes=flatten(slots.default?.()).filter(v=>v.type?.name==='ElTabPane');
    return h(TabsRoot,{...attrs,modelValue:String(p.modelValue),class:cn('m-tabs el-tabs',attrs.class),activationMode:'manual',
      'onUpdate:modelValue':select},()=>[
      h(TabsList,{...pan,class:'m-tabs-list','aria-label':'分类'},()=>panes.map(v=>h(TabsTrigger,{value:String(v.props.name),class:'m-tab',onMousedownCapture:e=>{if(e.button===0)e.stopPropagation()},onClick:()=>{if(!dragged)select(String(v.props.name))}},()=>v.children?.label?.()||v.props.label))),
      ...panes.map(v=>h(TabsContent,{value:String(v.props.name),forceMount:true,style:{display:v.props.name===p.modelValue?'':'none'},class:cn('m-tab-content',v.props.class)},()=>v.children?.default?.())),
    ])
    }
  },
})
export const ElCollapseItem=defineComponent({name:'ElCollapseItem',props:{name:{},title:String},setup:()=>()=>null})
export const ElCollapse=defineComponent({
  name:'ElCollapse',props:{modelValue:{},accordion:Boolean},emits:['update:modelValue','change'],
  setup(p,{attrs,slots,emit}) {
    const internal=ref(p.accordion?'':[]);
    return ()=>{
      const value=p.modelValue===undefined?internal.value:p.modelValue;
      const items=flatten(slots.default?.()).filter(v=>v.type?.name==='ElCollapseItem');
      return h(AccordionRoot,{...attrs,class:cn('m-accordion el-collapse',attrs.class),type:p.accordion?'single':'multiple',collapsible:true,modelValue:value,
        'onUpdate:modelValue':v=>{internal.value=v;emit('update:modelValue',v);emit('change',v)}},()=>items.map((v,i)=>h(AccordionItem,{value:String(v.props.name??i),class:'m-accordion-item'},()=>[
          h(AccordionHeader,{},()=>h(AccordionTrigger,{class:'m-accordion-trigger'},()=>[v.children?.title?.()||v.props.title,h('span',{'aria-hidden':true},'⌄')])),
          h(AccordionContent,{class:'m-accordion-content'},()=>v.children?.default?.()),
        ])))
    }
  },
})
export const ElTableColumn=defineComponent({name:'ElTableColumn',props:{prop:String,label:String,type:String,width:{},minWidth:{}},setup:()=>()=>null})
export const ElTable=defineComponent({
  name:'ElTable',props:{data:Array,size:String},emits:['selection-change'],
  setup(p,{attrs,slots,emit,expose}) {
    const selected=ref([]);
    watch(()=>p.data,rows=>{const next=selected.value.filter(row=>rows.includes(row));if(next.length!==selected.value.length){selected.value=next;emit('selection-change',next)}});
    const select=(row,checked)=>{selected.value=checked?[...selected.value,row]:selected.value.filter(r=>r!==row);emit('selection-change',selected.value)};
    expose({toggleRowSelection:(row,v)=>select(row,v??!selected.value.includes(row)),clearSelection:()=>{selected.value=[];emit('selection-change',[])}});
    return ()=>{
      const columns=flatten(slots.default?.()).filter(v=>v.type?.name==='ElTableColumn');
      return h('div',{...attrs,class:cn('m-data-table el-table',attrs.class)},[
        columns.some(c=>c.props.type==='selection')?h(ElCheckbox,{modelValue:!!p.data.length&&selected.value.length===p.data.length,'onUpdate:modelValue':v=>{selected.value=v?[...p.data]:[];emit('selection-change',selected.value)}},()=> '全选'):null,
        ...p.data.map((row,i)=>h('article',{class:'m-data-row'},columns.map((column,j)=> {
          if(column.props.type==='selection')return h(ElCheckbox,{modelValue:selected.value.includes(row),'aria-label':`选择第${i+1}行`,'onUpdate:modelValue':v=>select(row,v)});
          const content=column.children?.default?column.children.default({row,$index:i,column:column.props}):String(row[column.props.prop]);
          return h('div',{class:j===0?'m-data-row-title':'m-data-cell'},[h('span',{class:'m-data-label'},column.props.label),h('span',{class:'m-data-value'},content)])
        }))),
      ])
    }
  },
})
const dropdownKey=Symbol('mobile-dropdown')
export const ElDropdown=defineComponent({
  name:'ElDropdown',props:{splitButton:Boolean,size:String,trigger:String},emits:['click','command'],
  setup(p,{attrs,slots,emit}) {
    const open=ref(false);provide(dropdownKey,command=>{emit('command',command);open.value=false});
    return ()=>h('div',{...attrs,class:cn('m-dropdown el-dropdown',attrs.class)},[
      p.splitButton?h('div',{class:'m-button-group'},[
        h(Button,{variant:'outline',onClick:e=>emit('click',e)},slots.default),
        h(Button,{variant:'outline',size:'icon','aria-label':'更多操作',onClick:()=>open.value=true},()=> '⌄'),
      ]):h('div',{class:'m-dropdown-trigger',onClick:()=>open.value=true},slots.default?.()),
      h(Sheet,{open:open.value,title:'操作','onUpdate:open':v=>open.value=v},{default:()=>slots.dropdown?.()}),
    ])
  },
})
export const ElDropdownMenu=container('ElDropdownMenu','div','m-menu el-dropdown-menu')
export const ElDropdownItem=defineComponent({
  name:'ElDropdownItem',props:{command:{},icon:{},divided:Boolean,disabled:Boolean},
  setup(p,{attrs,slots}) {const choose=inject(dropdownKey);return ()=>h('button',{...attrs,type:'button',class:cn('m-menu-item el-dropdown-menu__item',p.divided&&'m-menu-divider',attrs.class),disabled:p.disabled,onClick:()=>choose(p.command)},[iconNode(p.icon),slots.default?.()])},
})
export const ElPopconfirm=defineComponent({
  name:'ElPopconfirm',props:{title:String,confirmButtonText:{default:'确认'},cancelButtonText:{default:'取消'}},emits:['confirm','cancel'],
  setup(p,{slots,emit}) {
    const open=ref(false);
    return ()=>h('span',{class:'m-popconfirm'},[
      h('span',{onClick:()=>open.value=true},slots.reference?.()),
      h(Sheet,{open:open.value,title:p.title,'onUpdate:open':v=>{open.value=v;if(!v)emit('cancel')}},{footer:()=>[
        h(Button,{variant:'outline',onClick:()=>{open.value=false;emit('cancel')}},()=>p.cancelButtonText),
        h(Button,{onClick:()=>{open.value=false;emit('confirm')}},()=>p.confirmButtonText),
      ]}),
    ])
  },
})
export const ElTooltip=defineComponent({name:'ElTooltip',setup:(p,{slots})=>{
  const open=ref(false);return ()=>h('span',{class:'m-tooltip'},[
    h('button',{type:'button',class:'m-tooltip-trigger','aria-label':'查看详情',onClick:()=>open.value=true},slots.default?.()),
    h(Sheet,{open:open.value,title:'详情','onUpdate:open':v=>open.value=v},{default:()=>slots.content?.()}),
  ])
}})
export const ElPagination=defineComponent({
  name:'ElPagination',props:{currentPage:{default:1},pageSize:Number,total:Number,layout:String,small:Boolean},emits:['update:current-page','current-change'],
  setup(p,{attrs,emit}) {
    const go=v=>{emit('update:current-page',v);emit('current-change',v)};
    return ()=>{const count=Math.max(1,Math.ceil(p.total/p.pageSize)),first=Math.max(1,Math.min(p.currentPage-2,count-4));return h('nav',{...attrs,class:cn('m-pagination el-pagination',attrs.class),'aria-label':'分页'},[
      h(Button,{variant:'outline',disabled:p.currentPage===1,'aria-label':'上一页',onClick:()=>go(p.currentPage-1)},()=> '‹'),
      ...Array.from({length:Math.min(5,count)},(_,i)=>h(Button,{variant:p.currentPage===first+i?'default':'outline','aria-current':p.currentPage===first+i?'page':undefined,onClick:()=>go(first+i)},()=>String(first+i))),
      h(Button,{variant:'outline',disabled:p.currentPage===count,'aria-label':'下一页',onClick:()=>go(p.currentPage+1)},()=> '›'),
    ])}
  },
})
export const ElTree=defineComponent({
  name:'ElTree',props:{data:Array,nodeKey:{default:'id'},defaultCheckedKeys:{default:()=>[]},filterNodeMethod:Function,showCheckbox:Boolean},emits:['check','node-click'],
  setup(p,{attrs,slots,emit,expose}) {
    const checked=ref(new Set(p.defaultCheckedKeys)),query=ref(''),expanded=ref(new Set());
    const all=()=>{const result=[];const visit=nodes=>nodes.forEach(n=>{result.push(n);if(n.children)visit(n.children)});visit(p.data);return result};
    const leaves=node=>node.children?node.children.flatMap(leaves):[node];
    const state=node=>{const children=leaves(node),n=children.filter(c=>checked.value.has(c[p.nodeKey])).length;return n===children.length?true:n?'indeterminate':false};
    const getCheckedNodes=()=>all().filter(n=>state(n)===true);
    const toggle=(node,v)=>{const next=new Set(checked.value);leaves(node).forEach(n=>v?next.add(n[p.nodeKey]):next.delete(n[p.nodeKey]));checked.value=next;
      emit('check',node,{checkedNodes:getCheckedNodes(),checkedKeys:getCheckedNodes().map(n=>n[p.nodeKey])})};
    watch(()=>p.defaultCheckedKeys,v=>{checked.value=new Set(v)},{deep:true});
    expose({filter:v=>query.value=v,getCheckedNodes,getCheckedKeys:()=>getCheckedNodes().map(n=>n[p.nodeKey]),setCheckedKeys:v=>checked.value=new Set(v)});
    const visible=node=>!query.value||p.filterNodeMethod(query.value,node)||node.children?.some(visible);
    const renderNodes=(nodes,depth)=>nodes.filter(visible).map((data,i)=>{
      const key=data[p.nodeKey]??`${depth}-${i}`,branch=!!data.children,isOpen=query.value||expanded.value.has(key);
      return h('div',{class:'m-tree-node',role:'treeitem','aria-expanded':branch?!!isOpen:undefined},[
        h('div',{class:'m-tree-row',style:{paddingLeft:`${depth*16}px`}},[
          branch?h(Button,{variant:'ghost',size:'icon','aria-label':isOpen?'收起':'展开',onClick:()=>{const next=new Set(expanded.value);isOpen?next.delete(key):next.add(key);expanded.value=next}},()=>isOpen?'⌄':'›'):null,
          p.showCheckbox?h(CheckboxRoot,{class:'m-checkbox',checked:state(data),'aria-label':data.label,'onUpdate:checked':v=>toggle(data,v)},()=>h(CheckboxIndicator,{},()=>state(data)==='indeterminate'?'−':'✓')):null,
          h('button',{type:'button',class:'m-tree-label',onClick:()=>{emit('node-click',data);if(branch){const next=new Set(expanded.value);isOpen?next.delete(key):next.add(key);expanded.value=next}}},slots.default?slots.default({data,node:{data,isLeaf:!branch}}):data.label),
        ]),
        branch&&isOpen?h('div',{role:'group'},renderNodes(data.children,depth+1)):null,
      ])
    });
    return ()=>h('div',{...attrs,class:cn('m-tree el-tree',attrs.class),role:'tree'},renderNodes(p.data,0))
  },
})
