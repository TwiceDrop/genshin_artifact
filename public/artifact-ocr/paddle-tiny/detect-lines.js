/* global ort */
// Inventory details have horizontal text, but no fixed card coordinates.
// Locate the connected text regions on the detector's DB probability map.
function artifactTextBoxes(scores, width, height) {
    const visited = new Uint8Array(scores.length)
    const queue = new Int32Array(scores.length)
    const boxes = []
    for (let start = 0; start < scores.length; start++) {
        if (visited[start] || scores[start] < .2) continue
        visited[start] = 1
        queue[0] = start
        let size = 1, left = width, top = height, right = 0, bottom = 0, total = 0
        for (let i = 0; i < size; i++) {
            const at = queue[i], x = at % width, y = Math.floor(at / width)
            left = Math.min(left, x); right = Math.max(right, x)
            top = Math.min(top, y); bottom = Math.max(bottom, y)
            total += scores[at]
            for (const next of [x ? at - 1 : -1, x + 1 < width ? at + 1 : -1, at - width, at + width]) {
                if (next < 0 || next >= scores.length || visited[next] || scores[next] < .2) continue
                visited[next] = 1
                queue[size++] = next
            }
        }
        const w = right - left + 1, h = bottom - top + 1
        if (Math.min(w,h) < 3 || total < .4 * size) continue
        const pad = 1.4 * w * h / (2 * (w + h))
        boxes.push({left: Math.max(0, left-pad), right: Math.min(width, right+1+pad),
            top: Math.max(0, top-pad), bottom: Math.min(height, bottom+1+pad), center: (top+bottom)/2, height:h})
    }
    return boxes
}

async function readArtifactPage({width, height, pixels}, recognizeBox) {
    const detector = await ort.InferenceSession.create(new URL('detection.onnx', self.location.href).href,
        {executionProviders:['wasm']})
    const source = new OffscreenCanvas(width, height)
    source.getContext('2d').putImageData(new ImageData(pixels, width, height), 0, 0)
    const ratio = Math.min(1, 960 / Math.max(width, height))
    const round32 = n => Math.max(32, 32 * Math.round(n * ratio / 32))
    const w = round32(width), h = round32(height)
    const canvas = new OffscreenCanvas(w, h)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(source, 0, 0, w, h)
    const rgba = ctx.getImageData(0, 0, w, h).data, plane = w*h
    const normalized = new Float32Array(3*plane)
    const mean = [.485,.456,.406], std = [.229,.224,.225]
    for (let c=0; c<3; c++) for (let i=0; i<plane; i++)
        normalized[c*plane+i] = (rgba[i*4+2-c]/255-mean[c])/std[c]
    let output
    try {
        const result = await detector.run({[detector.inputNames[0]]:new ort.Tensor('float32',normalized,[1,3,h,w])})
        output = result[detector.outputNames[0]]
    } finally { await detector.release() }
    const [mapH, mapW] = output.dims.slice(-2)
    const boxes = artifactTextBoxes(output.data, mapW, mapH).sort((a,b) => a.center-b.center)
    const rows = []
    for (const box of boxes) {
        const last = rows.at(-1)
        if (last && box.center-last[0].center < Math.min(box.height,last[0].height)/2) last.push(box)
        else rows.push([box])
    }
    const lines = []
    for (const row of rows) {
        const words = []
        for (const b of row.sort((a,b) => a.left-b.left)) {
            words.push(await recognizeBox(source,b.left*width/mapW,b.top*height/mapH,
                (b.right-b.left)*width/mapW,(b.bottom-b.top)*height/mapH,''))
        }
        lines.push(words.join(' '))
    }
    return lines.join('\n')
}
