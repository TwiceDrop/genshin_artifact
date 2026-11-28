import { shallowRef, type VNode } from 'vue'

type Kind = 'alert' | 'confirm' | 'prompt'
type Dismissal = 'cancel' | 'close'
type PromptResult = { value: string }

interface DialogOptions {
    confirmButtonText?: string
    cancelButtonText?: string
    closeOnClickModal?: boolean
    inputValue?: string
    inputPattern?: RegExp
    inputErrorMessage?: string
    inputValidator?: (value: string) => boolean | string
    type?: 'warning'
}

interface Request {
    kind: Kind
    title: string
    message: string | VNode
    options: DialogOptions
    resolve: (value: PromptResult) => void
    reject: (reason: Dismissal) => void
}

export function createArtifactPrompt() {
    const request = shallowRef<Request | null>(null)
    const shownRequest = shallowRef<Request | null>(null)

    function show(kind: Kind, message: Request['message'], title: string, options: DialogOptions) {
        return new Promise<PromptResult>((resolve, reject) => {
            request.value = { kind, message, title, options, resolve, reject }
            shownRequest.value = request.value
        })
    }

    function cancel(reason: Dismissal) {
        const current = request.value
        request.value = null
        current?.reject(reason)
    }

    function accept(value: string) {
        const current = request.value
        request.value = null
        current?.resolve({ value })
    }

    return {
        request, shownRequest, cancel, accept,
        alert: (message: string) => show('alert', message, '', {}),
        confirm: (message: Request['message'], title: string, options: DialogOptions) => show('confirm', message, title, options),
        prompt: (message: string, title: string, options: DialogOptions) => show('prompt', message, title, options),
    }
}

export type ArtifactPrompt = ReturnType<typeof createArtifactPrompt>
