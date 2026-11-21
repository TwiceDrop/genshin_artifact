import test from 'node:test'
import assert from 'node:assert/strict'
import {shouldShowWebVersionNotice} from '../src/platform/web-version.mjs'

test('hosted browser shows the migration notice regardless of port', () => {
    for (const location of ['https://example.test/', 'http://example.test:4184/']) {
        const {hostname} = new URL(location)
        assert.equal(shouldShowWebVersionNotice({native: false, hostname}), true, location)
    }
})

test('ZIP, Tauri, development servers and Android skip the migration notice', () => {
    for (const location of ['http://127.0.0.1:4184/', 'http://localhost:4184/', 'http://[::1]:4184/', 'http://127.0.0.1:47504/', 'http://localhost:4183/']) {
        const {hostname} = new URL(location)
        assert.equal(shouldShowWebVersionNotice({native: false, hostname}), false, location)
    }
    assert.equal(shouldShowWebVersionNotice({native: true, hostname: 'example.test'}), false)
})
