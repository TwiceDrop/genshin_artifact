/* global ort */
// PP-OCRv6 tiny recognition: BGR, 3 x 48 x 320, followed by greedy CTC decoding.
const modelWidth = 320, modelHeight = 48, plane = modelWidth * modelHeight
const input = new OffscreenCanvas(modelWidth, modelHeight)
const context = input.getContext('2d', {willReadFrequently: true})
let session, characters

async function initialize() {
    importScripts('./ort.wasm.min.js')
    ort.env.wasm.numThreads = 1
    ort.env.wasm.wasmPaths = new URL('./', self.location.href).href
    const response = await fetch('./characters.json')
    if (!response.ok) throw new Error('characters.json HTTP ' + response.status)
    characters = ['', ...await response.json(), ' ']
    session = await ort.InferenceSession.create(new URL('inference.onnx', self.location.href).href,
        {executionProviders: ['wasm']})
}

async function recognize({width, height, pixels, alphabet}) {
    // The parser supplies dark text on white. Blank badge margins must not
    // squeeze a short weapon name and level into just a few model columns.
    let left = width, right = -1
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (pixels[4 * (y * width + x)] >= 145) continue
            left = Math.min(left, x)
            right = Math.max(right, x)
        }
    }
    if (right < left) return ''
    left = Math.max(0, left - 5)
    right = Math.min(width - 1, right + 5)
    const cropWidth = right - left + 1
    const source = new OffscreenCanvas(width, height)
    source.getContext('2d').putImageData(new ImageData(pixels, width, height), 0, 0)
    return recognizeBox(source, left, 0, cropWidth, height, alphabet)
}

async function recognizeBox(source, left, top, width, height, alphabet) {
    const resized = Math.min(modelWidth, Math.ceil(width * modelHeight / height))
    context.drawImage(source, left, top, width, height, 0, 0, resized, modelHeight)
    const rgba = context.getImageData(0, 0, resized, modelHeight).data
    const tensor = new Float32Array(3 * plane)
    for (let y = 0; y < modelHeight; y++) {
        for (let x = 0; x < resized; x++) {
            const src = 4 * (y * resized + x), dst = y * modelWidth + x
            for (let channel = 0; channel < 3; channel++)
                tensor[channel * plane + dst] = rgba[src + 2 - channel] / 127.5 - 1
        }
    }
    const feeds = {[session.inputNames[0]]: new ort.Tensor('float32', tensor, [1, 3, modelHeight, modelWidth])}
    const output = (await session.run(feeds))[session.outputNames[0]]
    const classes = output.dims[2], scores = output.data
    let text = '', previous = 0
    for (let i = 0; i < scores.length; i += classes) {
        let best = 0
        for (let k = 1; k < classes; k++) if (scores[i + k] > scores[i + best]) best = k
        const character = characters[best]
        if (best && best !== previous && (!alphabet || alphabet.includes(character))) text += character
        previous = best
    }
    return text
}

self.onmessage = async ({data}) => {
    try {
        if (data.init) await initialize()
        let text = ''
        if (data.page) {
            importScripts('./detect-lines.js')
            text = await readArtifactPage(data, recognizeBox)
        } else if (!data.init) text = await recognize(data)
        self.postMessage({text})
    } catch (error) {
        self.postMessage({error: 'PP-OCRv6 tiny ' + (data.init ? '加载' : '识别') + '失败：' + error.message})
    }
}
