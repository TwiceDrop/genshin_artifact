import { runSingleOptimizeWorker } from './single-optimize-task.mjs'

export async function wasmSingleOptimize(optimizeConfig, artifacts, timeout = 600000, onDebug) {
    onDebug?.({phase:'worker-creating',entry:'optimize_artifact.js'})
    // Webpack recognizes workers only when new URL is directly inside new Worker.
    // Extracting the URL into a variable emits an unbundled module as a raw asset.
    const worker = new Worker(new URL('@worker/optimize_artifact.js', import.meta.url))
    return runSingleOptimizeWorker(worker, optimizeConfig, artifacts, timeout, onDebug)
}