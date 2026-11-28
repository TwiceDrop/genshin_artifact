import { ref, watch, type WatchSource } from 'vue'
import { useZIndex } from 'element-plus'

export function useOverlayZIndex(open: WatchSource<boolean>) {
    const { nextZIndex } = useZIndex()
    const zIndex = ref<number>()
    // Portalled Radix overlays and Element Plus dialogs share opening order.
    watch(open, visible => {
        if (visible) zIndex.value = nextZIndex()
    }, { immediate: true })
    return zIndex
}
