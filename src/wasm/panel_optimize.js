import {runSingleOptimizeWorker} from './single-optimize-task.mjs'

export function wasmPanelOptimize(config,artifacts,options={}) {
    const worker=new Worker(new URL('@worker/panel_optimization.js',import.meta.url))
    return runSingleOptimizeWorker(worker,config,artifacts,options)
}
