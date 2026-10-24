// One worker per calculation. Cancellation and every terminal event release it.
export function runSingleOptimizeWorker(worker, optimizeConfig, artifacts, {onDebug, onProgress, signal} = {}) {
    const trace = event => { try { onDebug?.(event) } catch { /* Diagnostics must not interrupt calculation. */ } }
    trace({phase:'worker-created'})
    return new Promise((resolve, reject) => {
        let settled = false, sent = false
        const finish = (error, result) => {
            if (settled) return
            settled = true
            signal?.removeEventListener('abort', abort)
            worker.onmessage = worker.onerror = worker.onmessageerror = null
            worker.terminate()
            trace({phase:error?.name==='AbortError'?'cancelled':error?'failed':'completed',message:error?.message,resultCount:result?.length})
            if (error) reject(error)
            else resolve(result)
        }
        const abort = () => finish(new DOMException('计算已取消', 'AbortError'))
        signal?.addEventListener('abort', abort, {once:true})
        if (signal?.aborted) { abort(); return }
        worker.onmessage = ({data}) => {
            if (settled) return
            if (data?.type === 'progress') { onProgress?.(data.data); return }
            if (data?.type === 'debug') { trace(data.event); return }
            if (data?.type === 'ready') {
                if (sent) return
                sent = true
                trace({phase:'worker-ready',initializationMs:data.initializationMs})
                try { worker.postMessage({optimizeConfig, artifacts, debug:typeof onDebug==='function',progress:typeof onProgress==='function'}); trace({phase:'parameters-sent',candidateCount:artifacts.length}) }
                catch (error) { finish(new Error('无法发送配装参数：' + (error.message || String(error)))) }
            } else if (data?.type === 'error') {
                trace({phase:'worker-error',error:data.error})
                const message = data.error?.message || '计算线程返回未知错误'
                finish(new Error((data.error?.phase === 'initialization' ? '计算内核加载失败：' : '配装计算失败：') + message))
            } else if (data?.type === 'results' && Array.isArray(data.data?.results)) {
                finish(null, data.data.results)
            } else {
                trace({phase:'invalid-worker-message',type:data?.type})
                finish(new Error('计算线程返回了无法识别的结果，请刷新页面后重试。'))
            }
        }
        worker.onerror = event => {
            event.preventDefault?.()
            trace({phase:'worker-runtime-error',message:event.message,filename:event.filename,line:event.lineno,column:event.colno,stack:event.error?.stack})
            finish(new Error('计算线程异常：' + (event.message || '未返回详情；请刷新页面，检查本地服务是否仍在运行。')))
        }
        worker.onmessageerror = () => finish(new Error('无法读取计算线程结果，请刷新页面后重试。'))
    })
}
