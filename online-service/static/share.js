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
