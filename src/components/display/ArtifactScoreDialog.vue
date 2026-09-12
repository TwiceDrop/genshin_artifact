<template>
    <el-dialog :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)"
        title="圣遗物详情 · 喵喵评分" width="min(1020px, 95vw)" top="6vh" destroy-on-close>
        <div v-if="item" class="score-dialog">
            <div class="score-layout">
                <section class="piece-details">
                    <div class="piece-heading">
                        <img :src="piece?.url" alt="圣遗物" />
                        <div><h2>{{ locale[piece?.text] || item.setName }}</h2><p>{{ locale[set?.nameLocale] }} · {{ positionLabel }} · {{ item.star }}星 · +{{ item.level }}</p></div>
                    </div>
                    <div class="score-overview">
                        <div><span>普通评分</span><strong>{{ ranking.score.toFixed(1) }} <small>{{ getMarkClass(ranking.score) }}</small></strong></div>
                        <div v-if="details"><span>{{ inspection.label || inspection.name }}</span><strong>{{ details.score.toFixed(1) }} <small>{{ details.grade }}</small></strong></div>
                    </div>
                    <el-button v-if="context" size="small" @click="rankName = ''">查看当前角色：{{ context.label || context.name }}</el-button>
                    <p class="rule-name">{{ details?.title || '请选择右侧角色查看词条得分' }}</p>
                    <table class="stat-table">
                        <thead><tr><th>详细词条</th><th>得分贡献</th></tr></thead>
                        <tbody>
                            <tr class="main-stat"><td><small>主词条</small>{{ displayedTag(item.mainTag.name, item.mainTag.value) }}</td><td>{{ details ? details.main.toFixed(1) : '—' }}</td></tr>
                            <tr v-for="(tag, index) in item.normalTags" :key="index" :class="{ effective: details?.subs[index]?.score > 0 }">
                                <td>{{ displayedTag(tag.name, tag.value) }}</td><td>{{ details ? details.subs[index].score.toFixed(1) : '—' }}</td>
                            </tr>
                        </tbody>
                    </table>
                    <p class="score-note">主词条和副词条均按角色规则评分；花、羽主词条不计分。逐条得分四舍五入后可能与总分相差 0.1。</p>
                    <p v-if="item.star !== 5 || item.level < 20" class="score-note">当前为 {{ item.star }}星 +{{ item.level }}，按现有词条评分，不预测强化结果；评级采用五星标准。</p>
                    <div v-if="build" class="build-summary">
                        <span>{{ context.label || context.name }} · 圣遗物总分</span>
                        <strong>{{ build.total === null ? '—' : build.total.toFixed(1) }} <small>{{ build.grade }}</small></strong>
                        <p>已装备 {{ build.count }}/5 件{{ build.complete ? ' · 毕业度按五件平均分判定' : ' · 装齐五件后判定毕业度' }}</p>
                    </div>
                </section>
                <section class="rankings">
                    <div class="ranking-heading"><h3>角色评分排名</h3><span>{{ ranking.characters.length }} 名</span></div>
                    <el-input v-model="search" placeholder="搜索角色" clearable label="搜索评分角色" />
                    <p class="score-note">按各角色默认流派比较，点击角色查看词条得分。当前角色评分使用计算器配置。</p>
                    <div class="ranking-list">
                        <button v-for="entry in visibleRanking" :key="entry.name" class="ranking-row" type="button"
                            :class="{ selected: (rankName || (!context && ranking.characters[0]?.name)) === entry.name }"
                            :aria-label="`查看${entry.name}评分`" @click="rankName = entry.name">
                            <span class="rank-number">{{ entry.rank }}</span>
                            <img v-if="portraits[entry.name]" :src="portraits[entry.name]" alt="" loading="lazy" />
                            <span class="rank-name">{{ entry.name }}</span><strong>{{ entry.score.toFixed(1) }}</strong><span class="rank-grade">{{ getMarkClass(entry.score) }}</span>
                        </button>
                        <p v-if="!visibleRanking.length" class="score-note">没有匹配的角色</p>
                    </div>
                </section>
            </div>
            <details class="score-rules"><summary>评分来源与毕业度标准</summary>
                <p>使用 BetterGI ArtifactScore 1.8.0 的喵喵评分规则。普通评分取角色排名前 50% 的平均值。评分用于比较圣遗物词条质量；天赋、角色等级与武器养成不计入毕业度，也不代表队伍伤害排名。</p>
                <p>五件平均分：S ≥28、SS ≥35、SSS ≥42、ACE ≥49、MAX ≥56；低于 28 为 D／C／B／A。对应总分门槛：140／175／210／245／280。</p>
                <a href="https://github.com/babalae/bettergi-scripts-list/tree/22d10e633fc9e03385b7766a66772d9a1aad2936/repo/js/ArtifactScore" target="_blank" rel="noopener noreferrer">查看 BetterGI 评分来源</a>
            </details>
        </div>
        <template #footer><el-button v-if="context && item" @click="emit('replace')">更换此部位圣遗物</el-button><el-button @click="emit('update:modelValue', false)">关闭</el-button></template>
    </el-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { displayedTag } from '@/utils/artifacts'
import sets from '@/assets/_gen_artifact'
import characters from '@/assets/_gen_character'
import locale from '@/i18n/generated/zh-cn.json'
import { scoreRanking, scoreDetails, scoreBuild, rankingContext, getMarkClass } from '@/algorithms/artifact-score/score.mjs'

const props = defineProps({ modelValue: Boolean, item: Object, context: Object, equipped: { type: Array, default: () => [] } })
const emit = defineEmits(['update:modelValue', 'replace'])
const rankName = ref(''), search = ref('')
watch(() => [props.modelValue, props.item?.id], () => { rankName.value = ''; search.value = '' })
const set = computed(() => sets[props.item?.setName])
const piece = computed(() => set.value?.[props.item?.position])
const positionLabel = computed(() => ({ flower: '生之花', feather: '死之羽', sand: '时之沙', cup: '空之杯', head: '理之冠' }[props.item?.position]))
const ranking = computed(() => scoreRanking(props.item))
const visibleRanking = computed(() => ranking.value.characters.map((e, i) => ({ ...e, rank: i + 1 })).filter(e => e.name.includes(search.value.trim())))
const inspection = computed(() => rankName.value ? rankingContext(rankName.value) : props.context || rankingContext(ranking.value.characters[0]?.name || ''))
const details = computed(() => scoreDetails(props.item, inspection.value, !rankName.value && props.context ? props.equipped : []))
const build = computed(() => props.context ? scoreBuild(props.equipped, props.context) : null)
const portraits = Object.fromEntries(Object.values(characters).map(c => [locale[c.nameLocale], c.splash || c.avatar]))
</script>

<style scoped>
.score-dialog{color:var(--el-text-color-primary);max-height:calc(88vh - 160px);overflow:auto;padding-right:8px}.score-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:32px}
.piece-heading{display:flex;align-items:center;gap:16px}.piece-heading img{width:76px;height:76px;object-fit:contain;background:#d5a34f;border-radius:12px}.piece-heading h2{font-size:19px;margin:0 0 8px}.piece-heading p{font-size:12px;color:var(--el-text-color-secondary);margin:0;line-height:1.6}
.score-overview{display:flex;gap:32px;background:var(--el-color-primary-light-9);padding:16px;margin:20px 0 12px;border-radius:8px}.score-overview span,.build-summary>span{display:block;font-size:13px}.score-overview strong,.build-summary strong{display:block;font-size:29px;margin-top:6px;color:var(--el-color-primary)}.score-overview small,.build-summary small{font-size:17px;margin-left:5px}
.rule-name{font-size:13px;color:var(--el-text-color-secondary);margin:12px 0}.stat-table{width:100%;border-collapse:collapse;font-size:14px}.stat-table th,.stat-table td{padding:11px 8px;text-align:left;border-bottom:1px solid var(--el-border-color-lighter)}.stat-table th:last-child,.stat-table td:last-child{text-align:right}.stat-table th{font-weight:400;color:var(--el-text-color-secondary)}.main-stat{font-weight:600}.main-stat small{display:block;font-size:11px;font-weight:400;margin-bottom:4px;color:var(--el-text-color-secondary)}.effective td:last-child{color:var(--el-color-success)}
.score-note{font-size:12px;color:var(--el-text-color-secondary);line-height:1.7}.build-summary{border-top:1px solid var(--el-border-color-lighter);margin-top:18px;padding-top:14px}.build-summary p{font-size:12px;color:var(--el-text-color-secondary)}
.ranking-heading{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}.ranking-heading h3{margin:0;font-size:16px}.ranking-heading span{font-size:12px;color:var(--el-text-color-secondary)}.ranking-list{max-height:440px;overflow:auto}.ranking-row{width:100%;display:flex;align-items:center;gap:10px;padding:8px 10px;border:0;border-bottom:1px solid var(--el-border-color-lighter);background:transparent;color:inherit;cursor:pointer;text-align:left;font:inherit}.ranking-row:hover,.ranking-row.selected{background:var(--el-color-primary-light-9)}.ranking-row:focus-visible{outline:2px solid var(--el-color-primary);outline-offset:-2px}.rank-number{width:24px;font-size:12px;color:var(--el-text-color-secondary)}.ranking-row img{width:38px;height:40px;object-fit:contain}.rank-name{flex:1;font-size:14px}.rank-grade{font-size:12px;min-width:30px;color:var(--el-color-primary)}.score-rules{font-size:12px;line-height:1.8;margin-top:24px;color:var(--el-text-color-secondary)}.score-rules summary{cursor:pointer}.score-rules a{color:var(--el-color-primary)}
@media(max-width:700px){.score-layout{grid-template-columns:1fr;gap:20px}.ranking-list{max-height:300px}.score-overview{gap:24px}}
@media(max-height:800px){.piece-heading img{width:60px;height:60px}.score-overview{padding:12px;margin:14px 0 10px}.score-overview strong{font-size:26px}.stat-table th,.stat-table td{padding:8px}.rule-name{margin:8px 0}.ranking-list{max-height:calc(88vh - 280px)}}
</style>
