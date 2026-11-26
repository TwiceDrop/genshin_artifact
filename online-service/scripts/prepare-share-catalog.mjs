// Public readers only need character names, elements and action/parameter labels.
import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { TEAM_ACTION_CATALOG } from '../../beta-data/team-engine/action-catalog.mjs'
import characters from '../../src/assets/_gen_character.js'
import locale from '../../src/i18n/generated/zh-cn.json' with { type: 'json' }

const catalog = Object.fromEntries(Object.entries(TEAM_ACTION_CATALOG).map(([id, entries]) => [
    id, { name: locale[characters[id].nameLocale], element: characters[id].element,
        actions: entries.map(({ id, label, parameters }) => ({ id, label, parameters })) },
]))
await writeFile(new URL('../static/share-catalog.json', import.meta.url), JSON.stringify(catalog, null, 2) + '\n')

const roles = Object.fromEntries(Object.entries(characters).map(([key, role]) => [
    key, { name:locale[role.nameLocale], element:role.element,
        portrait:existsSync(new URL('../static/share-portraits/'+key+'.webp', import.meta.url)) },
]))
await writeFile(new URL('../static/share-roles.json', import.meta.url), JSON.stringify(roles, null, 2) + '\n')
