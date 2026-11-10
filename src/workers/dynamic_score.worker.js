import {useMona} from '../wasm/mona'
import {createMonaScoreService} from '../algorithms/artifact-score/service.mjs'

let servicePromise
self.onmessage=async ({data})=>{
    try {
        servicePromise??=useMona().then(createMonaScoreService)
        const service=await servicePromise
        const result=service.score(data.request,progress=>self.postMessage({type:'progress',id:data.id,progress}))
        self.postMessage({type:'result',id:data.id,result})
    } catch(error) {self.postMessage({type:'error',id:data.id,error:{message:error.message||String(error),stack:error.stack,phase:'dynamic-score'}})}
}
