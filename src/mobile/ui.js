import { defineComponent, h, ref, watch, Fragment, Teleport } from 'vue'
import { Primitive, DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle, DialogClose } from 'radix-vue'
import { cva } from 'class-variance-authority'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Source-owned shadcn-vue primitives, using the Vue 3.2 / Radix generation.
// https://radix.shadcn-vue.com/docs/components/button
// https://radix.shadcn-vue.com/docs/components/sheet
export const cn = (...inputs) => twMerge(clsx(inputs))
export const buttonVariants = cva('m-inline-flex m-items-center m-justify-center m-gap-2 m-rounded-xl m-text-sm m-font-medium m-transition-colors disabled:m-pointer-events-none disabled:m-opacity-50', {
  variants: {
    variant: {
      default: 'm-bg-primary m-text-primary-foreground',
      outline: 'm-border m-border-input m-bg-background m-text-foreground',
      secondary: 'm-bg-secondary m-text-secondary-foreground',
      destructive: 'm-bg-destructive m-text-destructive-foreground',
      ghost: 'm-text-foreground hover:m-bg-accent',
      link: 'm-text-primary m-underline-offset-4 hover:m-underline',
    },
    size: { default: 'm-min-h-11 m-px-4 m-py-2', icon: 'm-h-11 m-w-11 m-shrink-0' },
  },
  defaultVariants: { variant: 'default', size: 'default' },
})
export const Button = defineComponent({
  name: 'ShadcnButton',
  props: { variant: {default:'default'}, size: {default:'default'}, as: {default:'button'}, asChild:Boolean },
  setup: (props, {slots, attrs}) => () => h(Primitive, {
    ...attrs, as:props.as, asChild:props.asChild, type:props.as === 'button' ? 'button' : undefined,
    class:cn(buttonVariants({variant:props.variant,size:props.size}), 'm-button',attrs.class),
  }, slots),
})
export const Sheet = defineComponent({
  name:'ShadcnSheet', inheritAttrs:false,
  props:{open:Boolean,title:String,showClose:{default:true},closeOnClickModal:{default:true},closeOnPressEscape:{default:true},destroyOnClose:Boolean},
  emits:['update:open'],
  setup(props,{slots,attrs,emit}) {
    const parking=ref(null),target=ref(null),mounted=ref(props.open)
    watch(()=>props.open,v=>{if(v)mounted.value=true})
    return () => h(Fragment,{},[
      h('div',{ref:parking,style:{display:'none'},'aria-hidden':true}),
      h(DialogRoot,{open:props.open,'onUpdate:open':v=>emit('update:open',v)}, {default:()=>h(DialogPortal,{}, {default:()=>[
      h(DialogOverlay,{class:'m-sheet-overlay'}),
      h(DialogContent,{
        ...attrs,class:cn('m-sheet',attrs.class),'aria-describedby':undefined,
        onEscapeKeyDown:e=>{if(!props.closeOnPressEscape)e.preventDefault()},
        onPointerDownOutside:e=>{if(!props.closeOnClickModal)e.preventDefault()},
        onInteractOutside:e=>{if(!props.closeOnClickModal)e.preventDefault()},
      },{default:()=>[
        h('header',{class:'m-sheet-header'},[
          h(DialogTitle,{class:'m-sheet-title'},()=>props.title),
          props.showClose ? h(DialogClose,{asChild:true},()=>h(Button,{variant:'ghost',size:'icon','aria-label':'关闭'},()=> '×')) : null,
        ]),
        h('div',{class:'m-sheet-body',ref:target}),
        slots.footer ? h('footer',{class:'m-sheet-footer'},slots.footer()) : null,
      ]}),
    ]})}),
      mounted.value && parking.value && (!props.destroyOnClose || props.open) ? h(Teleport,{to:target.value||parking.value},[h('div',{class:'m-sheet-body-content'},slots.default?.())]) : null,
    ])
  },
})
export function flatten(nodes) {
  return (nodes || []).flatMap(node => node.type === Fragment ? flatten(node.children) : [node])
}
export function slotText(nodes) {
  return (nodes || []).map(node => typeof node.children === 'string' ? node.children : Array.isArray(node.children) ? slotText(node.children) : '').join('')
}
export const iconNode = icon => icon && typeof icon !== 'string' ? h(icon,{'aria-hidden':true}) : null
