import { shallowRef } from 'vue'

export const pendingContentShare = shallowRef(null)

// A single in-memory draft survives navigation to the login page. Keep only
// public fields here. Equipment is sent only after the author opts in.
export function openContentShare(kind, content, equipment = []) {
    pendingContentShare.value = { kind, content, equipment,
        requestId:crypto.randomUUID() }
}
