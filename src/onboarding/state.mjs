import {FIRST_USE_KEY, needsFirstUse} from '../platform/first-use.mjs'

export const ONBOARDING_STORAGE_KEY = 'mona.onboarding.v1'

const sessions = new WeakMap()
const emptyState = () => ({version: 1, welcomeDismissed: false, completedIds: []})

function decodeState(raw) {
    const state = JSON.parse(raw)
    if (state?.version !== 1 || typeof state.welcomeDismissed !== 'boolean' ||
        !Array.isArray(state.completedIds) || !state.completedIds.every(id => typeof id === 'string')) {
        throw new TypeError('mona.onboarding.v1 引导进度结构无效')
    }
    return state
}

export function loadOnboardingState(storage) {
    const key = storage ?? globalThis
    const session = sessions.get(key)
    // 写入失败时，后续操作继续使用本次会话的进度。
    if (session?.unsaved) return session.state
    try {
        const raw = (storage ?? globalThis.localStorage).getItem(ONBOARDING_STORAGE_KEY)
        const state = raw === null ? emptyState() : decodeState(raw)
        sessions.set(key, {state, unsaved: false})
        return state
    } catch (error) {
        console.error('读取引导进度失败', error)
        return session?.state ?? emptyState()
    }
}

export function readFirstUseDone(storage) {
    try {
        return (storage ?? globalThis.localStorage).getItem(FIRST_USE_KEY) === 'true'
    } catch (error) {
        console.error('读取首次引导标记失败', error)
        return false
    }
}

export function saveOnboardingState(state, storage) {
    try {
        (storage ?? globalThis.localStorage).setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(state))
        sessions.set(storage ?? globalThis, {state, unsaved: false})
    } catch (error) {
        sessions.set(storage ?? globalThis, {state, unsaved: true})
        console.error('保存引导进度失败', error)
    }
    return state
}

export function markWelcomeDismissed(storage) {
    const state = loadOnboardingState(storage)
    return saveOnboardingState({...state, welcomeDismissed: true}, storage)
}

export function markGuideCompleted(guideId, storage) {
    const state = loadOnboardingState(storage)
    return saveOnboardingState({...state, completedIds: [...new Set([...state.completedIds, guideId])]}, storage)
}

export function resetOnboardingState(storage) {
    const state = loadOnboardingState(storage)
    return saveOnboardingState({...state, completedIds: []}, storage)
}

export function shouldShowWelcome({state, firstUseDone, accountData}) {
    return needsFirstUse({done: firstUseDone || state.welcomeDismissed, accountData})
}
