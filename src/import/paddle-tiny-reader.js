// The battle-record parser reads one pre-cropped line at a time.
export async function withPaddleTiny(base, signal, read) {
    signal.throwIfAborted()
    const worker = new Worker(base + 'paddle-tiny/reader.js')
    let pending, alphabet = ''
    function request(message, transfer = []) {
        signal.throwIfAborted()
        return new Promise((resolve, reject) => {
            pending = {resolve, reject}
            worker.postMessage(message, transfer)
        })
    }
    worker.onmessage = ({data}) => {
        if (data.error) pending.reject(new Error(data.error))
        else pending.resolve(data.text)
        pending = undefined
    }
    worker.onerror = event => pending?.reject(new Error(event.message))
    const abort = () => pending?.reject(signal.reason)
    signal.addEventListener('abort', abort, {once: true})
    try {
        await request({init: true})
        function recognize(canvas, page) {
            const {width, height} = canvas
            const {data} = canvas.getContext('2d').getImageData(0, 0, width, height)
            return request({width, height, pixels: data, alphabet, page}, [data.buffer])
        }
        return await read({
            configure(_language, characters) { alphabet = characters },
            readLine: canvas => recognize(canvas, false),
            readPage: canvas => recognize(canvas, true),
        })
    } finally {
        signal.removeEventListener('abort', abort)
        worker.terminate()
    }
}
