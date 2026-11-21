import test from 'node:test'
import assert from 'node:assert/strict'
import {isHostedWebVersion} from '../src/platform/web-version.mjs'

test('web version notice shows only on the hosted web build', () => {
    assert.equal(isHostedWebVersion({native: false, hostname: 'example.github.io'}), true)
    assert.equal(isHostedWebVersion({native: false, hostname: '127.0.0.1'}), false)
    assert.equal(isHostedWebVersion({native: false, hostname: 'localhost'}), false)
    // Android WebView serves from https://localhost, and is native either way.
    assert.equal(isHostedWebVersion({native: true, hostname: 'localhost'}), false)
    assert.equal(isHostedWebVersion({native: true, hostname: 'example.com'}), false)
})
