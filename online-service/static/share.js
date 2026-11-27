const members = Array.from(document.querySelectorAll('[data-member]'))
const clear = document.getElementById('clear')
function highlight(slot) {
    for (const item of members) item.setAttribute('aria-pressed', String(item.dataset.member === slot))
    for (const group of document.querySelectorAll('[data-slot]')) {
        group.classList.toggle('muted', Boolean(slot) && group.dataset.slot !== slot)
        group.classList.toggle('focused', group.dataset.slot === slot)
    }
    clear.hidden = !slot
}
for (const item of members) item.addEventListener('click', () => highlight(item.getAttribute('aria-pressed') === 'true' ? null : item.dataset.member))
clear?.addEventListener('click', () => highlight(null))
const modes = ['sequence', 'overview']
function selectMode(id) {
    for (const mode of modes) {
        document.getElementById(mode).hidden = id !== mode
        document.getElementById(mode + '-tab')?.setAttribute('aria-pressed', String(id === mode))
    }
}
for (const id of modes) document.getElementById(id + '-tab')?.addEventListener('click', () => selectMode(id))
matchMedia('(max-width:959px)').addEventListener('change', event => { if (event.matches && clear) selectMode('sequence') })
for (const image of document.querySelectorAll('.portrait img')) {
    const hide = () => { image.hidden = true }
    image.addEventListener('error', hide)
    if (image.complete && !image.naturalWidth) hide()
}
document.getElementById('retry')?.addEventListener('click', () => location.reload())

const copyCode = document.getElementById('copy-code')
if (copyCode) {
    const code = document.getElementById('dsl-source')
    const wrap = document.getElementById('wrap-code')
    const status = document.getElementById('copy-status')
    const source = JSON.parse(copyCode.dataset.source)
    const buttons = [copyCode, document.getElementById('copy-code-small')]
    const labels = buttons.map(button => button.textContent)
    const narrow = matchMedia('(max-width:767px)')
    let timer
    let changedWrap = false

    function setWrap(enabled) {
        code.classList.toggle('wrapped', enabled)
        wrap.setAttribute('aria-pressed', String(enabled))
        wrap.textContent = '自动换行：' + (enabled ? '开' : '关')
    }
    setWrap(narrow.matches)
    narrow.addEventListener('change', event => {
        if (!changedWrap) setWrap(event.matches)
    })
    wrap.addEventListener('click', () => {
        changedWrap = true
        setWrap(!code.classList.contains('wrapped'))
    })

    function legacyCopy() {
        const previousFocus = document.activeElement
        const field = document.createElement('textarea')
        field.value = source
        field.readOnly = true
        field.className = 'copy-field'
        document.body.append(field)
        field.select()
        try { return document.execCommand('copy') }
        catch { return false }
        finally { field.remove(); previousFocus?.focus({ preventScroll: true }) }
    }

    function restoreLabels() {
        buttons.forEach((button, index) => { button.textContent = labels[index] })
    }

    async function copy(event) {
        const button = event.currentTarget
        let copied
        try { await navigator.clipboard.writeText(source); copied = true }
        catch { copied = legacyCopy() }
        clearTimeout(timer)
        restoreLabels()
        if (copied) {
            status.textContent = '已复制'
            status.classList.remove('copy-failed')
            button.textContent = '✓ 已复制'
            timer = setTimeout(() => { restoreLabels(); status.textContent = '' }, 1800)
            return
        }
        status.classList.add('copy-failed')
        status.textContent = '当前浏览器限制自动复制，请长按下方代码手动复制'
        const selection = window.getSelection()
        if (selection) {
            const range = document.createRange()
            range.selectNodeContents(code.querySelector('code'))
            selection.removeAllRanges()
            selection.addRange(range)
        }
    }
    buttons.forEach(button => button.addEventListener('click', copy))
}
