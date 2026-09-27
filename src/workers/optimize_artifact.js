import { initializeSingleOptimizeWorker } from './single-optimize-handler.mjs'
initializeSingleOptimizeWorker(self, () => import('mona'))
