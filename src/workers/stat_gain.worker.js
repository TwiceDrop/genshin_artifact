import { useMona } from '../wasm/mona'
import { computeCurve, createDamageEvaluator, validateOptions } from '../algorithms/stat-gain/curve.mjs'

self.onmessage = async ({ data }) => {
    try {
        validateOptions(data.options)
        const mona = await useMona()
        const evaluator = createDamageEvaluator(mona, data.input, data.reaction, data.fumo, data.options.stats, data.options.tier)
        const result = computeCurve(evaluator.evaluate, data.options, (point, evaluations) => {
            self.postMessage({ type: 'progress', point: { ...point, panel: evaluator.panel(point.allocation) }, evaluations })
        })
        self.postMessage({ type: 'done', evaluations: result.evaluations })
    } catch (error) {
        self.postMessage({ type: 'error', message: error.message || String(error) })
    }
}
