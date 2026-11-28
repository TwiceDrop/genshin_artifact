import { h, nextTick, ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import UiCheckbox from '@/components/ui/UiCheckbox.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import backend from '@/store/backend'
import { accountReady, commitUidImport, getImportRevision, useAccountStore } from '@/store/pinia/account'
import { useMiyousheStore } from '@/store/pinia/miyoushe'
import { createArtifactStore, useArtifactStore, watchContent as artifactContent } from '@/store/pinia/artifact'
import { createPresetStore, usePresetStore } from '@/store/pinia/preset'
import { captureImportState, appendImportRecord } from './import-history.mjs'
import { accountGameUid, importDifferences, applyRoleReview, slotLabels } from './uid-import-review.mjs'
import weapons from '@/assets/_gen_weapon'
import sets from '@/assets/_gen_artifact'
import locale from '@/i18n/generated/zh-cn.json'

export const cancelledImport = e => e === 'cancel' || e === 'close'
const copy = value => JSON.parse(JSON.stringify(value))

async function newAccountName(uid, dialogs) {
    const { value } = await dialogs.prompt('本地账户名称', '新建本地账户', {
        inputValue: uid, confirmButtonText: '确认', cancelButtonText: '取消',
        inputValidator: name => !!name?.trim() || '请输入账户名称'
    })
    return value.trim()
}

async function importDestination(accounts, uid, currentUid, origin, dialogs) {
    const current = { id: origin, name: null }
    if (!uid || currentUid === uid) return current
    // Pending writes from the previous account must finish before looking up its UID.
    await backend.allReady()
    const others = accounts.allAccounts.filter(a => a.id !== origin)
    const matches = (await Promise.all(others.map(async account => {
        const data = await backend.getItem('mona_account_miyoushe_' + account.id)
        return data && accountGameUid(data) === uid ? { account, data } : null
    }))).filter(Boolean)
    if (matches.length) {
        let match = matches[0]
        const label = '要刷新的本地账户'
        const selectedAccount = ref(String(match.account.id))
        const selectAccount = value => {
            selectedAccount.value = value
            match = matches.find(m => String(m.account.id) === value)
        }
        const options = matches.map(m => ({ value: String(m.account.id), label: m.account.name }))
        const AccountSelect = () => dialogs === ElMessageBox
            ? h('select', { 'aria-label': label, onChange: e => selectAccount(e.target.value) }, options.map(o => h('option', { value: o.value }, o.label)))
            : h(UiSelect, { label, modelValue: selectedAccount.value, options, 'onUpdate:modelValue': selectAccount })
        const picker = matches.length === 1 ? '本地账户「' + match.account.name + '」已保存 UID ' + uid + '。'
            : h('div', ['多个本地账户已保存 UID ' + uid + '。', h(AccountSelect)])
        try {
            await dialogs.confirm(picker, '已找到相同 UID', { confirmButtonText: '刷新已有账户', cancelButtonText: '重新新建',
                distinguishCancelAndClose: true, closeOnClickModal: false })
            return { id: match.account.id, data: match.data, name: null }
        } catch (e) {
            if (e !== 'cancel') throw e
        }
    } else {
        if (!currentUid) return current
        await dialogs.confirm('当前本地账户已保存 UID ' + currentUid + '。请新建账户来保存 UID ' + uid + '。', '新建本地账户',
            { confirmButtonText: '确定', cancelButtonText: '取消' })
    }
    return { id: origin, name: await newAccountName(uid, dialogs) }
}

async function review(groups, dialogs) {
    const kept = new Set()
    if (!groups.length) return kept
    const message = h('div', { style: { maxHeight: '50vh', overflowY: 'auto' } }, groups.map(group => {
        const labels = new Map(group.roles.map(role => [role.key, role.label]))
        const names = group.roles.map(role => role.label).join('、')
        const details = group.roles.flatMap(role => role.details.length && group.transfers.length
            ? [h('strong', role.label), ...role.details.map(line => h('div', line))]
            : role.details.map(line => h('div', line)))
        const checked = ref(true)
        const selectGroup = value => {
            checked.value = value
            if (value) kept.delete(group)
            else kept.add(group)
        }
        const ReviewCheckbox = () => dialogs === ElMessageBox
            ? h('label', [h('input', { type: 'checkbox', checked: checked.value, onChange: e => selectGroup(e.target.checked) }), ' ' + names])
            : h(UiCheckbox, { 'modelValue': checked.value, 'onUpdate:modelValue': selectGroup }, { default: () => names })
        return h('div', { style: { marginBottom: '10px' } }, [
            h(ReviewCheckbox),
            h('div', { style: { marginLeft: '22px' } }, [
                ...group.transfers.map(({ from, to, slot }) => h('div', slotLabels[slot] + '：' + labels.get(from) + ' → ' + labels.get(to))),
                ...details,
            ]),
        ])
    }))
    try {
        await dialogs.confirm(message, '选择要用最新数据替换的角色', { confirmButtonText: '替换勾选角色',
            cancelButtonText: '全部保留', distinguishCancelAndClose: true, closeOnClickModal: false })
    } catch (e) {
        if (e === 'cancel') return new Set(groups)
        throw e
    }
    return kept
}

export async function bindCookieRole(roles, accountId, checkActive, beforeBinding, dialogs = ElMessageBox) {
    if (!roles?.length) return ''
    await accountReady
    const session = uidImportSession(accountId, checkActive, dialogs)
    session.check()
    const bound = accountGameUid(useMiyousheStore().data.value)
    const match = roles.find(role => String(role.uid) === bound)
    if (match) return bound
    beforeBinding?.()
    let uid = String(roles[0].uid)
    if (roles.length > 1) {
        const value = ref(uid)
        const label = '原神 UID'
        const options = roles.map(role => ({ value: String(role.uid), label: [role.nickname, role.uid].filter(Boolean).join(' · ') }))
        const RoleSelect = () => dialogs === ElMessageBox
            ? h('select', { 'aria-label': label, onChange: e => { value.value = e.target.value } },
                options.map(o => h('option', { value: o.value }, o.label)))
            : h(UiSelect, { label, modelValue: value.value, options, 'onUpdate:modelValue': selected => { value.value = selected } })
        await dialogs.confirm(h(RoleSelect),
            '选择要保存的原神 UID', { confirmButtonText: '确定', cancelButtonText: '取消' })
        uid = value.value
    }
    await session.run(uid, 'Cookie', () => ({}), false)
    return uid
}

export function uidImportSession(accountId, checkActive = () => {}, dialogs = ElMessageBox) {
    let expected = accountId
    const accounts = useAccountStore()
    const check = () => {
        checkActive(expected)
        if (accounts.currentAccountId.value !== expected) throw new Error('本地账户已切换，请重新导入')
    }
    async function run(uid, source, stage, record = true) {
        if (uid && !/^\d{8,10}$/.test(uid)) throw new Error('原神 UID 格式无效')
        await accountReady
        await nextTick()
        check()
        const current = useMiyousheStore()
        const bound = accountGameUid(current.data.value)
        const revision = getImportRevision(), generation = accounts.reloadGeneration.value
        const checkVersion = () => {
            check()
            if (getImportRevision() !== revision || accounts.reloadGeneration.value !== generation) throw new Error('本地数据已变更，请重新导入')
        }
        const accountIndex = JSON.stringify(accounts.allAccounts)
        const target = await importDestination(accounts, uid, bound, expected, dialogs)
        const checkDestination = () => {
            checkVersion()
            if (accountIndex !== JSON.stringify(accounts.allAccounts)) throw new Error('本地账户列表已变更，请重新导入')
        }
        checkDestination()
        const presets = createPresetStore(), inventory = createArtifactStore()
        let old
        if (target.data) {
            const [savedPresets, savedInventory] = await Promise.all(['presets', 'artifacts'].map(type =>
                backend.getItem('mona_account_' + type + '_' + target.id)))
            presets.init(savedPresets)
            inventory.init(savedInventory)
            old = { data: target.data, presets: copy(presets.presets.value), inventory: new Map(copy([...inventory.artifacts.value])) }
        } else if (target.name === null) {
            presets.presets.value = copy(usePresetStore().presets.value)
            inventory.init(copy(artifactContent()))
            old = { data: current.data.value, presets: usePresetStore().presets.value, inventory: useArtifactStore().artifacts.value }
        } else {
            old = { data: { entries: [], snapshots: {} }, presets: {}, inventory: new Map() }
        }
        const data = copy(old.data)
        const before = uid && record && captureImportState(old.data, old.presets, old.inventory)
        const roster = { data: ref(data), selectedUid: ref(uid || bound), linkCharacterPreset(key, presetName) {
            const groups = this.data.value.rosterCharacterPresets ??= {}
            const group = groups[key] ??= { names: [], active: null }
            if (!group.names.includes(presetName)) group.names.push(presetName)
            return group
        } }
        const result = await stage({ roster, inventory, presets })
        checkVersion()
        const next = { data: roster.data.value, presets: presets.presets.value, inventory: inventory.artifacts.value }
        if (uid) {
            const groups = importDifferences(uid, old, next, { weapon: key => locale[weapons[key]?.nameLocale] || key,
                set: key => locale[sets[key]?.nameLocale] || key })
            const kept = await review(groups, dialogs)
            const skipped = applyRoleReview(uid, groups, kept, old, next)
            next.data.boundUid = uid
            next.data.selectedUid = uid
            if (result.imported != null) result.imported -= skipped
            if (record) next.data = appendImportRecord(next.data, before, next.presets, next.inventory, { source, uids: [uid] })
        }
        checkVersion()
        expected = await commitUidImport(target.id, target.name, { miyoushe: next.data, presets: next.presets,
            artifacts: inventory.artifactsByPosition.value }, checkDestination)
        return result
    }
    return { run, check }
}
