import { BREAKS } from '../import/miyoushe.mjs'

export const highCharacterLevels = [90, 95, 100]

export function characterLevelLabel(level, ascend) {
    return BREAKS.includes(level) ? level + (ascend ? '+' : '-') : String(level)
}
