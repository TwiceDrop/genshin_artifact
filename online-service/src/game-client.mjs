import { communityClient } from '../../server/hoyolab.mjs'

export function createGameClient(platform, credential, { signal } = {}) {
    const fetcher = (url, options = {}) => fetch(url, {
        ...options,
        signal: signal && options.signal ? AbortSignal.any([signal, options.signal]) : signal || options.signal,
    })
    const client = communityClient(platform, fetcher)
    Object.assign(client, credential)
    return client
}
export function credentialsFrom(client) {
    return { cookie: client.cookie, device: client.device, deviceSeed: client.deviceSeed, deviceFp: client.deviceFp }
}
