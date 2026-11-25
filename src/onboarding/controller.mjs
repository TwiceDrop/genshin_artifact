import {computed, nextTick, reactive} from 'vue'
import {useScreen} from '@/composables/screen'
import {getGuideById, getGuideForRoute} from './guides.mjs'
import {ONBOARDING_STORAGE_KEY, loadOnboardingState, markGuideCompleted, markWelcomeDismissed, resetOnboardingState} from './state.mjs'

const {geSmall} = useScreen()
export const controller = reactive({
    hubOpen: false, welcomeOpen: false, activeGuideId: null, activeStepIndex: 0,
    completedIds: loadOnboardingState().completedIds, locating: false, targetRect: null, fallbackCentered: false,
})
export const activeGuide = computed(() => getGuideById(controller.activeGuideId))
export const activeStep = computed(() => activeGuide.value?.steps[controller.activeStepIndex])

window.addEventListener('storage', event => {
    if (event.key !== ONBOARDING_STORAGE_KEY && event.key !== null) return
    const state = loadOnboardingState()
    controller.completedIds = state.completedIds
    if (state.welcomeDismissed) controller.welcomeOpen = false
})

export function openHub() {
    controller.completedIds = loadOnboardingState().completedIds
    controller.hubOpen = true
}
export function closeHub() {
    controller.hubOpen = false
}
export function dismissWelcome() {
    controller.completedIds = markWelcomeDismissed().completedIds
    controller.welcomeOpen = false
}
export function resetProgress() {
    controller.completedIds = resetOnboardingState().completedIds
}

let navigation = Promise.resolve()
let generation = 0
let target = null
let frame = 0
function clearTarget() {
    target = null
    cancelAnimationFrame(frame)
    frame = 0
    window.removeEventListener('scroll', scheduleRefresh, true)
    window.removeEventListener('resize', scheduleRefresh)
    controller.targetRect = null
    controller.fallbackCentered = false
}

function visibleTarget(step) {
    const anchor = (!geSmall.value && step.mobileAnchor) || step.anchor
    return Array.from(document.querySelectorAll(`[data-tour="${anchor}"]`)).find(element => {
        const rect = element.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility === 'visible'
    })
}

function refreshRect() {
    const element = visibleTarget(activeStep.value)
    if (element !== target && element) {
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        element.scrollIntoView({behavior: reduced ? 'instant' : 'smooth', block: 'center', inline: 'nearest'})
    }
    target = element
    controller.targetRect = element?.getBoundingClientRect() ?? null
    controller.fallbackCentered = !element
}
function scheduleRefresh() {
    if (!frame) frame = requestAnimationFrame(() => {
        frame = 0
        refreshRect()
    })
}

async function showStep(index, router) {
    const current = ++generation
    clearTarget()
    controller.activeStepIndex = index
    controller.locating = true
    const step = activeStep.value
    try {
        // 等在途跳转结束，再根据最终路由执行最近一次切步。
        const navigate = async () => {
            if (current === generation && router.currentRoute.value.path !== step.route) await router.push(step.route)
        }
        navigation = navigation.then(navigate, navigate)
        await navigation
        if (current !== generation) return
        await nextTick()
        const deadline = performance.now() + 600
        while (current === generation && !visibleTarget(step) && performance.now() < deadline) {
            await new Promise(resolve => setTimeout(resolve, 50))
        }
        if (current !== generation) return
        refreshRect()
        window.addEventListener('scroll', scheduleRefresh, true)
        window.addEventListener('resize', scheduleRefresh)
        scheduleRefresh()
    } catch (error) {
        console.error('定位引导步骤失败', step.id, step.route, error)
        if (current === generation) controller.fallbackCentered = true
    } finally {
        if (current === generation) controller.locating = false
    }
}

export function startGuide(guideId, router) {
    closeHub()
    controller.activeGuideId = guideId
    return showStep(0, router)
}
export function startGuideForRoute(path, router) {
    const guide = getGuideForRoute(path)
    if (guide) return startGuide(guide.id, router)
}
export function stopGuide() {
    ++generation
    clearTarget()
    controller.activeGuideId = null
    controller.activeStepIndex = 0
    controller.locating = false
}
export function finishGuide() {
    controller.completedIds = markGuideCompleted(controller.activeGuideId).completedIds
    stopGuide()
}
export function nextStep(router) {
    if (controller.activeStepIndex + 1 === activeGuide.value.steps.length) return finishGuide()
    return showStep(controller.activeStepIndex + 1, router)
}
export function prevStep(router) {
    if (controller.activeStepIndex > 0) return showStep(controller.activeStepIndex - 1, router)
}
