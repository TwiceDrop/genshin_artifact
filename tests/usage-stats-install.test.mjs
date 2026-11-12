import test from 'node:test'
import assert from 'node:assert/strict'
import { installUsageStats, routeUsageFeature, USAGE_STATS_SEND_INTERVAL_MS } from '../src/usage-stats/install.mjs'

function harness(active = true) {
    const hooks = [], recorded = [], flushes = [], reports = [], timers = [], listeners = {}
    const recorder = { active: () => active, record: id => recorded.push(id), flush: options => flushes.push(options || {}) }
    const target = { addEventListener: (name, fn) => { listeners[name] = fn },
        document: { visibilityState: 'visible', addEventListener: (name, fn) => { listeners[`document:${name}`] = fn } } }
    installUsageStats({ router: { afterEach: fn => hooks.push(fn) }, recorder, target, report: m => reports.push(m),
        timers: { setTimeout: (fn, ms) => timers.push(['timeout', ms, fn]), setInterval: (fn, ms) => timers.push(['interval', ms, fn]) } })
    const navigate = (to, failure) => hooks.forEach(h => h(to, {}, failure))
    return { recorded, flushes, reports, timers, listeners, navigate, target }
}
const route = (path, aliasOf) => ({ matched: [{ path, ...(aliasOf ? { aliasOf: { path: aliasOf } } : {}) }] })

test('each finished navigation records the page feature of the route it landed on', () => {
    const h = harness()
    h.navigate(route('/calculate'))
    h.navigate(route('/', '/intro'))
    h.navigate(route('/artifacts'), new Error('aborted'))
    h.navigate({ matched: [] })
    assert.deepEqual(h.recorded, ['page.calculate', 'page.intro'])
    assert.deepEqual(routeUsageFeature(route('/help/export-tools')), { path: '/help/export-tools', feature: 'page.export-tools-help' })
})

test('a route without a registered feature is reported, not recorded', () => {
    const h = harness()
    h.navigate(route('/no-such-page'))
    assert.deepEqual(h.recorded, [])
    assert.deepEqual(h.reports, ['使用统计：路由 /no-such-page 没有登记功能 ID'])
})

test('an active recorder sends on start, every 10 minutes and when the page is hidden or closed', () => {
    const h = harness()
    assert.deepEqual(h.timers.map(([kind, ms]) => [kind, ms]), [['timeout', 5000], ['interval', USAGE_STATS_SEND_INTERVAL_MS]])
    h.timers.forEach(([, , fn]) => fn())
    h.listeners.pagehide()
    h.listeners['document:visibilitychange']()
    h.target.document.visibilityState = 'hidden'
    h.listeners['document:visibilitychange']()
    assert.deepEqual(h.flushes, [{}, {}, { keepalive: true }, { keepalive: true }])
})

test('an inactive recorder still gets the route hook but no timers or listeners', () => {
    const h = harness(false)
    assert.equal(h.timers.length, 0)
    assert.deepEqual(Object.keys(h.listeners), [])
    h.navigate(route('/calculate'))
    assert.deepEqual(h.recorded, ['page.calculate'], 'the recorder itself ignores records while inactive')
})
