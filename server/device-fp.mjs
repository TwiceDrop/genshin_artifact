// CN record compatibility profile follows TRSS Yunzai-genshin model/mys/apiTool.js.
// The ID/seed belong to this local session; no phone identifiers are collected.
export function deviceFpBody(device, seed) {
    return {
        seed_id: seed, device_id: device, platform: '1', seed_time: String(Date.now()),
        app_name: 'bbs_cn', device_fp: '38d7ee834d1e9',
        ext_fields: JSON.stringify({
            proxyStatus: '0', accelerometer: '-0.159515x-0.830887x-0.682495', ramCapacity: '3746',
            IDFV: device, gyroscope: '-0.191951x-0.112927x0.632637', isJailBreak: '0', model: 'iPhone12,5',
            ramRemain: '115', chargeStatus: '1', networkType: 'WIFI', vendor: '--', osVersion: '17.0.2',
            batteryStatus: '50', screenSize: '414×896', cpuCores: '6', appMemory: '55', romCapacity: '488153',
            romRemain: '157348', cpuType: 'CPU_TYPE_ARM64', magnetometer: '-84.426331x-89.708435x-37.117889',
        }),
    }
}
