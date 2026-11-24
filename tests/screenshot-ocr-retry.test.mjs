import assert from 'node:assert/strict'
import test from 'node:test'
import { recognizeWithBackup } from '../src/import/screenshot-ocr-retry.mjs'

const signal = new AbortController().signal
const engines = ['primary', 'backup']
const flower = () => ({setName:'set', position:'flower', star:2, level:0,
    mainTag:{name:'hp', value:'100'}, normalTags:[]})
const primary = {drafts:[flower()]}

test('a complete reading with level zero only invokes the primary engine', async () => {
    let retries = 0
    const result = await recognizeWithBackup(signal, () => primary, () => { retries++ }, engines)
    assert.equal(result, primary)
    assert.equal(retries, 0)
})

test('reconcile the same printed row even when the other engine skipped an earlier row', async () => {
    const region = {top:2, left:.5}
    const first = {...flower(), region, normalTags:[{row:1,name:'def',value:'19'},{row:3,name:'crit',value:''}]}
    const second = {...flower(), region, normalTags:[{row:2,name:'em',value:'23'},{row:3,name:'crit',value:'3.9'}]}
    const read = await recognizeWithBackup(signal, () => ({drafts:[first]}), () => ({drafts:[second]}), engines)
    assert.deepEqual(read.drafts[0].normalTags, [first.normalTags[0], ...second.normalTags])
    assert.equal(first.normalTags[1].value, '')
})

test('cancellation stops the retry and two failed engines retain both diagnoses', async () => {
    const controller = new AbortController()
    let retries = 0
    await assert.rejects(recognizeWithBackup(controller.signal, () => {
        controller.abort()
        return {drafts:[]}
    }, () => { retries++ }, engines), {name:'AbortError'})
    assert.equal(retries, 0)
    await assert.rejects(recognizeWithBackup(signal, () => {throw Error('model load')},
        () => {throw Error('worker init')}, engines), /primary.*model load.*backup.*worker init/)
})
