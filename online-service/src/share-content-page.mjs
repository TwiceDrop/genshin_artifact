import { resistances } from './content-snapshot.mjs'

const elements = {Pyro:'火',Hydro:'水',Anemo:'风',Electro:'雷',Dendro:'草',Cryo:'冰',Geo:'岩'}
const resNames = ['火','水','冰','雷','风','岩','草','物理']
const slots = {flower:'生之花',feather:'死之羽',sand:'时之沙',cup:'空之杯',head:'理之冠'}
const minimums = {minRecharge:'充能效率',minCritical:'暴击率',minCriticalDamage:'暴击伤害',minElementalMastery:'元素精通'}
const pct = value => Number((value * 100).toFixed(3))+'%'

export function renderContent(kind, c, role, portrait, escape) {
    if (kind !== 'dsl') return renderPreset(c, role, portrait, escape)
    const lines = c.source.split(/\r\n|\r|\n/)
    const code = lines.map((line, index) => {
        const tokens = line.split(/(\b(?:dmg|result|let|true|false|\d+(?:\.\d+)?)\b)/g)
            .map((part, i) => i % 2 ? '<em>' + escape(part) + '</em>' : escape(part)).join('')
        return `<span class="code-line" data-line="${index + 1}"><span class="line-source">${tokens}</span></span>`
    }).join('')
    return `<main class="dsl-reader">
        <div class="dsl-heading"><div><h1>${escape(c.title)}</h1>
            <div class="dsl-role">${portrait}<span>${escape(role.name)} · ${escape(elements[role.element] || role.element)} · ${lines.length} 行</span></div></div>
            <button type="button" class="download" id="copy-code" data-source="${escape(JSON.stringify(c.source))}">一键复制 DSL 源码</button>
        </div>
        <p role="status" id="copy-status"></p>
        <section class="source-card">
            <div class="code-tools"><strong>MONA-DSL · ${lines.length} 行</strong><div>
                <button type="button" id="wrap-code" aria-controls="dsl-source">自动换行</button>
                <button type="button" id="copy-code-small">复制</button>
            </div></div>
            <div class="source-body"><pre id="dsl-source" tabindex="0" aria-label="MONA-DSL"><code>${code}</code></pre></div>
        </section>
        <p class="dsl-help">复制后，在莫娜占卜铺「配装计算 → 目标函数」中选择「MONA-DSL」粘贴。</p>
    </main>`
}

function resistanceText(enemy) {
    const values = resistances.flatMap((key, index) => enemy[key + '_res'] === undefined
        ? [] : [{ name: resNames[index], value: pct(enemy[key + '_res']) }])
    const token = text => '<span class="res-value">' + text + '</span>'
    const element = item => token(item.name + ' ' + item.value)
    if (values.length === resistances.length) {
        const frequencies = new Map()
        for (const { value } of values) frequencies.set(value, (frequencies.get(value) || 0) + 1)
        const [common, count] = [...frequencies].sort((a, b) => b[1] - a[1])[0]
        if (count >= 6) {
            const exceptions = values.filter(item => item.value !== common)
            return token('全抗 ' + common) + (exceptions.length ? '（' + exceptions.map(element).join('、') + '）' : '')
        }
    }
    return values.map(element).join(' · ')
}

function statText(text) {
    return text.replace(/\s*\+\s*(\d+)(\.\d+)?(%?)$/, (_, integer, fraction = '', unit) =>
        ' +' + integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + fraction + unit)
}

function renderPreset(c, role, portrait, escape) {
    const row = (label, value, quiet = false) =>
        `<dt>${escape(label)}</dt><dd${quiet ? ' class="quiet"' : ''}>${escape(value)}</dd>`
    const card = (label, rows) => `<section class="preset-card"><h2>${label}</h2><dl>${rows}</dl></section>`
    const weapon = row('武器', c.weapon.name) + row('等级 / 精炼', `Lv.${c.weapon.level} · 精炼 ${c.weapon.refine} 阶`)
        + (c.weapon.params || []).map(param => row(param.label, param.value)).join('')
    const settings = [row('目标函数', c.target)]
    if (c.enemy.level !== undefined) settings.push(row('敌人等级', c.enemy.level))
    const resistance = resistanceText(c.enemy)
    if (resistance) settings.push('<dt>抗性</dt><dd>' + resistance + '</dd>')
    settings.push(row('套装限制', c.sets.join(' + ') || '不限', !c.sets.length))
    for (const [key, label] of Object.entries(minimums)) {
        if (c.limits[key] !== undefined) settings.push(row(label + '下限', key === 'minElementalMastery' ? c.limits[key] : pct(c.limits[key])))
    }
    for (const [slot, values] of Object.entries(c.filters)) {
        if (values.length) settings.push(row(slots[slot], values.join(' / ')))
    }
    settings.push(row('已启用 BUFF', c.buffs.join('、') || '无', !c.buffs.length))

    const gear = c.includeEquipment ? c.equipment : []
    const counts = new Map()
    for (const piece of gear) counts.set(piece.set, (counts.get(piece.set) || 0) + 1)
    const summary = [...counts].map(([set, n]) => escape(set) + ' ' + n + ' 件').join(' / ')
    const banner = c.includeEquipment
        ? `<div class="gear-banner gear-included"><strong>✓ 已附带当前穿戴圣遗物（${gear.length} 件）</strong><small>${summary}</small></div>`
        : '<div class="gear-banner gear-omitted"><strong>未附带当前穿戴圣遗物 · 仅配置</strong><small>此预设仅含养成、武器和计算设置，可用自己仓库里的圣遗物配装。</small></div>'
    const cards = gear.map(piece => `<section class="gear-piece">
        <div class="piece-slot"><img src="/share-assets/slot-${piece.position}.png" alt=""><b>${slots[piece.position]}</b><span>+${piece.level}</span></div>
        <div class="piece-stats"><h3>${escape(piece.set)}</h3><strong>${escape(statText(piece.main))}</strong>
        <ul>${piece.subs.map(tag => '<li>' + escape(statText(tag)) + '</li>').join('')}</ul></div>
    </section>`).join('')
    const gearSection = c.includeEquipment ? `<section class="preset-gear"><div class="gear-heading"><h2>当前穿戴圣遗物（${gear.length} 件）</h2>
        <small>仅含当前穿戴，不含仓库与 UID</small></div><div class="gear-cards">${cards}</div></section>` : ''
    return `<main class="preset-page">
        <section class="preset-hero"><div class="preset-role">${portrait}<div><h1>${escape(c.title)}</h1>
        <p>${escape(role.name)} · ${escape(elements[role.element] || role.element)} · Lv.${c.level} · ${c.constellation} 命 · 天赋 ${c.talents.join(' / ')}</p></div></div>${banner}</section>
        <div class="preset-settings">${card('武器配置', weapon)}${card('计算设置', settings.join(''))}</div>${gearSection}
    </main>`
}
