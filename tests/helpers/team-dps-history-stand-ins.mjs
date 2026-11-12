// TeamDpsPage runs calculations through calculation history (7.2.03). Tests that evaluate the page script
// use the real history module with memory storage, plus the history and progress helpers the page imports.
import {reactive} from 'vue'
import {createCalculationHistory,historyMembers,buildIds} from '../../src/algorithms/calculation-history.mjs'
import {teamDpsProgressText,teamDpsProgressIndeterminate} from '../../beta-data/team-dps-progress.mjs'

export function teamDpsHistoryStandIns() {
    const saved = new Map(), calculationState = reactive({accounts: {}, active: null})
    const calculationHistory = createCalculationHistory({
        storage: {getItem: async key => structuredClone(saved.get(key)), setItem: async (key, value) => { saved.set(key, structuredClone(value)) }},
        state: calculationState, notify: () => {},
    })
    return {calculationHistory, calculationState, historyMembers, buildIds, teamDpsProgressText, teamDpsProgressIndeterminate}
}
