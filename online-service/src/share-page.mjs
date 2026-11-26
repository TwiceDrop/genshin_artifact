import { readFile } from 'node:fs/promises'
import metadata from '../static/share-catalog.json' with { type: 'json' }
import roles from '../static/share-roles.json' with { type: 'json' }
import { renderContent } from './share-content-page.mjs'
import { axisSummary } from '../../beta-data/shared-axis.mjs'

const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]))
const seconds = ms => (ms / 1000) + 's'
const eventLabels = { switch:'切至', cast:'施放', hit:'命中', heal:'治疗', reaction:'反应', hp_change:'生命变化', state:'状态', sprint:'冲刺', aim:'瞄准', pickup:'拾取' }
const castLabels = { skill:'元素战技', burst:'元素爆发' }
const detailLabels = {team:'全队',active:'当前前台',increase:'增加',decrease:'减少',damage:'受伤',frozen:'冻结',shield:'护盾',nightsoul:'夜魂',cryo_aura:'冰附着'}
function portrait(member) {
    const role = roles[member.character]
    const image = role.portrait ? `<img alt="" src="/share-assets/${encodeURIComponent(member.character)}.webp">` : ''
    return `<span class="portrait ${escape(role.element)}"><span>${escape(role.name.slice(0,1))}</span>${image}</span>`
}
function page(title, main, type = '四人轴分享') {
    return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>${escape(title)} · 莫娜占卜铺</title><link rel="stylesheet" href="/share-assets/share.css"><script src="/share-assets/share.js" defer></script></head><body><header><img src="/share-assets/mona.png" alt=""><b>莫娜占卜铺</b><span>${escape(type)}</span></header>${main}</body></html>`
}
function describeEvent(row, member, members, legacy) {
    const action = metadata[member.character].actions.find(item => item.id === row.action)
    const detail = []
    if (row.when) {
        const subject = members.get(row.when.slot ?? row.actor)
        detail.push(metadata[subject.character].name + ' ≥ ' + row.when.constellationAtLeast + ' 命')
        if (row.when.otherwiseTimeMs !== undefined) detail.push('其他命座 ' + seconds(row.when.otherwiseTimeMs))
    }
    if (row.repeat) detail.push('重复 ' + row.repeat.count + ' 次，间隔 ' + seconds(row.repeat.intervalMs))
    for (const param of action?.parameters || []) {
        const value = row.params?.[param.key]
        if (value !== undefined) detail.push(param.label + ' ' + value / (param.scale || 1))
        else if (param.placeholder) detail.push(param.label + ' ' + param.placeholder)
    }
    if (legacy) {
        for (const field of ['recipients','reaction','state','change','healing']) {
            if (row[field]) detail.push(detailLabels[row[field]] || row[field])
        }
        if (row.durationMs !== undefined) detail.push('持续 ' + seconds(row.durationMs))
        if (row.ratio !== undefined) detail.push(row.ratio * 100 + '%')
        if (row.weakpoint) detail.push('弱点命中')
    }
    const title = legacy ? [eventLabels[row.kind], row.label || castLabels[row.action] || row.action].filter(Boolean).join(' · ') : action?.label
    return { title: row.kind === 'switch' ? '切至 ' + metadata[member.character].name : title, detail: detail.join(' · ') }
}
function timelineOverview(members, rows, end) {
    if (!rows.length || rows.some(row => row.when) || !(end > 0)) return ''
    return Array.from(members.values(), member => {
        const dots = rows.filter(row => member.slot === row.actor).map(row =>
            `<circle cx="${Math.min(row.timeMs/end,1)*980+10}" cy="12" r="5"><title>${escape(seconds(row.timeMs)+' '+row.display.title)}</title></circle>`).join('')
        return `<div class="track ${metadata[member.character].element}" data-slot="${escape(member.slot)}"><b>${escape(metadata[member.character].name)}</b><svg viewBox="0 0 1000 24" preserveAspectRatio="none" role="img" aria-label="${escape(metadata[member.character].name)}"><path d="M0 12H1000"></path>${dots}</svg></div>`
    }).join('') + `<small>记录时刻范围　0s — ${seconds(end)}</small>`
}
export function renderShare(published, id) {
    if (published.kind === 'dsl' || published.kind === 'preset') {
        const { kind, content } = published
        const role = roles[content.character]
        return page(content.title, renderContent(kind, content, role, portrait(content), escape), kind === 'dsl' ? 'MONA-DSL' : '角色预设')
    }
    const { axis, publishedAt } = published
    const legacy = axis.format === 'mona-team-axis'
    const members = new Map(axis.members.map(m => [m.slot, m]))
    const rows = [...axis.timeline].sort((a,b) => a.timeMs-b.timeMs).map(row => ({
        ...row, display: describeEvent(row, members.get(row.actor), members, legacy),
    }))
    let possibleActive = new Set([axis.initialActiveSlot]), group, step = 0
    // Alternative timestamps can reorder the rows. The snapshot cannot establish
    // an implicit switch in that case; explicit switch records still stand.
    const inferSwitch = !legacy && !rows.some(row => row.when?.otherwiseTimeMs !== undefined)
    const segments = []
    for (const row of rows) {
        const member = members.get(row.actor), role = metadata[member.character]
        const explicit = row.kind === 'switch'
        const changesFront = explicit || !legacy
        const implicit = inferSwitch && !possibleActive.has(row.actor)
        if (changesFront) {
            if (row.when) possibleActive.add(row.actor)
            else possibleActive = new Set([row.actor])
        }
        if (explicit || implicit) {
            const condition = row.display.detail ? ' · ' + escape(row.display.detail) : ''
            segments.push({ html: `<div class="switch" data-slot="${escape(row.actor)}">↓　切至 <b>${escape(role.name)}</b>　${seconds(row.timeMs)}${condition}</div>` })
            group = undefined
            if (explicit) continue
        }
        if (!group || group.member.slot !== row.actor) {
            group = { member, entries: [] }
            segments.push(group)
        }
        step++
        group.entries.push(`<li><span class="num">${String(step).padStart(2,'0')}</span><div><strong>${escape(row.display.title)}</strong>${row.display.detail ? '<small>'+escape(row.display.detail)+'</small>' : ''}</div><time>${seconds(row.timeMs)}</time></li>`)
    }
    const cards = segments.map(segment => {
        if (segment.html) return segment.html
        const {member,entries} = segment, role = metadata[member.character]
        return `<article class="${role.element}" data-slot="${escape(member.slot)}"><h3>${portrait(member)}${escape(role.name)} <small>${legacy?'事件':'连段'} ${entries.length} ${legacy?'条':'步'}</small></h3><ol>${entries.join('')}</ol></article>`
    }).join('')
    const roster = axis.members.map(m => `<button class="member ${metadata[m.character].element}" data-member="${escape(m.slot)}" aria-pressed="false">${portrait(m)}<b>${escape(metadata[m.character].name)}</b><small>${m.slot===axis.initialActiveSlot?'初始前台':rows.filter(row=>row.actor===m.slot&&(legacy||row.kind!=='switch')).length+(legacy?' 个事件':' 步')}</small></button>`).join('')
    const end = axis.durationMs ?? rows.reduce((max,row)=>Math.max(max,row.timeMs),0)
    const overview = timelineOverview(members, rows, end)
    const download = `<a class="download" href="/s/${id}/download" download>↓ 下载轴文件</a>`
    const importHelp = '下载后，打开莫娜占卜铺，在「多人优化」中点「导入计算配置」，选择轴文件。'
    return page(axis.title, `<main><aside><h1>${escape(axis.title)}</h1><p>4 名角色 · <strong>${axisSummary(axis)}</strong></p><div class="roster">${roster}</div><div class="download-box">${download}<small>${importHelp}</small></div><small>上次发布 <time datetime="${new Date(publishedAt).toISOString()}">${new Date(publishedAt).toISOString().slice(0,10)}</time></small></aside><section><nav><h2>${legacy?'事件顺序':'操作顺序'}</h2><button id="clear" hidden>显示全部</button>${overview?'<div class="modes"><button id="sequence-tab" aria-pressed="true">分段视图</button><button id="overview-tab" aria-pressed="false">时间轴总览</button></div>':''}</nav><div id="sequence">${cards}</div><div id="overview" hidden>${overview}</div></section></main><footer>${download}<small>${importHelp}</small></footer>`)
}
export function renderShareError(code) {
    const content = {
        SHARE_EXPIRED: ['该分享链接已过期','如需查看，请联系作者重新分享。'],
        SHARE_REVOKED: ['该分享已取消','如需查看，请联系作者获取新链接。'],
        SHARE_NOT_FOUND: ['分享链接不存在','请核对链接地址。'],
    }[code]
    const [title,detail] = content || ['暂时无法读取分享','请稍后重试。']
    return page(title, `<section class="failure"><h1>${title}</h1><p>${detail}</p>${content?'':'<button id="retry">重试</button>'}</section>`, '分享链接')
}
export const shareHeaders = { 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'no-referrer',
    'Content-Security-Policy':"default-src 'none'; img-src 'self'; style-src 'self'; script-src 'self'; font-src 'self'; base-uri 'none'; frame-ancestors 'none'" }
export async function shareAsset(name) {
    const fixed = { 'mona.png':'image/png', 'share.css':'text/css', 'share.js':'text/javascript', 'brand.woff2':'font/woff2' }
    if (['slot-flower.png','slot-feather.png','slot-sand.png','slot-cup.png','slot-head.png'].includes(name)) {
        return { type:'image/png', body:await readFile(new URL('../static/'+name,import.meta.url)) }
    }
    if (Object.hasOwn(fixed,name)) return { type:fixed[name], body:await readFile(new URL('../static/'+name,import.meta.url)) }
    if (!name.endsWith('.webp') || !roles[name.slice(0,-5)]?.portrait) return null
    return { type:'image/webp', body:await readFile(new URL('../static/share-portraits/'+name,import.meta.url)) }
}
