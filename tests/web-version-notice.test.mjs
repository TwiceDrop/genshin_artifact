import test from 'node:test'
import assert from 'node:assert/strict'
import {shouldShowWebVersionNotice} from '../src/platform/web-version.mjs'

test('development browser sessions skip the migration notice', () => {
    assert.equal(shouldShowWebVersionNotice({development: true, native: false, tauri: false}), false)
})

test('production browser sessions show the migration notice, including both local Windows launchers', () => {
    assert.equal(shouldShowWebVersionNotice({development: false, native: false, tauri: false}), true)
})

test('Tauri and native Android skip the browser migration notice', () => {
    assert.equal(shouldShowWebVersionNotice({native: false, tauri: true}), false)
    assert.equal(shouldShowWebVersionNotice({native: true, tauri: false}), false)
})
