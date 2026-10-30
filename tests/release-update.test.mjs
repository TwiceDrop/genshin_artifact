import test from 'node:test'
import assert from 'node:assert/strict'
import {checkLatestRelease, compareVersions, createReleaseCheckCoordinator,
    isAutomaticUpdateEnabled, setAutomaticUpdateEnabled,
    AUTOMATIC_UPDATE_CHANGED_EVENT, RELEASE_API} from '../src/platform/release-update.mjs'
const githubOnly = fetcher => (url, options) => url.startsWith('https://cnb.cool/') ? Promise.reject(Error('CNB unavailable')) : fetcher(url, options)

test('EA display and package versions compare consistently without offering an older stable release', async () => {
    assert.equal(compareVersions('v7.2.01EA', '7.2.1-EA'), 0)
    assert.equal(compareVersions('v7.2.02EA', '7.2.01EA'), 1)
    assert.equal(compareVersions('v7.1.12', '7.2.01EA'), -1)
    assert.equal(compareVersions('7.2.01unknown', '7.2.01EA'), null)
    for (const current of ['7.2.01EA', '7.2.1-EA']) {
        const calls = []
        const check = version => checkLatestRelease(current, async url => {
            calls.push(url)
            return {ok: true, json: async () => ({tag_name: version,
                html_url: 'https://github.com/TwiceDrop/genshin_artifact/releases/tag/' + version})}
        })
        assert.equal((await check('v7.1.12')).newer, false)
        assert.equal(calls.length, 2, 'an older CNB release must still be followed by GitHub')
        calls.length = 0
        assert.equal((await check('v7.2.02EA')).newer, true)
        assert.equal(calls.length, 1, 'a newer EA release from CNB completes the check')
    }
})

test('four-part and zero-padded release versions compare numerically', () => {
    assert.equal(compareVersions('v7.1.05','7.1.04'),1)
    assert.equal(compareVersions('7.1.04','v7.1.4'),0)
    assert.equal(compareVersions('v7.1.10','7.1.09'),1)
    assert.equal(compareVersions('unknown','7.1.04'),null)
})

test('new release returns notes and official release URL', async () => {
    const fetchImpl = async (url, options) => {
        assert.equal(url,RELEASE_API)
        assert.equal(options.headers.Accept,'application/vnd.github+json')
        return {ok:true,json:async()=>({tag_name:'v7.1.05',
            html_url:'https://github.com/TwiceDrop/genshin_artifact/releases/tag/v7.1.05',
            body:'修复配装计算',assets:[]})}
    }
    const release = await checkLatestRelease('7.1.04',githubOnly(fetchImpl))
    assert.equal(release.newer,true)
    assert.equal(release.notes,'修复配装计算')
    assert.equal(release.downloadUrl,release.url)
})

test('Android chooses the official APK asset while web uses the release page', async () => {
    const release = {tag_name:'v7.1.05',
        html_url:'https://github.com/TwiceDrop/genshin_artifact/releases/tag/v7.1.05',
        assets:[
            {name:'fake.apk',browser_download_url:'https://example.com/fake.apk'},
            {name:'genshin_artifact_V7.1.05_android.apk',browser_download_url:'https://github.com/TwiceDrop/genshin_artifact/releases/download/v7.1.05/genshin_artifact_V7.1.05_android.apk'},
        ]}
    const fetchImpl = githubOnly(async () => ({ok:true,json:async()=>release}))
    assert.equal((await checkLatestRelease('v7.1.04',fetchImpl,true)).downloadUrl,release.assets[1].browser_download_url)
    assert.equal((await checkLatestRelease('v7.1.04',fetchImpl,false)).downloadUrl,release.html_url)
    release.assets.pop()
    assert.equal((await checkLatestRelease('v7.1.04',fetchImpl,true)).downloadUrl,release.html_url)
});

test('manual check shares an automatic in-flight request and receives its result or error', async () => {
    let calls=0, resolve
    const fetchImpl=()=>{calls++;return new Promise(r=>{resolve=r})}
    const run=createReleaseCheckCoordinator('v7.1.04',fetchImpl)
    const automatic=run(),manual=run()
    assert.strictEqual(automatic,manual)
    assert.equal(calls,1)
    resolve({ok:true,json:async()=>({tag_name:'v7.1.05',
        html_url:'https://github.com/TwiceDrop/genshin_artifact/releases/tag/v7.1.05'})})
    assert.equal((await manual).newer,true)
    await automatic

    const failure=new Error('network unavailable')
    const failedRun=createReleaseCheckCoordinator('v7.1.04',async()=>{throw failure})
    const first=failedRun(),second=failedRun()
    assert.strictEqual(first,second)
    await assert.rejects(second,error=>error.message.includes(failure.message))
    await assert.rejects(first,error=>error.message.includes(failure.message))
});

test('release checker does not trust external download links or malformed versions', async () => {
    const response = data => githubOnly(async () => ({ok:true,json:async()=>data}))
    await assert.rejects(checkLatestRelease('7.1.04',response({tag_name:'v7.1.05',html_url:'https://example.com/fake'})),/地址无效/)
    await assert.rejects(checkLatestRelease('7.1.04',response({tag_name:'v7.1.05',html_url:'https://github.com/TwiceDrop/genshin_artifact/releases/../issues/1'})),/地址无效/)
    await assert.rejects(checkLatestRelease('7.1.04',response({tag_name:'latest',html_url:'https://github.com/TwiceDrop/genshin_artifact/releases/tag/latest'})),/版本号无法识别/)
})

test('declining keeps prompts enabled until the user opts out', () => {
    const values = new Map()
    const storage = {getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)}
    assert.equal(isAutomaticUpdateEnabled(storage),true)
    setAutomaticUpdateEnabled(false,storage)
    assert.equal(isAutomaticUpdateEnabled(storage),false)
    setAutomaticUpdateEnabled(true,storage)
    assert.equal(isAutomaticUpdateEnabled(storage),true)
})

test('preference changes notify an open About page and failed persistence is reported', () => {
    const previous=globalThis.window,events=[]
    const target=new EventTarget(),values=new Map()
    target.addEventListener(AUTOMATIC_UPDATE_CHANGED_EVENT,()=>events.push('changed'))
    globalThis.window=target
    try {
        const storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)}
        assert.equal(setAutomaticUpdateEnabled(false,storage),true)
        assert.equal(isAutomaticUpdateEnabled(storage),false)
        assert.deepEqual(events,['changed'])
        assert.equal(setAutomaticUpdateEnabled(false,{setItem(){throw Error('storage disabled')}}),false)
        assert.deepEqual(events,['changed'])
    } finally { globalThis.window=previous }
})
