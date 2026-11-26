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
    const code = document.getElementById('dsl-source'), wrap = document.getElementById('wrap-code')
    const status = document.getElementById('copy-status')
    let timer
    function setWrap(enabled) {
        code.classList.toggle('wrapped', enabled)
        wrap.setAttribute('aria-pressed', String(enabled))
        wrap.textContent = '自动换行：' + (enabled ? '开' : '关')
    }
    setWrap(matchMedia('(max-width:959px)').matches)
    wrap.addEventListener('click', () => setWrap(!code.classList.contains('wrapped')))
    copyCode.addEventListener('click', async () => {
        const source = JSON.parse(copyCode.dataset.source)
        try { await navigator.clipboard.writeText(source) }
        catch {
            const field = document.createElement('textarea')
            field.value = source
            field.className = 'copy-field'
            document.body.append(field)
            field.select()
            let copied
            try { copied = document.execCommand('copy') } catch { copied = false }
            finally { field.remove() }
            if (!copied) {
                const range = document.createRange()
                range.selectNodeContents(code.querySelector('code'))
                const selection = window.getSelection()
                selection.removeAllRanges()
                selection.addRange(range)
                status.textContent = '请长按或选中源码复制。'
                return
            }
        }
        status.textContent = copyCode.textContent = '✓ 已复制 DSL 源码'
        clearTimeout(timer)
        timer = setTimeout(() => { copyCode.textContent = '一键复制 DSL 源码'; status.textContent = '' }, 1800)
    })
}
