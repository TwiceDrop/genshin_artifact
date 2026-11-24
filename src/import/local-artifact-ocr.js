import { readShareCards } from './miyoushe-artifact-share'
import { screenshotDraft } from './artifact-screenshot.mjs'
import { recognizeWithBackup } from './screenshot-ocr-retry.mjs'

const base = new URL('artifact-ocr/', new URL(process.env.BASE_URL || './', document.baseURI)).href
let engine

function loadEngine() {
    if (!engine) {
        engine = new Promise((resolve, reject) => {
            const script = document.createElement('script')
            script.src = base + 'tesseract.min.js'
            script.onload = () => resolve(window.Tesseract)
            script.onerror = () => { script.remove(); engine = undefined; reject(new Error('无法加载本地文字识别引擎')) }
            document.head.appendChild(script)
        })
    }
    return engine
}

async function withTesseract(signal, read) {
    const api = await loadEngine()
    signal.throwIfAborted()
    let rejectJob, worker
    const interrupted = new Promise((_, reject) => { rejectJob = reject })
    const abort = () => rejectJob(signal.reason)
    signal.addEventListener('abort', abort, {once: true})
    let finished = false
    try {
        const start = api.createWorker('chi_sim', 1, {workerPath: base + 'worker.min.js', corePath: base,
            langPath: base, workerBlobURL: false, cacheMethod: 'none',
            errorHandler: error => rejectJob(error instanceof Error ? error : new Error(String(error)))})
            .then(created => {
                if (finished) return created.terminate()
                worker = created
                return read(worker, api)
            })
        return await Promise.race([start, interrupted])
    } finally {
        finished = true
        signal.removeEventListener('abort', abort)
        if (worker) await worker.terminate()
    }
}

function withTesseractLines(signal, read) {
    return withTesseract(signal, worker => {
        let language = 'chi_sim'
        return read({
            async configure(next, alphabet) {
                if (language !== next) {
                    await worker.reinitialize(next, 1)
                    language = next
                }
                await worker.setParameters({tessedit_pageseg_mode: '7', tessedit_char_whitelist: alphabet})
            },
            async readLine(canvas) { return (await worker.recognize(canvas)).data.text },
        })
    })
}

async function withTiny(signal, read) {
    const { withPaddleTiny } = await import('./paddle-tiny-reader')
    return withPaddleTiny(base, signal, read)
}

export async function readArtifactScreenshot(image, signal, sets, locale, tags, readRole, panelMatches) {
    signal.throwIfAborted()
    if (image instanceof Blob) {
        const source = new Image()
        const url = URL.createObjectURL(image)
        try {
            source.src = url
            await source.decode()
            if (source.naturalHeight > 2 * source.naturalWidth) {
                const canvas = document.createElement('canvas')
                canvas.width = 1080
                canvas.height = Math.round(canvas.width * source.naturalHeight / source.naturalWidth)
                canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height)
                const read = async reader => {
                    const role = readRole && await readRole(canvas, reader, signal)
                    const drafts = await readShareCards(canvas, reader, signal, sets, locale, tags)
                    return {role, drafts: drafts || []}
                }
                const tesseract = () => withTesseractLines(signal, read)
                const result = process.env.NODE_ENV === 'development'
                    ? await recognizeWithBackup(signal, () => withTiny(signal, read), tesseract, ['PP-OCRv6 tiny', 'Tesseract'], panelMatches)
                    : await tesseract()
                if (readRole) return result
                if (result.drafts.length) return result.drafts
            }
        } finally { URL.revokeObjectURL(url) }
    }
    if (readRole) throw new Error('请选择米游社原神战绩的完整角色分享图')
    // A manually cropped inventory screenshot has no battle-record row layout.
    const parse = text => ({drafts: [screenshotDraft(text, sets, locale, tags)]})
    const tesseract = () => withTesseract(signal, async (worker, api) => {
        await worker.setParameters({ tessedit_pageseg_mode: api.PSM.SPARSE_TEXT })
        const { data } = await worker.recognize(image)
        return parse(data.text)
    })
    if (process.env.NODE_ENV !== 'development') return (await tesseract()).drafts
    const paddle = () => withTiny(signal, async reader => {
        let source = image
        if (image instanceof Blob) source = await createImageBitmap(image)
        try {
            const canvas = document.createElement('canvas')
            canvas.width = source.width
            canvas.height = source.height
            canvas.getContext('2d').drawImage(source, 0, 0)
            return parse(await reader.readPage(canvas))
        } finally { if (source !== image) source.close() }
    })
    return (await recognizeWithBackup(signal, tesseract, paddle, ['Tesseract', 'PP-OCRv6 tiny'])).drafts
}

