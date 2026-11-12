import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {listUsageFeatures, getUsageFeature, usageFeatureIdForRoute} from '../server/usage-stats-features.mjs'

// The router imports Vue pages, so Node reads its source instead of loading it.
// Each top-level object in `const routes = [...]` is one route record.
function routeRecords() {
    const source = fs.readFileSync('src/router/router.js', 'utf8')
    const start = source.indexOf('const routes = [')
    assert.ok(start >= 0, 'src/router/router.js no longer declares `const routes = [`')
    const records = []
    let depth = 0, from = -1
    for (let i = source.indexOf('[', start) + 1; i < source.length; i++) {
        const c = source[i]
        if (c === '{') { if (depth++ === 0) from = i }
        else if (c === '}') { if (--depth === 0) records.push(source.slice(from, i + 1)) }
        else if (c === ']' && depth === 0) break
    }
    return records.map(text => {
        const path = text.match(/\bpath:\s*["']([^"']+)["']/)?.[1]
        assert.ok(path, `route record without a path: ${text.slice(0, 60)}`)
        return {path, redirect: /\bredirect:/.test(text)}
    })
}

test('every page route that is not a redirect has a usage feature', () => {
    const pages = routeRecords().filter(r => !r.redirect)
    assert.ok(pages.length >= 12, `found only ${pages.length} page routes; the source scan is probably broken`)
    for (const {path} of pages) {
        const id = usageFeatureIdForRoute(path)
        assert.ok(id, `route ${path} has no usage feature`)
        assert.equal(getUsageFeature(id).route, path)
    }
})

test('every page feature points at a page route in the router', () => {
    const pages = new Set(routeRecords().filter(r => !r.redirect).map(r => r.path))
    for (const feature of listUsageFeatures().filter(f => f.category === 'page'))
        assert.ok(pages.has(feature.route), `${feature.id} points at ${feature.route}, which is not a page route`)
})

test('feature ids are unique and every feature is complete', () => {
    const features = listUsageFeatures()
    assert.equal(new Set(features.map(f => f.id)).size, features.length)
    for (const f of features) {
        assert.match(f.id, /^(page|action)\.[a-z][a-z0-9-]*$/)
        assert.equal(f.id.split('.')[0], f.category)
        assert.ok(f.name.trim(), `${f.id} has no name`)
        if (f.category === 'page') assert.match(f.route, /^\//)
        else assert.equal(f.route, undefined)
    }
    assert.equal(features.filter(f => f.category === 'page').length, 12)
    assert.equal(features.filter(f => f.category === 'action').length, 14)
})

test('lookups return nothing for unknown ids and routes, and the registry cannot be changed', () => {
    assert.equal(getUsageFeature('action.unknown'), undefined)
    assert.equal(usageFeatureIdForRoute('/no-such-page'), undefined)
    assert.equal(usageFeatureIdForRoute('/online-account'), undefined)
    const [first] = listUsageFeatures()
    assert.throws(() => { first.name = 'changed' }, TypeError)
    assert.throws(() => { listUsageFeatures().push({}) }, TypeError)
})

test('every action feature is recorded somewhere in src, and every recorded id is registered', () => {
    const calls = new Set()
    for (const file of fs.readdirSync('src', { recursive: true })) {
        if (!/\.(vue|mjs|js|ts)$/.test(file)) continue
        for (const [, id] of fs.readFileSync(`src/${file}`, 'utf8').matchAll(/recordUsage\(\s*['"]([^'"]+)['"]\s*\)/g)) calls.add(id)
    }
    for (const id of calls) assert.ok(getUsageFeature(id), `src records unregistered id ${id}`)
    for (const f of listUsageFeatures().filter(f => f.category === 'action'))
        assert.ok(calls.has(f.id), `${f.id} is never recorded in src`)
})
