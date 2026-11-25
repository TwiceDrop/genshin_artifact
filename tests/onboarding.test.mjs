import test from 'node:test'
import assert from 'node:assert/strict'
import {readdirSync, readFileSync} from 'node:fs'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {
    ONBOARDING_STORAGE_KEY, loadOnboardingState, saveOnboardingState, markWelcomeDismissed,
    markGuideCompleted, resetOnboardingState, readFirstUseDone, shouldShowWelcome,
} from '../src/onboarding/state.mjs'
import {ONBOARDING_GUIDES, getDetailGuides, getGuideById, getGuideForRoute, getQuickGuide} from '../src/onboarding/guides.mjs'

test('一套快速引导和六套详细引导均可查询，页面入口匹配当前模块', () => {
    assert.equal(getQuickGuide().id, 'quick-start')
    assert.deepEqual(getDetailGuides().map(guide => guide.steps.length), [4, 6, 4, 4, 3, 3])
    assert.equal(new Set(ONBOARDING_GUIDES.map(guide => guide.id)).size, 7)
    for (const guide of ONBOARDING_GUIDES) assert.equal(getGuideById(guide.id), guide)
    assert.equal(getGuideForRoute('/artifacts').id, 'detail-artifacts')
    assert.equal(getGuideForRoute('/uid-data').id, 'detail-import')
    assert.equal(getGuideForRoute('/intro'), undefined)
})

test('快速引导共三步，留在当前页，第二步没有锚点', () => {
    const {steps} = getQuickGuide()
    assert.deepEqual(steps.map(step => step.route), [null, null, null])
    assert.equal(steps[1].anchor, null)
    assert.equal(steps[1].mobileAnchor ?? null, null)
})

test('每一步都有独立标识及文案，步骤与页面入口的路由均已注册', () => {
    const router = readFileSync(new URL('../src/router/router.js', import.meta.url), 'utf8')
    const routes = new Set(Array.from(router.matchAll(/\bpath:\s*['"]([^'"]+)['"]/g), match => match[1]))
    for (const guide of ONBOARDING_GUIDES) {
        assert.ok(guide.title.trim() && guide.summary.trim())
        for (const path of guide.pageRoutes) assert.ok(routes.has(path), path)
        assert.equal(new Set(guide.steps.map(step => step.id)).size, guide.steps.length)
        for (const step of guide.steps) {
            assert.ok(step.id.trim() && step.title.trim() && step.body.trim())
            if (step.route) assert.ok(routes.has(step.route), step.route)
        }
    }
})

function memoryStorage() {
    const values = new Map()
    return {getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value)}
}

test('引导进度按设备保存，完成去重，重置只清空完成记录', () => {
    const storage = memoryStorage()
    const initial = {version: 1, welcomeDismissed: false, completedIds: []}
    assert.deepEqual(loadOnboardingState(storage), initial)
    assert.equal(ONBOARDING_STORAGE_KEY, 'mona.onboarding.v1')
    saveOnboardingState(initial, storage)
    assert.deepEqual(JSON.parse(storage.getItem(ONBOARDING_STORAGE_KEY)), initial)
    markWelcomeDismissed(storage)
    markGuideCompleted('quick-start', storage)
    markGuideCompleted('quick-start', storage)
    assert.deepEqual(loadOnboardingState(storage).completedIds, ['quick-start'])
    resetOnboardingState(storage)
    assert.deepEqual(loadOnboardingState(storage), {...initial, welcomeDismissed: true})
    assert.equal(storage.getItem('mona.firstUseDone'), 'true')
})

test('外部写入无效 v1 数据时记录错误并保留本次会话进度', t => {
    const storage = memoryStorage()
    const valid = markGuideCompleted('quick-start', storage)
    const log = t.mock.method(console, 'error', () => {})
    for (const raw of ['null', '{}', '{"version":2}', '{"version":1,"welcomeDismissed":false,"completedIds":[1]}']) {
        storage.setItem(ONBOARDING_STORAGE_KEY, raw)
        assert.deepEqual(loadOnboardingState(storage), valid)
        assert.equal(storage.getItem(ONBOARDING_STORAGE_KEY), raw)
    }
    assert.equal(log.mock.callCount(), 4)
})

test('写入前读取其他窗口最新保存的完成记录和欢迎标记', () => {
    const storage = memoryStorage()
    loadOnboardingState(storage)
    storage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify({version: 1, completedIds: ['quick-start'], welcomeDismissed: true}))
    const saved = markGuideCompleted('detail-import', storage)
    assert.deepEqual(saved.completedIds, ['quick-start', 'detail-import'])
    assert.equal(saved.welcomeDismissed, true)
})

test('欢迎卡兼容旧标记，检查所有本地账号，关闭后保存新旧标记', () => {
    const storage = memoryStorage()
    const eligible = accountData => shouldShowWelcome({
        state: loadOnboardingState(storage), firstUseDone: readFirstUseDone(storage), accountData,
    })
    assert.equal(eligible([{}, {}]), true)
    assert.equal(eligible([{}, {presets: [{id: 1}]}]), false)
    storage.setItem('mona.firstUseDone', 'true')
    assert.equal(eligible([{}]), false)
    resetOnboardingState(storage)
    assert.equal(storage.getItem('mona.firstUseDone'), 'true')
    storage.setItem('mona.firstUseDone', 'false')
    const expected = {version: 1, welcomeDismissed: true, completedIds: []}
    assert.deepEqual(markWelcomeDismissed(storage), expected)
    assert.deepEqual(JSON.parse(storage.getItem('mona.onboarding.v1')), expected)
    assert.equal(storage.getItem('mona.firstUseDone'), 'true')
    assert.equal(eligible([{}]), false)
})

test('旧标记写入失败时记录原因，保留新键、返回值和会话进度', t => {
    const storage = memoryStorage()
    markGuideCompleted('quick-start', storage)
    const setItem = storage.setItem
    const denied = new Error('legacy key blocked')
    storage.setItem = (key, value) => {
        if (key === 'mona.firstUseDone') throw denied
        return setItem(key, value)
    }
    const log = t.mock.method(console, 'error', () => {})
    const expected = {version: 1, welcomeDismissed: true, completedIds: ['quick-start']}
    assert.deepEqual(markWelcomeDismissed(storage), expected)
    assert.deepEqual(JSON.parse(storage.getItem(ONBOARDING_STORAGE_KEY)), expected)
    assert.equal(storage.getItem('mona.firstUseDone'), null)
    assert.deepEqual(loadOnboardingState(storage), expected)
    assert.ok(log.mock.calls.some(call => call.arguments.includes(denied)))
})

test('存储被禁用时记录错误，引导仍可在本次会话完成', t => {
    const blocked = () => { throw new Error('storage blocked') }
    const storage = {getItem: blocked, setItem: blocked}
    const log = t.mock.method(console, 'error', () => {})
    assert.equal(readFirstUseDone(storage), false)
    assert.deepEqual(loadOnboardingState(storage).completedIds, [])
    assert.equal(markWelcomeDismissed(storage).welcomeDismissed, true)
    assert.deepEqual(markGuideCompleted('quick-start', storage), {version: 1, welcomeDismissed: true, completedIds: ['quick-start']})
    assert.ok(log.mock.callCount() > 0)
})

test('每个桌面与手机锚点都在 Vue 模板中有对应元素', () => {
    const root = fileURLToPath(new URL('../src/', import.meta.url))
    const anchors = new Set()
    for (const name of readdirSync(root, {recursive: true})) {
        if (!name.endsWith('.vue')) continue
        const source = readFileSync(join(root, name), 'utf8').replace(/<!--[\s\S]*?-->/g, '')
        for (const match of source.matchAll(/\sdata-tour="([^"]+)"/g)) anchors.add(match[1])
    }
    for (const guide of ONBOARDING_GUIDES) {
        for (const step of guide.steps) {
            if (step.anchor) assert.ok(anchors.has(step.anchor), `${guide.id} / ${step.anchor}`)
            if (step.mobileAnchor) assert.ok(anchors.has(step.mobileAnchor), `${guide.id} / ${step.mobileAnchor}`)
        }
    }
})
