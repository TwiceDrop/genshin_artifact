import { resistances } from './content-snapshot.mjs'

const elements = {Pyro:'火',Hydro:'水',Anemo:'风',Electro:'雷',Dendro:'草',Cryo:'冰',Geo:'岩'}
const resNames = ['火','水','冰','雷','风','岩','草','物理']
const slots = {flower:'生之花',feather:'死之羽',sand:'时之沙',cup:'空之杯',head:'理之冠'}
const minimums = {minRecharge:'充能效率',minCritical:'暴击率',minCriticalDamage:'暴击伤害',minElementalMastery:'元素精通'}
const pct = value => Number((value * 100).toFixed(3))+'%'

export function renderContent(kind, c, role, portrait, escape) {
    const identity = '<div class="shared-role">'+portrait+'<b>'+escape(role.name)+'</b> · '+escape(elements[role.element] || role.element)+'</div>'
    const heading = '<h1>'+escape(c.title)+'</h1>'+identity
    if (kind === 'dsl') {
        const lines = c.source.split(/\r\n|\r|\n/)
        const code = lines.map(line => '<span class="code-line">'+line.split(/(\b(?:dmg|result|let|true|false|\d+(?:\.\d+)?)\b)/g)
            .map((part,i)=>i%2 ? '<em>'+escape(part)+'</em>' : escape(part)).join('')+'</span>').join('\n')
        return '<main class="public-content">'+heading+'<button class="download" id="copy-code" data-source="'+escape(JSON.stringify(c.source))+'">一键复制 DSL 源码</button><section class="source-card"><div class="code-tools"><strong>MONA-DSL · '+lines.length+' 行</strong><button id="wrap-code">自动换行</button></div><pre id="dsl-source"><code>'+code+'</code></pre></section><p role="status" id="copy-status"></p><p>复制源码后，在「配装计算 → 目标函数」中选择「MONA-DSL」并粘贴。</p></main>'
    }
    const row = (label,value) => '<dt>'+escape(label)+'</dt><dd>'+escape(value)+'</dd>'
    const info = (label,rows) => '<section class="setting-card"><h2>'+label+'</h2><dl>'+rows+'</dl></section>'
    let settings = row('目标函数',c.target)
    if (c.enemy.level !== undefined) settings += row('敌人等级',c.enemy.level)
    const res = resistances.flatMap((id,i)=>c.enemy[id+'_res'] === undefined ? [] : [resNames[i]+' '+pct(c.enemy[id+'_res'])])
    if (res.length) settings += row('抗性',res.join(' · '))
    settings += row('套装限制',c.sets.join(' + ') || '不限')
    for (const [key,label] of Object.entries(minimums)) {
        if (c.limits[key] !== undefined) settings += row(label+'下限',key==='minElementalMastery'?c.limits[key]:pct(c.limits[key]))
    }
    for (const [slot,values] of Object.entries(c.filters)) if (values.length) settings += row(slots[slot],values.join(' / '))
    settings += row('已启用 BUFF',c.buffs.join('、') || '无')
    const counts = new Map()
    for (const p of c.equipment || []) counts.set(p.set,(counts.get(p.set)||0)+1)
    const setBonus = [...counts].filter(([,n])=>n>=2).map(([set,n])=>set+' '+(n>=4?4:2)+' 件')
    const banner = c.includeEquipment
        ? `<section class="gear-included"><b>已附带当前穿戴圣遗物（${c.equipment.length} 件）</b>${escape(setBonus.join(' / '))}</section>`
        : '<section class="gear-omitted"><b>未附带当前穿戴圣遗物 · 仅配置</b><p>这份预设仅含养成、武器和计算设置。你可以用自己仓库里的圣遗物配装。</p></section>'
    const cards = (c.equipment || []).map(p => `
        <section class="setting-card">
            <small>${slots[p.position]}　+${p.level}</small><h3>${escape(p.set)}</h3><b>${escape(p.main)}</b>
            <ul>${p.subs.map(tag => '<li>'+escape(tag)+'</li>').join('')}</ul>
        </section>`).join('')
    const weapon = row('武器',c.weapon.name) + row('等级',c.weapon.level) + row('精炼',c.weapon.refine+' 阶')
    return `<main class="public-content">
        ${heading}<p>Lv. ${c.level} · ${c.constellation} 命 · 天赋 ${c.talents.join(' / ')}</p>
        ${banner}<div class="preset-settings">${info('武器配置',weapon)}${info('计算设置',settings)}</div>
        ${c.includeEquipment ? '<div class="gear-cards">'+cards+'</div>' : ''}
    </main>`
}
