// Usage stats page. The token lives only in this tab's sessionStorage; data is inserted with textContent only.
const TOKEN_KEY = 'mona-usage-stats-token'
const $ = id => document.getElementById(id)
const CATEGORY = { page: '入口访问', action: '关键动作' }
const SVG = 'http://www.w3.org/2000/svg'

function readToken() { try { return sessionStorage.getItem(TOKEN_KEY) || '' } catch { return '' } }
function writeToken(value) { try { value ? sessionStorage.setItem(TOKEN_KEY, value) : sessionStorage.removeItem(TOKEN_KEY) } catch {} }

function showLogin(message = '') {
    $('report').hidden = true
    $('login').hidden = false
    $('login-error').textContent = message
    $('token').focus()
}

function fillSelect(select, values, selected, label = v => v) {
    const keep = select.options[0]
    select.replaceChildren(keep, ...values.map(v => new Option(label(v), v, false, v === selected)))
}

function drawChart(daily) {
    const width = 960, height = 220, left = 36, right = 12, top = 12, bottom = 28
    const max = Math.max(1, ...daily.map(d => d.installs))
    const x = i => left + (i * (width - left - right)) / Math.max(1, daily.length - 1)
    const y = v => top + (height - top - bottom) * (1 - v / max)
    const svg = document.createElementNS(SVG, 'svg')
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
    svg.setAttribute('role', 'img')
    const add = (name, attributes, text) => {
        const node = document.createElementNS(SVG, name)
        for (const [k, v] of Object.entries(attributes)) node.setAttribute(k, v)
        if (text !== undefined) node.textContent = text
        svg.append(node)
    }
    for (const v of [0, Math.ceil(max / 2), max]) {
        add('line', { x1: left, x2: width - right, y1: y(v), y2: y(v), class: 'axis' })
        add('text', { x: left - 6, y: y(v) + 4, 'text-anchor': 'end', class: 'label' }, String(v))
    }
    daily.forEach((d, i) => { if (i % 15 === 0 || i === daily.length - 1) add('text', { x: x(i), y: height - 8, 'text-anchor': 'middle', class: 'label' }, d.day.slice(5)) })
    add('polyline', { points: daily.map((d, i) => `${x(i)},${y(d.installs)}`).join(' '), class: 'series' })
    const title = document.createElementNS(SVG, 'title')
    title.textContent = daily.map(d => `${d.day} ${d.installs}`).join('\n')
    svg.prepend(title)
    $('chart').replaceChildren(svg)
}

function cell(value, zero = value === 0) {
    const td = document.createElement('td')
    td.textContent = value
    if (zero) td.className = 'zero'
    return td
}

function render(data) {
    $('today').textContent = `统计截至 ${data.today}（UTC）`
    fillSelect($('platform'), data.platforms, data.filters.platform, v => ({ windows: 'Windows', android: 'Android' })[v] || v)
    fillSelect($('version'), data.versions, data.filters.version)
    $('active').textContent = data.activeInstalls30
    drawChart(data.daily)
    const rows = [...data.features].sort((a, b) => b.total - a.total || b.last30 - a.last30)
    $('features').replaceChildren(...rows.map(f => {
        const tr = document.createElement('tr')
        const name = document.createElement('td')
        name.textContent = f.name
        name.title = f.id
        tr.append(name, cell(CATEGORY[f.category] || f.category, false), cell(f.total), cell(f.last7), cell(f.last30),
            cell(f.share30 === null ? '-' : `${(f.share30 * 100).toFixed(1)}%`, !f.share30))
        return tr
    }))
    $('login').hidden = true
    $('report').hidden = false
}

async function load() {
    const token = readToken()
    if (!token) return showLogin()
    const query = new URLSearchParams()
    if ($('platform').value) query.set('platform', $('platform').value)
    if ($('version').value) query.set('version', $('version').value)
    $('report-error').textContent = ''
    let response
    try { response = await fetch(`/v1/usage-stats/summary?${query}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }) }
    catch (error) { $('report-error').textContent = `统计读取失败：${error.message}`; return }
    const body = await response.json().catch(() => ({}))
    if (response.status === 401) { writeToken(''); return showLogin(body.error?.message || '口令不正确') }
    if (!response.ok) { $('report-error').textContent = `统计读取失败（HTTP ${response.status}）：${body.error?.message || ''}`; return }
    render(body)
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
load()
