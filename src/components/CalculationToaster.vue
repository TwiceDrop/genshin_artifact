<script setup lang="ts">
import { ToastClose, ToastDescription, ToastProvider, ToastRoot, ToastTitle, ToastViewport } from 'radix-vue'
import { calculationNotices, dismissCalculationNotice } from '@/store/calculation-history'
import UiButton from '@/components/ui/UiButton.vue'

const timeLabel = ' 用时：'
</script>

<template>
    <ToastProvider :duration="3500" swipe-direction="right">
        <ToastRoot v-for="notice in calculationNotices" :key="notice.id" class="calc-toast" :data-tone="notice.type" default-open
            @update:open="$event || dismissCalculationNotice(notice.id)">
            <i-ep-circle-check-filled v-if="notice.type === 'success'" class="calc-toast-icon" aria-hidden="true" />
            <i-ep-info-filled v-else-if="notice.type === 'info'" class="calc-toast-icon" aria-hidden="true" />
            <i-ep-warning-filled v-else class="calc-toast-icon" aria-hidden="true" />
            <div class="calc-toast-text">
                <ToastTitle>{{ notice.type === 'success' ? notice.message.split(timeLabel)[0] : notice.message }}</ToastTitle>
                <ToastDescription v-if="notice.type === 'success' && notice.message.includes(timeLabel)" class="calc-toast-time">
                    {{ timeLabel.trim() }}{{ notice.message.split(timeLabel)[1] }}
                </ToastDescription>
            </div>
            <ToastClose as-child><UiButton size="small" class="calc-toast-close" aria-label="关闭"><i-ep-close aria-hidden="true" /></UiButton></ToastClose>
        </ToastRoot>
        <ToastViewport class="calc-toast-viewport" />
    </ToastProvider>
</template>

<style>
.calc-toast-viewport { position: fixed; right: 16px; bottom: max(16px, env(safe-area-inset-bottom)); z-index: 10000; display: grid; gap: 8px; width: min(360px, calc(100vw - 24px)); margin: 0; padding: 0; list-style: none; pointer-events: none; }
.calc-toast { --notice-tone: var(--cx-down); display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: start; gap: 10px; padding: 11px 12px; border: 1px solid var(--cx-step-2); border-radius: 12px; background: var(--cx-card); color: var(--cx-letter); box-shadow: 0 8px 24px rgb(0 0 0 / 18%); pointer-events: auto; }
.calc-toast[data-tone="error"] { --notice-tone: var(--cx-up); }
.calc-toast[data-tone="warning"] { --notice-tone: var(--cx-gold); }
.calc-toast[data-tone="info"] { --notice-tone: var(--cx-dim); }
.calc-toast-icon { width: 18px; height: 18px; margin-top: 2px; color: var(--notice-tone); }
.calc-toast-text { font-size: 14px; font-weight: 600; overflow-wrap: anywhere; }
.calc-toast-time { margin-top: 3px; color: var(--cx-dim); font-size: 12px; font-weight: 400; font-variant-numeric: tabular-nums; }
.calc-toast-close[data-slot="button"] { width: 28px; padding: 0; border-color: transparent; background: transparent; color: var(--cx-dim); }
.calc-toast[data-swipe="move"] { transform: translateX(var(--radix-toast-swipe-move-x)); }
@media (max-width: 600px) {
    .calc-toast-viewport { right: 12px; bottom: calc(64px + max(8px, env(safe-area-inset-bottom))); width: calc(100vw - 24px); }
}
@media (prefers-reduced-motion: no-preference) {
    .calc-toast[data-state="open"] { animation: calc-toast-enter 160ms ease-out; }
    @keyframes calc-toast-enter { from { opacity: 0; transform: translateY(6px); } }
}
</style>
