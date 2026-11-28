<template>
 <TeamDialog :model-value="true" title="技能倍率预览" viewport width="min(1120px,96vw)" @update:model-value="!$event && $emit('close')">
  <p class="preview-description">按单目标汇总当前轴内的技能倍率，包含形态、资源、命座追加和角色独立倍率。生命消耗增幅、装备效果及定额加值在正式伤害计算中结算。</p>
  <p v-if="error" class="team-inline-error" role="alert">{{ error }}</p>
  <simple-loading v-else-if="!preview"/>
  <template v-else>
   <div class="preview-overview"><strong>{{ number(preview.duration) }} 秒</strong><span>{{ preview.roles.reduce((n,r)=>n+r.hits.length,0) }} 段命中</span><span>轴尾命中{{ preview.endHit==='include'?'计入':'排除' }}</span></div>
   <div class="team-table-scroll multiplier-summary">
    <table class="team-data-table" aria-label="技能倍率预览">
     <colgroup><col style="width:48px"/><col/><col style="width:100px"/><col/><col/></colgroup>
     <thead><tr><th aria-label="展开"></th><th>角色</th><th>命中段数</th><th>基础倍率总和</th><th>含角色修正的倍率总和</th></tr></thead>
     <tbody>
      <template v-for="row in preview.roles" :key="row.character.name">
       <tr>
        <td><UiButton size="small" :aria-expanded="expanded.includes(row.character.name)" :aria-label="locale[characterData[row.character.name].nameLocale]+'技能倍率预览'" @click="toggleHits(row.character.name)"><i-ep-arrow-down v-if="expanded.includes(row.character.name)" aria-hidden="true"/><i-ep-arrow-right v-else aria-hidden="true"/></UiButton></td>
        <td><div class="preview-character"><img :src="characterData[row.character.name].avatar" alt=""/><div><strong>{{ locale[characterData[row.character.name].nameLocale] }}</strong><small>Lv.{{ row.character.level }} · C{{ row.character.constellation }} · 天赋 {{ row.character.skill1+1 }}/{{ row.character.skill2+1 }}/{{ row.character.skill3+1 }}</small></div></div></td>
        <td>{{ row.hits.length }}</td><td>{{ ratios(row.base) }}</td><td>{{ ratios(row.effective) }}</td>
       </tr>
       <tr v-if="expanded.includes(row.character.name)">
        <td colspan="5" class="multiplier-expanded">
         <div class="team-table-scroll multiplier-hits">
          <table class="team-data-table" aria-label="命中段数">
           <colgroup><col style="width:100px"/><col/><col style="width:110px"/><col/><col/><col/></colgroup>
           <thead><tr><th>时间（秒）</th><th>动作</th><th>状态</th><th>基础倍率</th><th>角色倍率修正</th><th>合计倍率</th></tr></thead>
           <tbody>
            <tr v-for="(hit,i) in row.hits" :key="i">
             <td>{{ number(hit.time) }}</td><td>{{ hit.label }}</td><td>{{ elements[hit.element] }} · {{ hit.onField?'前台':'后台' }}</td>
             <td>{{ hit.damageModel==='reaction.superconduct'?'—':ratios(hit.base) }}</td>
             <td><div v-for="(m,j) in hit.modifiers" :key="j">{{ m.label }} +{{ number(m.value*100) }}%{{ stats[m.stat] }}</div><span v-if="!hit.modifiers.length">—</span></td>
             <td>{{ hit.damageModel==='reaction.superconduct'?'—':ratios(hit.effective) }}</td>
            </tr>
            <tr v-if="!row.hits.length"><td colspan="6" class="team-data-empty">此角色在轴内没有伤害命中</td></tr>
           </tbody>
          </table>
         </div>
        </td>
       </tr>
      </template>
     </tbody>
    </table>
   </div>
   <p class="preview-context">使用本轴当前计算参数；未设置时为90级、C0、天赋10级，队伍天赋等级加成已计入。</p>
  </template>
  <template #footer><div class="team-dialog-actions"><UiButton @click="$emit('close')">关闭</UiButton></div></template>
 </TeamDialog>
</template>
<script setup lang="ts">
import {ref,onMounted,onBeforeUnmount} from 'vue'
import TeamDialog from './TeamDialog.vue'
import UiButton from '@/components/ui/UiButton.vue'
import SimpleLoading from '@/components/loading/SimpleLoading.vue'
import {characterData} from '@/assets/character'
import locale from '@/i18n/generated/zh-cn.json'
const props=defineProps<{axis:any,characters?:any[]}>()
defineEmits(['close'])
const preview=ref<any>(null),error=ref('')
const expanded=ref<string[]>([])
function toggleHits(name:string) {
 if (expanded.value.includes(name)) expanded.value = expanded.value.filter(item => item !== name)
 else expanded.value.push(name)
}
const stats:Record<string,string>={atk:'攻击力',hp:'生命值上限',def:'防御力',em:'元素精通'}
const elements:Record<string,string>={Physical:'物理',Cryo:'冰',Hydro:'水',Pyro:'火',Electro:'雷',Anemo:'风',Geo:'岩',Dendro:'草'}
const number=(n:number)=>n.toLocaleString('zh-CN',{maximumFractionDigits:2})
const ratios=(values:Record<string,number>)=>Object.entries(values).filter(([,v])=>v!==0).map(([key,v])=>`${number(v*100)}%${stats[key]}`).join(' + ')||'0'
let worker:Worker|null=null
function fail(message:string,stack?:string){console.error(stack||message);error.value=message;worker?.terminate();worker=null}
onMounted(()=>{
 worker=new Worker(new URL('@worker/team_multiplier_preview.js',import.meta.url))
 worker.onerror=e=>fail(e.message)
 worker.onmessage=({data})=>{
  if(data.type==='ready')worker!.postMessage(JSON.parse(JSON.stringify({axis:props.axis,characters:props.characters})))
  else if(data.type==='error')fail(data.message,data.stack)
  else if(data.type==='result'){preview.value=data.result;worker?.terminate();worker=null}
 }
})
onBeforeUnmount(()=>{worker?.terminate();worker=null})
</script>
<style scoped>
.preview-description,.preview-context{color:var(--cx-dim);font-size:13px;line-height:1.7;margin:0 0 16px}.preview-context{margin:14px 0 0}.preview-overview{display:flex;align-items:center;gap:20px;margin-bottom:18px;color:var(--cx-dim)}.preview-overview strong{font-size:24px;color:var(--cx-gold)}.preview-character{display:flex;align-items:center;gap:12px}.preview-character img{width:42px;height:42px;border-radius:50%;background:var(--cx-step)}.preview-character small{display:block;color:var(--cx-dim);margin-top:4px}.multiplier-summary > table{min-width:758px;line-height:1.7}.multiplier-hits{margin:6px 0 12px;max-height:450px}.multiplier-hits > table{min-width:890px}.team-data-table td.multiplier-expanded{padding:12px 18px;background:var(--cx-step)}
</style>
