// Usage stats page. The token lives only in this tab's sessionStorage; data reaches the page through textContent only,
// and sizes are set through the CSSOM, which the page's content security policy allows (no inline style attributes).
const TOKEN_KEY = 'mona-usage-stats-token'
const SVG = 'http://www.w3.org/2000/svg'
const ROWS = 10, CANDIDATES = 5
const PLATFORM = { windows: 'Windows', android: 'Android' }
const CATEGORY = { page: '入口访问', action: '关键动作' }
const $ = id => document.getElementById(id)
const int = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 })
const pct = new Intl.NumberFormat('zh-CN', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 })

const view = { data: null, characterFeature: null, characterAll: false, featureCategory: 'all', featureAll: false }

function readToken() { try { return sessionStorage.getItem(TOKEN_KEY) || '' } catch { return '' } }
function writeToken(value) { try { value ? sessionStorage.setItem(TOKEN_KEY, value) : sessionStorage.removeItem(TOKEN_KEY) } catch {} }
const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node }

function showLogin(message = '') {
    $('report').hidden = true
    $('logout').hidden = true
    $('stamp').textContent = ''
    $('login').hidden = false
    $('login-error').textContent = message
    $('token').focus()
}

function fillSelect(select, values, selected, label = v => v) {
    select.replaceChildren(select.options[0], ...values.map(v => new Option(label(v), v, false, v === selected)))
}

function segmented(container, options, selected, onPick) {
    container.replaceChildren(...options.map(([value, label]) => {
        const button = el('button', '', label)
        button.type = 'button'
        button.setAttribute('aria-pressed', String(value === selected))
        button.addEventListener('click', () => onPick(value))
        return button
    }))
}

function avatar(character) {
    const url = (window.MONA_AVATARS || {})[character.name]
    const monogram = () => { const span = el('span', 'avatar', character.zh.slice(0, 1)); span.setAttribute('aria-hidden', 'true'); return span }
    if (!url) return monogram()
    const img = el('img', 'avatar')
    img.alt = ''
    img.loading = 'lazy'
    img.referrerPolicy = 'no-referrer'
    img.src = url
    img.addEventListener('error', () => img.replaceWith(monogram()), { once: true })
    return img
}

function numberCell(value, className = '') {
    const td = el('td', `num ${className}`.trim(), int.format(value))
    if (value === 0) td.classList.add('zero')
    return td
}

function rowBar(share, quiet) {
    const bar = el('div', quiet ? 'rowbar quiet' : 'rowbar'), fill = el('span')
    fill.style.width = `${Math.round(share * 1000) / 10}%`
    bar.append(fill)
    return bar
}

function moreButton(button, shown, total, expanded, noun, onToggle) {
    button.hidden = total <= ROWS
    button.textContent = expanded ? '收起' : `显示全部 ${int.format(total)} ${noun}`
    button.setAttribute('aria-expanded', String(expanded))
    button.onclick = onToggle
}

// The line under the title: the screen's one finding, built from the same rows as the cards.
function renderFinding(data, candidates) {
    const p = $('finding')
    if (!data.activeInstalls30) { p.textContent = '近 30 天还没有上报数据。'; return }
    const [single] = data.characterFeatures
    const top = single && [...data.characters].sort((a, b) => b.counts[single.id].last30 - a.counts[single.id].last30)[0]
    const strong = text => el('strong', '', text)
    const parts = ['近 30 天有', strong(`${int.format(data.activeInstalls30)} 个活跃安装`), '。']
    if (top && top.counts[single.id].last30) parts.push('单人配装算得最多的是', strong(top.zh), `（${int.format(top.counts[single.id].last30)} 人）`)
    if (candidates[0]) parts.push('；还没进过四人轴的角色里最多的是', Object.assign(strong(candidates[0].zh), { className: 'gold' }), `（${int.format(candidates[0].counts[single.id].last30)} 人）`)
    parts.push('。')
    p.replaceChildren(...parts.map(x => typeof x === 'string' ? document.createTextNode(x) : x))
}

function candidateRows(data) {
    const [single, team] = data.characterFeatures
    if (!single || !team) return []
    return data.characters
        .filter(c => c.counts[team.id].total === 0 && c.counts[single.id].total > 0)
        .sort((a, b) => b.counts[single.id].last30 - a.counts[single.id].last30 || b.counts[single.id].total - a.counts[single.id].total)
}

function renderCandidates(data, rows) {
    const list = $('candidates'), single = data.characterFeatures[0]
    if (!rows.length) {
        list.replaceChildren(el('li', 'empty', data.characters.length ? '算过的角色都已经在四人轴计算里出现过。' : '还没有角色记录。'))
        return
    }
    const max = Math.max(1, ...rows.map(c => c.counts[single.id].last30))
    list.replaceChildren(...rows.slice(0, CANDIDATES).map((c, i) => {
        const li = el('li'), value = c.counts[single.id].last30
        const bar = el('div', 'bar'), fill = el('span')
        fill.style.width = `${Math.round(value / max * 1000) / 10}%`
        bar.append(fill)
        const name = el('span', 'name'); name.title = c.name
        name.append(el('span', 'rank num', String(i + 1)), document.createTextNode(c.zh))
        const count = el('span', 'value num', int.format(value)); count.append(el('small', '', '人'))
        li.append(avatar(c), name, count, bar)
        return li
    }))
}

function renderCharacters(data) {
    const features = data.characterFeatures
    if (!features.some(f => f.id === view.characterFeature)) view.characterFeature = features[0]?.id
    const feature = features.find(f => f.id === view.characterFeature), other = features.find(f => f.id !== view.characterFeature)
    const team = features[1]
    segmented($('character-sort'), features.map(f => [f.id, `按${f.name}`]), view.characterFeature, id => { view.characterFeature = id; view.characterAll = false; renderCharacters(view.data) })
    $('other-head').textContent = other ? `${other.name} 30 天` : ''
    $('other-head').classList.add('hide-phone')
    const rows = [...data.characters].sort((a, b) => b.counts[feature.id].last30 - a.counts[feature.id].last30
        || b.counts[feature.id].total - a.counts[feature.id].total || a.name.localeCompare(b.name, 'en'))
    const max = Math.max(1, ...rows.map(c => c.counts[feature.id].last30))
    const shown = view.characterAll ? rows : rows.slice(0, ROWS)
    if (!rows.length) {
        const td = el('td', 'empty-cell', '还没有角色记录。'); td.colSpan = 5
        const tr = el('tr'); tr.append(td); $('characters').replaceChildren(tr)
    } else $('characters').replaceChildren(...shown.map(c => {
        const counts = c.counts[feature.id], tr = el('tr'), name = el('td', 'ident'), line = el('div', 'ident-line')
        const label = el('span', '', c.zh); label.title = c.name
        line.append(label)
        if (team && c.counts[team.id].total === 0) line.append(el('span', 'pill', '未进四人轴'))
        const text = el('div', 'ident-text'), row = el('div', 'ident-row')
        text.append(line, el('div', 'sub', `近 7 天 ${int.format(counts.last7)} · 累计 ${int.format(counts.total)}`), rowBar(counts.last30 / max, false))
        row.append(avatar(c), text)
        name.append(row)
        tr.append(name, numberCell(counts.last30, 'lead'), numberCell(counts.last7, 'hide-phone'), numberCell(counts.total, 'hide-phone'),
            numberCell(other ? c.counts[other.id].last30 : 0, 'hide-phone'))
        return tr
    }))
    for (const th of $('characters').closest('table').querySelectorAll('thead th')) th.classList.toggle('hide-phone', th.cellIndex >= 2)
    moreButton($('characters-more'), shown.length, rows.length, view.characterAll, '个角色', () => { view.characterAll = !view.characterAll; renderCharacters(view.data) })
}

function renderFeatures(data) {
    segmented($('feature-filter'), [['all', '全部'], ['page', CATEGORY.page], ['action', CATEGORY.action]], view.featureCategory,
        category => { view.featureCategory = category; view.featureAll = false; renderFeatures(view.data) })
    const rows = data.features.filter(f => view.featureCategory === 'all' || f.category === view.featureCategory)
        .sort((a, b) => b.last30 - a.last30 || b.total - a.total)
    const max = Math.max(1, ...rows.map(f => f.last30))
    const shown = view.featureAll ? rows : rows.slice(0, ROWS)
    $('features').replaceChildren(...shown.map(f => {
        const tr = el('tr'), name = el('td', 'ident')
        const label = el('span', '', f.name); label.title = f.id
        const line = el('div', 'ident-line'); line.append(label)
        name.append(line, el('div', 'sub', `${CATEGORY[f.category]} · 累计 ${int.format(f.total)}`), rowBar(f.last30 / max, true))
        const share = el('td', 'num hide-phone', f.share30 === null ? '—' : pct.format(f.share30))
        if (!f.share30) share.classList.add('zero')
        tr.append(name, numberCell(f.last30, 'lead'), share, numberCell(f.total, 'hide-phone'))
        return tr
    }))
    for (const th of $('features').closest('table').querySelectorAll('thead th')) th.classList.toggle('hide-phone', th.cellIndex >= 2)
    moreButton($('features-more'), shown.length, rows.length, view.featureAll, '项', () => { view.featureAll = !view.featureAll; renderFeatures(view.data) })
}

// Daily active installs: one series, 4 round gridlines above the maximum, ticks on the right, x labels every 15 (or 30) days ending today.
function niceTicks(max) {
    if (max <= 0) return [0, 1, 2, 3, 4]
    const raw = max / 4, mag = 10 ** Math.floor(Math.log10(raw))
    const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw && Number.isInteger(s)) || Math.ceil(raw)
    let top = Math.ceil(max / step) * step
    if (top <= max) top += step
    return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step)
}

function drawChart(daily) {
    const box = $('chart'), width = box.clientWidth, height = Math.max(220, box.clientHeight)
    const right = 36, top = 8, bottom = 26
    // Labels every 15 days, or every 30 when the plot is too narrow for six of them.
    const labelStep = width < 560 ? 30 : 15
    const values = daily.map(d => d.installs), ticks = niceTicks(Math.max(...values)), maxTick = ticks.at(-1)
    const x = i => (i * (width - right)) / Math.max(1, daily.length - 1)
    const y = v => top + (height - top - bottom) * (1 - v / maxTick)
    const svg = document.createElementNS(SVG, 'svg')
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
    svg.setAttribute('role', 'img')
    const peak = Math.max(...values), peakDay = daily[values.indexOf(peak)]
    svg.setAttribute('aria-label', `近 90 天每日活跃安装，最高 ${peak} 个（${peakDay?.day ?? ''}），今天 ${values.at(-1) ?? 0} 个`)
    const add = (name, attrs, text) => {
        const node = document.createElementNS(SVG, name)
        for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v)
        if (text !== undefined) node.textContent = text
        svg.append(node)
        return node
    }
    for (const t of ticks) {
        add('line', { x1: 0, x2: width - right, y1: y(t), y2: y(t), class: t === 0 ? 'baseline' : 'gridline' })
        add('text', { x: width - right + 8, y: y(t) + 4, class: 'tick num' }, int.format(t))
    }
    daily.forEach((d, i) => {
        if ((daily.length - 1 - i) % labelStep) return
        const first = i === 0, last = i === daily.length - 1
        add('text', { x: x(i), y: height - 6, class: 'tick num', 'text-anchor': last ? 'end' : first ? 'start' : 'middle' }, d.day.slice(5).replace('-', '/'))
    })
    const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
    add('polygon', { points: `0,${y(0)} ${points} ${x(values.length - 1)},${y(0)}`, class: 'area' })
    add('polyline', { points, class: 'series' })
    const cursor = add('line', { y1: top, y2: height - bottom, class: 'cursor', visibility: 'hidden' })
    const dot = add('circle', { r: 4, class: 'dot', visibility: 'hidden' })
    const tip = el('div', 'tooltip num'); tip.hidden = true
    svg.addEventListener('pointermove', event => {
        const rect = svg.getBoundingClientRect(), i = Math.max(0, Math.min(daily.length - 1, Math.round((event.clientX - rect.left) / (width - right) * (daily.length - 1))))
        cursor.setAttribute('x1', x(i)); cursor.setAttribute('x2', x(i)); cursor.setAttribute('visibility', 'visible')
        dot.setAttribute('cx', x(i)); dot.setAttribute('cy', y(values[i])); dot.setAttribute('visibility', 'visible')
        tip.textContent = `${daily[i].day} · ${int.format(values[i])} 个安装`
        tip.style.left = `${x(i)}px`; tip.hidden = false
    })
    svg.addEventListener('pointerleave', () => { cursor.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); tip.hidden = true })
    box.replaceChildren(svg, tip)
}

function render(data) {
    view.data = data
    $('stamp').textContent = `数据截至 ${data.today}（UTC）`
    fillSelect($('platform'), data.platforms, data.filters.platform, v => PLATFORM[v] || v)
    fillSelect($('version'), data.versions, data.filters.version)
    $('kpi-30').textContent = int.format(data.activeInstalls30)
    $('kpi-7').textContent = int.format(data.activeInstalls7)
    $('kpi-total').textContent = int.format(data.totalInstalls)
    const candidates = candidateRows(data)
    renderFinding(data, candidates)
    renderCandidates(data, candidates)
    renderCharacters(data)
    renderFeatures(data)
    $('login').hidden = true
    $('logout').hidden = false
    $('report').hidden = false
    drawChart(data.daily)
}

async function load() {
    const token = readToken()
    if (!token) return showLogin()
    const query = new URLSearchParams()
    if ($('platform').value) query.set('platform', $('platform').value)
    if ($('version').value) query.set('version', $('version').value)
    $('report-error').hidden = true
    let response
    try { response = await fetch(`/v1/usage-stats/summary?${query}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }) }
    catch (error) { return showError(`统计读取失败：${error.message}`) }
    const body = await response.json().catch(() => ({}))
    if (response.status === 401) { writeToken(''); return showLogin(body.error?.message || '口令不正确') }
    if (!response.ok) return showError(`统计读取失败（HTTP ${response.status}）：${body.error?.message || ''}`)
    render(body)
}

// A failed refresh keeps the figures already on screen and says so beside them.
function showError(message) {
    if ($('report').hidden) return showLogin(message)
    $('report-error-text').textContent = view.data ? `${message}。下面仍是 ${view.data.today} 的数据。` : message
    $('report-error').hidden = false
}

$('login').addEventListener('submit', event => {
    event.preventDefault()
    writeToken($('token').value.trim())
    $('token').value = ''
    load()
})
$('logout').addEventListener('click', () => { writeToken(''); showLogin() })
$('platform').addEventListener('change', load)
$('version').addEventListener('change', load)
$('refresh').addEventListener('click', load)
$('retry').addEventListener('click', load)
let resizeTimer
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => view.data && drawChart(view.data.daily), 120) })
load()
