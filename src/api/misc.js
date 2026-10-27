import axios from "axios"
import { client } from "./client"


export async function createComputeResult(characterInterface, weaponInterface, buffsInterface, targetFunctionInterface, resultArtifacts) {
    const config = {
        character: characterInterface,
        weapon: weaponInterface,
        buffs: buffsInterface,
        target_function: targetFunctionInterface
    }

    const data = {
        config,
        result_artifacts: resultArtifacts
    }

    return await client.post("/compute_result/create", data)
}

let computeResultCache = null
let lastComputeResultTime = null
export async function getComputeResultAnalysis() {
    if (process.env.MONA_MOBILE) {
        const [{ usePresetStore }, { useArtifactStore }, { convertArtifact }, { localDatabase }] = await Promise.all([
            import('@/store/pinia/preset'), import('@/store/pinia/artifact'), import('@/utils/converter'), import('@/algorithms/local-database.mjs')])
        return localDatabase(usePresetStore().presets.value, useArtifactStore().artifacts.value, convertArtifact)
    }
    const refresh = async () => {
        const response = await client.get("/compute_result/analysis")
        if (response.status !== 200) {
            throw new Error(response.statusText)
        }
        const data = response.data
        if (!data || !data.success) {
            throw new Error(data.msg ?? "")
        }

        computeResultCache = data.data
        lastComputeResultTime = new Date()
        return data.data
    }

    if (!computeResultCache) {
        return await refresh()
    } else {
        const now = new Date()
        if (now - lastComputeResultTime >= 60 * 60 * 1000) {
            return await refresh()
        } else {
            return computeResultCache
        }
    }
}
