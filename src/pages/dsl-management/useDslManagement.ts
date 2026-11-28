import { computed, onActivated, reactive, shallowRef, watch } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { characterData } from '@/assets/character'
import { weaponByType, weaponData } from '@/assets/weapon'
import { buffData, buffFlat } from '@/assets/buff'
import { targetFunctionByCharacterName } from '@/assets/target_function'
import { useI18n } from '@/i18n/i18n'
import { useCharacter } from '@/composables/character'
import { newEnemyConfig } from '@/composables/enemy'
import { getWeaponDefaultConfigWasmInterface } from '@/utils/weapon'
import { deepCopy, downloadString } from '@/utils/common'
import { isPickerCharacter } from '@/import/character-summary.mjs'
import { useMona } from '@/wasm/mona'
import { useAccountStore } from '@/store/pinia/account'
import { cloudApi } from '@/platform/cloud.mjs'
import { openContentShare } from '@/components/share/content-share.mjs'
import { listDslEntries, removeDslEntry, saveDslEntry, updateDistributedDslEntries } from '@/store/dsl-library'
import { generateDsl } from '@/algorithms/dsl-generator.mjs'
import { dslShareId, exportDslDocument, importDslDocument, validateDslDocument } from '@/algorithms/dsl-library.mjs'
import type { DslLibraryDocument, DslLibraryEntry, DslNamedBuff } from '@/types/dsl-library'
import type { IDslGeneratorState } from '@/types/preset'
import type { IWeapon, WeaponType } from '@/types/weapon'
import skillNames from '../../../beta-data/dsl-skill-names.json'

interface Editor {
    id: string
    existing: boolean
    name: string
    description: string
    source: string
    mode: 'source' | 'generator'
    generator: IDslGeneratorState
    weapon: string
    buffs: DslNamedBuff[]
}

interface ConfigField {
    name: string
    default: unknown
}

interface CatalogLabel {
    name: string
    nameLocale: number
}

type CharacterCatalogEntry = CatalogLabel & { avatar: string; element: string; star: number; weapon: WeaponType; config: ConfigField[] }
type WeaponCatalogEntry = CatalogLabel
type BuffCatalogEntry = CatalogLabel & { config: ConfigField[] }
type TargetCatalogEntry = CatalogLabel & { description: number | null }

const roles = characterData as Record<string, CharacterCatalogEntry>
const weaponsByType = weaponByType as Record<WeaponType, WeaponCatalogEntry[]>
const buffsByName = buffData as Record<string, BuffCatalogEntry>
const targetFunctions = targetFunctionByCharacterName as Record<string, TargetCatalogEntry[]>

const defaultWeapon = (name: string): IWeapon => ({
    name, level: 90, ascend: false, refine: 1, params: getWeaponDefaultConfigWasmInterface(name),
})
const newEntryId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('')
const hasWeaponOverrides = (generator: IDslGeneratorState | null) => generator?.states?.some(state => state.weapon) === true
const buffIdentity = ({ name, config }: DslNamedBuff) => JSON.stringify([name, config])

function generatorBuffs(generator: IDslGeneratorState | null): DslNamedBuff[] {
    const buffs = generator?.states?.flatMap(state => state.buffs) ?? []
    return [...new Map(buffs.map(buff => [buffIdentity(buff), buff])).values()]
}

export function useDslManagement() {
    const { ta } = useI18n()
    const account = useAccountStore()
    const roleDefaults = useCharacter()
    const eligibleRoles = computed(() => Object.values(roles).filter(role =>
        Object.prototype.hasOwnProperty.call(skillNames, role.name) && isPickerCharacter(role.name, ta(role.nameLocale))))
    const catalog = computed(() => ({ characters: Object.fromEntries(eligibleRoles.value.map(role => [role.name, role])),
        weapons: weaponData, buffs: buffData, skillNames }))
    const previewEnemy = newEnemyConfig()
    const mona = shallowRef<Awaited<ReturnType<typeof useMona>> | null>(null)
    const wide = useMediaQuery('(min-width: 1100px)')
    const list = shallowRef<DslLibraryEntry[]>([])
    let loadRevision = 0
    let contextAccount = account.currentAccountId.value

    const vm = reactive({
        character: roleDefaults.characterName.value,
        characterOptions: computed(() => eligibleRoles.value
            .map(role => ({ value: role.name, label: ta(role.nameLocale), avatar: role.avatar, element: role.element, star: role.star }))
            .sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'))),
        defaultFunction: computed(() => {
            const target = targetFunctions[selectedRole()]?.[0] ?? targetFunctions.common[0]
            return { title: ta(target.nameLocale), description: target.description == null ? '' : ta(target.description) }
        }),
        entries: computed(() => list.value.filter(entry => entry.character === selectedRole())),
        draft: null as Editor | null,
        deleteTarget: null as DslLibraryEntry | null,
        linkImportOpen: false,
        shareLink: '',
        loading: true,
        busy: false,
        error: '',
        onlineStatus: '',
        mona,
        wide,
        canSave: computed((): boolean => {
            const current = vm.draft
            return Boolean(current?.name.trim() && (current.mode === 'generator' || current.source.trim()))
        }),
        weaponOptions: computed(() => weaponsByType[roles[draft().generator.character].weapon]
            .map(weapon => ({ value: weapon.name, label: ta(weapon.nameLocale) }))),
        buffOptions: computed(() => (buffFlat as BuffCatalogEntry[]).map(buff => ({ value: buff.name, label: ta(buff.nameLocale) }))
            .sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'))),
        availableBuffs: computed(() => draft().buffs),
        generatorInput: computed(() => ({
            character: roleDefaults.characterInterface.value, weapon: defaultWeapon(draft().weapon),
            enemy: previewEnemy, buffs: [], artifacts: [], artifact_config: null,
        })),
        selectCharacter,
        openNew,
        openEdit,
        closeEditor,
        save,
        askDelete,
        closeDelete,
        confirmDelete,
        importFile,
        openLinkImport,
        closeLinkImport,
        importLink,
        exportEntry,
        shareEntry,
        updateOnline,
        selectWeapon,
        addBuff,
        removeBuff,
        updateBuff,
        buffLabel,
        buffConfigs,
    })

    function selectedRole(): string { return vm.character }
    function draft(): Editor { return vm.draft! }

    function showError(error: unknown) {
        vm.error = error instanceof Error ? error.message : String(error)
    }

    async function refresh(accountId: number) {
        const revision = ++loadRevision
        vm.loading = true
        try {
            const entries = await listDslEntries(accountId)
            if (revision === loadRevision) list.value = entries
        } catch (error) {
            if (revision === loadRevision) showError(error)
        } finally {
            if (revision === loadRevision) vm.loading = false
        }
    }

    watch([account.currentAccountId, account.reloadGeneration], ([id]) => {
        if (contextAccount !== id) {
            vm.draft = vm.deleteTarget = null
            vm.linkImportOpen = false
            vm.shareLink = ''
            vm.error = vm.onlineStatus = ''
            list.value = []
            contextAccount = id
        }
        void refresh(id)
    }, { immediate: true })

    onActivated(() => { if (!vm.loading && !vm.busy) void refresh(contextAccount) })
    void useMona().then(value => { mona.value = value }, showError)

    function selectCharacter(name: string) {
        vm.character = name
        vm.error = vm.onlineStatus = ''
    }

    function openNew() {
        const character = selectedRole()
        roleDefaults.characterName.value = character
        const weapon = weaponsByType[roles[character].weapon][0]
        vm.error = ''
        vm.draft = {
            id: newEntryId(), existing: false, name: '', description: '', mode: 'generator', source: '',
            generator: { character, entries: [] },
            weapon: weapon.name, buffs: [],
        }
    }

    function openEdit(entry: DslLibraryEntry) {
        vm.error = ''
        roleDefaults.characterName.value = entry.character
        vm.draft = {
            id: entry.id, existing: true, name: entry.name, description: entry.description ?? '',
            source: entry.source, mode: entry.generator ? 'generator' : 'source',
            generator: entry.generator ? deepCopy(entry.generator) : { character: entry.character, entries: [] },
            weapon: editingWeapon(entry) ?? weaponsByType[roles[entry.character].weapon][0].name,
            buffs: deepCopy(generatorBuffs(entry.generator)),
        }
    }

    function editingWeapon(entry: DslLibraryEntry): string | null {
        if (!hasWeaponOverrides(entry.generator)) return null
        // Development previews saved the weapon used by the editor in the conditions object.
        const previewRecord = entry as DslLibraryEntry & { conditions?: { weapon: IWeapon } }
        return entry.weapon ?? previewRecord.conditions?.weapon.name ?? null
    }

    function closeEditor() {
        if (vm.busy) return
        vm.draft = null
        vm.error = ''
    }

    function askDelete(entry: DslLibraryEntry) {
        vm.error = ''
        vm.deleteTarget = entry
    }

    function closeDelete() {
        if (vm.busy) return
        vm.deleteTarget = null
        vm.error = ''
    }

    async function run(action: (accountId: number) => Promise<void>) {
        if (vm.busy) return
        const id = contextAccount
        vm.busy = true
        vm.error = ''
        try {
            await action(id)
        } catch (error) {
            if (contextAccount === id) showError(error)
        } finally {
            vm.busy = false
        }
    }

    function acceptEntries(id: number, result: { entries?: DslLibraryEntry[]; mirrorError?: unknown }) {
        if (contextAccount !== id) return false
        if (!result.entries) throw new Error('DSL 条目或所属本地账户已删除')
        loadRevision++
        vm.loading = false
        list.value = result.entries
        if (result.mirrorError) {
            console.error(result.mirrorError)
            showError(new Error('DSL 已写入本机，目录镜像写入失败：' + String(result.mirrorError)))
        }
        return true
    }

    function save() {
        const current = draft()
        return run(async id => {
            const generator = current.mode === 'generator' ? deepCopy(current.generator) : null
            const description = current.description.trim()
            const document: DslLibraryDocument = {
                name: current.name.trim(),
                ...(description ? { description } : {}),
                character: current.generator.character,
                source: generator ? generateDsl(generator) : current.source,
                generator,
                weapon: hasWeaponOverrides(generator) ? current.weapon : null,
            }
            validateDslDocument(document, catalog.value)
            const next = await saveDslEntry(id, { ...document, id: current.id }, current.existing)
            if (acceptEntries(id, next)) vm.draft = null
        })
    }

    function confirmDelete() {
        const { id: entryId } = vm.deleteTarget!
        return run(async id => {
            const next = await removeDslEntry(id, entryId)
            if (acceptEntries(id, next)) vm.deleteTarget = null
        })
    }

    function importFile(file: File) {
        return run(async id => {
            const raw = await file.text()
            if (contextAccount !== id) return
            const document: DslLibraryDocument = importDslDocument(raw, catalog.value)
            await addImportedDocument(id, document)
        })
    }

    async function addImportedDocument(id: number, document: DslLibraryDocument) {
        const next = await saveDslEntry(id, { ...document, id: newEntryId() }, false)
        if (!acceptEntries(id, next)) return false
        vm.character = document.character
        return true
    }

    function openLinkImport() {
        vm.shareLink = vm.error = ''
        vm.linkImportOpen = true
    }

    function closeLinkImport() {
        if (vm.busy) return
        vm.linkImportOpen = false
        vm.shareLink = vm.error = ''
    }

    function importLink() {
        const link = vm.shareLink.trim()
        const generation = account.reloadGeneration.value
        return run(async accountId => {
            const config = await cloudApi('config')
            const id = dslShareId(link, config.url)
            const context = { url: config.url, userId: config.user?.id }
            const result = await cloudApi('v1/dsl-shares/' + id, 'GET', undefined, context)
            if (contextAccount !== accountId || account.reloadGeneration.value !== generation) return
            const document: DslLibraryDocument = validateDslDocument(result.document, catalog.value)
            if (await addImportedDocument(accountId, document)) {
                vm.linkImportOpen = false
                vm.shareLink = ''
            }
        })
    }

    function shareEntry(entry: DslLibraryEntry) {
        openContentShare('dsl', {
            title: entry.name, character: entry.character, source: entry.source, description: entry.description,
        })
    }

    function updateOnline() {
        const character = selectedRole()
        const accountGeneration = account.reloadGeneration.value
        vm.onlineStatus = ''
        return run(async id => {
            const config = await cloudApi('config')
            const context = { url: config.url, userId: config.user?.id }
            const result = await cloudApi('v1/dsl-catalog/' + character, 'GET', undefined, context)
            if (contextAccount !== id || accountGeneration !== account.reloadGeneration.value) return
            const latest = await cloudApi('config')
            if (latest.url !== context.url || contextAccount !== id || accountGeneration !== account.reloadGeneration.value) return
            if (result.character !== character || !Number.isInteger(result.revision) || result.revision < 0 || !Array.isArray(result.entries)) {
                throw new Error('DSL 发布版本或条目列表无效')
            }
            const ids = new Set<string>()
            const entries = result.entries.map((entry: { id: string; document: DslLibraryDocument }) => {
                const document = validateDslDocument(entry.document, catalog.value)
                if (document.character !== character || !/^[0-9a-f-]{36}$/.test(entry.id) || ids.has(entry.id)) {
                    throw new Error('DSL 条目标识、角色或重复项无效')
                }
                ids.add(entry.id)
                return { ...document, id: 'online:' + context.url + ':' + entry.id, distribution: { service: context.url, revision: result.revision } }
            })
            const saved = await updateDistributedDslEntries(id, character, context.url, result.revision, entries)
            if (acceptEntries(id, saved) && selectedRole() === character) vm.onlineStatus = '已更新'
        })
    }

    function exportEntry(entry: DslLibraryEntry) {
        return run(async () => {
            const filename = entry.name.replace(/[\\/:*?"<>|]/g, '_') + '.mona-dsl.json'
            await downloadString(exportDslDocument({ ...entry, weapon: editingWeapon(entry) }), 'application/json', filename)
        })
    }

    function selectWeapon(name: string) {
        const current = draft()
        if (name === current.weapon) return
        current.weapon = name
        for (const state of current.generator.states ?? []) delete state.weapon
    }

    function buffLabel(name: string): string { return ta(buffsByName[name].nameLocale) }
    function buffConfigs(name: string) { return buffsByName[name].config }

    function addBuff(name: string) {
        const configs = buffConfigs(name)
        const config = configs.length === 0 ? 'NoConfig'
            : { [name]: Object.fromEntries(configs.map(item => [item.name, deepCopy(item.default)])) }
        draft().buffs.push({ name, config })
    }

    function removeBuff(index: number) {
        draft().buffs.splice(index, 1)
    }

    function updateBuff(index: number, config: Record<string, unknown>) {
        const current = draft()
        const buff = current.buffs[index]
        const before = buffIdentity(buff)
        const next = { name: buff.name, config: { [buff.name]: config } }
        current.buffs[index] = next
        for (const state of current.generator.states ?? []) {
            state.buffs = state.buffs.map(saved => buffIdentity(saved) === before ? deepCopy(next) : saved)
        }
    }

    return vm
}
