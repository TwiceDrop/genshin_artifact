// One worker per calculation. Always release its timer and worker on every exit.
export function runSingleOptimizeWorker(worker, optimizeConfig, artifacts, timeout = 600000, onDebug) {
    const trace = event => { try { onDebug?.(event) } catch { /* Diagnostics must not interrupt calculation. */ } }
    trace({phase:'worker-created'})
    return new Promise((resolve, reject) => {
        let settled = false, sent = false
        const finish = (error, result) => {
            if (settled) return
            settled = true
            clearTimeout(timer)
            worker.onmessage = worker.onerror = worker.onmessageerror = null
            worker.terminate()
            trace({phase:error?'failed':'completed',message:error?.message,resultCount:result?.length})
            if (error) reject(error)
            else resolve(result)
        }
        const timer = setTimeout(() => finish(new Error('计算超时，请减少候选圣遗物或调整筛选后重试。')), timeout)
        worker.onmessage = ({data}) => {
            if (data?.type === 'debug') { trace(data.event); return }
            if (data?.type === 'ready') {
                if (sent) return
                sent = true
                trace({phase:'worker-ready',initializationMs:data.initializationMs})
                try { worker.postMessage({optimizeConfig, artifacts, debug:typeof onDebug==='function'}); trace({phase:'parameters-sent',candidateCount:artifacts.length}) }
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
