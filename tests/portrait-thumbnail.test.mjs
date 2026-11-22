import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'

const require = createRequire(import.meta.url)
const { JSDOM } = require('jsdom')
const { parse, compileScript } = require('@vue/compiler-sfc')
const ts = require('typescript')

test('picker resamples the original crop at display density before showing it', async () => {
    const dom = new JSDOM('<div id="app"></div>')
    for (const key of ['window', 'document', 'Element', 'SVGElement']) globalThis[key] = dom.window[key]
    let resize, disconnected = false
    globalThis.ResizeObserver = class {
        constructor(callback) { resize = callback }
        observe() {}
        disconnect() { disconnected = true }
    }
    const vue = require('vue')
    const file = new URL('../src/components/display/PortraitThumbnail.vue', import.meta.url)
    const { descriptor } = parse(readFileSync(file, 'utf8'))
    const script = compileScript(descriptor, { id: 'portrait', inlineTemplate: true })
    const js = ts.transpileModule(script.content, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
    const components = {}
    new Function('require', 'exports', js)(require, components)
    const right = vue.ref(true)
    const app = vue.createApp({ render: () => vue.h(components.default, { src: 'synthetic.webp', alt: '立绘', loading: 'lazy', zoom: 1.25, alignRight: right.value }) })
    try {
        app.mount('#app')
        const image = document.querySelector('img'), canvas = document.querySelector('canvas'), draws = []
        Object.defineProperties(image, { naturalWidth: { value: 640 }, naturalHeight: { value: 1083 } })
        Object.defineProperties(canvas, { clientWidth: { value: 84 }, clientHeight: { value: 104 } })
        canvas.getContext = () => ({ drawImage(source, ...rectangles) {
            assert.equal(source, image)
            assert.equal(this.imageSmoothingEnabled, true)
            assert.equal(this.imageSmoothingQuality, 'high')
            draws.push(rectangles)
        } })
        window.devicePixelRatio = 1
        image.dispatchEvent(new window.Event('load'))
        assert.equal(draws.length, 1)
        assert.ok(Math.abs(draws[0][0] - 128) < 1e-8)
        assert.equal(draws[0][2], 512)
        assert.deepEqual(draws[0].slice(-4), [0, 0, 84, 104])
        right.value = false
        await vue.nextTick()
        assert.equal(draws.at(-1)[0], 0)
        window.devicePixelRatio = 2
        resize()
        assert.deepEqual([canvas.width, canvas.height], [168, 208])
        assert.deepEqual(draws.at(-1).slice(-4), [0, 0, 168, 208])
        assert.equal(image.alt, '立绘')
        assert.equal(image.getAttribute('loading'), 'lazy')
    } finally { app.unmount(); dom.window.close() }
    assert.equal(disconnected, true)
})
