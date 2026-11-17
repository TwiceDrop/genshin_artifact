<template>
 <div class="block-editor">
  <div class="skill-shelf">
   <div v-for="(member,r) in axis.members" :key="member.slot" class="shelf-row">
    <div class="shelf-person"><div class="person"><img :src="characterData[member.character].avatar" alt=""/>{{ label(member) }}</div><label class="preview-constellation">命座<select :value="buffConstellations[r]" :aria-label="label(member)+'命座'" :disabled="disabled" @change="constellationOverrides[member.slot]=Number($event.target.value)"><option v-for="n in 7" :key="n-1" :value="n-1">{{ n-1 }}命</option></select></label></div>
    <div class="skills"><button v-for="action in catalog[member.character]" :key="action.id" type="button" :disabled="disabled" @pointerdown="beginNew($event,member,action)">{{ action.label }}</button><button type="button" :disabled="disabled" @pointerdown="beginNew($event,member,null)">切换至</button></div>
   </div>
  </div>
  <div ref="viewport" class="timeline-scroll" tabindex="0" @keydown.left.prevent="nudge(-1)" @keydown.right.prevent="nudge(1)" @keydown.delete.prevent="selected&&remove(selected.id)" @wheel="wheel" @scroll="hoverBuff=null">
   <div class="timeline-canvas" :style="{width:canvasWidth+'px'}">
    <div v-if="drag?.inside&&drag.snapTime!==undefined" class="snap-guide" :style="{left:labelWidth+drag.snapTime/1000*scale+'px'}"/><div class="ruler"><span class="track-label">时间（秒）</span><span v-for="tick in ticks" :key="tick" class="tick" :style="{left:labelWidth+tick*scale+'px'}">{{ tick }}</span></div>
    <div v-for="(member,r) in axis.members" :key="member.slot" class="action-track" :data-slot="member.slot" :style="{height:trackHeight(r)+'px'}">
     <div class="track-label person"><img :src="characterData[member.character].avatar" alt=""/>{{ label(member) }}</div>
     <button v-for="block in tracks[r]" :key="block.id" type="button" class="action-block" :class="{selected:selectedId===block.id}" :style="{left:labelWidth+block.timeMs/1000*scale+'px',top:8+block.level*42+'px',width:block.width+'px'}" :title="actionLabel(block)+(block.durationMs!==undefined?' · '+(block.durationMs/1000).toFixed(1)+'s':'')" :disabled="disabled" @pointerdown="beginMove($event,block)" @click="selectedId=block.id" @keydown.delete.stop.prevent="remove(block.id)"><strong>{{ actionLabel(block) }}</strong><span>{{ (block.timeMs/1000).toFixed(1) }}s</span></button>
     <div v-for="(window,i) in buffTracks[r]" :key="window.key+'/'+i" class="buff-bar" tabindex="0" :aria-label="buffDescription(window)" :style="{left:labelWidth+window.start*scale+'px',width:Math.max(3,(window.end-window.start)*scale)+'px',top:blockAreaHeight(r)-5+window.level*5+'px','--buff-color':buffColor(window.key)}" @mouseenter="showBuff($event,window)" @mousemove="showBuff($event,window)" @mouseleave="hoverBuff=null" @focus="showBuff($event,window)" @blur="hoverBuff=null"/>
     <div v-if="drag&&drag.row.actor===member.slot&&drag.inside" class="ghost" :class="{snapping:drag.snapTime!==undefined}" :style="{left:labelWidth+'px',transform:'translateX('+drag.visualTimeMs/1000*scale+'px)',width:dragWidth+'px'}"><strong>{{ actionLabel(drag.row) }}</strong><span>{{ (drag.timeMs/1000).toFixed(1) }}s</span></div>
    </div>
   </div>
  </div>
  <teleport to="body"><div v-if="hoverBuff" ref="buffTooltip" class="buff-tooltip" role="tooltip" :style="{left:hoverBuff.left+'px',top:hoverBuff.top+'px'}"><div class="buff-tooltip-heading">{{ buffHeading(hoverBuff.entry) }}</div><div v-for="(detail,i) in hoverBuff.entry.details" :key="i" class="buff-tooltip-detail">{{ detail }}</div></div></teleport>
  <div v-if="selected&&preview" class="skill-details">
   <strong>技能倍率预览</strong>
   <div v-for="(hit,i) in selectedHits" :key="i" class="skill-hit"><span>{{ seconds(hit.time) }}s</span><span>{{ hit.label }}</span><span>{{ hit.damageModel==='reaction.superconduct'?'—':ratios(hit.effective) }}</span></div>
  </div>
  <el-alert v-if="previewError" :title="previewError" type="error" :closable="false"/>
  <el-progress v-if="previewBusy" :percentage="50" :indeterminate="true" :show-text="false"/>
  <div v-if="selected" class="block-properties">
   <strong>{{ actionLabel(selected) }}</strong>
   <label>时间（秒） <el-input-number :model-value="selected.timeMs/1000" :min="0" :step="0.1" :disabled="disabled" @update:model-value="updateTime"/></label>
   <label v-for="field in parameters" :key="field.key">{{ field.label }}<el-input-number :model-value="selected.params?.[field.key]===undefined?undefined:selected.params[field.key]/(field.scale||1)" :min="field.min/(field.scale||1)" :max="field.max/(field.scale||1)" :step="field.step" :disabled="disabled" @update:model-value="setParameter(field,$event)"/></label>
   <el-button :disabled="disabled||selectedIndex===0" @click="reorder(-1)">↑</el-button><el-button :disabled="disabled||selectedIndex===axis.timeline.length-1" @click="reorder(1)">↓</el-button><el-button type="danger" :disabled="disabled" @click="remove(selected.id)">删除</el-button>
  </div>
 </div>
</template>
<script setup>
import {computed,ref,shallowRef,watch,onBeforeUnmount,nextTick} from 'vue'
import {characterData} from '@/assets/character'
import locale from '@/i18n/generated/zh-cn.json'
import {TEAM_ACTION_CATALOG as catalog} from '../../../beta-data/team-engine/action-config.mjs'
import {TIMELINE_SCALE as scale,TIMELINE_LABEL_WIDTH as labelWidth,pointerTime,edgeVelocity,stackBlocks,findTimelineSnap,nudgeActionTime,actionBlockWidth} from './timeline-layout.mjs'
import {createTeamPreviewSession} from './team-preview-session.mjs'
import {previewActionCasts} from '../../../beta-data/team-engine/action-cast-preview.mjs'
const props=defineProps({axis:{type:Object,required:true},characters:Array,disabled:Boolean})
const emit=defineEmits(['update:timeline'])
const viewport=ref(null),selectedId=ref(''),drag=ref(null),preview=shallowRef(null),previewError=ref(''),previewBusy=ref(false),extraSeconds=ref(0)
const hoverBuff=shallowRef(null)
const buffTooltip=ref(null)
const constellationOverrides=ref({})
const buffConstellations=computed(()=>props.axis.members.map((member,r)=>constellationOverrides.value[member.slot]??props.characters?.[r]?.constellation??0))
watch(()=>JSON.stringify([props.axis.id,props.axis.members]),()=>{constellationOverrides.value={}},{immediate:true})
const label=m=>locale[characterData[m.character].nameLocale]
const seconds=n=>Number(n.toFixed(3))
const actionLabel=row=>row.kind==='switch'?'切换至':catalog[props.axis.members.find(m=>m.slot===row.actor).character].find(a=>a.id===row.action).label
const selectedIndex=computed(()=>props.axis.timeline.findIndex(row=>row.id===selectedId.value))
const selected=computed(()=>props.axis.timeline[selectedIndex.value])
const parameters=computed(()=>selected.value?.kind==='action'?catalog[props.axis.members.find(m=>m.slot===selected.value.actor).character].find(a=>a.id===selected.value.action).parameters||[]:[])
const castInput=computed(()=>JSON.parse(JSON.stringify({axis:props.axis,characters:props.characters})))
const castTimings=computed(()=>previewActionCasts(castInput.value.axis,castInput.value.characters))
const timedRows=computed(()=>props.axis.timeline.map((row,order)=>{const durationMs=castTimings.value.find(c=>c.id===row.id)?.durationMs;return {...row,order,durationMs,width:actionBlockWidth(durationMs)}}))
const dragWidth=computed(()=>{
 const d=drag.value;if(!d)return undefined
 const row=JSON.parse(JSON.stringify({...d.row,timeMs:d.timeMs})),input=castInput.value
 const timeline=d.isNew?[...input.axis.timeline,row]:input.axis.timeline.map(a=>a.id===row.id?row:a)
 const timing=previewActionCasts({...input.axis,timeline},input.characters).find(c=>c.id===row.id)
 return actionBlockWidth(timing?.durationMs)
})
const tracks=computed(()=>props.axis.members.map(m=>stackBlocks(timedRows.value.filter(row=>row.actor===m.slot),row=>row.width)))
const blockAreaHeight=r=>Math.max(52,...tracks.value[r].map(b=>b.level*42+52))
const buffTracks=computed(()=>props.axis.members.map((_,r)=>{
 const rows=(preview.value?.windows||[]).filter(w=>w.role===r&&w.end>w.start),keys=[...new Set(rows.map(w=>w.key))];
 return rows.map(w=>({...w,level:keys.indexOf(w.key)}))
}))
const trackHeight=r=>Math.max(72,blockAreaHeight(r)+Math.max(0,...buffTracks.value[r].map(w=>w.level+1))*5+10)
const selectedHits=computed(()=>selected.value?preview.value?.roles.flatMap(role=>role.hits.filter(h=>h.eventId===selected.value.id||h.eventId.startsWith(selected.value.id+'/')))||[]:[])
const length=computed(()=>Math.ceil(Math.max(20,extraSeconds.value,preview.value?.duration||0,...(preview.value?.windows||[]).map(w=>w.end),...props.axis.timeline.map(row=>row.timeMs/1000))+5))
const canvasWidth=computed(()=>labelWidth+length.value*scale+180)
const ticks=computed(()=>Array.from({length:Math.floor(length.value/2)+1},(_,i)=>i*2))
const windowNames={fanfare:'万众狂欢',furinaSinger:'众水的歌者',skirkPhase:'七相一闪',skirkC2:'凋尽',monaOmen:'星异',monaC2:'莫娜·二命',vodySong:'遥久之歌',vodyFlat:'十二弦的泪歌'}
const buffHeading=w=>`${w.label||windowNames[w.key]||w.key} · ${label(props.axis.members[w.role])} · ${seconds(w.start)}–${seconds(w.end)}s${w.probability!==undefined&&w.probability!==1?' · '+seconds(w.probability*100)+'%':''}`
const buffDescription=w=>[buffHeading(w),...(w.details||[])].join('\n')
const buffKeys=computed(()=>[...new Set((preview.value?.windows||[]).map(w=>w.key))].sort())
const buffColor=key=>`hsl(${buffKeys.value.indexOf(key)*137.508%360} 55% 45%)`
function showBuff(event,entry){
 const rect=event.currentTarget.getBoundingClientRect(),view=viewport.value.getBoundingClientRect()
 const x=event.clientX??Math.max(rect.left+8,view.left+labelWidth+8),y=event.clientY??rect.top
 const hover={entry,left:Math.max(12,Math.min(x+12,window.innerWidth-372)),top:y-12}
 hoverBuff.value=hover
 nextTick(()=>{
  if(hoverBuff.value!==hover||!buffTooltip.value)return
  const tooltip=buffTooltip.value.getBoundingClientRect()
  hoverBuff.value={...hover,left:Math.max(12,Math.min(x+12,window.innerWidth-tooltip.width-12)),top:Math.max(12,Math.min(y-tooltip.height-12,window.innerHeight-tooltip.height-12))}
 })
}
const stats={atk:'攻击力',hp:'生命值上限',def:'防御力',em:'元素精通'}
const ratios=values=>Object.entries(values).filter(([,v])=>v!==0).map(([key,v])=>`${Number((v*100).toFixed(2))}%${stats[key]}`).join(' + ')||'0'
function commit(rows){emit('update:timeline',rows)}
function replace(row){commit(props.axis.timeline.map(old=>old.id===row.id?row:old))}
function updateTime(value){replace({...selected.value,timeMs:Math.round(value*1000)})}
function setParameter(field,value){const row={...selected.value,params:{...selected.value.params}};if(value===undefined||value===null)delete row.params[field.key];else row.params[field.key]=value*(field.scale||1);if(!Object.keys(row.params).length)delete row.params;replace(row)}
function nudge(direction){if(selected.value&&!props.disabled)replace({...selected.value,timeMs:nudgeActionTime(selected.value.timeMs,direction)})}
function remove(id){if(!props.disabled)commit(props.axis.timeline.filter(row=>row.id!==id))}
function reorder(direction){const rows=[...props.axis.timeline],i=selectedIndex.value;[rows[i],rows[i+direction]]=[rows[i+direction],rows[i]];commit(rows)}
let frame=0,lastFrame=0
function start(event,row,isNew,offset){
 if(props.disabled||event.button!==0||event.pointerType==='touch')return
 event.preventDefault();event.currentTarget.focus({preventScroll:true});hoverBuff.value=null;selectedId.value=isNew?'':row.id
 drag.value={row:{...row},isNew,offset,timeMs:row.timeMs,visualTimeMs:row.timeMs,x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,moved:false,inside:false,pointerId:event.pointerId}
 window.addEventListener('pointermove',move);window.addEventListener('pointerup',drop);window.addEventListener('pointercancel',cancel);window.addEventListener('keydown',escape);window.addEventListener('blur',cancel)
 lastFrame=0;frame=requestAnimationFrame(autoScroll)
}
function beginNew(event,member,action){start(event,{id:crypto.randomUUID(),actor:member.slot,kind:action?'action':'switch',...(action?{action:action.id}:{}),timeMs:0},true,0)}
function beginMove(event,row){start(event,row,false,event.clientX-event.currentTarget.getBoundingClientRect().left)}
function locate(){const d=drag.value,el=viewport.value;if(!d||!el)return;const rect=el.getBoundingClientRect();d.inside=d.x>=rect.left+labelWidth&&d.x<=rect.right&&d.y>=rect.top&&d.y<=rect.bottom;const time=pointerTime(d.x,rect.left,el.scrollLeft,d.offset,false);d.snapTime=findTimelineSnap(time,timedRows.value,d.row.id,32/scale*1000);d.timeMs=d.snapTime??Math.round(time/100)*100;d.visualTimeMs=d.snapTime??time}
function move(e){if(e.pointerId!==drag.value?.pointerId)return;Object.assign(drag.value,{x:e.clientX,y:e.clientY});drag.value.moved ||=Math.hypot(e.clientX-drag.value.startX,e.clientY-drag.value.startY)>4}
function autoScroll(now){const d=drag.value,el=viewport.value;if(!d||!el)return;const rect=el.getBoundingClientRect();if(d.moved&&d.y>=rect.top&&d.y<=rect.bottom){const velocity=edgeVelocity(d.x,rect.left+labelWidth,rect.right);el.scrollLeft+=velocity*Math.min(2,(now-lastFrame||16.7)/16.7);if(velocity>0&&el.scrollLeft+el.clientWidth>=el.scrollWidth-24)extraSeconds.value=length.value+5}if(d.moved)locate();lastFrame=now;frame=requestAnimationFrame(autoScroll)}
function drop(e){if(e.pointerId!==drag.value?.pointerId)return;move(e);locate();const d=drag.value;if(d.inside&&d.moved&&!props.disabled){const row={...d.row,timeMs:d.timeMs};delete row.level;delete row.order;delete row.width;delete row.durationMs;if(d.isNew)commit([...props.axis.timeline,row]);else replace(row);selectedId.value=row.id;nextTick(()=>viewport.value?.focus({preventScroll:true}))}cancel()}
function escape(e){if(e.key==='Escape')cancel()}
function cancel(){cancelAnimationFrame(frame);drag.value=null;window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',drop);window.removeEventListener('pointercancel',cancel);window.removeEventListener('keydown',escape);window.removeEventListener('blur',cancel)}
function wheel(e){if(e.ctrlKey)return;const delta=e.deltaX||(e.shiftKey?e.deltaY:0);if(!delta)return;e.preventDefault();viewport.value.scrollLeft+=delta*(e.deltaMode===1?16:e.deltaMode===2?viewport.value.clientWidth:1)}
const previewSession=createTeamPreviewSession({
 createWorker:()=>new Worker(new URL('@worker/team_multiplier_preview.js',import.meta.url)),
 onResult:result=>{preview.value=result;previewBusy.value=false},
 onError:(message,detail)=>{console.error(detail||message);previewError.value=message;previewBusy.value=false},
})
watch(()=>[props.axis,props.characters,buffConstellations.value],()=>{
 preview.value=null;previewError.value='';previewBusy.value=true;hoverBuff.value=null;cancel()
 previewSession.update({axis:props.axis,characters:props.characters,includeEffects:true,buffConstellations:buffConstellations.value})
},{deep:true,immediate:true})
watch(()=>props.disabled,value=>{if(value)cancel()})
onBeforeUnmount(()=>{cancel();previewSession.dispose()})
</script>
<style scoped>
.ghost{will-change:transform;box-shadow:0 3px 8px #31557926}.ghost.snapping{transition:transform 80ms ease-out}@media(prefers-reduced-motion:reduce){.ghost.snapping{transition:none}}
.snap-guide{position:absolute;top:36px;bottom:0;width:0;border-left:2px dashed #2879d8;z-index:6;pointer-events:none}
.buff-tooltip-heading{font-weight:600}.buff-tooltip-detail{margin-top:5px}
.shelf-person{display:flex;flex-direction:column;gap:6px;min-width:128px}.preview-constellation{display:flex;align-items:center;gap:8px;padding-left:38px;font-size:12px}.preview-constellation select{border:1px solid #cbd9eb;border-radius:4px;background:#f2f7ff;color:#315b90;padding:3px;font:inherit}
.block-editor{--grid:#e8edf5;color:#405673}.skill-shelf{border:1px solid #dce4ef;border-radius:8px;margin-bottom:16px;overflow:hidden}.shelf-row{display:flex;border-bottom:1px solid #edf1f6;padding:10px;gap:12px}.shelf-row:last-child{border:0}.person{display:flex;align-items:center;gap:8px;font-weight:600;font-size:13px;min-width:128px}.person img{width:30px;height:30px;border-radius:50%}.skills{display:flex;flex-wrap:wrap;gap:6px}.skills button{border:1px solid #cbd9eb;background:#f2f7ff;color:#315b90;border-radius:5px;padding:7px 10px;font:inherit;font-size:12px;cursor:grab;touch-action:none}.skills button:hover{background:#e1edff;border-color:#6095d5}.skills button:disabled{opacity:.5;cursor:default}.timeline-scroll{overflow-x:scroll;overflow-y:auto;max-height:650px;border:1px solid #ccd9e9;border-radius:8px;scrollbar-color:#8ba5c6 #e8eef5;scrollbar-width:auto;overscroll-behavior-x:contain}.timeline-scroll::-webkit-scrollbar{height:15px;width:12px}.timeline-scroll::-webkit-scrollbar-thumb{background:#8ba5c6;border:3px solid #e8eef5;border-radius:8px}.timeline-scroll::-webkit-scrollbar-track{background:#e8eef5}.timeline-canvas{position:relative;background:repeating-linear-gradient(to right,transparent 0,transparent 63px,var(--grid) 63px,var(--grid) 64px);background-position:150px 0}.ruler{height:36px;position:sticky;top:0;background:#f1f5fa;z-index:4;border-bottom:1px solid #dce4ef}.tick{position:absolute;top:8px;font-size:11px;border-left:1px solid #a7b8cf;padding-left:4px}.track-label{position:sticky;left:0;width:150px;box-sizing:border-box;height:100%;padding:10px;background:#f8fafc;border-right:1px solid #dce4ef;z-index:3;display:flex;align-items:center;font-size:12px;overflow:hidden}.action-track{position:relative;border-bottom:1px solid #e2e9f2;min-height:40px}.action-block,.ghost{position:absolute;box-sizing:border-box;height:36px;font-family:inherit;line-height:14px;border:1px solid #7fa3d1;border-left:4px solid #5187cc;border-radius:5px;background:#eaf2ff;color:#315579;text-align:left;padding:3px 7px;cursor:grab;touch-action:none;overflow:hidden}.action-block strong,.ghost strong{display:block;font-size:11px;white-space:nowrap;text-overflow:ellipsis;overflow:hidden}.action-block span,.ghost span{display:block;font-size:10px;white-space:nowrap}.action-block.selected{outline:2px solid #357bce;outline-offset:1px}.ghost{top:8px;z-index:5;pointer-events:none;background:#cbe0ff;opacity:.85}.buff-bar{position:absolute;height:5px;cursor:help;outline:none}.buff-bar::after{content:"";position:absolute;left:0;right:0;top:1px;height:2px;background:var(--buff-color);border-radius:1px;pointer-events:none}.buff-bar:hover::after{filter:brightness(1.15)}.buff-bar:focus-visible::after{outline:1px solid #355b85;outline-offset:1px}.buff-tooltip{position:fixed;z-index:3000;width:360px;max-width:calc(100vw - 24px);max-height:calc(100vh - 24px);overflow-y:auto;box-sizing:border-box;padding:7px 10px;border-radius:5px;background:#30343b;color:#fff;font-size:12px;line-height:1.6;pointer-events:none;overflow-wrap:anywhere}.skill-details{margin-top:12px;padding:12px;background:#f8fafc;border-radius:6px;font-size:12px}.skill-hit{display:grid;grid-template-columns:70px minmax(140px,1fr) 2fr;gap:12px;padding-top:8px}.block-properties{display:flex;align-items:center;flex-wrap:wrap;gap:12px;margin-top:14px}.block-properties label{display:flex;align-items:center;gap:8px;font-size:12px}.block-properties .el-input-number{width:125px}button:focus-visible{outline:2px solid #357bce;outline-offset:2px}
</style>
