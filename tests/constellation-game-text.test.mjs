import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gameTextRuns } from '../src/import/game-text.mjs'

const catalog = JSON.parse(readFileSync(new URL('../src/assets/character-constellations.json', import.meta.url)))

test('Odette C1 keeps the game emphasis, cryo color and paragraph break', () => {
    const runs = gameTextRuns(catalog.Odette.stages[0].effect)
    assert.ok(runs.some(r => r.text === '柔板·破晓终奏' && r.tone === 'gold'))
    assert.ok(runs.some(r => r.text === '冰元素范围伤害' && r.tone === 'cryo'))
    assert.ok(runs.some(r => r.text.includes('\n\n此外')))
})

test('all roster effects render their complete text without source markup', () => {
    const tones = new Set()
    for (const { stages } of Object.values(catalog)) {
        for (const stage of stages) {
            const runs = gameTextRuns(stage.effect)
            const text = runs.map(r => r.text).join('')
            assert.equal(text, stage.effect.replace(/<[^>]+>|\{[^}]+\}/g, ''), stage.name)
            assert.doesNotMatch(text, /\*\*|<\/?color|\{\/?LINK/)
            for (const run of runs) if (run.tone) tones.add(run.tone)
        }
    }
    assert.deepEqual([...tones].sort(), ['anemo','cryo','dendro','electro','geo','gold','hydro','pyro'])
    assert.deepEqual(gameTextRuns('触发**效果**。'), [{ text: '触发' }, { text: '效果', tone: 'gold' }, { text: '。' }])
})
