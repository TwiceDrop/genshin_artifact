import {reactive, ref} from 'vue'
import backend from './backend'
import {useAccountStore} from './pinia/account'
import {createCalculationHistory} from '../algorithms/calculation-history.mjs'

export const calculationState=reactive<any>({accounts:{},active:null})
type CalculationNoticeTone = 'error' | 'success' | 'warning' | 'info'
export const calculationNotices = ref<{ id: number; type: CalculationNoticeTone; message: string }[]>([])
let nextNoticeId = 0

export function showCalculationNotice(type: CalculationNoticeTone, message: string) {
    calculationNotices.value.push({ id: ++nextNoticeId, type, message })
}

export function dismissCalculationNotice(id: number) {
    calculationNotices.value = calculationNotices.value.filter(notice => notice.id !== id)
}

export const calculationHistory=createCalculationHistory({storage:backend,state:calculationState,
    notify:(type:'error'|'success',message:string,accountId:number)=>{
        if (useAccountStore().currentAccountId.value === accountId) {
            showCalculationNotice(type, message)
        }
    },
})
