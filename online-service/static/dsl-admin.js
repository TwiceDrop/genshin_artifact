'use strict'
const byId = id => document.getElementById(id)
const unlock = byId('unlock'), tokenInput = byId('token'), workspace = byId('workspace')
const roles = byId('roles'), entries = byId('entries'), source = byId('source'), file = byId('file')
const publish = byId('publish'), reload = byId('reload'), add = byId('add'), status = byId('status')
const roleData = new Map()
let token = '', current, draft = [], activeId = null, replacingId = null, busy = false
const rolePath = role => '/v1/dsl-catalog/' + encodeURIComponent(role)
const dirty = () => current && JSON.stringify(draft) !== JSON.stringify(current.entries)

async function request(path, body) {
    const response = await fetch(path, { method: body ? 'PUT' : 'GET', cache: 'no-store',
        headers: { Authorization: 'Bearer ' + token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}) })
    const data = await response.json()
    if (!response.ok) throw Error(data.error?.message || 'HTTP ' + response.status)
    return data
}

function makeButton(label, action, className = '') {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = className
    button.textContent = label
    button.disabled = busy
    button.addEventListener('click', action)
    return button
}

function render() {
    roles.disabled = busy
    reload.disabled = add.disabled = busy || !current
    publish.disabled = busy || !dirty()
    if (!current) return
    byId('role-name').textContent = roleData.get(current.character).name
    byId('revision').textContent = current.revision ? '已发布 · 第 ' + current.revision + ' 版 · ' +
        new Date(current.publishedAt).toLocaleString('zh-CN') : '未发布'
    if (dirty()) byId('revision').textContent += ' · 草稿 ' + draft.length + ' 项'
    const original = new Map(current.entries.map(entry => [entry.id, entry]))
    entries.replaceChildren(...draft.map(entry => {
        const li = document.createElement('li'), heading = document.createElement('div')
        const select = makeButton(entry.document.name, () => { activeId = entry.id; render() }, 'entry-title')
        select.setAttribute('aria-pressed', String(activeId === entry.id))
        heading.append(select)
        if (JSON.stringify(original.get(entry.id)) !== JSON.stringify(entry)) {
            const badge = document.createElement('span')
            badge.className = 'entry-status'
            badge.textContent = '草稿'
            heading.append(badge)
        }
        const actions = document.createElement('div')
        actions.className = 'entry-actions'
        actions.append(
            makeButton('替换 JSON', () => chooseFile(entry.id)),
            makeButton('删除', () => {
                if (!window.confirm('删除「' + entry.document.name + '」？')) return
                draft = draft.filter(item => item.id !== entry.id)
                if (activeId === entry.id) activeId = draft[0]?.id
                render()
            }, 'danger')
        )
        li.append(heading, actions)
        return li
    }))
    const entry = draft.find(dsl => dsl.id === activeId)
    byId('preview-title').textContent = entry ? entry.document.name + ' · 源码' : '源码'
    source.textContent = entry?.document.source || ''
}

async function perform(action, output = status) {
    if (busy) return
    busy = true
    unlock.querySelector('button').disabled = true
    output.textContent = ''
    render()
    try { await action() }
    catch (error) { output.textContent = error.message }
    finally {
        busy = false
        unlock.querySelector('button').disabled = false
        render()
    }
}

function showCatalog(catalog) {
    current = catalog
    draft = [...catalog.entries]
    activeId = draft[0]?.id
    roles.value = current.character
}

unlock.addEventListener('submit', event => {
    event.preventDefault()
    void perform(async () => {
        token = tokenInput.value.trim()
        try {
            const data = await request('/v1/admin/dsl-catalog')
            data.roles.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
            roleData.clear()
            roles.replaceChildren(...data.roles.map(role => {
                roleData.set(role.id, role)
                return new Option(role.name + (role.count ? ' · ' + role.count : ''), role.id)
            }))
            const role = data.roles.find(role => role.count) ?? data.roles[0]
            showCatalog(await request(rolePath(role.id)))
        } catch (error) { token = ''; throw error }
        tokenInput.value = ''
        unlock.hidden = true
        workspace.hidden = false
        // The role selector remains disabled until perform() finishes.
        requestAnimationFrame(() => roles.focus())
    }, byId('unlock-status'))
})

async function loadRole(role) {
    if (dirty() && !window.confirm('放弃未发布的更改？')) {
        roles.value = current.character
        return
    }
    await perform(async () => {
        try { showCatalog(await request(rolePath(role))) }
        catch (error) { roles.value = current.character; throw error }
    })
}

roles.addEventListener('change', () => loadRole(roles.value))
reload.addEventListener('click', () => loadRole(current.character))

function chooseFile(id = null) {
    replacingId = id
    file.click()
}
add.addEventListener('click', () => chooseFile())
file.addEventListener('change', () => {
    const selected = file.files[0], replacement = replacingId
    file.value = ''
    if (!selected || !current) return
    void perform(async () => {
        if (selected.size > 524288) throw Error('请求内容过大')
        const data = JSON.parse(await selected.text())
        if (data?.format !== 'mona-dsl-entry' || data.version !== 1) throw Error('DSL 文件格式或版本不受支持')
        const document = data.document
        if (document?.character !== current.character) throw Error('DSL 条目的角色与当前角色不一致')
        if (typeof document.name !== 'string' || !document.name.trim() || typeof document.source !== 'string' || !document.source.trim()) {
            throw Error('DSL 条目缺少名称或源码')
        }
        const entry = { id: replacement || crypto.randomUUID(), document }
        draft = replacement ? draft.map(item => item.id === replacement ? entry : item) : [...draft, entry]
        activeId = entry.id
    })
})

publish.addEventListener('click', () => {
    if (!dirty() || !window.confirm('发布「' + roleData.get(current.character).name + '」的 ' + draft.length + ' 项手法？')) return
    void perform(async () => {
        showCatalog(await request(rolePath(current.character), { revision: current.revision, entries: draft }))
        const role = roleData.get(current.character)
        roles.selectedOptions[0].textContent = role.name + (draft.length ? ' · ' + draft.length : '')
        status.textContent = '已发布 · 第 ' + current.revision + ' 版'
    })
})
window.addEventListener('beforeunload', event => {
    if (dirty()) { event.preventDefault(); event.returnValue = true }
})
