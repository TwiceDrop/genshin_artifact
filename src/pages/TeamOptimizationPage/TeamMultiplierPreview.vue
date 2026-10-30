<template>
 <el-dialog :model-value="true" title="技能倍率预览" width="min(1120px,96vw)" custom-class="team-dps-dialog" @close="$emit('close')">
  <p class="preview-description">按单目标汇总当前轴内的技能倍率，包含形态、资源、命座追加和角色独立倍率。生命消耗增幅、装备效果及定额加值在正式伤害计算中结算。</p>
  <el-alert v-if="error" :title="error" type="error" :closable="false"/>
  <simple-loading v-else-if="!preview"/>
  <template v-else>
   <div class="preview-overview"><strong>{{ number(preview.duration) }} 秒</strong><span>{{ preview.roles.reduce((n,r)=>n+r.hits.length,0) }} 段命中</span><span>轴尾命中{{ preview.endHit==='include'?'计入':'排除' }}</span></div>
   <el-table :data="preview.roles" row-key="character.name" class="multiplier-summary">
    <el-table-column type="expand"><template #default="{row}">
     <el-table :data="row.hits" max-height="450" class="multiplier-hits" empty-text="此角色在轴内没有伤害命中">
      <el-table-column label="时间（秒）" width="100"><template #default="{row:hit}">{{ number(hit.time) }}</template></el-table-column>
      <el-table-column prop="label" label="动作" min-width="180"/>
      <el-table-column label="状态" width="110"><template #default="{row:hit}">{{ elements[hit.element] }} · {{ hit.onField?'前台':'后台' }}</template></el-table-column>
      <el-table-column v-if="hasReactions" label="伤害类型" width="115"><template #default="{row:hit}">{{ hit.damageKind==='stellarConduct'?'直接星超导':hit.damageKind==='superconduct'?'超导反应':'普通伤害' }}</template></el-table-column>
      <el-table-column label="基础倍率" min-width="150"><template #default="{row:hit}">{{ hit.damageKind==='superconduct'?'反应系数 1.5':ratios(hit.base) }}</template></el-table-column>
      <el-table-column v-if="hasReactions" label="极星系数" width="90"><template #default="{row:hit}">{{ hit.stellarCoefficient===undefined?'—':number(hit.stellarCoefficient) }}</template></el-table-column>
      <el-table-column label="角色倍率修正" min-width="200"><template #default="{row:hit}"><div v-for="(m,i) in hit.modifiers" :key="i">{{ m.label }} +{{ number(m.value*100) }}%{{ stats[m.stat] }}</div><span v-if="!hit.modifiers.length">—</span></template></el-table-column>
      <el-table-column label="合计倍率" min-width="150"><template #default="{row:hit}">{{ ratios(hit.effective) }}</template></el-table-column>
     </el-table>
    </template></el-table-column>
    <el-table-column label="角色" min-width="230"><template #default="{row}"><div class="preview-character"><img :src="characterData[row.character.name].avatar" alt=""/><div><strong>{{ locale[characterData[row.character.name].nameLocale] }}</strong><small>Lv.{{ row.character.level }} · C{{ row.character.constellation }} · 天赋 {{ row.character.skill1+1 }}/{{ row.character.skill2+1 }}/{{ row.character.skill3+1 }}</small></div></div></template></el-table-column>
    <el-table-column label="命中段数" width="100"><template #default="{row}">{{ row.hits.length }}</template></el-table-column>
    <el-table-column label="基础倍率总和" min-width="180"><template #default="{row}">{{ ratios(row.base) }}</template></el-table-column>
    <el-table-column label="含角色修正的倍率总和" min-width="200"><template #default="{row}">{{ ratios(row.effective) }}</template></el-table-column>
   </el-table>
   <p class="preview-context">使用本轴当前计算参数；未设置时为90级、C0、天赋10级，队伍天赋等级加成已计入。</p>
  </template>
  <template #footer><el-button @click="$emit('close')">关闭</el-button></template>
 </el-dialog>
</template>
<script setup lang="ts">
import {ref,computed,onMounted,onBeforeUnmount} from 'vue'
import SimpleLoading from '@/components/loading/SimpleLoading.vue'
import {characterData} from '@/assets/character'
import locale from '@/i18n/generated/zh-cn.json'
const props=defineProps<{axis:any,characters?:any[]}>()
defineEmits(['close'])
const preview=ref<any>(null),error=ref('')
const hasReactions=computed(()=>preview.value?.roles.some((role:any)=>role.hits.some((hit:any)=>hit.damageKind==='stellarConduct'||hit.damageKind==='superconduct')))
const stats:Record<string,string>={atk:'攻击力',hp:'生命值上限',def:'防御力',em:'元素精通',stellar_atk:'攻击力（星超导）'}
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
.preview-description,.preview-context{color:#718096;font-size:13px;line-height:1.7;margin:0 0 16px}.preview-context{margin:14px 0 0}.preview-overview{display:flex;align-items:center;gap:20px;margin-bottom:18px;color:#718096}.preview-overview strong{font-size:24px;color:#355b85}.preview-character{display:flex;align-items:center;gap:12px}.preview-character img{width:42px;height:42px;border-radius:50%;background:#edf4fb}.preview-character small{display:block;color:#8b97a8;margin-top:4px}.multiplier-hits{margin:6px 0 12px}.multiplier-summary :deep(.cell){line-height:1.7}.multiplier-summary :deep(.el-table__expanded-cell){padding:12px 18px;background:#f7f9fc}
</style>
