import {initializePanelOptimizeWorker} from './panel-optimize-handler.mjs'
import {optimizePanelWithBounds} from '../../beta-data/panel-program.mjs'
import nativeFunctions from '../../beta-data/team-dps-native/native-functions.json'
import extensionFunctions from '../../beta-data/team-dps-native/extension-functions.json'
import extensionSlots from '../../beta-data/team-dps-native/extension-slots.json'

const resources={libraries:[nativeFunctions,extensionFunctions],extensionSlots}
initializePanelOptimizeWorker(self,()=>import('../wasm/team-dps-native-api.mjs'),
    (api,input,artifacts,onProgress)=>optimizePanelWithBounds(api,input,artifacts,resources,onProgress))
