// @ts-ignore
import {buffData} from "@buff"
import {RandomIDProvider} from "@/utils/idProvider"
import type {IBuffWasm} from "@/types/preset"
import { POLESTAR_FIELD, polestarFieldState, updatePolestarField } from '@/algorithms/polestar-field.mjs'

export interface BuffEntry {
    id: number,
    name: string,
    config: any,
    lock: boolean,
    source_id?: string,
    source_effect?: string,
}

export function useBuff() {
    const buffs = ref<BuffEntry[]>([])

    const idGenerator = new RandomIDProvider()
    const polestarState = computed(() => polestarFieldState(buffs.value))
    const polestarEnabled = computed({
        get: () => polestarState.value.enabled,
        set: (enabled: boolean) => { buffs.value = updatePolestarField(buffs.value, { enabled }, () => idGenerator.generateId()) },
    })
    const polestarStacks = computed({
        get: () => polestarState.value.stacks,
        set: (stacks: number) => { if (stacks !== undefined && stacks !== null) buffs.value = updatePolestarField(buffs.value, { stacks }, () => idGenerator.generateId()) },
    })

    const buffsUnlocked = computed((): BuffEntry[] => {
        return buffs.value.filter(e => !e.lock)
    })

    const buffsInterface = computed((): IBuffWasm[] => {
        let temp = []
        for (let buff of buffsUnlocked.value) {
            temp.push({
                name: buff.name,
                config: buff.config,
                ...(buff.source_id ? {source_id: buff.source_id} : {}),
                ...(buff.source_effect ? {source_effect: buff.source_effect} : {}),
            })
        }
        return temp
    })

    function addBuff(name: string, configured?: any) {
        if (name === POLESTAR_FIELD) { polestarEnabled.value = true; return }
        const data = buffData[name]
        let defaultConfig: any = {}
        for (let c of data.config) {
            defaultConfig[c.name] = c.default
        }

        let config
        if (data.config.length === 0) {
            config = "NoConfig"
        } else {
            config = {
                [name]: defaultConfig
            }
        }

        buffs.value.push({
            name,
            config: configured === undefined ? config : JSON.parse(JSON.stringify(configured)),
            id: idGenerator.generateId(),
            lock: false
        })
    }

    function deleteBuff(id: number) {
        const index = buffs.value.findIndex(e => e.id === id)
        buffs.value.splice(index, 1)
    }

    function toggleBuff(id: number) {
        const index = buffs.value.findIndex(e => e.id === id)
        const v = buffs.value[index].lock
        buffs.value[index].lock = !v
    }

    return {
        buffs,

        buffsInterface,
        polestarEnabled,
        polestarStacks,

        addBuff,
        deleteBuff,
        toggleBuff,
    }
}
