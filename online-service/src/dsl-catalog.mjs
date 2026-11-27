import { readFile } from 'node:fs/promises'
import characters from '../../src/assets/_gen_character.js'
import weapons from '../../src/assets/_gen_weapon.js'
import buffs from '../../src/assets/_gen_buff.js'
import skillNames from '../../beta-data/dsl-skill-names.json' with { type: 'json' }
import { validateDslDocument } from '../../src/algorithms/dsl-library.mjs'
import roles from '../static/share-roles.json' with { type: 'json' }
import { isPickerCharacter } from '../../src/import/character-summary.mjs'
import { sameSecret } from './crypto.mjs'
import { ApiError, invalid } from './errors.mjs'

const catalog = { characters, weapons, buffs, skillNames }
const supportedRoles = new Map(Object.entries(roles)
    .filter(([id, role]) => role.name && Object.hasOwn(skillNames, id) && isPickerCharacter(id, role.name))
    .map(([id, role]) => [id, { id, name: role.name }]))
const entryId = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/
export const DSL_CATALOG_BODY_LIMIT = 524288

function requireRole(character) {
    if (!supportedRoles.has(character)) throw invalid('DSL 条目的角色无法识别')
}

export function createDslCatalog({ pool, config, clock = () => new Date() }) {
    function authorize(authorization) {
        const expected = config.dslAdminToken
        const token = authorization?.match(/^Bearer (\S+)$/i)?.[1]
        if (!expected) throw new ApiError(503, 'DSL_ADMIN_DISABLED', '未配置 DSL 管理口令')
        if (!token || !sameSecret(token, expected)) throw new ApiError(401, 'UNAUTHORIZED', 'DSL 管理口令不正确')
    }

    return {
        authorize,
        async list() {
            const { rows } = await pool.query('SELECT character, revision, published_at, json_array_length(entries) AS count FROM dsl_catalog')
            const byRole = new Map(rows.map(row => [row.character, row]))
            return { roles: [...supportedRoles.values()].map(role => ({
                ...role, revision: byRole.get(role.id)?.revision ?? 0,
                count: byRole.get(role.id)?.count ?? 0, publishedAt: byRole.get(role.id)?.published_at ?? null,
            })) }
        },
        async read(character) {
            requireRole(character)
            const { rows } = await pool.query('SELECT revision, entries, published_at FROM dsl_catalog WHERE character=$1', [character])
            const row = rows[0]
            return { character, revision: row?.revision ?? 0, publishedAt: row?.published_at ?? null, entries: row?.entries ?? [] }
        },
        async publish(character, { revision, entries }) {
            requireRole(character)
            if (!Number.isSafeInteger(revision) || revision < 0 || revision >= 2147483647 || !Array.isArray(entries)) {
                throw invalid('DSL 发布版本或条目列表无效')
            }
            const ids = new Set()
            const documents = entries.map(entry => {
                if (typeof entry?.id !== 'string' || !entryId.test(entry.id) || ids.has(entry.id) || entry.document?.character !== character) {
                    throw invalid('DSL 条目标识、角色或重复项无效')
                }
                ids.add(entry.id)
                try { return { id: entry.id, document: validateDslDocument(entry.document, catalog) } }
                catch (error) { throw invalid(error.message) }
            })
            const values = [character, JSON.stringify(documents), clock()]
            const { rows } = revision === 0
                ? await pool.query('INSERT INTO dsl_catalog(character, entries, published_at, revision) VALUES($1,$2,$3,1) ON CONFLICT DO NOTHING RETURNING revision, published_at', values)
                : await pool.query('UPDATE dsl_catalog SET entries=$2, published_at=$3, revision=revision+1 WHERE character=$1 AND revision=$4 RETURNING revision, published_at', [...values, revision])
            if (!rows.length) throw new ApiError(409, 'DSL_REVISION_CONFLICT', '线上版本已变更，请刷新后再发布')
            return { character, revision: rows[0].revision, publishedAt: rows[0].published_at, entries: documents }
        },
    }
}

const adminFiles = new Map([
    ['/admin/dsl', ['dsl-admin.html', 'text/html; charset=utf-8']],
    ['/admin/dsl.js', ['dsl-admin.js', 'text/javascript; charset=utf-8']],
    ['/admin/dsl.css', ['dsl-admin.css', 'text/css; charset=utf-8']],
])

export async function dslAdminPageFile(path) {
    const file = adminFiles.get(path)
    if (!file) return null
    return { type: file[1], body: await readFile(new URL('../static/' + file[0], import.meta.url)) }
}
