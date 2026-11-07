import {reactive} from 'vue'
import {ElMessage} from 'element-plus'
import backend from './backend'
import {useAccountStore} from './pinia/account'
import {createCalculationHistory} from '../algorithms/calculation-history.mjs'

export const calculationState=reactive<any>({accounts:{},active:null})
export const calculationHistory=createCalculationHistory({storage:backend,state:calculationState,
    notify:(type:'error'|'success',message:string,accountId:number)=>{if(useAccountStore().currentAccountId.value===accountId)ElMessage({type,message})},
})
